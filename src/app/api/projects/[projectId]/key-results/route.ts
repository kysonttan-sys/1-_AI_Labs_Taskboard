import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const objectives = await prisma.objective.findMany({
    where: { projectId },
    orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
    include: {
      keyResults: {
        orderBy: { position: 'asc' },
      },
    },
  });

  return NextResponse.json(objectives);
}
