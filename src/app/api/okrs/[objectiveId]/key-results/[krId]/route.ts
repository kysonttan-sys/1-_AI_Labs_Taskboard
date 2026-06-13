import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string; krId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { objectiveId, krId } = await params;
  const body = await request.json();
  const { title, target, current, unit } = body;

  const existing = await prisma.keyResult.findFirst({ where: { id: krId, objectiveId } });
  if (!existing) {
    return NextResponse.json({ error: 'Key result not found' }, { status: 404 });
  }

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
    }
  }
  if (target !== undefined) {
    if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
      return NextResponse.json({ error: 'target must be a positive number' }, { status: 400 });
    }
  }
  if (current !== undefined) {
    if (typeof current !== 'number' || !Number.isFinite(current) || current < 0) {
      return NextResponse.json({ error: 'current must be a non-negative number' }, { status: 400 });
    }
  }
  if (unit !== undefined && unit !== null) {
    if (typeof unit !== 'string' || unit.length > 32) {
      return NextResponse.json({ error: 'unit must be a string up to 32 characters' }, { status: 400 });
    }
  }

  // If either side of the current/target relationship is being updated,
  // validate that current <= target. The PATCH may not include both
  // fields, so resolve the effective target by combining the patch with
  // the existing row.
  const effectiveTarget = target !== undefined ? target : existing.target;
  const effectiveCurrent = current !== undefined ? current : existing.current;
  if (effectiveCurrent > effectiveTarget) {
    return NextResponse.json(
      { error: 'current must not exceed target' },
      { status: 400 }
    );
  }

  const kr = await prisma.keyResult.update({
    where: { id: krId },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(target !== undefined && { target }),
      ...(current !== undefined && { current }),
      ...(unit !== undefined && { unit: unit || null }),
    },
  });

  return NextResponse.json(kr);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string; krId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { objectiveId, krId } = await params;
  const existing = await prisma.keyResult.findFirst({ where: { id: krId, objectiveId } });
  if (!existing) {
    return NextResponse.json({ error: 'Key result not found' }, { status: 404 });
  }
  await prisma.keyResult.delete({ where: { id: krId } });
  return NextResponse.json({ ok: true });
}
