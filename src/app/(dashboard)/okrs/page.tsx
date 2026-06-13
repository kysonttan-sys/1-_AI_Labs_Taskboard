import { prisma } from '@/lib/db/client';
import ObjectiveList, { type SerializedObjective } from './ObjectiveList';

export const dynamic = 'force-dynamic';

export default async function OkrsPage() {
  const objectives = await prisma.objective.findMany({
    orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
    include: { keyResults: { orderBy: { position: 'asc' } } },
  });
  const serialized: SerializedObjective[] = objectives.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    startDate: o.startDate.toISOString(),
    endDate: o.endDate.toISOString(),
    position: o.position,
    ownerId: o.ownerId,
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
      createdAt: kr.createdAt.toISOString(),
      updatedAt: kr.updatedAt.toISOString(),
    })),
  }));
  return <ObjectiveList initialObjectives={serialized} />;
}
