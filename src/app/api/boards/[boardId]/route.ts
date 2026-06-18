import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireBoardAccess, requireProjectAccess } from '@/lib/auth/permissions';
import { createActivityEvent } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;
  const { boardId } = await params;

  const access = await requireBoardAccess(auth.session, boardId);
  if (access.response) return access.response;

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
              dependsOn: { include: { dependsOnCard: true } },
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
  const auth = await requireSession();
  if (auth.response) return auth.response;
  const { boardId } = await params;

  const access = await requireBoardAccess(auth.session, boardId);
  if (access.response) return access.response;

  const body = await request.json();

  const { name, description, icon, position, projectId } = body;

  if (projectId !== undefined) {
    const projectAccess = await requireProjectAccess(auth.session, projectId);
    if (projectAccess.response) return projectAccess.response;
  }

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
        actorId: auth.session.userId,
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
  const auth = await requireSession();
  if (auth.response) return auth.response;
  const { boardId } = await params;

  const access = await requireBoardAccess(auth.session, boardId);
  if (access.response) return access.response;

  try {
    await prisma.board.delete({ where: { id: boardId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
}
