import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireCardAccess } from '@/lib/auth/permissions';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; dependsOnCardId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { cardId, dependsOnCardId } = await params;

  const { response: accessResponse } = await requireCardAccess(session, cardId);
  if (accessResponse) return accessResponse;

  try {
    await prisma.cardDependency.delete({
      where: {
        dependsOnCardId_dependentCardId: { dependsOnCardId, dependentCardId: cardId },
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Dependency not found' }, { status: 404 });
  }
}
