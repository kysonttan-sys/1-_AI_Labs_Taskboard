import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/permissions';

const ALLOWED_VISIBILITY = ['private', 'team'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { eventId } = await params;
  const existing = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Only the event owner can edit
  if (existing.userId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, startDate, endDate, allDay, color, visibility } = body;

  if (visibility !== undefined && !ALLOWED_VISIBILITY.includes(visibility)) {
    return NextResponse.json({ error: 'visibility must be private or team' }, { status: 400 });
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(allDay !== undefined && { allDay }),
      ...(color !== undefined && { color }),
      ...(visibility !== undefined && { visibility }),
    },
    include: { user: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { eventId } = await params;
  const existing = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.calendarEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ success: true });
}