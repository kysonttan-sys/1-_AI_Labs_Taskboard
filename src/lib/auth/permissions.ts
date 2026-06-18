import { NextResponse } from 'next/server';
import { getSession, type SessionData } from './session';
import { prisma } from '@/lib/db/client';

export interface AuthResult {
  session: SessionData;
}

export async function requireSession(): Promise<
  { session: SessionData; response: null } | { session: null; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    };
  }
  return { session, response: null };
}

export async function requireAdmin(): Promise<
  { session: SessionData; response: null } | { session: null; response: NextResponse }
> {
  const auth = await requireSession();
  if (auth.response) return auth;
  if (auth.session.role !== 'admin') {
    return {
      session: null,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }
  return { session: auth.session, response: null };
}

export async function requireBoardAccess(
  session: SessionData,
  boardId: string
): Promise<
  { board: { id: string; projectId: string }; response: null } | { board: null; response: NextResponse }
> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, projectId: true },
  });
  if (!board) {
    return { board: null, response: NextResponse.json({ error: 'Board not found' }, { status: 404 }) };
  }
  return { board, response: null };
}

export async function requireListAccess(
  session: SessionData,
  listId: string
): Promise<
  { list: { id: string; title: string; boardId: string; board: { id: string; projectId: string } }; response: null } | { list: null; response: NextResponse }
> {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { board: { select: { id: true, projectId: true } } },
  });
  if (!list) {
    return { list: null, response: NextResponse.json({ error: 'List not found' }, { status: 404 }) };
  }
  return { list, response: null };
}

export async function requireCardAccess(
  session: SessionData,
  cardId: string
): Promise<
  { card: { id: string; boardId: string; listId: string }; response: null } | { card: null; response: NextResponse }
> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true, boardId: true, listId: true },
  });
  if (!card) {
    return { card: null, response: NextResponse.json({ error: 'Card not found' }, { status: 404 }) };
  }
  return { card, response: null };
}

export async function requireProjectAccess(
  session: SessionData,
  projectId: string
): Promise<
  { project: { id: string }; response: null } | { project: null; response: NextResponse }
> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return { project: null, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }
  return { project, response: null };
}

export async function requireObjectiveAccess(
  session: SessionData,
  objectiveId: string
): Promise<
  { objective: { id: string; projectId: string }; response: null } | { objective: null; response: NextResponse }
> {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    select: { id: true, projectId: true },
  });
  if (!objective) {
    return { objective: null, response: NextResponse.json({ error: 'Objective not found' }, { status: 404 }) };
  }
  return { objective, response: null };
}
