import { create } from 'zustand';

interface BulkSelectionState {
  selectedIds: Set<string>;
  isSelecting: boolean;
  toggle: (cardId: string) => void;
  select: (cardId: string) => void;
  deselect: (cardId: string) => void;
  setSelection: (ids: string[]) => void;
  clear: () => void;
  setIsSelecting: (value: boolean) => void;
}

export const useBulkSelectionStore = create<BulkSelectionState>((set) => ({
  selectedIds: new Set(),
  isSelecting: false,
  toggle: (cardId) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return { selectedIds: next };
    }),
  select: (cardId) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      next.add(cardId);
      return { selectedIds: next };
    }),
  deselect: (cardId) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      next.delete(cardId);
      return { selectedIds: next };
    }),
  setSelection: (ids) => set({ selectedIds: new Set(ids) }),
  clear: () => set({ selectedIds: new Set() }),
  setIsSelecting: (value) => set({ isSelecting: value }),
}));
