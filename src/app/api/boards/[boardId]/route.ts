import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createActivityEvent } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { boardId } = await params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      lists: {
        orderBy: { position: 'asc' },
        include: {
          cards: {
            orderBy: { position: 'asc' },
            include: {
              assignees: {
                include: { user: true },
              },
              labels: {
                include: { label: true },
              },
              _count: {
                select: { comments: true },
              },
              checklist: true,
              keyResults: { include: { keyResult: true } },
            },
          },
        },
      },
    },
  });

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  return NextResponse.json(board);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { boardId } = await params;
  const body = await request.json();

  const { name, description, icon, position, projectId } = body;

  try {
    const before = await prisma.board.findUnique({ where: { id: boardId } });
    const board = await prisma.board.update({
      where: { id: boardId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(position !== undefined && { position }),
        ...(projectId !== undefined && { projectId }),
      },
    });
    if (name !== undefined && name !== before?.name) {
      await createActivityEvent({
        type: 'board_renamed',
        actorId: session.userId,
        boardId,
        metadata: { from: before?.name, to: board.name },
      });
    }
    return NextResponse.json(board);
  } catch {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { boardId } = await params;

  try {
    await prisma.board.delete({ where: { id: boardId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
}