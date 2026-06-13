import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  try {
    const body = await request.json();
    const { text, position } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const maxPosition = await prisma.checklistItem.aggregate({
      where: { cardId },
      _max: { position: true },
    });

    const item = await prisma.checklistItem.create({
      data: {
        text,
        checked: false,
        position: position ?? (maxPosition._max.position ?? -1) + 1,
        cardId,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
  }
}