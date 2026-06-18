import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireCardAccess } from '@/lib/auth/permissions';
import { createActivityEvent } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const { session, response: authResponse } = await requireSession();
  if (authResponse) return authResponse;

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { card: { select: { id: true, boardId: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
  }

  const { response: cardResponse } = await requireCardAccess(session, item.cardId);
  if (cardResponse) return cardResponse;

  try {
    const body = await request.json();
    const { text, checked, position } = body;

    const updateData: Record<string, unknown> = {};
    if (text !== undefined) updateData.text = text;
    if (checked !== undefined) updateData.checked = checked;
    if (position !== undefined) updateData.position = position;

    const updatedItem = await prisma.checklistItem.update({
      where: { id: itemId },
      data: updateData,
      include: { card: { select: { id: true, boardId: true } } },
    });

    if (checked === true) {
      await createActivityEvent({
        type: 'checklist_item_completed',
        actorId: session.userId,
        boardId: updatedItem.card.boardId,
        cardId: updatedItem.card.id,
        metadata: { text: updatedItem.text },
      });
    }

    return NextResponse.json(updatedItem);
  } catch {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const { session, response: authResponse } = await requireSession();
  if (authResponse) return authResponse;

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { cardId: true },
  });
  if (!item) {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
  }

  const { response: cardResponse } = await requireCardAccess(session, item.cardId);
  if (cardResponse) return cardResponse;

  try {
    await prisma.checklistItem.delete({ where: { id: itemId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
  }
}
