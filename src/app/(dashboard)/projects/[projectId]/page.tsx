'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useProjectStore } from '@/features/projects/projectStore';
import { useBoardStore } from '@/features/board/boardStore';
import { useOkrStore } from '@/features/okrs/okrStore';
import { FolderKanban, Target, ArrowLeft, Plus, LayoutGrid, BarChart3 } from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { projects, fetchProjects } = useProjectStore();
  const { boards, fetchBoards } = useBoardStore();
  const { objectives, fetchObjectives } = useOkrStore();
  const [activeTab, setActiveTab] = useState<'boards' | 'okrs'>('boards');

  useEffect(() => {
    fetchProjects();
    fetchBoards();
    fetchObjectives();
  }, [fetchProjects, fetchBoards, fetchObjectives]);

  const project = projects.find((p) => p.id === projectId);
  const projectBoards = boards.filter((b) => b.projectId === projectId);
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
        onClick={() => router.push('/projects')}
        className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mb-4 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </button>

      <div className="flex items-center gap-3 mb-6">
        <FolderKanban className="h-8 w-8 text-[var(--accent)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-[var(--text-tertiary)]">{project.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('boards')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${activeTab === 'boards'
              ? 'bg-[var(--accent)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Boards ({projectBoards.length})
        </button>
        <button
          onClick={() => setActiveTab('okrs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${activeTab === 'okrs'
              ? 'bg-[var(--accent)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
        >
          <Target className="h-4 w-4" />
          OKRs ({projectObjectives.length})
        </button>
        <button
          onClick={() => router.push(`/projects/${projectId}/gantt`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
        >
          <BarChart3 className="h-4 w-4" />
          Gantt
        </button>
      </div>

      {activeTab === 'boards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectBoards.map((board) => (
            <div
              key={board.id}
              onClick={() => router.push(`/board/${board.id}`)}
              className="card-base p-4 cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{board.icon}</span>
                <div>
                  <h3 className="text-base font-medium text-[var(--text-primary)]">{board.name}</h3>
                  <p className="text-xs text-[var(--text-tertiary)]">Click to open board</p>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => router.push(`/board/new?projectId=${projectId}`)}
            className="card-base p-4 flex flex-col items-center justify-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--accent)]/40 transition-colors border-dashed"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Create board in project</span>
          </button>
        </div>
      )}

      {activeTab === 'okrs' && (
        <div className="space-y-4">
          {projectObjectives.length === 0 ? (
            <div className="card-base p-8 text-center">
              <Target className="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="text-sm text-[var(--text-tertiary)]">No OKRs in this project yet.</p>
            </div>
          ) : (
            projectObjectives.map((obj) => (
              <div key={obj.id} className="card-base p-4">
                <h3 className="text-base font-medium text-[var(--text-primary)]">{obj.title}</h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {new Date(obj.startDate).toLocaleDateString()} – {new Date(obj.endDate).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
