import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireObjectiveAccess } from '@/lib/auth/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { objectiveId } = await params;
  const body = await request.json();
  const { krIds } = body;

  if (!Array.isArray(krIds) || krIds.length === 0 || !krIds.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'krIds must be a non-empty string array' }, { status: 400 });
  }

  const { response: accessResponse } = await requireObjectiveAccess(session, objectiveId);
  if (accessResponse) return accessResponse;

  const keyResults = await prisma.keyResult.findMany({
    where: { objectiveId },
    select: { id: true },
  });

  const existingIds = new Set(keyResults.map((kr) => kr.id));
  if (krIds.length !== existingIds.size || !krIds.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: 'krIds must contain exactly the existing key result ids' }, { status: 400 });
  }

  // Update positions in a transaction. Because KeyResult has a unique
  // constraint on (objectiveId, position), we must first move every row
  // to a temporary negative position so that no two rows share a final
  // position during the swap. Then we assign the final positions.
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < krIds.length; i++) {
      await tx.keyResult.update({
        where: { id: krIds[i] },
        data: { position: -1 - i },
      });
    }
    for (let i = 0; i < krIds.length; i++) {
      await tx.keyResult.update({
        where: { id: krIds[i] },
        data: { position: i },
      });
    }
  });

  const updated = await prisma.keyResult.findMany({
    where: { objectiveId },
    orderBy: { position: 'asc' },
  });

  return NextResponse.json(updated);
}
