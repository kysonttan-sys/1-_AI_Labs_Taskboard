import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createActivityEvent } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const body = await request.json();
  const { title, position } = body;

  try {
    const before = await prisma.list.findUnique({ where: { id: listId } });
    const list = await prisma.list.update({
      where: { id: listId },
      data: {
        ...(title !== undefined && { title }),
        ...(position !== undefined && { position }),
      },
    });
    if (title !== undefined && title !== before?.title) {
      const session = await getSession();
      await createActivityEvent({
        type: 'list_renamed',
        actorId: session?.userId,
        boardId: list.boardId,
        listId,
        metadata: { from: before?.title, to: list.title },
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

  try {
    const session = await getSession();
    const list = await prisma.list.findUnique({ where: { id: listId } });
    await prisma.list.delete({ where: { id: listId } });
    if (list) {
      await createActivityEvent({
        type: 'list_deleted',
        actorId: session?.userId,
        boardId: list.boardId,
        listId,
        metadata: { title: list.title },
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }
}