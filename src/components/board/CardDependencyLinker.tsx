'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link2, Plus, X } from 'lucide-react';
import { isCompletedStatus } from '@/lib/board/status';

interface DepCard {
  id: string;
  title: string;
  status: string;
  completedAt: string | null;
}

interface Dependency {
  dependsOnCardId: string;
  dependsOnCard: DepCard;
}

interface Props {
  cardId: string;
  boardId: string;
  dependencies: Dependency[];
  onChange: (deps: Dependency[]) => void;
}

export default function CardDependencyLinker({ cardId, boardId, dependencies, onChange }: Props) {
  const [boardCards, setBoardCards] = useState<DepCard[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch(`/api/boards/${boardId}/cards`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBoardCards(data);
      })
      .catch(() => {});
  }, [boardId]);

  const linkedIds = useMemo(
    () => new Set(dependencies.map((d) => d.dependsOnCardId)),
    [dependencies]
  );

  const available = useMemo(
    () =>
      boardCards
        .filter((c) => c.id !== cardId && !linkedIds.has(c.id))
        .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6),
    [boardCards, cardId, linkedIds, query]
  );

  async function addDep(target: DepCard) {
    const res = await fetch(`/api/cards/${cardId}/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dependsOnCardId: target.id }),
    });
    if (!res.ok) return;
    onChange([...dependencies, { dependsOnCardId: target.id, dependsOnCard: target }]);
    setQuery('');
  }

  async function removeDep(dependsOnCardId: string) {
    const res = await fetch(`/api/cards/${cardId}/dependencies/${dependsOnCardId}`, {
      method: 'DELETE',
    });
    if (!res.ok) return;
    onChange(dependencies.filter((d) => d.dependsOnCardId !== dependsOnCardId));
  }

  const isDone = (c: DepCard) => isCompletedStatus(c.status) || !!c.completedAt;

  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Link2 className="h-3 w-3" />
        Dependencies
      </label>

      {dependencies.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {dependencies.map((d) => (
            <div
              key={d.dependsOnCardId}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs border ${
                isDone(d.dependsOnCard)
                  ? 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-tertiary)]'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              <span className="truncate">{d.dependsOnCard.title}</span>
              <button
                onClick={() => removeDep(d.dependsOnCardId)}
                className="text-[var(--text-tertiary)] hover:text-red-400 shrink-0"
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
          placeholder="Search cards..."
          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring"
        />
        {query && available.length > 0 && (
          <div className="absolute z-10 mt-1 w-full card-base border border-[var(--border)] max-h-48 overflow-y-auto">
            {available.map((c) => (
              <button
                key={c.id}
                onClick={() => addDep(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-card-hover)] flex items-center justify-between"
              >
                <span className="text-[var(--text-primary)] truncate">{c.title}</span>
                <Plus className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
