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
    // Optimistic update: apply locally, revert on error.
    const previous = get().objectives.find((o) => o.id === objectiveId);
    const previousKr = previous?.keyResults.find((kr) => kr.id === krId);
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
      // Revert.
      if (previous && previousKr) {
        set((s) => ({
          objectives: s.objectives.map((o) =>
            o.id === objectiveId
              ? {
                  ...o,
                  keyResults: o.keyResults.map((k) => (k.id === krId ? previousKr : k)),
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
        o.id === objectiveId
          ? { ...o, keyResults: o.keyResults.filter((k) => k.id !== krId) }
          : o
      ),
    }));
  },
}));
