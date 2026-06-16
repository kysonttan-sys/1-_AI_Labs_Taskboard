import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const body = await request.json();
  const { dependsOnCardId } = body;

  if (!dependsOnCardId || typeof dependsOnCardId !== 'string') {
    return NextResponse.json({ error: 'dependsOnCardId is required' }, { status: 400 });
  }
  if (dependsOnCardId === cardId) {
    return NextResponse.json({ error: 'A card cannot depend on itself' }, { status: 400 });
  }

  const [card, target] = await Promise.all([
    prisma.card.findUnique({ where: { id: cardId }, select: { boardId: true } }),
    prisma.card.findUnique({ where: { id: dependsOnCardId }, select: { boardId: true } }),
  ]);

  if (!card || !target) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  if (card.boardId !== target.boardId) {
    return NextResponse.json({ error: 'Cards must be on the same board' }, { status: 400 });
  }

  try {
    const dep = await prisma.cardDependency.create({
      data: {
        dependentCardId: cardId,
        dependsOnCardId,
        type: 'finish_to_start',
      },
      include: { dependsOnCard: true },
    });
    return NextResponse.json(dep, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
  }
}
