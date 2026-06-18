import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireBoardAccess, requireSession } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { session, response: authResponse } = await requireSession();
  if (authResponse) return authResponse;

  const { boardId } = await params;

  const { response } = await requireBoardAccess(session, boardId);
  if (response) return response;

  const labels = await prisma.label.findMany({
    where: { boardId },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(labels);
}