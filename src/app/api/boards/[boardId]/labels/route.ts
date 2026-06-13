import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const labels = await prisma.label.findMany({
    where: { boardId },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(labels);
}