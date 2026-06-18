import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireCardAccess, requireSession } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const { session, response: sessionResponse } = await requireSession();
  if (sessionResponse) return sessionResponse;

  const { response: accessResponse } = await requireCardAccess(session, cardId);
  if (accessResponse) return accessResponse;

  try {
    const body = await request.json();
    const { text, position } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
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
