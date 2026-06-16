import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase();

  if (!q || q.length < 2) {
    return NextResponse.json({ cards: [], objectives: [], comments: [] });
  }

  const [cards, objectives, comments] = await Promise.all([
    prisma.card.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        board: { select: { id: true, name: true } },
        list: { select: { id: true, title: true } },
        assignees: { include: { user: { select: { id: true, name: true, color: true } } } },
        labels: { include: { label: true } },
      },
      take: 10,
    }),
    prisma.objective.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      take: 10,
    }),
    prisma.comment.findMany({
      where: {
        text: { contains: q, mode: 'insensitive' },
      },
      include: {
        card: { select: { id: true, title: true, boardId: true } },
        author: { select: { id: true, name: true, color: true } },
      },
      take: 10,
    }),
  ]);

  return NextResponse.json({ cards, objectives, comments });
}
