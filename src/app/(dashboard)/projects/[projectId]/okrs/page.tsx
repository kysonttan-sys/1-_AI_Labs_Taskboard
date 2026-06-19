'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useProjectStore } from '@/features/projects/projectStore';
import { useOkrStore } from '@/features/okrs/okrStore';
import { FolderKanban, Target, ArrowLeft, Plus } from 'lucide-react';
import { pct } from '@/features/okrs/progress';
import ObjectiveCard from '@/app/(dashboard)/okrs/ObjectiveCard';

export default function ProjectOkrsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { projects, fetchProjects } = useProjectStore();
  const { objectives, fetchObjectives } = useOkrStore();

  useEffect(() => {
    fetchProjects();
    fetchObjectives();
  }, [fetchProjects, fetchObjectives]);

  const project = projects.find((p) => p.id === projectId);
  const projectObjectives = objectives.filter((o) => o.projectId === projectId);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 rounded-md bg-[var(--accent)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 sm:p-6">
      <button
        onClick={() => router.push(`/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mb-4 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to project overview
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderKanban className="h-6 w-6 text-[var(--accent)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{project.name}</h1>
            <p className="text-sm text-[var(--text-tertiary)]">Objectives & Key Results</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/okrs')}
          className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          View all projects’ OKRs →
        </button>
      </div>

      {projectObjectives.length === 0 ? (
        <div className="card-base p-8 text-center">
          <Target className="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-3" />
          <h2 className="text-lg font-medium text-[var(--text-primary)] mb-1">No OKRs yet</h2>
          <p className="text-sm text-[var(--text-tertiary)] mb-4">Create your first objective for this project.</p>
          <button
            onClick={() => router.push('/okrs')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-[var(--text-primary)] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create OKR
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projectObjectives.map((obj) => {
            const overall = obj.keyResults.length === 0
              ? 0
              : obj.keyResults.reduce((acc, kr) => acc + pct(kr.current, kr.target), 0) / obj.keyResults.length;
            return (
              <ObjectiveCard
                key={obj.id}
                objective={obj}
                projectId={projectId}
                overallPct={overall}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
