import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireBoardAccess } from '@/lib/auth/permissions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { boardId } = await params;

  const { response: accessResponse } = await requireBoardAccess(session, boardId);
  if (accessResponse) return accessResponse;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { projectId: true },
  });
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const objectives = await prisma.objective.findMany({
    where: { projectId: board.projectId },
    orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
    include: {
      keyResults: {
        orderBy: { position: 'asc' },
      },
    },
  });

  return NextResponse.json(objectives);
}
