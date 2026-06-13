'use client';

import { useState } from 'react';
import { useOkrStore } from '@/features/okrs/okrStore';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import KeyResultRow from './KeyResultRow';
import ObjectiveCreateModal from './ObjectiveCreateModal';
import type { Objective as ApiObjective } from '@/lib/api/okrs';

type Objective = ApiObjective;

interface Props {
  objective: Objective;
  overallPct: number;
}

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${new Date(start).toLocaleDateString('en-US', opts)} – ${new Date(end).toLocaleDateString('en-US', opts)}`;
}

export default function ObjectiveCard({ objective, overallPct }: Props) {
  const { addKeyResult, deleteObjective } = useOkrStore();
  const [editing, setEditing] = useState(false);
  const [addingKr, setAddingKr] = useState(false);
  const [newKrTitle, setNewKrTitle] = useState('');
  const [newKrTarget, setNewKrTarget] = useState('100');
  const [newKrUnit, setNewKrUnit] = useState('');

  const handleAddKr = async () => {
    if (!newKrTitle.trim()) return;
    const target = Number(newKrTarget);
    if (!Number.isFinite(target) || target <= 0) return;
    await addKeyResult(objective.id, {
      title: newKrTitle.trim(),
      target,
      unit: newKrUnit.trim() || undefined,
    });
    setNewKrTitle('');
    setNewKrTarget('100');
    setNewKrUnit('');
    setAddingKr(false);
  };

  return (
    <div className="card-base p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] truncate">{objective.title}</h2>
          <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] mt-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDateRange(objective.startDate, objective.endDate)}</span>
          </div>
          {objective.description && (
            <p className="text-sm text-[var(--text-secondary)] mt-2">{objective.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            title="Edit objective"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${objective.title}" and all its key results?`)) {
                deleteObjective(objective.id);
              }
            }}
            className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
            title="Delete objective"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mb-1">
          <span>Overall progress</span>
          <span className="tabular-nums">{Math.round(overallPct)}%</span>
        </div>
        <div className="h-2 bg-[var(--bg-surface)] rounded overflow-hidden">
          <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      <div>
        {objective.keyResults.map((kr) => (
          <KeyResultRow key={kr.id} objectiveId={objective.id} kr={kr} />
        ))}
      </div>

      {addingKr ? (
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
          <input
            autoFocus
            value={newKrTitle}
            onChange={(e) => setNewKrTitle(e.target.value)}
            placeholder="Key result title..."
            className="w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newKrTarget}
              onChange={(e) => setNewKrTarget(e.target.value)}
              placeholder="Target"
              min="0"
              step="any"
              className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
            />
            <input
              value={newKrUnit}
              onChange={(e) => setNewKrUnit(e.target.value)}
              placeholder="Unit (optional)"
              maxLength={32}
              className="flex-1 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
            />
            <button
              onClick={handleAddKr}
              className="px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-medium text-[var(--text-primary)]"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAddingKr(false);
                setNewKrTitle('');
                setNewKrTarget('100');
                setNewKrUnit('');
              }}
              className="px-3 py-1.5 rounded text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingKr(true)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors border border-dashed border-[var(--border)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Key Result
        </button>
      )}

      {editing && <ObjectiveCreateModal objective={objective} onClose={() => setEditing(false)} />}
    </div>
  );
}
