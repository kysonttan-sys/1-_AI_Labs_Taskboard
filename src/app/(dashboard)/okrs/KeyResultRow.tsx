'use client';

import { useState, useEffect, useRef } from 'react';
import { useOkrStore } from '@/features/okrs/okrStore';
import { pct, formatValue } from '@/features/okrs/progress';
import { Trash2, Pencil, Check, X, ChevronUp, ChevronDown } from 'lucide-react';

interface Kr {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string | null;
  position: number;
}

interface Props {
  objectiveId: string;
  kr: Kr;
  index: number;
  total: number;
}

export default function KeyResultRow({ objectiveId, kr, index, total }: Props) {
  const { updateKeyResult, deleteKeyResult, reorderKeyResults } = useOkrStore();
  const [currentText, setCurrentText] = useState(String(kr.current));
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(kr.title);
  const [editTarget, setEditTarget] = useState(String(kr.target));
  const [editUnit, setEditUnit] = useState(kr.unit ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local input from the store ONLY when the input isn't focused,
  // and only when the store's current actually differs from what we last
  // rendered. This prevents an in-flight optimistic update or a refetch
  // from clobbering text the user is mid-way through editing.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    if (String(kr.current) !== currentText) {
      setCurrentText(String(kr.current));
    }
    // We intentionally only react to kr.current changes — we don't want
    // our own setCurrentText to re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kr.current]);

  const commitCurrent = async () => {
    const parsed = Number(currentText);
    if (Number.isNaN(parsed) || parsed < 0) {
      setCurrentText(String(kr.current));
      return;
    }
    if (parsed === kr.current) return;
    setError(null);
    try {
      await updateKeyResult(objectiveId, kr.id, { current: parsed });
    } catch (e) {
      setError((e as Error).message);
      setCurrentText(String(kr.current));
    }
  };

  const saveEdit = async () => {
    const title = editTitle.trim();
    const target = Number(editTarget);
    if (!title) {
      setError('Title is required.');
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      setError('Target must be a positive number.');
      return;
    }
    setError(null);
    try {
      await updateKeyResult(objectiveId, kr.id, {
        title,
        target,
        unit: editUnit.trim(),
      });
      setIsEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const cancelEdit = () => {
    setEditTitle(kr.title);
    setEditTarget(String(kr.target));
    setEditUnit(kr.unit ?? '');
    setIsEditing(false);
    setError(null);
  };

  const moveUp = () => {
    if (index <= 0) return;
    reorderKeyResults(objectiveId, index, index - 1);
  };

  const moveDown = () => {
    if (index >= total - 1) return;
    reorderKeyResults(objectiveId, index, index + 1);
  };

  const progress = pct(kr.current, kr.target);

  if (isEditing) {
    return (
      <div className="py-3 border-t border-[var(--border)] first:border-t-0">
        <div className="flex flex-col gap-2">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Key result title..."
            maxLength={200}
            className="w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editTarget}
              onChange={(e) => setEditTarget(e.target.value)}
              placeholder="Target"
              min="0"
              step="any"
              className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
            />
            <input
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              placeholder="Unit (optional)"
              maxLength={32}
              className="w-32 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
            />
            <button
              onClick={saveEdit}
              className="p-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)]"
              title="Save"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancelEdit}
              className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 border-t border-[var(--border)] first:border-t-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex flex-col">
            <button
              onClick={moveUp}
              disabled={index <= 0}
              className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-30 disabled:hover:text-[var(--text-tertiary)]"
              title="Move up"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              onClick={moveDown}
              disabled={index >= total - 1}
              className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-30 disabled:hover:text-[var(--text-tertiary)]"
              title="Move down"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <p className="text-sm text-[var(--text-primary)] truncate">{kr.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[var(--text-tertiary)] font-mono">
            {formatValue(kr.current, kr.target, kr.unit)}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            title="Edit key result"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteKeyResult(objectiveId, kr.id)}
            className="p-1 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
            title="Delete key result"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="number"
          value={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
          onBlur={commitCurrent}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setCurrentText(String(kr.current));
              (e.target as HTMLInputElement).blur();
            }
          }}
          step="any"
          min="0"
          className="w-24 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
        />
        <span className="text-xs text-[var(--text-tertiary)]">/ {kr.target}{kr.unit ? ` ${kr.unit}` : ''}</span>
        <div className="flex-1 h-1.5 bg-[var(--bg-surface)] rounded overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-[var(--text-tertiary)] w-10 text-right tabular-nums">{Math.round(progress)}%</span>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
