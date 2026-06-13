import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const boards = await prisma.board.findMany({
    orderBy: { position: 'asc' },
  });
  return NextResponse.json(boards);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, icon } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const maxPosition = await prisma.board.aggregate({
    _max: { position: true },
  });

  const board = await prisma.board.create({
    data: {
      name,
      description,
      icon,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  return NextResponse.json(board, { status: 201 });
}