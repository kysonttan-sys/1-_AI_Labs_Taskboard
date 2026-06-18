import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createActivityEvent } from '@/lib/activity';
import { requireSession, requireListAccess } from '@/lib/auth/permissions';
import { deriveStatusFromListTitle } from '@/lib/board/status';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  const sessionAuth = await requireSession();
  if (sessionAuth.response) {
    return sessionAuth.response;
  }

  const listAuth = await requireListAccess(sessionAuth.session, listId);
  if (listAuth.response) {
    return listAuth.response;
  }

  const cards = await prisma.card.findMany({
    where: { listId },
    orderBy: { position: 'asc' },
  });

  return NextResponse.json(cards);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  const sessionAuth = await requireSession();
  if (sessionAuth.response) {
    return sessionAuth.response;
  }

  const listAuth = await requireListAccess(sessionAuth.session, listId);
  if (listAuth.response) {
    return listAuth.response;
  }

  const body = await request.json();
  const { title } = body;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const list = listAuth.list;

  const maxPosition = await prisma.card.aggregate({
    _max: { position: true },
    where: { listId },
  });

  const initialStatus = deriveStatusFromListTitle(list.title);

  const card = await prisma.card.create({
    data: {
      title,
      listId,
      boardId: list.boardId,
      position: (maxPosition._max.position ?? -1) + 1,
      ...(initialStatus ? { status: initialStatus } : {}),
    },
    include: {
      assignees: {
        include: { user: true },
      },
      labels: { include: { label: true } },
      _count: { select: { comments: true } },
      checklist: true,
    },
  });

  await createActivityEvent({
    type: 'card_created',
    actorId: sessionAuth.session.userId,
    boardId: card.boardId,
    cardId: card.id,
    listId,
    metadata: { title: card.title },
  });

  return NextResponse.json(card, { status: 201 });
}