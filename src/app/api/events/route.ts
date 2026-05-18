import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');

  const start = startStr ? new Date(startStr) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endStr ? new Date(endStr) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  const events = await prisma.calendarEvent.findMany({
    where: {
      AND: [
        {
          OR: [
            { userId: session.userId },
            { visibility: 'team', userId: { not: session.userId } },
          ],
        },
        {
          OR: [
            { startDate: { gte: start, lte: end } },
            { endDate: { gte: start } },
          ],
        },
      ],
    },
    include: { user: { select: { id: true, name: true, color: true } } },
    orderBy: { startDate: 'asc' },
  });

  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, startDate, endDate, allDay, color, visibility } = body;

  if (!title || !startDate) {
    return NextResponse.json({ error: 'title and startDate are required' }, { status: 400 });
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title,
      description: description || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      allDay: allDay ?? false,
      color: color || '#10b981',
      visibility: visibility || 'private',
      userId: session.userId,
    },
    include: { user: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json(event, { status: 201 });
}