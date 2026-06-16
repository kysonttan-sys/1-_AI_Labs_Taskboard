import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { recomputeLinkedKeyResults } from '../../_recompute';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; keyResultId: string }> }
) {
  const { cardId, keyResultId } = await params;

  try {
    await prisma.cardKeyResult.delete({
      where: { cardId_keyResultId: { cardId, keyResultId } },
    });
    await recomputeLinkedKeyResults(cardId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }
}
