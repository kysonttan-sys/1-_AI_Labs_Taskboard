'use client';

import { useEffect, useState } from 'react';
import { useOkrStore } from '@/features/okrs/okrStore';
import type { Objective as ApiObjective } from '@/lib/api/okrs';
import { pct } from '@/features/okrs/progress';
import ObjectiveCard from './ObjectiveCard';
import ObjectiveCreateModal from './ObjectiveCreateModal';
import { Plus, Target } from 'lucide-react';

type Objective = ApiObjective & {
  startDate: string;
  endDate: string;
  keyResults: (ApiObjective['keyResults'][number])[];
};

export type SerializedObjective = Objective;

interface Props {
  initialObjectives: Objective[];
}

export default function ObjectiveList({ initialObjectives }: Props) {
  const { objectives, fetchObjectives, error, isLoading } = useOkrStore();
  const [modalOpen, setModalOpen] = useState(false);

  // Seed the store with SSR data on first mount, then skip the refetch
  // entirely. The store starts empty on the client; without this, every
  // cold load would issue a /api/okrs request even though we already
  // have fresh data from the server render.
  useEffect(() => {
    if (useOkrStore.getState().objectives.length === 0 && initialObjectives.length > 0) {
      useOkrStore.setState({ objectives: initialObjectives });
    }
    // We deliberately don't call fetchObjectives() here — the SSR data
    // is already current as of the page render. Refetching would just
    // burn a network call for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use the store data when it has been populated (e.g. by a mutation
  // that ran after mount); fall back to the SSR initial data only if
  // the store is empty AND we got no SSR data either.
  const list = objectives.length > 0 ? objectives : initialObjectives;

  const overallPct = (obj: Objective) => {
    if (obj.keyResults.length === 0) return 0;
    const sum = obj.keyResults.reduce((acc, kr) => acc + pct(kr.current, kr.target), 0);
    return sum / obj.keyResults.length;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-[var(--accent)]" />
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Objectives</h1>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-[var(--text-primary)] transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Objective
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {list.length === 0 && !isLoading ? (
          <div className="card-base p-8 text-center">
            <Target className="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-3" />
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-1">No objectives yet</h2>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">
              Create your first OKR to start tracking what matters.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-[var(--text-primary)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create your first OKR
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((obj) => (
              <ObjectiveCard key={obj.id} objective={obj} overallPct={overallPct(obj)} />
            ))}
          </div>
        )}

        {modalOpen && <ObjectiveCreateModal onClose={() => setModalOpen(false)} />}
      </div>
    </div>
  );
}
