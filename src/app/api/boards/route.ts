import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

const MAX_POSITION_RETRIES = 5;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const boards = await prisma.board.findMany({
    orderBy: { position: 'asc' },
  });
  return NextResponse.json(boards);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const { name, description, icon, projectId } = body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  for (let attempt = 0; attempt < MAX_POSITION_RETRIES; attempt++) {
    const maxPosition = await prisma.board.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    const nextPosition = (maxPosition._max.position ?? -1) + 1;

    try {
      const board = await prisma.board.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          icon: icon || '📋',
          position: nextPosition,
          projectId,
        },
      });
      return NextResponse.json(board, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        continue;
      }
      throw e;
    }
  }

  return NextResponse.json(
    { error: 'Could not allocate a board position. Please retry.' },
    { status: 503 }
  );
}
