import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createNotification } from '@/lib/notifications';
import { createActivityEvent } from '@/lib/activity';

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

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true, listId: true, position: true, assignees: { select: { userId: true } }, boardId: true, title: true },
  });
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const sourceListId = card.listId;
  const isSameList = sourceListId === targetListId;

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
        data: { listId: targetListId, position: targetPosition },
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

  // Activity event
  await createActivityEvent({
    type: 'card_moved',
    actorId: (await getSession())?.userId,
    boardId: card.boardId,
    cardId,
    listId: targetListId,
    metadata: { fromListId: sourceListId, toListId: targetListId, title: card.title },
  });

  // Notify assignees if card moved to a different list
  if (!isSameList && card.assignees.length > 0) {
    const session = await getSession();
    const triggerUserId = session?.userId || undefined;

    for (const a of card.assignees) {
      if (a.userId !== triggerUserId) {
        const targetList = await prisma.list.findUnique({
          where: { id: targetListId },
          select: { title: true },
        });
        await createNotification({
          type: 'card_moved',
          title: 'Card moved',
          body: `${card.title} → ${targetList?.title || 'list'}`,
          userId: a.userId,
          cardId: card.id,
          boardId: card.boardId,
          triggerUserId,
        });
      }
    }
  }

  return NextResponse.json(updatedCard);
}