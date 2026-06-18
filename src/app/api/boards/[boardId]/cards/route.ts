import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireBoardAccess } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { boardId } = await params;

  const { response: boardResponse } = await requireBoardAccess(session, boardId);
  if (boardResponse) return boardResponse;

  const cards = await prisma.card.findMany({
    where: { boardId },
    orderBy: { position: 'asc' },
    select: { id: true, title: true, status: true, listId: true, completedAt: true },
  });

  return NextResponse.json(cards);
}
