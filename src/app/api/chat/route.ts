import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get('boardId');
  if (!boardId) {
    return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { boardId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, color: true } },
      replyTo: { select: { id: true, text: true, user: { select: { id: true, name: true, color: true } } } },
    },
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { text, boardId, replyToId } = body;

  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }
  if (!boardId) {
    return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
  }

  const message = await prisma.chatMessage.create({
    data: {
      text: text.trim(),
      boardId,
      userId: session.userId,
      ...(replyToId ? { replyToId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, color: true } },
      replyTo: { select: { id: true, text: true, user: { select: { id: true, name: true, color: true } } } },
    },
  });

  // Check for @mentions and send notifications
  const mentionRegex = /@(\w+)/g;
  const mentions = text.match(mentionRegex);
  if (mentions) {
    const mentionedNames = Array.from(new Set(mentions.map((m: string) => m.slice(1).toLowerCase()))) as string[];

    const users = await prisma.user.findMany({
      where: {
        name: { in: mentionedNames.map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)) },
      },
      select: { id: true, name: true },
    });

    for (const user of users) {
      if (user.id !== session.userId) {
        await createNotification({
          type: 'chat_mentioned',
          title: `${session.name} mentioned you in chat`,
          body: text.trim().substring(0, 100),
          userId: user.id,
          boardId,
          triggerUserId: session.userId,
        });
      }
    }
  }

  return NextResponse.json(message, { status: 201 });
}