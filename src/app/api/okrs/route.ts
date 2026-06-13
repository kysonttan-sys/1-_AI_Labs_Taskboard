import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET() {
  const objectives = await prisma.objective.findMany({
    orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
    include: {
      keyResults: { orderBy: { position: 'asc' } },
    },
  });
  return NextResponse.json(objectives);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, startDate, endDate } = body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
  }
  if (description && typeof description === 'string' && description.length > 2000) {
    return NextResponse.json({ error: 'description must be 2000 characters or fewer' }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'startDate and endDate must be valid dates' }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
  }

  const maxPosition = await prisma.objective.aggregate({ _max: { position: true } });

  const objective = await prisma.objective.create({
    data: {
      title: title.trim(),
      description: description || null,
      startDate: start,
      endDate: end,
      position: (maxPosition._max.position ?? -1) + 1,
    },
    include: { keyResults: { orderBy: { position: 'asc' } } },
  });

  return NextResponse.json(objective, { status: 201 });
}
