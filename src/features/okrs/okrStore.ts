import { create } from 'zustand';
import {
  okrsApi,
  type Objective,
  type CreateObjectiveInput,
  type UpdateObjectiveInput,
  type CreateKeyResultInput,
  type UpdateKeyResultInput,
} from '@/lib/api/okrs';

interface OkrState {
  objectives: Objective[];
  isLoading: boolean;
  error: string | null;
  fetchObjectives: () => Promise<void>;
  createObjective: (input: CreateObjectiveInput) => Promise<Objective>;
  updateObjective: (id: string, input: UpdateObjectiveInput) => Promise<Objective>;
  deleteObjective: (id: string) => Promise<void>;
  addKeyResult: (objectiveId: string, input: CreateKeyResultInput) => Promise<void>;
  updateKeyResult: (objectiveId: string, krId: string, input: UpdateKeyResultInput) => Promise<void>;
  deleteKeyResult: (objectiveId: string, krId: string) => Promise<void>;
  reorderKeyResults: (objectiveId: string, fromIndex: number, toIndex: number) => Promise<void>;
}

// Per-KR request counter for last-write-wins semantics. Each in-flight
// updateKeyResult claims a version; responses/rollbacks from older versions
// are ignored so a slow first request can never clobber a newer optimistic
// value, and a failure on request N can't roll back the value set by N+1.
const krRequestVersion = new Map<string, number>();

function nextVersion(krId: string): number {
  const v = (krRequestVersion.get(krId) ?? 0) + 1;
  krRequestVersion.set(krId, v);
  return v;
}

export const useOkrStore = create<OkrState>((set, get) => ({
  objectives: [],
  isLoading: false,
  error: null,

  fetchObjectives: async () => {
    set({ isLoading: true, error: null });
    try {
      const objectives = await okrsApi.list();
      set({ objectives, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createObjective: async (input) => {
    const created = await okrsApi.create(input);
    set((s) => ({ objectives: [...s.objectives, created] }));
    return created;
  },

  updateObjective: async (id, input) => {
    const updated = await okrsApi.update(id, input);
    set((s) => ({
      objectives: s.objectives.map((o) => (o.id === id ? updated : o)),
    }));
    return updated;
  },

  deleteObjective: async (id) => {
    await okrsApi.remove(id);
    set((s) => ({ objectives: s.objectives.filter((o) => o.id !== id) }));
  },

  addKeyResult: async (objectiveId, input) => {
    const kr = await okrsApi.addKeyResult(objectiveId, input);
    set((s) => ({
      objectives: s.objectives.map((o) =>
        o.id === objectiveId ? { ...o, keyResults: [...o.keyResults, kr] } : o
      ),
    }));
  },

  updateKeyResult: async (objectiveId, krId, input) => {
    // Capture pre-optimistic value so a rollback restores the user's
    // original view, not the prior call's optimistic value.
    const before = get().objectives.find((o) => o.id === objectiveId);
    const previousKr = before?.keyResults.find((kr) => kr.id === krId);
    const version = nextVersion(krId);

    // Optimistic update
    set((s) => ({
      objectives: s.objectives.map((o) =>
        o.id === objectiveId
          ? {
              ...o,
              keyResults: o.keyResults.map((kr) =>
                kr.id === krId ? { ...kr, ...input } : kr
              ),
            }
          : o
      ),
    }));

    try {
      const kr = await okrsApi.updateKeyResult(objectiveId, krId, input);
      // If a newer updateKeyResult has started since, drop this stale
      // response on the floor — the newer call owns the truth now.
      if (krRequestVersion.get(krId) !== version) return;
      set((s) => ({
        objectives: s.objectives.map((o) =>
          o.id === objectiveId
            ? {
                ...o,
                keyResults: o.keyResults.map((k) => (k.id === krId ? kr : k)),
              }
            : o
        ),
      }));
    } catch (e) {
      // A newer call owns the rollback decision — just propagate the error.
      if (krRequestVersion.get(krId) !== version) throw e;
      if (previousKr) {
        set((s) => ({
          objectives: s.objectives.map((o) =>
            o.id === objectiveId
              ? {
                  ...o,
                  keyResults: o.keyResults.map((k) =>
                    k.id === krId ? previousKr : k
                  ),
                }
              : o
          ),
        }));
      }
      throw e;
    }
  },

  deleteKeyResult: async (objectiveId, krId) => {
    await okrsApi.removeKeyResult(objectiveId, krId);
    set((s) => ({
      objectives: s.objectives.map((o) =>
        o.id === objectiveId ? { ...o, keyResults: o.keyResults.filter((k) => k.id !== krId) } : o
      ),
    }));
  },

  reorderKeyResults: async (objectiveId, fromIndex, toIndex) => {
    const objective = get().objectives.find((o) => o.id === objectiveId);
    if (!objective) return;
    const keyResults = [...objective.keyResults];
    if (fromIndex < 0 || fromIndex >= keyResults.length || toIndex < 0 || toIndex >= keyResults.length) return;

    const [moved] = keyResults.splice(fromIndex, 1);
    keyResults.splice(toIndex, 0, moved);
    const reorderedIds = keyResults.map((k) => k.id);

    // Optimistic update
    set((s) => ({
      objectives: s.objectives.map((o) =>
        o.id === objectiveId ? { ...o, keyResults } : o
      ),
    }));

    try {
      await okrsApi.reorderKeyResults(objectiveId, reorderedIds);
    } catch (e) {
      set({ error: (e as Error).message });
      // Rollback on error by refetching
      get().fetchObjectives();
    }
  },
}));
