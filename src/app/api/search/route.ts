import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import {
  requireSession,
  requireBoardAccess,
  requireProjectAccess,
} from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase();
  const boardId = searchParams.get('boardId') ?? undefined;
  const projectId = searchParams.get('projectId') ?? undefined;

  if (!q || q.length < 2) {
    return NextResponse.json({ cards: [], objectives: [], comments: [] });
  }

  let cardQuery: Promise<any[]> = Promise.resolve([]);
  let objectiveQuery: Promise<any[]> = Promise.resolve([]);
  let commentQuery: Promise<any[]> = Promise.resolve([]);

  if (boardId) {
    const boardAuth = await requireBoardAccess(session, boardId);
    if (boardAuth.response) return boardAuth.response;

    cardQuery = prisma.card.findMany({
      where: {
        boardId,
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
    });

    commentQuery = prisma.comment.findMany({
      where: {
        text: { contains: q, mode: 'insensitive' },
        card: { boardId },
      },
      include: {
        card: { select: { id: true, title: true, boardId: true } },
        author: { select: { id: true, name: true, color: true } },
      },
      take: 10,
    });
  }

  if (projectId) {
    const projectAuth = await requireProjectAccess(session, projectId);
    if (projectAuth.response) return projectAuth.response;

    objectiveQuery = prisma.objective.findMany({
      where: {
        projectId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      take: 10,
    });
  }

  const [cards, objectives, comments] = await Promise.all([
    cardQuery,
    objectiveQuery,
    commentQuery,
  ]);

  return NextResponse.json({ cards, objectives, comments });
}
