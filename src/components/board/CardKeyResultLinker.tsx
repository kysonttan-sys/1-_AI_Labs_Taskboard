'use client';

import { useEffect, useMemo, useState } from 'react';
import { Target, Plus, X } from 'lucide-react';

interface KeyResult {
  id: string;
  title: string;
}

interface Objective {
  id: string;
  title: string;
  keyResults: KeyResult[];
}

interface LinkedKeyResult {
  keyResultId: string;
  weight: number;
  keyResult: KeyResult;
}

interface Props {
  cardId: string;
  boardId: string;
  linked: LinkedKeyResult[];
  onChange: (linked: LinkedKeyResult[]) => void;
}

export default function CardKeyResultLinker({ cardId, boardId, linked, onChange }: Props) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch(`/api/boards/${boardId}/key-results`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setObjectives(data);
      })
      .catch(() => {});
  }, [boardId]);

  const linkedIds = useMemo(() => new Set(linked.map((l) => l.keyResultId)), [linked]);

  const allKrs = useMemo(
    () =>
      objectives.flatMap((o) =>
        o.keyResults.map((kr) => ({ ...kr, objectiveTitle: o.title }))
      ),
    [objectives]
  );

  const available = useMemo(
    () =>
      allKrs
        .filter((kr) => !linkedIds.has(kr.id))
        .filter(
          (kr) =>
            kr.title.toLowerCase().includes(query.toLowerCase()) ||
            kr.objectiveTitle.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 6),
    [allKrs, linkedIds, query]
  );

  async function linkKr(kr: KeyResult & { objectiveTitle: string }) {
    const res = await fetch(`/api/cards/${cardId}/key-results`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyResultId: kr.id }),
    });
    if (!res.ok) return;
    onChange([...linked, { keyResultId: kr.id, weight: 1, keyResult: kr }]);
    setQuery('');
  }

  async function unlinkKr(keyResultId: string) {
    const res = await fetch(`/api/cards/${cardId}/key-results/${keyResultId}`, {
      method: 'DELETE',
    });
    if (!res.ok) return;
    onChange(linked.filter((l) => l.keyResultId !== keyResultId));
  }

  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Target className="h-3 w-3" />
        Key Results
      </label>

      {linked.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {linked.map((l) => (
            <div
              key={l.keyResultId}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]"
            >
              <span className="truncate max-w-[180px]">{l.keyResult.title}</span>
              <button
                onClick={() => unlinkKr(l.keyResultId)}
                className="text-[var(--text-tertiary)] hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search key results..."
          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring"
        />
        {query && available.length > 0 && (
          <div className="absolute z-10 mt-1 w-full card-base border border-[var(--border)] max-h-48 overflow-y-auto">
            {available.map((kr) => (
              <button
                key={kr.id}
                onClick={() => linkKr(kr)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-card-hover)] flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[var(--text-primary)] truncate">{kr.title}</p>
                  <p className="text-xs text-[var(--text-tertiary)] truncate">{kr.objectiveTitle}</p>
                </div>
                <Plus className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {objectives.length === 0 && (
        <p className="text-xs text-[var(--text-tertiary)] mt-1">No OKRs linked to this board&apos;s project.</p>
      )}
    </div>
  );
}
