import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; dependsOnCardId: string }> }
) {
  const { cardId, dependsOnCardId } = await params;

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
