import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const users = await prisma.user.findMany({
    select: { id: true, name: true, color: true, role: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(users);
}