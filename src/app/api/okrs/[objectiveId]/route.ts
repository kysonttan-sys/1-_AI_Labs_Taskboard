import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireObjectiveAccess } from '@/lib/auth/permissions';
import type { Objective, KeyResult, LinkedTask } from '@/lib/api/okrs';

function serializeKeyResult(kr: any): KeyResult {
  return {
    id: kr.id,
    title: kr.title,
    target: kr.target,
    current: kr.current,
    unit: kr.unit,
    trackingMode: kr.trackingMode,
    position: kr.position,
    objectiveId: kr.objectiveId,
    startDate: kr.startDate.toISOString(),
    endDate: kr.endDate.toISOString(),
    createdAt: kr.createdAt.toISOString(),
    updatedAt: kr.updatedAt.toISOString(),
    cards: (kr.cards ?? []).map(({ card }: any): LinkedTask => ({
      id: card.id,
      title: card.title,
      status: card.status,
      listId: card.listId,
      boardId: card.boardId,
      dueDate: card.dueDate?.toISOString() ?? null,
      assignees: card.assignees?.map(({ user }: any) => ({
        user: {
          id: user.id,
          name: user.name,
          color: user.color,
        },
      })) ?? [],
    })),
  };
}

function serializeObjective(o: any): Objective {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    startDate: o.startDate.toISOString(),
    endDate: o.endDate.toISOString(),
    position: o.position,
    ownerId: o.ownerId,
    projectId: o.projectId,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    keyResults: o.keyResults.map(serializeKeyResult),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;
  const { objectiveId } = await params;
  const access = await requireObjectiveAccess(auth.session, objectiveId);
  if (access.response) return access.response;
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: {
      keyResults: {
        orderBy: { position: 'asc' },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  assignees: { include: { user: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!objective) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }
  return NextResponse.json(serializeObjective(objective));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;
  const { objectiveId } = await params;
  const access = await requireObjectiveAccess(auth.session, objectiveId);
  if (access.response) return access.response;
  const body = await request.json();
  const { title, description, startDate, endDate } = body;

  const existing = await prisma.objective.findUnique({ where: { id: objectiveId } });
  if (!existing) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
    }
  }
  if (description !== undefined && description !== null) {
    if (typeof description === 'string' && description.length > 2000) {
      return NextResponse.json({ error: 'description must be 2000 characters or fewer' }, { status: 400 });
    }
  }

  const newStart = startDate ? new Date(startDate) : existing.startDate;
  const newEnd = endDate ? new Date(endDate) : existing.endDate;
  if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
    return NextResponse.json({ error: 'startDate and endDate must be valid dates' }, { status: 400 });
  }
  if (newEnd <= newStart) {
    return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
  }

  const objective = await prisma.objective.update({
    where: { id: objectiveId },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description || null }),
      ...(startDate && { startDate: newStart }),
      ...(endDate && { endDate: newEnd }),
    },
    include: {
      keyResults: {
        orderBy: { position: 'asc' },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  assignees: { include: { user: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(serializeObjective(objective));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;
  const { objectiveId } = await params;
  const access = await requireObjectiveAccess(auth.session, objectiveId);
  if (access.response) return access.response;
  const existing = await prisma.objective.findUnique({ where: { id: objectiveId } });
  if (!existing) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
  }
  await prisma.objective.delete({ where: { id: objectiveId } });
  return NextResponse.json({ ok: true });
}
