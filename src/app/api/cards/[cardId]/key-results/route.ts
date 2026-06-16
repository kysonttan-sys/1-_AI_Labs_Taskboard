import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { recomputeLinkedKeyResults } from '../_recompute';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const body = await request.json();
  const { keyResultId, weight = 1 } = body;

  if (!keyResultId || typeof keyResultId !== 'string') {
    return NextResponse.json({ error: 'keyResultId is required' }, { status: 400 });
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return NextResponse.json({ error: 'weight must be a positive number' }, { status: 400 });
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { board: { select: { projectId: true } } },
  });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const kr = await prisma.keyResult.findUnique({
    where: { id: keyResultId },
    include: { objective: { select: { projectId: true } } },
  });
  if (!kr) return NextResponse.json({ error: 'Key result not found' }, { status: 404 });

  if (card.board.projectId !== kr.objective.projectId) {
    return NextResponse.json(
      { error: 'Card and key result must belong to the same project' },
      { status: 400 }
    );
  }

  const existing = await prisma.cardKeyResult.findUnique({
    where: { cardId_keyResultId: { cardId, keyResultId } },
  });
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const link = await prisma.cardKeyResult.create({
    data: { cardId, keyResultId, weight },
    include: { keyResult: true },
  });

  await recomputeLinkedKeyResults(cardId);

  return NextResponse.json(link, { status: 201 });
}
