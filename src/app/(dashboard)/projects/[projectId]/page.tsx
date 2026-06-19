'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useProjectStore } from '@/features/projects/projectStore';
import { useBoardStore } from '@/features/board/boardStore';
import { useOkrStore } from '@/features/okrs/okrStore';
import {
  FolderKanban,
  Target,
  ArrowLeft,
  Plus,
  LayoutGrid,
  BarChart3,
  Home,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { pct } from '@/features/okrs/progress';
import ObjectiveCard from '@/app/(dashboard)/okrs/ObjectiveCard';
import GanttChart from '@/components/calendar/GanttChart';

type TabKey = 'overview' | 'okrs' | 'boards' | 'gantt';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { projects, fetchProjects } = useProjectStore();
  const { boards, fetchBoards, fetchProjectBoardsData, lists } = useBoardStore();
  const { objectives, fetchObjectives } = useOkrStore();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  useEffect(() => {
    fetchProjects();
    fetchBoards();
    fetchObjectives();
    fetchProjectBoardsData(projectId);
  }, [fetchProjects, fetchBoards, fetchObjectives, fetchProjectBoardsData, projectId]);

  const project = projects.find((p) => p.id === projectId);
  const projectBoards = boards.filter((b) => b.projectId === projectId);
  const projectObjectives = objectives.filter((o) => o.projectId === projectId);

  const projectCards = useMemo(() => {
    return lists.flatMap((list) =>
      list.cards.map((card) => ({ ...card, listTitle: list.title }))
    );
  }, [lists]);

  const taskDistribution = useMemo(() => {
    const counts: Record<string, number> = { 'To Do': 0, 'In Progress': 0, 'Done': 0, Other: 0 };
    projectCards.forEach((card) => {
      const status = card.status ?? card.listTitle ?? '';
      const normalized = status.toLowerCase();
      if (normalized.includes('done') || normalized.includes('complete')) {
        counts['Done']++;
      } else if (normalized.includes('progress') || normalized.includes('ongoing')) {
        counts['In Progress']++;
      } else if (normalized.includes('todo') || normalized.includes('to do')) {
        counts['To Do']++;
      } else {
        counts['Other']++;
      }
    });
    return counts;
  }, [projectCards]);

  const overallOkrProgress = useMemo(() => {
    if (projectObjectives.length === 0) return 0;
    const sum = projectObjectives.reduce((acc, obj) => {
      if (obj.keyResults.length === 0) return acc;
      const objSum = obj.keyResults.reduce((kAcc, kr) => kAcc + pct(kr.current, kr.target), 0);
      return acc + objSum / obj.keyResults.length;
    }, 0);
    return sum / projectObjectives.length;
  }, [projectObjectives]);

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return projectCards
      .filter((c) => c.dueDate && new Date(c.dueDate) >= now && new Date(c.dueDate) <= nextWeek)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);
  }, [projectCards]);

  const overdue = useMemo(() => {
    const now = new Date();
    return projectCards.filter((c) => c.dueDate && new Date(c.dueDate) < now);
  }, [projectCards]);

  const teamWorkload = useMemo(() => {
    const map: Record<string, { name: string; count: number; color?: string }> = {};
    projectCards.forEach((card) => {
      card.assignees?.forEach(({ user }) => {
        if (!map[user.id]) map[user.id] = { name: user.name, count: 0, color: user.color };
        map[user.id].count++;
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [projectCards]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 rounded-md bg-[var(--accent)] animate-pulse" />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Home className="h-4 w-4" /> },
    { key: 'okrs', label: 'OKRs', icon: <Target className="h-4 w-4" /> },
    { key: 'boards', label: 'Boards', icon: <LayoutGrid className="h-4 w-4" /> },
    { key: 'gantt', label: 'Gantt', icon: <BarChart3 className="h-4 w-4" /> },
  ];

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
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {projectBoards.length} boards · {projectObjectives.length} OKRs · {projectCards.length} tasks
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-[var(--border)] pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-md text-sm font-medium transition-colors border-b-2 -mb-[1px]
              ${activeTab === tab.key
                ? 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] border-transparent'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Top stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-base p-4">
              <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-2">
                <Target className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">OKR Progress</span>
              </div>
              <div className="text-2xl font-semibold text-[var(--text-primary)]">
                {Math.round(overallOkrProgress)}%
              </div>
              <div className="h-1.5 bg-[var(--bg-surface)] rounded overflow-hidden mt-2">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${overallOkrProgress}%` }}
                />
              </div>
            </div>

            <div className="card-base p-4">
              <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Task Status</span>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-center">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{taskDistribution['To Do']}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">To Do</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{taskDistribution['In Progress']}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">In Progress</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{taskDistribution['Done']}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">Done</div>
                </div>
              </div>
            </div>

            <div className="card-base p-4">
              <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Due Soon</span>
              </div>
              <div className="text-2xl font-semibold text-[var(--text-primary)]">{upcomingDeadlines.length}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">
                {overdue.length > 0 ? (
                  <span className="text-red-400">{overdue.length} overdue</span>
                ) : (
                  'No overdue tasks'
                )}
              </div>
            </div>

            <div className="card-base p-4">
              <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-2">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Team Load</span>
              </div>
              <div className="text-2xl font-semibold text-[var(--text-primary)]">{teamWorkload.length}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">active assignees</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Upcoming deadlines */}
            <div className="card-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Upcoming deadlines (next 7 days)</h3>
              </div>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No tasks due in the next 7 days.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingDeadlines.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => router.push(`/board/${card.boardId}?card=${card.id}`)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-left transition-colors"
                    >
                      <span className="text-sm text-[var(--text-primary)] truncate">{card.title}</span>
                      <span className="text-xs text-[var(--text-tertiary)] shrink-0">{formatDate(card.dueDate!)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team workload */}
            <div className="card-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Team workload</h3>
              </div>
              {teamWorkload.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No tasks assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {teamWorkload.map((member) => {
                    const initials = member.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <div key={member.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
                            style={{ backgroundColor: member.color || 'var(--accent)' }}
                          >
                            {initials}
                          </span>
                          <span className="text-sm text-[var(--text-primary)] truncate">{member.name}</span>
                        </div>
                        <span className="text-xs font-medium text-[var(--text-tertiary)]">{member.count} tasks</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OKRs tab */}
      {activeTab === 'okrs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Objectives & Key Results</h2>
            <button
              onClick={() => router.push(`/projects/${projectId}/okrs`)}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Open full OKR view →
            </button>
          </div>
          {projectObjectives.length === 0 ? (
            <div className="card-base p-8 text-center">
              <Target className="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="text-sm text-[var(--text-tertiary)]">No OKRs in this project yet.</p>
            </div>
          ) : (
            projectObjectives.map((obj) => {
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
            })
          )}
        </div>
      )}

      {/* Boards tab */}
      {activeTab === 'boards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Task Boards</h2>
            <button
              onClick={() => router.push(`/board/new?projectId=${projectId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-[var(--text-primary)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Board
            </button>
          </div>
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
          </div>
        </div>
      )}

      {/* Gantt tab */}
      {activeTab === 'gantt' && (
        <div className="flex flex-col h-full min-h-0">
          <GanttChart
            objectives={projectObjectives}
            boardIds={projectBoards.map((b) => b.id)}
          />
        </div>
      )}
    </div>
  );
}
