import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  await prisma.googleCalendarToken.deleteMany({
    where: { userId: session.userId },
  });

  return NextResponse.json({ success: true });
}