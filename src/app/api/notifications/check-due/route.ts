import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/permissions';
import type { NotificationType } from '@/lib/notifications';

export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;

  const now = new Date();
  const approachingThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const cards = await prisma.card.findMany({
    where: {
      dueDate: { not: null },
      status: { not: 'done' },
      assignees: { some: {} },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assignees: { select: { userId: true } },
      boardId: true,
    },
  });

  // Build the list of notifications we would create.
  const pending: { type: NotificationType; userId: string; cardId: string; boardId: string; title: string; body?: string }[] = [];

  for (const card of cards) {
    if (!card.dueDate) continue;
    const dueDate = new Date(card.dueDate);

    for (const a of card.assignees) {
      if (dueDate < now) {
        pending.push({
          type: 'due_date_overdue',
          userId: a.userId,
          cardId: card.id,
          boardId: card.boardId,
          title: 'Task overdue',
          body: card.title,
        });
      } else if (dueDate <= approachingThreshold) {
        pending.push({
          type: 'due_date_approaching',
          userId: a.userId,
          cardId: card.id,
          boardId: card.boardId,
          title: 'Due date approaching',
          body: card.title,
        });
      }
    }
  }

  if (pending.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  // Batch-check which notifications already exist (single query).
  const existing = await prisma.notification.findMany({
    where: {
      OR: pending.map((p) => ({
        type: p.type,
        userId: p.userId,
        cardId: p.cardId,
        read: false,
      })),
    },
    select: { type: true, userId: true, cardId: true },
  });

  const existingKeySet = new Set(existing.map((e) => `${e.type}:${e.userId}:${e.cardId}`));

  const toCreate = pending.filter(
    (p) => !existingKeySet.has(`${p.type}:${p.userId}:${p.cardId}`)
  );

  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  await prisma.notification.createMany({
    data: toCreate.map((p) => ({
      type: p.type,
      title: p.title,
      body: p.body,
      userId: p.userId,
      cardId: p.cardId,
      boardId: p.boardId,
    })),
  });

  return NextResponse.json({ created: toCreate.length });
}