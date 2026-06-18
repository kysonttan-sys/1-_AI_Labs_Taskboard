import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireListAccess } from '@/lib/auth/permissions';
import { createActivityEvent } from '@/lib/activity';
import { isCompletedStatus } from '@/lib/board/status';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { list: beforeList, response: listResponse } = await requireListAccess(session, listId);
  if (listResponse) return listResponse;

  const body = await request.json();
  const { title, position } = body;

  try {
    const list = await prisma.list.update({
      where: { id: listId },
      data: {
        ...(title !== undefined && { title }),
        ...(position !== undefined && { position }),
      },
    });
    if (title !== undefined && title !== beforeList.title) {
      // With Option A, card status follows the list title, so keep cards in sync.
      const isCompleted = isCompletedStatus(title);
      await prisma.card.updateMany({
        where: { listId },
        data: {
          status: title,
          completedAt: isCompleted ? new Date() : null,
          ...(isCompleted ? { progress: 100 } : {}),
        },
      });

      await createActivityEvent({
        type: 'list_renamed',
        actorId: session.userId,
        boardId: list.boardId,
        listId,
        metadata: { from: beforeList.title, to: list.title },
      });
    }
    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { list, response: listResponse } = await requireListAccess(session, listId);
  if (listResponse) return listResponse;

  try {
    await prisma.list.delete({ where: { id: listId } });
    await createActivityEvent({
      type: 'list_deleted',
      actorId: session.userId,
      boardId: list.boardId,
      listId,
      metadata: { title: list.title },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }
}
