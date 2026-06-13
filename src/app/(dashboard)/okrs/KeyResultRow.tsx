'use client';

import { useState, useEffect } from 'react';
import { useOkrStore } from '@/features/okrs/okrStore';
import { pct, formatValue } from '@/features/okrs/progress';
import { Trash2 } from 'lucide-react';

interface Kr {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string | null;
}

interface Props {
  objectiveId: string;
  kr: Kr;
}

export default function KeyResultRow({ objectiveId, kr }: Props) {
  const { updateKeyResult, deleteKeyResult } = useOkrStore();
  const [currentText, setCurrentText] = useState(String(kr.current));
  const [error, setError] = useState<string | null>(null);

  // Sync local input when the store value changes from elsewhere.
  useEffect(() => {
    setCurrentText(String(kr.current));
  }, [kr.current]);

  const commit = async () => {
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

  const progress = pct(kr.current, kr.target);

  return (
    <div className="py-3 border-t border-[var(--border)] first:border-t-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-sm text-[var(--text-primary)]">{kr.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[var(--text-tertiary)] font-mono">
            {formatValue(kr.current, kr.target, kr.unit)}
          </span>
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
          type="number"
          value={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
          onBlur={commit}
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
