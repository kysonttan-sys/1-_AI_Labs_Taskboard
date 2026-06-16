import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createActivityEvent } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  try {
    const body = await request.json();
    const { text, checked, position } = body;

    const updateData: Record<string, unknown> = {};
    if (text !== undefined) updateData.text = text;
    if (checked !== undefined) updateData.checked = checked;
    if (position !== undefined) updateData.position = position;

    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: updateData,
      include: { card: { select: { id: true, boardId: true } } },
    });

    if (checked === true) {
      const session = await getSession();
      await createActivityEvent({
        type: 'checklist_item_completed',
        actorId: session?.userId,
        boardId: item.card.boardId,
        cardId: item.card.id,
        metadata: { text: item.text },
      });
    }

    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  try {
    await prisma.checklistItem.delete({ where: { id: itemId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
  }
}