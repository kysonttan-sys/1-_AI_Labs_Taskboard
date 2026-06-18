import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { createActivityEvent } from '@/lib/activity';
import { isCompletedStatus } from '@/lib/board/status';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string; krId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { objectiveId, krId } = await params;
  const body = await request.json();
  const {
    title,
    boardId,
    listId,
    newBoardName,
    newListName,
    description,
    dueDate,
  } = body;

  if (typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
  }

  const existingPath = typeof boardId === 'string' && typeof listId === 'string';
  const createBoardPath = typeof newBoardName === 'string' && newBoardName.trim() !== '';
  if (!existingPath && !createBoardPath) {
    return NextResponse.json(
      { error: 'Either boardId+listId or newBoardName is required' },
      { status: 400 }
    );
  }

  const kr = await prisma.keyResult.findUnique({
    where: { id: krId },
    include: { objective: { select: { projectId: true, title: true } } },
  });
  if (!kr || kr.objectiveId !== objectiveId) {
    return NextResponse.json({ error: 'Key result not found' }, { status: 404 });
  }
  const projectId = kr.objective.projectId;

  let due: Date | null = null;
  if (dueDate !== undefined && dueDate !== null) {
    due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
      return NextResponse.json({ error: 'dueDate must be a valid date' }, { status: 400 });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let finalListId = listId as string;
      let finalBoardId = boardId as string;

      if (createBoardPath) {
        const board = await tx.board.create({
          data: {
            name: newBoardName.trim(),
            projectId,
            position: 0, // caller can reorder later
          },
        });
        finalBoardId = board.id;

        const listTitle = typeof newListName === 'string' && newListName.trim() !== ''
          ? newListName.trim()
          : 'To Do';
        const existingList = await tx.list.findFirst({
          where: { boardId: board.id, title: listTitle },
        });
        finalListId = existingList?.id ?? (
          await tx.list.create({
            data: { title: listTitle, boardId: board.id, position: 0 },
          })
        ).id;
      } else {
        const list = await tx.list.findUnique({
          where: { id: finalListId },
          include: { board: { select: { projectId: true, id: true } } },
        });
        if (!list) {
          throw new Error('List not found');
        }
        if (list.board.projectId !== projectId) {
          throw new Error('Board does not belong to this project');
        }
        finalBoardId = list.board.id;
      }

      const targetList = await tx.list.findUnique({
        where: { id: finalListId },
        select: { title: true },
      });
      if (!targetList) throw new Error('List not found');

      const maxPosition = await tx.card.aggregate({
        _max: { position: true },
        where: { listId: finalListId },
      });

      const initialStatus = targetList.title;
      const card = await tx.card.create({
        data: {
          title: title.trim(),
          description: typeof description === 'string' ? description.trim() : null,
          listId: finalListId,
          boardId: finalBoardId,
          position: (maxPosition._max.position ?? -1) + 1,
          status: initialStatus,
          completedAt: isCompletedStatus(initialStatus) ? new Date() : null,
          dueDate: due,
        },
        include: {
          assignees: { include: { user: true } },
          labels: { include: { label: true } },
          _count: { select: { comments: true } },
          checklist: true,
        },
      });

      await tx.cardKeyResult.create({
        data: { cardId: card.id, keyResultId: kr.id, weight: 1 },
      });

      return card;
    });

    await createActivityEvent({
      type: 'okr_task_created',
      actorId: session.userId,
      boardId: result.boardId,
      cardId: result.id,
      listId: result.listId,
      metadata: { keyResultTitle: kr.title, objectiveTitle: kr.objective.title },
    });

    return NextResponse.json(
      {
        card: {
          id: result.id,
          title: result.title,
          status: result.status,
          listId: result.listId,
          boardId: result.boardId,
          dueDate: result.dueDate?.toISOString() ?? null,
          assignees: result.assignees?.map(({ user }: any) => ({
            user: {
              id: user.id,
              name: user.name,
              color: user.color,
            },
          })) ?? [],
        },
      },
      { status: 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('List not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('does not belong')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error('[OKR_TASK_CREATE_ERROR]', message, e);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
