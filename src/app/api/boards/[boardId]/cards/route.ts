import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const cards = await prisma.card.findMany({
    where: { boardId },
    orderBy: { position: 'asc' },
    select: { id: true, title: true, status: true, listId: true, completedAt: true },
  });

  return NextResponse.json(cards);
}
