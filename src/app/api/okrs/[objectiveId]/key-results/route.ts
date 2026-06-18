import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireObjectiveAccess } from '@/lib/auth/permissions';
import { Prisma } from '@/generated/prisma/client';
import { parseIsoDateRange } from '@/lib/okrs/dates';

const MAX_POSITION_RETRIES = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { objectiveId } = await params;

  const { response: objectiveResponse } = await requireObjectiveAccess(session, objectiveId);
  if (objectiveResponse) return objectiveResponse;
  const body = await request.json();
  const { title, target, current, unit, startDate, endDate } = body;

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

  const dateRange = parseIsoDateRange(startDate, endDate);
  if (!dateRange) {
    return NextResponse.json(
      { error: 'startDate and endDate are required and endDate must be on or after startDate' },
      { status: 400 }
    );
  }

  // Compute the next position from current rows, then insert atomically.
  // Two concurrent requests can still race on the @@unique([objectiveId, position])
  // constraint; the second insert becomes P2002. We catch that, recompute, and retry.
  for (let attempt = 0; attempt < MAX_POSITION_RETRIES; attempt++) {
    try {
      const kr = await prisma.$transaction(async (tx) => {
        const maxPosition = await tx.keyResult.aggregate({
          where: { objectiveId },
          _max: { position: true },
        });
        const nextPosition = (maxPosition._max.position ?? -1) + 1;

        return tx.keyResult.create({
          data: {
            title: title.trim(),
            target,
            current: initialCurrent,
            unit: unit || null,
            objectiveId,
            position: nextPosition,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          },
        });
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
