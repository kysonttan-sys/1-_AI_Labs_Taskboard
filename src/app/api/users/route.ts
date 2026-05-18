import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, color: true, role: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(users);
}