import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { objectiveId } = await params;
  const body = await request.json();
  const { krIds } = body;

  if (!Array.isArray(krIds) || krIds.length === 0 || !krIds.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'krIds must be a non-empty string array' }, { status: 400 });
  }

  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: { keyResults: true },
  });
  if (!objective) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }

  const existingIds = new Set(objective.keyResults.map((kr) => kr.id));
  if (krIds.length !== existingIds.size || !krIds.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: 'krIds must contain exactly the existing key result ids' }, { status: 400 });
  }

  // Update positions in a transaction
  await prisma.$transaction(
    krIds.map((id, index) =>
      prisma.keyResult.update({
        where: { id },
        data: { position: index },
      })
    )
  );

  const updated = await prisma.keyResult.findMany({
    where: { objectiveId },
    orderBy: { position: 'asc' },
  });

  return NextResponse.json(updated);
}
