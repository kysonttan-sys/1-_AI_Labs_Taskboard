import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { Prisma } from '@/generated/prisma/client';

const MAX_POSITION_RETRIES = 5;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const objectives = await prisma.objective.findMany({
    orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
    include: {
      keyResults: { orderBy: { position: 'asc' } },
    },
  });
  return NextResponse.json(objectives);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await request.json();
  const { title, description, startDate, endDate, projectId } = body;

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

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'startDate and endDate must be valid dates' }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
  }

  for (let attempt = 0; attempt < MAX_POSITION_RETRIES; attempt++) {
    const maxPosition = await prisma.objective.aggregate({ _max: { position: true } });
    const nextPosition = (maxPosition._max.position ?? -1) + 1;

    try {
      const objective = await prisma.objective.create({
        data: {
          title: title.trim(),
          description: description || null,
          startDate: start,
          endDate: end,
          position: nextPosition,
          projectId,
        },
        include: { keyResults: { orderBy: { position: 'asc' } } },
      });
      return NextResponse.json(objective, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        continue;
      }
      throw e;
    }
  }

  return NextResponse.json(
    { error: 'Could not allocate a position for the new objective. Please retry.' },
    { status: 503 }
  );
}
