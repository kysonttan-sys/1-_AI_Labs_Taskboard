import { prisma } from '@/lib/db/client';
import { isCompletedStatus } from '@/lib/board/status';
import { pct } from '@/features/okrs/progress';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  Target,
  Users,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import AiSuggestionPanel from '@/components/ai/AiSuggestionPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatDate(date: Date | string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end, now };
}

export default async function DigestPage() {
  const { start: weekStart, end: weekEnd, now } = getWeekRange();

  const [cards, objectives, activities] = await Promise.all([
    prisma.card.findMany({
      include: {
        board: { select: { id: true, name: true, projectId: true } },
        list: { select: { title: true } },
        assignees: { include: { user: { select: { id: true, name: true, color: true } } } },
      },
    }),
    prisma.objective.findMany({
      include: {
        project: { select: { id: true, name: true } },
        keyResults: { orderBy: { position: 'asc' } },
      },
      orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
    }),
    prisma.activityEvent.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true } },
        board: { select: { name: true } },
        card: { select: { title: true } },
      },
    }),
  ]);

  const completedThisWeek = cards.filter(
    (c) => c.completedAt && new Date(c.completedAt) >= weekStart && new Date(c.completedAt) <= weekEnd
  );

  const dueThisWeek = cards.filter(
    (c) =>
      c.dueDate &&
      new Date(c.dueDate) >= weekStart &&
      new Date(c.dueDate) <= weekEnd &&
      !isCompletedStatus(c.status)
  );

  const overdue = cards.filter(
    (c) => c.dueDate && new Date(c.dueDate) < now && !isCompletedStatus(c.status)
  );

  const overallOkrProgress =
    objectives.length === 0
      ? 0
      : objectives.reduce((acc, obj) => {
          if (obj.keyResults.length === 0) return acc;
          const sum = obj.keyResults.reduce((kAcc, kr) => kAcc + pct(kr.current, kr.target), 0);
          return acc + sum / obj.keyResults.length;
        }, 0) / objectives.length;

  const workload: Record<string, { name: string; color: string | null; count: number }> = {};
  cards.forEach((card) => {
    if (isCompletedStatus(card.status)) return;
    card.assignees.forEach(({ user }) => {
      if (!workload[user.id]) workload[user.id] = { name: user.name, color: user.color, count: 0 };
      workload[user.id].count++;
    });
  });
  const topAssignees = Object.values(workload).sort((a, b) => b.count - a.count).slice(0, 8);

  const formatActivity = (a: (typeof activities)[number]) => {
    const actor = a.actor?.name || 'Someone';
    const card = a.card?.title ? `"${a.card.title}"` : 'a card';
    const board = a.board?.name ? `on ${a.board.name}` : '';
    switch (a.type) {
      case 'card_created':
        return `${actor} created ${card} ${board}`;
      case 'card_moved':
        return `${actor} moved ${card} ${board}`;
      case 'card_updated':
        return `${actor} updated ${card} ${board}`;
      case 'card_deleted':
        return `${actor} deleted ${card} ${board}`;
      case 'comment_created':
        return `${actor} commented on ${card} ${board}`;
      case 'okr_task_created':
        return `${actor} linked ${card} to an OKR ${board}`;
      default:
        return `${actor} did ${a.type} ${board}`;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-[var(--accent)]" />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Weekly Digest</h1>
              <p className="text-sm text-[var(--text-tertiary)]">
                {formatDate(weekStart)} – {formatDate(weekEnd)}
              </p>
            </div>
          </div>
        </div>

        <AiSuggestionPanel className="mb-6" />

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card-base p-4">
            <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Completed this week</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{completedThisWeek.length}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">tasks done</div>
          </div>

          <div className="card-base p-4">
            <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Due this week</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{dueThisWeek.length}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">upcoming deadlines</div>
          </div>

          <div className="card-base p-4">
            <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Overdue</span>
            </div>
            <div className={`text-2xl font-semibold ${overdue.length > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
              {overdue.length}
            </div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">need attention</div>
          </div>

          <div className="card-base p-4">
            <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-2">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">OKR progress</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{Math.round(overallOkrProgress)}%</div>
            <div className="h-1.5 bg-[var(--bg-surface)] rounded overflow-hidden mt-2">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{ width: `${overallOkrProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Completed this week */}
          <div className="card-base p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Completed this week</h2>
            </div>
            {completedThisWeek.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No tasks completed yet this week.</p>
            ) : (
              <div className="space-y-2">
                {completedThisWeek.slice(0, 8).map((card) => (
                  <Link
                    key={card.id}
                    href={`/board/${card.boardId}?card=${card.id}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors text-sm"
                  >
                    <span className="text-[var(--text-primary)] truncate">{card.title}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{card.board.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Due this week */}
          <div className="card-base p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Due this week</h2>
            </div>
            {dueThisWeek.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No deadlines this week.</p>
            ) : (
              <div className="space-y-2">
                {dueThisWeek
                  .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                  .slice(0, 8)
                  .map((card) => (
                    <Link
                      key={card.id}
                      href={`/board/${card.boardId}?card=${card.id}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors text-sm"
                    >
                      <span className="text-[var(--text-primary)] truncate">{card.title}</span>
                      <span className="text-xs text-[var(--text-tertiary)] shrink-0">{formatDate(card.dueDate)}</span>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          {/* Overdue */}
          <div className="card-base p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Overdue tasks</h2>
            </div>
            {overdue.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No overdue tasks. Great job!</p>
            ) : (
              <div className="space-y-2">
                {overdue
                  .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                  .slice(0, 8)
                  .map((card) => (
                    <Link
                      key={card.id}
                      href={`/board/${card.boardId}?card=${card.id}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md bg-red-500/5 hover:bg-red-500/10 transition-colors text-sm"
                    >
                      <span className="text-[var(--text-primary)] truncate">{card.title}</span>
                      <span className="text-xs text-red-400 shrink-0">{formatDate(card.dueDate)}</span>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          {/* Team workload */}
          <div className="card-base p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Active team workload</h2>
            </div>
            {topAssignees.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No active assignments.</p>
            ) : (
              <div className="space-y-2">
                {topAssignees.map((member) => (
                  <div key={member.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
                        style={{ backgroundColor: member.color || 'var(--accent)' }}
                      >
                        {getInitials(member.name)}
                      </span>
                      <span className="text-sm text-[var(--text-primary)] truncate">{member.name}</span>
                    </div>
                    <span className="text-xs font-medium text-[var(--text-tertiary)]">{member.count} tasks</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* OKRs snapshot */}
        <div className="card-base p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">OKR snapshot</h2>
          </div>
          {objectives.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No OKRs set up yet.</p>
          ) : (
            <div className="space-y-3">
              {objectives.map((obj) => {
                const progress =
                  obj.keyResults.length === 0
                    ? 0
                    : obj.keyResults.reduce((acc, kr) => acc + pct(kr.current, kr.target), 0) /
                      obj.keyResults.length;
                return (
                  <div key={obj.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <Link
                        href={`/projects/${obj.projectId}/okrs`}
                        className="text-[var(--text-primary)] hover:text-[var(--accent)] truncate"
                      >
                        {obj.title}
                      </Link>
                      <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-surface)] rounded overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{obj.project.name}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent activity</h2>
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-[var(--border)] last:border-0"
                >
                  <span className="text-[var(--text-secondary)]">{formatActivity(a)}</span>
                  <span className="text-xs text-[var(--text-tertiary)] shrink-0">
                    {formatDate(a.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
