import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { Prisma } from '@/generated/prisma/client';

const MAX_POSITION_RETRIES = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { objectiveId } = await params;
  const body = await request.json();
  const { title, target, current, unit } = body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
  }
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
    return NextResponse.json({ error: 'target must be a positive number' }, { status: 400 });
  }
  if (current !== undefined && (typeof current !== 'number' || !Number.isFinite(current) || current < 0)) {
    return NextResponse.json({ error: 'current must be a non-negative number' }, { status: 400 });
  }
  const initialCurrent = current ?? 0;
  if (initialCurrent > target) {
    return NextResponse.json(
      { error: 'current must not exceed target' },
      { status: 400 }
    );
  }
  if (unit !== undefined && unit !== null && (typeof unit !== 'string' || unit.length > 32)) {
    return NextResponse.json({ error: 'unit must be a string up to 32 characters' }, { status: 400 });
  }

  const objective = await prisma.objective.findUnique({ where: { id: objectiveId } });
  if (!objective) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }

  // Compute the next position from current rows, then insert. Two concurrent
  // requests can both read the same MAX(position) and pick the same value —
  // the @@unique([objectiveId, position]) constraint turns the second insert
  // into P2002. We catch that, recompute, and retry.
  for (let attempt = 0; attempt < MAX_POSITION_RETRIES; attempt++) {
    const maxPosition = await prisma.keyResult.aggregate({
      where: { objectiveId },
      _max: { position: true },
    });
    const nextPosition = (maxPosition._max.position ?? -1) + 1;

    try {
      const kr = await prisma.keyResult.create({
        data: {
          title: title.trim(),
          target,
          current: initialCurrent,
          unit: unit || null,
          objectiveId,
          position: nextPosition,
        },
      });
      return NextResponse.json(kr, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        continue; // someone else grabbed this position — try again
      }
      throw e;
    }
  }

  return NextResponse.json(
    { error: 'Could not allocate a position for the new key result. Please retry.' },
    { status: 503 }
  );
}
