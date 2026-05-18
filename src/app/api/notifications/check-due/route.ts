import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createNotification } from '@/lib/notifications';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

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

  let created = 0;

  for (const card of cards) {
    if (!card.dueDate) continue;

    const dueDate = new Date(card.dueDate);

    for (const a of card.assignees) {
      if (dueDate < now) {
        const existing = await prisma.notification.findFirst({
          where: {
            type: 'due_date_overdue',
            userId: a.userId,
            cardId: card.id,
            read: false,
          },
        });
        if (!existing) {
          await createNotification({
            type: 'due_date_overdue',
            title: 'Task overdue',
            body: card.title,
            userId: a.userId,
            cardId: card.id,
            boardId: card.boardId,
          });
          created++;
        }
      } else if (dueDate <= approachingThreshold) {
        const existing = await prisma.notification.findFirst({
          where: {
            type: 'due_date_approaching',
            userId: a.userId,
            cardId: card.id,
            read: false,
          },
        });
        if (!existing) {
          await createNotification({
            type: 'due_date_approaching',
            title: 'Due date approaching',
            body: card.title,
            userId: a.userId,
            cardId: card.id,
            boardId: card.boardId,
          });
          created++;
        }
      }
    }
  }

  return NextResponse.json({ created });
}