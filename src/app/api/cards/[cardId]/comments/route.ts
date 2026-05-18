import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createNotification } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, assignees: { select: { userId: true } }, boardId: true, title: true },
    });
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        text: text.trim(),
        cardId,
        authorId: session.userId,
      },
      include: { author: true },
    });

    // Notify all assignees who aren't the commenter
    for (const a of card.assignees) {
      if (a.userId !== session.userId) {
        await createNotification({
          type: 'comment_added',
          title: 'New comment on your card',
          body: text.trim().substring(0, 100),
          userId: a.userId,
          cardId: card.id,
          boardId: card.boardId,
          triggerUserId: session.userId,
        });
      }
    }

    return NextResponse.json(comment, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}