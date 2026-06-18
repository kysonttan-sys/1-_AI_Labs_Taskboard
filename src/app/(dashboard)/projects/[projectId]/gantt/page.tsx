'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useBoardStore } from '@/features/board/boardStore';
import { useOkrStore } from '@/features/okrs/okrStore';
import { useProjectStore } from '@/features/projects/projectStore';
import GanttChartView from '@/components/calendar/GanttChart';

export default function ProjectGanttPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { projects, fetchProjects } = useProjectStore();
  const { boards, fetchBoards, fetchProjectBoardsData } = useBoardStore();
  const { objectives, fetchObjectives } = useOkrStore();

  useEffect(() => {
    async function load() {
      await fetchProjects();
      await fetchBoards();
      await fetchObjectives();
      await fetchProjectBoardsData(projectId);
    }
    load();
  }, [fetchProjects, fetchBoards, fetchObjectives, fetchProjectBoardsData, projectId]);

  const project = projects.find((p) => p.id === projectId);
  const projectBoardIds = useMemo(
    () => boards.filter((b) => b.projectId === projectId).map((b) => b.id),
    [boards, projectId]
  );
  const projectObjectives = useMemo(
    () => objectives.filter((o) => o.projectId === projectId),
    [objectives, projectId]
  );

  return (
    <div className="flex flex-col h-full p-4 sm:p-6">
      <button
        onClick={() => router.push(`/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mb-4 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to project
      </button>

      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="h-8 w-8 text-[var(--accent)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            {project ? `${project.name} Gantt` : 'Project Gantt'}
          </h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            All tasks and OKRs across every board in this project.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <GanttChartView objectives={projectObjectives} boardIds={projectBoardIds} />
      </div>
    </div>
  );
}
