import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
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
  if (unit !== undefined && unit !== null && (typeof unit !== 'string' || unit.length > 32)) {
    return NextResponse.json({ error: 'unit must be a string up to 32 characters' }, { status: 400 });
  }

  const objective = await prisma.objective.findUnique({ where: { id: objectiveId } });
  if (!objective) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }

  const maxPosition = await prisma.keyResult.aggregate({
    where: { objectiveId },
    _max: { position: true },
  });

  const kr = await prisma.keyResult.create({
    data: {
      title: title.trim(),
      target,
      current: current ?? 0,
      unit: unit || null,
      objectiveId,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  return NextResponse.json(kr, { status: 201 });
}
