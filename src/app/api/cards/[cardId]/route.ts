import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createNotification } from '@/lib/notifications';
import { recomputeLinkedKeyResults } from './_recompute';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

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
      },
    });

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (progress !== undefined) updateData.progress = progress;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (listId !== undefined) updateData.listId = listId;
    if (position !== undefined) updateData.position = position;

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

    const card = await prisma.card.update({
      where: { id: cardId },
      data: updateData,
      include: {
        assignees: { include: { user: true } },
        labels: { include: { label: true } },
        checklist: { orderBy: { position: 'asc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        keyResults: { include: { keyResult: true } },
      },
    });

    await recomputeLinkedKeyResults(cardId);

    // Create notifications for relevant changes
    if (before) {
      const session = await getSession();
      const triggerUserId = session?.userId || undefined;
      const beforeAssigneeIds = new Set(before.assignees.map((a) => a.userId));

      // New assignees — notify them

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
      if (status !== undefined && status !== before.status) {
        for (const a of card.assignees) {
          if (a.userId !== triggerUserId) {
            await createNotification({
              type: 'card_status_changed',
              title: 'Card status updated',
              body: `${before.title} → ${status}`,
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

  try {
    await prisma.card.delete({ where: { id: cardId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }
}