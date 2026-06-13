import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  const cards = await prisma.card.findMany({
    where: { listId },
    orderBy: { position: 'asc' },
  });

  return NextResponse.json(cards);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const body = await request.json();
  const { title } = body;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }

  const maxPosition = await prisma.card.aggregate({
    _max: { position: true },
    where: { listId },
  });

  const card = await prisma.card.create({
    data: {
      title,
      listId,
      boardId: list.boardId,
      position: (maxPosition._max.position ?? -1) + 1,
    },
    include: {
      assignees: {
        include: { user: true },
      },
      labels: { include: { label: true } },
      _count: { select: { comments: true } },
      checklist: true,
    },
  });

  return NextResponse.json(card, { status: 201 });
}