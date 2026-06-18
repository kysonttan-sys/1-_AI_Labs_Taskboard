import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { projectId } = await params;
  const boards = await prisma.board.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
    include: {
      lists: { orderBy: { position: 'asc' }, select: { id: true, title: true } },
    },
  });
  return NextResponse.json(boards);
}
