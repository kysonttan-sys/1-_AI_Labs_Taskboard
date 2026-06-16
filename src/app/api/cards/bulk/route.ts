import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createActivityEvent } from '@/lib/activity';
import { broadcastToBoard } from '@/lib/socket-server';
import { recomputeLinkedKeyResults } from '../[cardId]/_recompute';

export const dynamic = 'force-dynamic';

type BulkOperation = 'move' | 'archive' | 'delete' | 'assign' | 'label' | 'status';

interface BulkRequest {
  operation: BulkOperation;
  cardIds: string[];
  targetListId?: string;
  assigneeIds?: string[];
  appendAssignees?: boolean;
  labelIds?: string[];
  appendLabels?: boolean;
  status?: string;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body: BulkRequest = await request.json();
  const { operation, cardIds } = body;

  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return NextResponse.json({ error: 'cardIds must be a non-empty array' }, { status: 400 });
  }

  if (!operation || !['move', 'archive', 'delete', 'assign', 'label', 'status'].includes(operation)) {
    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  }

  try {
    const cards = await prisma.card.findMany({
      where: { id: { in: cardIds } },
      select: {
        id: true,
        boardId: true,
        listId: true,
        title: true,
        status: true,
      },
    });

    if (cards.length === 0) {
      return NextResponse.json({ error: 'No cards found' }, { status: 404 });
    }

    const boardId = cards[0].boardId;

    switch (operation) {
      case 'move': {
        if (!body.targetListId) {
          return NextResponse.json({ error: 'targetListId is required' }, { status: 400 });
        }
        const targetList = await prisma.list.findUnique({
          where: { id: body.targetListId },
          select: { id: true, boardId: true },
        });
        if (!targetList || targetList.boardId !== boardId) {
          return NextResponse.json({ error: 'Invalid target list' }, { status: 400 });
        }

        const maxPosition = await prisma.card.aggregate({
          where: { listId: body.targetListId },
          _max: { position: true },
        });
        let nextPosition = (maxPosition._max.position ?? -1) + 1;

        for (const card of cards) {
          await prisma.card.update({
            where: { id: card.id },
            data: { listId: body.targetListId, position: nextPosition++ },
          });
          await createActivityEvent({
            type: 'card_moved',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            listId: body.targetListId,
            metadata: { title: card.title, fromListId: card.listId, toListId: body.targetListId },
          });
          broadcastToBoard(boardId, 'card-updated', { cardId: card.id, userId: session.userId });
        }
        return NextResponse.json({ updated: cards.length });
      }

      case 'archive': {
        const now = new Date();
        for (const card of cards) {
          await prisma.card.update({
            where: { id: card.id },
            data: { status: 'done', completedAt: now, progress: 100 },
          });
          await createActivityEvent({
            type: 'card_updated',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            listId: card.listId,
            metadata: { title: card.title, status: { from: card.status, to: 'done' } },
          });
          await recomputeLinkedKeyResults(card.id);
          broadcastToBoard(boardId, 'card-updated', { cardId: card.id, userId: session.userId });
        }
        return NextResponse.json({ updated: cards.length });
      }

      case 'status': {
        if (!body.status) {
          return NextResponse.json({ error: 'status is required' }, { status: 400 });
        }
        const completedAt = body.status === 'done' ? new Date() : null;
        for (const card of cards) {
          await prisma.card.update({
            where: { id: card.id },
            data: { status: body.status, completedAt },
          });
          await createActivityEvent({
            type: 'card_updated',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            listId: card.listId,
            metadata: { title: card.title, status: { from: card.status, to: body.status } },
          });
          await recomputeLinkedKeyResults(card.id);
          broadcastToBoard(boardId, 'card-updated', { cardId: card.id, userId: session.userId });
        }
        return NextResponse.json({ updated: cards.length });
      }

      case 'assign': {
        if (!body.assigneeIds || !Array.isArray(body.assigneeIds)) {
          return NextResponse.json({ error: 'assigneeIds is required' }, { status: 400 });
        }
        for (const card of cards) {
          await prisma.card.update({
            where: { id: card.id },
            data: {
              assignees: {
                deleteMany: body.appendAssignees ? { userId: { notIn: body.assigneeIds } } : {},
                create: body.assigneeIds.map((userId: string) => ({ userId })),
              },
            },
          });
          await createActivityEvent({
            type: 'card_updated',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            listId: card.listId,
            metadata: { title: card.title, assigneeIds: body.assigneeIds },
          });
          broadcastToBoard(boardId, 'card-updated', { cardId: card.id, userId: session.userId });
        }
        return NextResponse.json({ updated: cards.length });
      }

      case 'label': {
        if (!body.labelIds || !Array.isArray(body.labelIds)) {
          return NextResponse.json({ error: 'labelIds is required' }, { status: 400 });
        }
        for (const card of cards) {
          await prisma.card.update({
            where: { id: card.id },
            data: {
              labels: {
                deleteMany: body.appendLabels ? { labelId: { notIn: body.labelIds } } : {},
                create: body.labelIds.map((labelId: string) => ({ labelId })),
              },
            },
          });
          await createActivityEvent({
            type: 'card_updated',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            listId: card.listId,
            metadata: { title: card.title, labelIds: body.labelIds },
          });
          broadcastToBoard(boardId, 'card-updated', { cardId: card.id, userId: session.userId });
        }
        return NextResponse.json({ updated: cards.length });
      }

      case 'delete': {
        for (const card of cards) {
          await prisma.card.delete({ where: { id: card.id } });
          await createActivityEvent({
            type: 'card_deleted',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            metadata: { title: card.title },
          });
          broadcastToBoard(boardId, 'card-deleted', { cardId: card.id, userId: session.userId });
        }
        return NextResponse.json({ deleted: cards.length });
      }

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Bulk cards] error:', err);
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 });
  }
}
