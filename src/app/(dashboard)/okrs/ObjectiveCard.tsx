'use client';

import { useState } from 'react';
import { useOkrStore } from '@/features/okrs/okrStore';
import { Plus, Pencil, Trash2, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { AiAssistButton } from '@/components/ai/AiAssistButton';
import { useCollapsedIds } from '@/lib/hooks/useCollapsedIds';
import KeyResultRow from './KeyResultRow';
import ObjectiveCreateModal from './ObjectiveCreateModal';
import type { Objective as ApiObjective } from '@/lib/api/okrs';

type Objective = ApiObjective;

interface Props {
  objective: Objective;
  projectId: string;
  overallPct: number;
}

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${new Date(start).toLocaleDateString('en-US', opts)} – ${new Date(end).toLocaleDateString('en-US', opts)}`;
}

function deriveTrackingMode(unit: string, mode: 'auto' | 'manual' | undefined): 'auto' | 'manual' {
  if (mode) return mode;
  return unit.trim().toLowerCase() === '%' ? 'auto' : 'manual';
}

export default function ObjectiveCard({ objective, projectId, overallPct }: Props) {
  const { addKeyResult, deleteObjective } = useOkrStore();
  const { isCollapsed, toggle } = useCollapsedIds('okr-collapsed-objectives');
  const [editing, setEditing] = useState(false);
  const [addingKr, setAddingKr] = useState(false);
  const [newKrTitle, setNewKrTitle] = useState('');
  const [newKrTarget, setNewKrTarget] = useState('100');
  const [newKrUnit, setNewKrUnit] = useState('');
  const [newKrTrackingMode, setNewKrTrackingMode] = useState<'auto' | 'manual'>('manual');
  const [newKrStartDate, setNewKrStartDate] = useState('');
  const [newKrEndDate, setNewKrEndDate] = useState('');

  const linkedTaskCount = objective.keyResults.reduce(
    (acc, kr) => acc + (kr.cards?.length ?? 0),
    0
  );

  const handleAddKr = async () => {
    if (!newKrTitle.trim()) return;
    const target = Number(newKrTarget);
    if (!Number.isFinite(target) || target <= 0) return;
    if (!newKrStartDate || !newKrEndDate) return;
    const unit = newKrUnit.trim() || undefined;
    const trackingMode = deriveTrackingMode(newKrUnit, newKrTrackingMode);
    await addKeyResult(objective.id, {
      title: newKrTitle.trim(),
      target,
      unit,
      trackingMode,
      startDate: newKrStartDate,
      endDate: newKrEndDate,
    });
    setNewKrTitle('');
    setNewKrTarget('100');
    setNewKrUnit('');
    setNewKrTrackingMode('manual');
    setNewKrStartDate('');
    setNewKrEndDate('');
    setAddingKr(false);
  };

  return (
    <div className="card-base p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={() => toggle(objective.id)}
            className="mt-0.5 p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
            title={isCollapsed(objective.id) ? 'Expand objective' : 'Collapse objective'}
            aria-expanded={!isCollapsed(objective.id)}
          >
            {isCollapsed(objective.id) ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
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

      {isCollapsed(objective.id) ? (
        <div className="mt-2 text-xs text-[var(--text-tertiary)]">
          {objective.keyResults.length} key {objective.keyResults.length === 1 ? 'result' : 'results'}
          {linkedTaskCount > 0 && ` · ${linkedTaskCount} linked ${linkedTaskCount === 1 ? 'task' : 'tasks'}`}
        </div>
      ) : (
        <>
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
            {objective.keyResults.map((kr, i) => (
              <KeyResultRow key={kr.id} objectiveId={objective.id} projectId={projectId} kr={kr} index={i} total={objective.keyResults.length} />
            ))}
          </div>

          {addingKr ? (
            <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
              <div className="flex items-start gap-1.5">
                <input
                  autoFocus
                  value={newKrTitle}
                  onChange={(e) => setNewKrTitle(e.target.value)}
                  placeholder="Key result title..."
                  className="flex-1 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
                />
                <AiAssistButton
                  field="key-result-title"
                  value={newKrTitle}
                  projectId={projectId}
                  objectiveId={objective.id}
                  onApply={(s) => setNewKrTitle(s.trim())}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newKrStartDate}
                  onChange={(e) => setNewKrStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
                />
                <span className="text-xs text-[var(--text-tertiary)]">to</span>
                <input
                  type="date"
                  value={newKrEndDate}
                  onChange={(e) => setNewKrEndDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
                />
              </div>
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
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewKrUnit(value);
                    if (value.trim().toLowerCase() === '%') {
                      setNewKrTrackingMode('auto');
                    } else if (newKrTrackingMode === 'auto') {
                      setNewKrTrackingMode('manual');
                    }
                  }}
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
                    setNewKrTrackingMode('manual');
                    setNewKrStartDate('');
                    setNewKrEndDate('');
                  }}
                  className="px-3 py-1.5 rounded text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`kr-mode-${objective.id}-new`}
                    checked={newKrTrackingMode === 'auto'}
                    onChange={() => setNewKrTrackingMode('auto')}
                    disabled={newKrUnit.trim().toLowerCase() !== '%'}
                    className="accent-[var(--accent)]"
                  />
                  Auto (% from tasks)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`kr-mode-${objective.id}-new`}
                    checked={newKrTrackingMode === 'manual'}
                    onChange={() => setNewKrTrackingMode('manual')}
                    className="accent-[var(--accent)]"
                  />
                  Manual
                </label>
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
        </>
      )}

      {editing && <ObjectiveCreateModal objective={objective} onClose={() => setEditing(false)} />}
    </div>
  );
}
