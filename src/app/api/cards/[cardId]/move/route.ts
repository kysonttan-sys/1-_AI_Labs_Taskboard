import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireCardAccess } from '@/lib/auth/permissions';
import { createNotification } from '@/lib/notifications';
import { createActivityEvent } from '@/lib/activity';
import { broadcastToBoard } from '@/lib/socket-server';
import { recomputeLinkedKeyResults } from '../_recompute';
import { isCompletedStatus } from '@/lib/board/status';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const body = await request.json();
  const { targetListId, targetPosition } = body;

  if (!targetListId || targetPosition === undefined) {
    return NextResponse.json(
      { error: 'targetListId and targetPosition are required' },
      { status: 400 }
    );
  }

  const auth = await requireSession();
  if (auth.response) return auth.response;

  const cardAccess = await requireCardAccess(auth.session, cardId);
  if (cardAccess.response) return cardAccess.response;
  const authCard = cardAccess.card;

  const targetList = await prisma.list.findUnique({
    where: { id: targetListId },
    select: { id: true, boardId: true, title: true },
  });
  if (!targetList) {
    return NextResponse.json({ error: 'Target list not found' }, { status: 404 });
  }
  if (targetList.boardId !== authCard.boardId) {
    return NextResponse.json(
      { error: 'Target list must belong to the same board' },
      { status: 400 }
    );
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      listId: true,
      position: true,
      assignees: { select: { userId: true } },
      boardId: true,
      title: true,
      list: { select: { title: true } },
    },
  });
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const sourceListId = card.listId;
  const sourceListTitle = card.list?.title ?? '';
  const isSameList = sourceListId === targetListId;
  const targetStatus = !isSameList ? targetList.title : null;

  await prisma.$transaction(async (tx) => {
    // Remove the card from its current position by shifting cards after it down
    await tx.card.updateMany({
      where: {
        listId: sourceListId,
        position: { gt: card.position },
      },
      data: { position: { decrement: 1 } },
    });

    if (isSameList) {
      // When moving within the same list, adjust for the removal we just did
      // If moving to a later position, subtract 1 since we removed the card
      const adjustedTarget = targetPosition > card.position ? targetPosition - 1 : targetPosition;

      // Shift cards at/after the target position up
      await tx.card.updateMany({
        where: {
          listId: targetListId,
          position: { gte: adjustedTarget },
          id: { not: cardId },
        },
        data: { position: { increment: 1 } },
      });

      await tx.card.update({
        where: { id: cardId },
        data: { position: adjustedTarget },
      });
    } else {
      // Moving to a different list: shift cards at/after target position up
      await tx.card.updateMany({
        where: {
          listId: targetListId,
          position: { gte: targetPosition },
        },
        data: { position: { increment: 1 } },
      });

      await tx.card.update({
        where: { id: cardId },
        data: {
          listId: targetListId,
          boardId: targetList.boardId,
          position: targetPosition,
          ...(targetStatus
            ? {
                status: targetStatus,
                completedAt: isCompletedStatus(targetStatus) ? new Date() : null,
              }
            : {}),
        },
      });
    }

    // Reindex positions for both lists to ensure no gaps
    const listsToReindex = isSameList
      ? [sourceListId]
      : [sourceListId, targetListId];

    for (const listId of listsToReindex) {
      const cards = await tx.card.findMany({
        where: { listId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });

      for (let i = 0; i < cards.length; i++) {
        await tx.card.update({
          where: { id: cards[i].id },
          data: { position: i },
        });
      }
    }
  });

  await recomputeLinkedKeyResults(cardId);

  const updatedCard = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      assignees: {
        include: { user: true },
      },
      labels: { include: { label: true } },
      checklist: { orderBy: { position: 'asc' } },
    },
  });

  const triggerUserId = auth.session.userId;
  await createActivityEvent({
    type: 'card_moved',
    actorId: triggerUserId,
    boardId: targetList.boardId,
    cardId,
    listId: targetListId,
    metadata: {
      fromListId: sourceListId,
      toListId: targetListId,
      fromListTitle: sourceListTitle,
      toListTitle: targetList.title,
      title: card.title,
      ...(targetStatus ? { status: targetStatus } : {}),
    },
  });

  broadcastToBoard(targetList.boardId, 'card-moved', { cardId, userId: triggerUserId });

  // Notify assignees if card moved to a different list
  if (!isSameList && card.assignees.length > 0) {
    for (const a of card.assignees) {
      if (a.userId !== triggerUserId) {
        await createNotification({
          type: 'card_moved',
          title: 'Card moved',
          body: `${card.title} → ${targetList.title || 'list'}`,
          userId: a.userId,
          cardId: card.id,
          boardId: targetList.boardId,
          triggerUserId,
        });
      }
    }
  }

  return NextResponse.json(updatedCard);
}
