import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);

  const events = await prisma.activityEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      actor: { select: { id: true, name: true, color: true } },
      board: { select: { id: true, name: true } },
      card: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({ events });
}
