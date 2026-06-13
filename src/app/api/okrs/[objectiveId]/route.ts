import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params;
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: { keyResults: { orderBy: { position: 'asc' } } },
  });
  if (!objective) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }
  return NextResponse.json(objective);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params;
  const body = await request.json();
  const { title, description, startDate, endDate } = body;

  const existing = await prisma.objective.findUnique({ where: { id: objectiveId } });
  if (!existing) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
    }
  }
  if (description !== undefined && description !== null) {
    if (typeof description === 'string' && description.length > 2000) {
      return NextResponse.json({ error: 'description must be 2000 characters or fewer' }, { status: 400 });
    }
  }

  const newStart = startDate ? new Date(startDate) : existing.startDate;
  const newEnd = endDate ? new Date(endDate) : existing.endDate;
  if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
    return NextResponse.json({ error: 'startDate and endDate must be valid dates' }, { status: 400 });
  }
  if (newEnd <= newStart) {
    return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
  }

  const objective = await prisma.objective.update({
    where: { id: objectiveId },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description || null }),
      ...(startDate && { startDate: newStart }),
      ...(endDate && { endDate: newEnd }),
    },
    include: { keyResults: { orderBy: { position: 'asc' } } },
  });

  return NextResponse.json(objective);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params;
  const existing = await prisma.objective.findUnique({ where: { id: objectiveId } });
  if (!existing) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }
  await prisma.objective.delete({ where: { id: objectiveId } });
  return NextResponse.json({ ok: true });
}
