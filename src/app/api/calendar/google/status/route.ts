import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const token = await prisma.googleCalendarToken.findUnique({
    where: { userId: session.userId },
  });

  return NextResponse.json({ connected: !!token });
}