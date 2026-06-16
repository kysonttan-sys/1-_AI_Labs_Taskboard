'use client';

import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import type { Card, List } from '@/types';

export interface BoardFiltersState {
  text: string;
  assignees: string[];
  priorities: string[];
  statuses: string[];
  labels: string[];
  dueDate: 'all' | 'overdue' | 'today' | 'week' | 'none';
}

interface Props {
  lists: List[];
  filters: BoardFiltersState;
  onChange: (filters: BoardFiltersState) => void;
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const STATUSES = ['todo', 'in_progress', 'done'];

export function makeEmptyFilters(): BoardFiltersState {
  return {
    text: '',
    assignees: [],
    priorities: [],
    statuses: [],
    labels: [],
    dueDate: 'all',
  };
}

export function isActive(filters: BoardFiltersState): boolean {
  return (
    filters.text.trim().length > 0 ||
    filters.assignees.length > 0 ||
    filters.priorities.length > 0 ||
    filters.statuses.length > 0 ||
    filters.labels.length > 0 ||
    filters.dueDate !== 'all'
  );
}

export function filterCards(cards: Card[], filters: BoardFiltersState): Card[] {
  const text = filters.text.trim().toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  return cards.filter((card) => {
    if (text) {
      const match =
        card.title.toLowerCase().includes(text) ||
        (card.description?.toLowerCase().includes(text) ?? false);
      if (!match) return false;
    }

    if (filters.assignees.length > 0) {
      const cardAssignees = card.assignees?.map((a) => a.user.id) ?? [];
      if (!filters.assignees.some((id) => cardAssignees.includes(id))) return false;
    }

    if (filters.priorities.length > 0 && !filters.priorities.includes(card.priority)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(card.status)) return false;

    if (filters.labels.length > 0) {
      const cardLabels = card.labels?.map(({ label }) => label.id) ?? [];
      if (!filters.labels.some((id) => cardLabels.includes(id))) return false;
    }

    if (filters.dueDate !== 'all') {
      const due = card.dueDate ? new Date(card.dueDate) : null;
      if (filters.dueDate === 'none') {
        if (due) return false;
      } else if (!due) {
        return false;
      } else if (filters.dueDate === 'overdue') {
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        if (dueDay >= today) return false;
      } else if (filters.dueDate === 'today') {
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        if (dueDay.getTime() !== today.getTime()) return false;
      } else if (filters.dueDate === 'week') {
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        if (dueDay < today || dueDay > weekEnd) return false;
      }
    }

    return true;
  });
}

export default function BoardFilters({ lists, filters, onChange }: Props) {
  const allCards = useMemo(() => lists.flatMap((l) => l.cards), [lists]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const card of allCards) {
      for (const a of card.assignees ?? []) {
        if (!map.has(a.user.id)) {
          map.set(a.user.id, a.user);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allCards]);

  const labelOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const card of allCards) {
      for (const { label } of card.labels ?? []) {
        if (!map.has(label.id)) {
          map.set(label.id, label);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allCards]);

  function toggleArray(value: string, current: string[]) {
    return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  }

  const filteredCount = useMemo(() => filterCards(allCards, filters).length, [allCards, filters]);

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 mb-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
          <input
            value={filters.text}
            onChange={(e) => onChange({ ...filters, text: e.target.value })}
            placeholder="Filter cards by title or description..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-ring"
          />
          {filters.text && (
            <button
              onClick={() => onChange({ ...filters, text: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={filters.dueDate}
          onChange={(e) => onChange({ ...filters, dueDate: e.target.value as BoardFiltersState['dueDate'] })}
          className="px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-md text-[var(--text-primary)] focus-ring"
        >
          <option value="all">All due dates</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
          <option value="overdue">Overdue</option>
          <option value="none">No due date</option>
        </select>

        {isActive(filters) && (
          <button
            onClick={() => onChange(makeEmptyFilters())}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {assigneeOptions.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Assignees</span>
            <div className="flex flex-wrap gap-1">
              {assigneeOptions.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onChange({ ...filters, assignees: toggleArray(user.id, filters.assignees) })}
                  title={user.name}
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all
                    ${filters.assignees.includes(user.id)
                      ? 'ring-2 ring-[var(--accent)]'
                      : 'opacity-60 hover:opacity-100'
                    }`}
                  style={{
                    backgroundColor: `${user.color}22`,
                    color: user.color,
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Priority</span>
          <div className="flex flex-wrap gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => onChange({ ...filters, priorities: toggleArray(p, filters.priorities) })}
                className={`px-2 py-1 rounded text-[10px] font-medium capitalize border transition-colors
                  ${filters.priorities.includes(p)
                    ? 'bg-[var(--accent)] text-[var(--text-primary)] border-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-tertiary)] border-[var(--border)] hover:text-[var(--text-secondary)]'
                  }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Status</span>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => onChange({ ...filters, statuses: toggleArray(s, filters.statuses) })}
                className={`px-2 py-1 rounded text-[10px] font-medium capitalize border transition-colors
                  ${filters.statuses.includes(s)
                    ? 'bg-[var(--accent)] text-[var(--text-primary)] border-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-tertiary)] border-[var(--border)] hover:text-[var(--text-secondary)]'
                  }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {labelOptions.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Labels</span>
            <div className="flex flex-wrap gap-1">
              {labelOptions.map((label) => (
                <button
                  key={label.id}
                  onClick={() => onChange({ ...filters, labels: toggleArray(label.id, filters.labels) })}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors
                    ${filters.labels.includes(label.id)
                      ? 'ring-2 ring-offset-1 ring-offset-[var(--bg-elevated)]'
                      : 'opacity-70 hover:opacity-100'
                    }`}
                  style={{
                    backgroundColor: `${label.color}22`,
                    color: label.color,
                  }}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        Showing {filteredCount} of {allCards.length} cards
      </p>
    </div>
  );
}
