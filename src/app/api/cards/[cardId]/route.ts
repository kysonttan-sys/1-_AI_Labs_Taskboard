import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireCardAccess } from '@/lib/auth/permissions';
import { createNotification } from '@/lib/notifications';
import { createActivityEvent } from '@/lib/activity';
import { broadcastToBoard } from '@/lib/socket-server';
import { recomputeLinkedKeyResults } from './_recompute';
import { isCompletedStatus } from '@/lib/board/status';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { response: accessResponse } = await requireCardAccess(session, cardId);
  if (accessResponse) return accessResponse;

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      assignees: {
        include: { user: true },
      },
      labels: {
        include: { label: true },
      },
      checklist: {
        orderBy: { position: 'asc' },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: true },
      },
      dependsOn: {
        include: { dependsOnCard: true },
      },
      dependents: {
        include: { dependentCard: true },
      },
      keyResults: {
        include: { keyResult: true },
      },
    },
  });

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  return NextResponse.json(card);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { response: accessResponse } = await requireCardAccess(session, cardId);
  if (accessResponse) return accessResponse;

  const body = await request.json();

  const {
    title,
    description,
    status,
    priority,
    progress,
    startDate,
    dueDate,
    assigneeIds,
    listId,
    position,
    labelIds,
  } = body;

  try {
    // Fetch before-state for notification diffing
    const before = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        assignees: { select: { userId: true } },
        status: true,
        priority: true,
        boardId: true,
        title: true,
        description: true,
        progress: true,
        listId: true,
        position: true,
      },
    });

    if (!before) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Cross-board/cross-project prevention for listId and labelIds
    if (listId !== undefined) {
      const list = await prisma.list.findUnique({
        where: { id: listId },
        select: { boardId: true },
      });
      if (!list || list.boardId !== before.boardId) {
        return NextResponse.json({ error: "listId does not belong to this card's board" }, { status: 400 });
      }
    }

    if (labelIds !== undefined) {
      const labels = await prisma.label.findMany({
        where: { id: { in: labelIds as string[] } },
        select: { id: true, boardId: true },
      });
      const allExist = labels.length === (labelIds as string[]).length;
      const allSameBoard = labels.every((label) => label.boardId === before.boardId);
      if (!allExist || !allSameBoard) {
        return NextResponse.json({ error: "labelIds must belong to this card's board" }, { status: 400 });
      }
    }

    let resolvedListId: string | undefined = listId;
    let resolvedStatus: string | undefined = status;

    if (resolvedListId !== undefined && resolvedListId !== before.listId) {
      const targetList = await prisma.list.findUnique({
        where: { id: resolvedListId },
        select: { title: true, boardId: true },
      });
      if (!targetList || targetList.boardId !== before.boardId) {
        return NextResponse.json({ error: "listId does not belong to this card's board" }, { status: 400 });
      }
      resolvedStatus = targetList.title;
    } else if (status !== undefined && status !== before.status && resolvedListId === undefined) {
      // If a manual status change matches another list title, move the card there.
      const matchingList = await prisma.list.findFirst({
        where: {
          boardId: before.boardId,
          title: { equals: status, mode: 'insensitive' },
        },
        select: { id: true, title: true },
      });
      if (matchingList) {
        resolvedListId = matchingList.id;
        resolvedStatus = matchingList.title;
      }
    }

    const shouldMoveList = resolvedListId !== undefined && resolvedListId !== before.listId;
    const finalStatus = resolvedStatus ?? before.status;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (resolvedStatus !== undefined) updateData.status = resolvedStatus;
    if (priority !== undefined) updateData.priority = priority;
    if (progress !== undefined) updateData.progress = progress;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (resolvedListId !== undefined) updateData.listId = resolvedListId;
    if (resolvedStatus !== undefined) {
      updateData.completedAt = isCompletedStatus(finalStatus) ? new Date() : null;
    }
    if (!shouldMoveList && position !== undefined) updateData.position = position;

    // Handle assignee synchronization
    if (assigneeIds !== undefined) {
      updateData.assignees = {
        deleteMany: {},
        create: (assigneeIds as string[]).map((userId: string) => ({ userId })),
      };
    }

    // Handle label synchronization
    if (labelIds !== undefined) {
      updateData.labels = {
        deleteMany: {},
        create: (labelIds as string[]).map((labelId: string) => ({ labelId })),
      };
    }

    let card;
    if (shouldMoveList) {
      card = await prisma.$transaction(async (tx) => {
        // Shift cards after the old position down to fill the gap
        await tx.card.updateMany({
          where: { listId: before.listId, position: { gt: before.position } },
          data: { position: { decrement: 1 } },
        });

        // Append the card to the end of the target list
        const maxAgg = await tx.card.aggregate({
          where: { listId: resolvedListId },
          _max: { position: true },
        });
        const nextPos = (maxAgg._max.position ?? -1) + 1;

        const updated = await tx.card.update({
          where: { id: cardId },
          data: { ...updateData, position: nextPos },
          include: {
            assignees: { include: { user: true } },
            labels: { include: { label: true } },
            checklist: { orderBy: { position: 'asc' } },
            comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
            keyResults: { include: { keyResult: true } },
            dependsOn: { include: { dependsOnCard: true } },
          },
        });

        // Reindex both source and target lists so positions stay gap-free
        for (const lid of [before.listId, resolvedListId!]) {
          const cardsInList = await tx.card.findMany({
            where: { listId: lid },
            orderBy: { position: 'asc' },
            select: { id: true },
          });
          for (let i = 0; i < cardsInList.length; i++) {
            await tx.card.update({
              where: { id: cardsInList[i].id },
              data: { position: i },
            });
          }
        }

        return updated;
      });
    } else {
      card = await prisma.card.update({
        where: { id: cardId },
        data: updateData,
        include: {
          assignees: { include: { user: true } },
          labels: { include: { label: true } },
          checklist: { orderBy: { position: 'asc' } },
          comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
          keyResults: { include: { keyResult: true } },
          dependsOn: { include: { dependsOnCard: true } },
        },
      });
    }

    await recomputeLinkedKeyResults(cardId);

    // Create notifications for relevant changes
    if (before) {
      const triggerUserId = session.userId;
      const beforeAssigneeIds = new Set(before.assignees.map((a) => a.userId));

      // New assignees — notify them
      if (assigneeIds !== undefined) {
        for (const userId of assigneeIds as string[]) {
          if (!beforeAssigneeIds.has(userId) && userId !== triggerUserId) {
            await createNotification({
              type: 'card_assigned',
              title: 'Card assigned to you',
              body: before.title,
              userId,
              cardId: card.id,
              boardId: before.boardId,
              triggerUserId,
            });
          }
        }
      }

      // Status changed — notify all assignees
      if (resolvedStatus !== undefined && finalStatus !== before.status) {
        for (const a of card.assignees) {
          if (a.userId !== triggerUserId) {
            await createNotification({
              type: 'card_status_changed',
              title: 'Card status updated',
              body: `${before.title} → ${finalStatus}`,
              userId: a.userId,
              cardId: card.id,
              boardId: before.boardId,
              triggerUserId,
            });
          }
        }
      }

      // Priority changed — notify all assignees
      if (priority !== undefined && priority !== before.priority) {
        for (const a of card.assignees) {
          if (a.userId !== triggerUserId) {
            await createNotification({
              type: 'card_priority_changed',
              title: 'Card priority updated',
              body: `${before.title} → ${priority}`,
              userId: a.userId,
              cardId: card.id,
              boardId: before.boardId,
              triggerUserId,
            });
          }
        }
      }

      // Activity event
      const metadata: Record<string, unknown> = {};
      if (title !== undefined && title !== before.title) metadata.title = { from: before.title, to: title };
      if (description !== undefined && description !== before.description) metadata.description = true;
      if (resolvedStatus !== undefined && finalStatus !== before.status) metadata.status = { from: before.status, to: finalStatus };
      if (priority !== undefined && priority !== before.priority) metadata.priority = { from: before.priority, to: priority };
      if (progress !== undefined && progress !== before.progress) metadata.progress = { from: before.progress, to: progress };
      if (startDate !== undefined) metadata.startDate = true;
      if (dueDate !== undefined) metadata.dueDate = true;
      if (resolvedListId !== undefined && resolvedListId !== before.listId) metadata.listId = { from: before.listId, to: resolvedListId };

      if (Object.keys(metadata).length > 0) {
        await createActivityEvent({
          type: resolvedListId !== undefined && resolvedListId !== before.listId ? 'card_moved' : 'card_updated',
          actorId: triggerUserId,
          boardId: before.boardId,
          cardId: card.id,
          listId: card.listId,
          metadata: { ...metadata, title: card.title },
        });
      }

      broadcastToBoard(before.boardId, 'card-updated', { cardId: card.id, userId: triggerUserId });
    }

    return NextResponse.json(card);
  } catch {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { response: accessResponse } = await requireCardAccess(session, cardId);
  if (accessResponse) return accessResponse;

  try {
    const before = await prisma.card.findUnique({
      where: { id: cardId },
      select: { boardId: true, title: true },
    });
    await prisma.card.delete({ where: { id: cardId } });
    if (before) {
      await createActivityEvent({
        type: 'card_deleted',
        actorId: session.userId,
        boardId: before.boardId,
        cardId,
        metadata: { title: before.title },
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }
}