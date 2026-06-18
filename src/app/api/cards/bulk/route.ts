import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireBoardAccess, requireListAccess } from '@/lib/auth/permissions';
import { createActivityEvent } from '@/lib/activity';
import { broadcastToBoard } from '@/lib/socket-server';
import { recomputeLinkedKeyResults } from '../[cardId]/_recompute';
import { isCompletedStatus } from '@/lib/board/status';

export const dynamic = 'force-dynamic';

async function reindexListPositions(listId: string) {
  const cardsInList = await prisma.card.findMany({
    where: { listId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });
  for (let i = 0; i < cardsInList.length; i++) {
    await prisma.card.update({
      where: { id: cardsInList[i].id },
      data: { position: i },
    });
  }
}

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
  const { session, response } = await requireSession();
  if (response) return response;

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
        position: true,
      },
    });

    if (cards.length === 0) {
      return NextResponse.json({ error: 'No cards found' }, { status: 404 });
    }

    const boardId = cards[0].boardId;
    const boardAuth = await requireBoardAccess(session, boardId);
    if (boardAuth.response) return boardAuth.response;

    switch (operation) {
      case 'move': {
        if (!body.targetListId) {
          return NextResponse.json({ error: 'targetListId is required' }, { status: 400 });
        }
        const targetListId = body.targetListId;
        const listAuth = await requireListAccess(session, targetListId);
        if (listAuth.response) return listAuth.response;
        if (listAuth.list.boardId !== boardId) {
          return NextResponse.json({ error: 'Invalid target list' }, { status: 400 });
        }
        const targetListTitle = listAuth.list.title;
        const completedAt = isCompletedStatus(targetListTitle) ? new Date() : null;

        const maxPosition = await prisma.card.aggregate({
          where: { listId: targetListId },
          _max: { position: true },
        });
        const nextPosition = (maxPosition._max.position ?? -1) + 1;

        const affectedListIds = new Set<string>([targetListId]);
        for (const card of cards) affectedListIds.add(card.listId);

        const updated = await prisma.$transaction(
          cards.map((card, index) =>
            prisma.card.update({
              where: { id: card.id },
              data: {
                listId: targetListId,
                position: nextPosition + index,
                status: targetListTitle,
                completedAt,
              },
            })
          )
        );

        for (const listId of Array.from(affectedListIds)) {
          await reindexListPositions(listId);
        }

        for (const card of cards) {
          await createActivityEvent({
            type: 'card_moved',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            listId: targetListId,
            metadata: { title: card.title, fromListId: card.listId, toListId: targetListId },
          });
          broadcastToBoard(boardId, 'card-updated', { cardId: card.id, userId: session.userId });
        }
        for (const card of cards) {
          await recomputeLinkedKeyResults(card.id);
        }
        return NextResponse.json({ updated: updated.length });
      }

      case 'archive': {
        const now = new Date();
        const lists = await prisma.list.findMany({
          where: { boardId },
          select: { id: true, title: true },
        });
        const doneList = lists.find((l) => isCompletedStatus(l.title));
        const archiveStatus = doneList?.title ?? 'Done';

        let updated: { id: string }[] = [];
        if (doneList) {
          const affectedListIds = new Set<string>([doneList.id]);
          for (const card of cards) affectedListIds.add(card.listId);
          const maxPosition = await prisma.card.aggregate({
            where: { listId: doneList.id },
            _max: { position: true },
          });
          let nextPosition = (maxPosition._max.position ?? -1) + 1;

          updated = await prisma.$transaction(
            cards.map((card) =>
              prisma.card.update({
                where: { id: card.id },
                data: {
                  listId: doneList.id,
                  position: nextPosition++,
                  status: archiveStatus,
                  completedAt: now,
                  progress: 100,
                },
              })
            )
          );

          for (const listId of Array.from(affectedListIds)) {
            await reindexListPositions(listId);
          }
        } else {
          updated = await prisma.$transaction(
            cards.map((card) =>
              prisma.card.update({
                where: { id: card.id },
                data: { status: archiveStatus, completedAt: now, progress: 100 },
              })
            )
          );
        }

        for (const card of cards) {
          await createActivityEvent({
            type: doneList ? 'card_moved' : 'card_updated',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            listId: doneList?.id ?? card.listId,
            metadata: { title: card.title, status: { from: card.status, to: archiveStatus } },
          });
          broadcastToBoard(boardId, 'card-updated', { cardId: card.id, userId: session.userId });
        }
        for (const card of cards) {
          await recomputeLinkedKeyResults(card.id);
        }
        return NextResponse.json({ updated: updated.length });
      }

      case 'status': {
        if (!body.status) {
          return NextResponse.json({ error: 'status is required' }, { status: 400 });
        }
        const newStatus = body.status;
        const matchingList = await prisma.list.findFirst({
          where: {
            boardId,
            title: { equals: newStatus, mode: 'insensitive' },
          },
          select: { id: true, title: true },
        });
        const completedAt = isCompletedStatus(newStatus) ? new Date() : null;

        let updated: { id: string }[] = [];
        if (matchingList) {
          const affectedListIds = new Set<string>([matchingList.id]);
          for (const card of cards) affectedListIds.add(card.listId);
          const maxPosition = await prisma.card.aggregate({
            where: { listId: matchingList.id },
            _max: { position: true },
          });
          let nextPosition = (maxPosition._max.position ?? -1) + 1;

          updated = await prisma.$transaction(
            cards.map((card) =>
              prisma.card.update({
                where: { id: card.id },
                data: {
                  listId: matchingList.id,
                  position: nextPosition++,
                  status: matchingList.title,
                  completedAt,
                },
              })
            )
          );

          for (const listId of Array.from(affectedListIds)) {
            await reindexListPositions(listId);
          }
        } else {
          updated = await prisma.$transaction(
            cards.map((card) =>
              prisma.card.update({
                where: { id: card.id },
                data: { status: newStatus, completedAt },
              })
            )
          );
        }

        for (const card of cards) {
          await createActivityEvent({
            type: matchingList ? 'card_moved' : 'card_updated',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            listId: matchingList?.id ?? card.listId,
            metadata: { title: card.title, status: { from: card.status, to: newStatus } },
          });
          broadcastToBoard(boardId, 'card-updated', { cardId: card.id, userId: session.userId });
        }
        for (const card of cards) {
          await recomputeLinkedKeyResults(card.id);
        }
        return NextResponse.json({ updated: updated.length });
      }

      case 'assign': {
        if (!body.assigneeIds || !Array.isArray(body.assigneeIds)) {
          return NextResponse.json({ error: 'assigneeIds is required' }, { status: 400 });
        }
        const assigneeIds = body.assigneeIds;
        const updated = await prisma.$transaction(
          cards.map((card) =>
            prisma.card.update({
              where: { id: card.id },
              data: {
                assignees: {
                  deleteMany: body.appendAssignees ? { userId: { notIn: assigneeIds } } : {},
                  create: assigneeIds.map((userId: string) => ({ userId })),
                },
              },
            })
          )
        );

        for (const card of cards) {
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
        return NextResponse.json({ updated: updated.length });
      }

      case 'label': {
        if (!body.labelIds || !Array.isArray(body.labelIds)) {
          return NextResponse.json({ error: 'labelIds is required' }, { status: 400 });
        }
        const labelIds = body.labelIds;
        const updated = await prisma.$transaction(
          cards.map((card) =>
            prisma.card.update({
              where: { id: card.id },
              data: {
                labels: {
                  deleteMany: body.appendLabels ? { labelId: { notIn: labelIds } } : {},
                  create: labelIds.map((labelId: string) => ({ labelId })),
                },
              },
            })
          )
        );

        for (const card of cards) {
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
        return NextResponse.json({ updated: updated.length });
      }

      case 'delete': {
        const deleted = await prisma.$transaction(
          cards.map((card) => prisma.card.delete({ where: { id: card.id } }))
        );

        for (const card of cards) {
          await createActivityEvent({
            type: 'card_deleted',
            actorId: session.userId,
            boardId,
            cardId: card.id,
            metadata: { title: card.title },
          });
          broadcastToBoard(boardId, 'card-deleted', { cardId: card.id, userId: session.userId });
        }
        return NextResponse.json({ deleted: deleted.length });
      }

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Bulk cards] error:', err);
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 });
  }
}
