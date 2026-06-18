import { prisma } from '@/lib/db/client';
import ObjectiveList, { type SerializedObjective } from './ObjectiveList';
import type { LinkedTask } from '@/lib/api/okrs';

export const dynamic = 'force-dynamic';

export default async function OkrsPage() {
  let objectives: SerializedObjective[] = [];
  let fetchError: string | null = null;

  try {
    const rows = await prisma.objective.findMany({
      orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
      include: {
        keyResults: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              include: { card: true },
            },
          },
        },
      },
    });
    objectives = rows.map((o) => ({
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
      keyResults: o.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        target: kr.target,
        current: kr.current,
        unit: kr.unit,
        position: kr.position,
        objectiveId: kr.objectiveId,
        startDate: kr.startDate.toISOString(),
        endDate: kr.endDate.toISOString(),
        createdAt: kr.createdAt.toISOString(),
        updatedAt: kr.updatedAt.toISOString(),
        cards: kr.cards.map(({ card }) => ({
          id: card.id,
          title: card.title,
          status: card.status as LinkedTask['status'],
          listId: card.listId,
          boardId: card.boardId,
          dueDate: card.dueDate?.toISOString() ?? null,
        })),
      })),
    }));
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
    // Log to server stdout/stderr so it appears in Render logs.
    console.error('[OKRS_SERVER_ERROR]', fetchError, e);
  }

  if (fetchError) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto rounded-md border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          <h1 className="mb-2 text-lg font-semibold">Failed to load OKRs</h1>
          <p className="mb-2 text-sm">Server error:</p>
          <pre className="whitespace-pre-wrap rounded-md bg-black/30 p-3 text-xs">{fetchError}</pre>
          <p className="mt-3 text-xs text-red-300">
            Check Render server logs for the full stack trace.
          </p>
        </div>
      </div>
    );
  }

  return <ObjectiveList initialObjectives={objectives} />;
}
