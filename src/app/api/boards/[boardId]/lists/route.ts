import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const lists = await prisma.list.findMany({
    where: { boardId },
    orderBy: { position: 'asc' },
  });

  return NextResponse.json(lists);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await request.json();
  const { title } = body;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const maxPosition = await prisma.list.aggregate({
    _max: { position: true },
    where: { boardId },
  });

  const list = await prisma.list.create({
    data: {
      title,
      boardId,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  return NextResponse.json(list, { status: 201 });
}