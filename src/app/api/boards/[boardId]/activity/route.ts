import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireBoardAccess, requireSession } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { boardId } = await params;

  const { response: accessResponse } = await requireBoardAccess(session, boardId);
  if (accessResponse) return accessResponse;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);
  const cursor = searchParams.get('cursor');

  const events = await prisma.activityEvent.findMany({
    where: { boardId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    include: { actor: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json({
    events,
    nextCursor: events.length === limit ? events[events.length - 1]?.id : null,
  });
}
