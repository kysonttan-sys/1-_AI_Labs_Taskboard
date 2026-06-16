import { create } from 'zustand';
import type { Card, List, Board } from '@/types';

interface BoardState {
  boards: Board[];
  activeBoardId: string | null;
  lists: List[];
  isLoading: boolean;
  fetchBoards: () => Promise<void>;
  createBoard: (name: string, icon?: string, projectId?: string) => Promise<Board>;
  updateBoard: (id: string, data: Partial<Pick<Board, 'name' | 'icon'>>) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  reorderBoards: (boardIds: string[]) => Promise<void>;
  setActiveBoard: (id: string) => void;
  fetchBoard: (id: string) => Promise<void>;
  fetchAllBoardsData: () => Promise<void>;
  addList: (title: string) => Promise<void>;
  updateList: (id: string, data: Partial<Pick<List, 'title' | 'position'>>) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  reorderLists: (listIds: string[]) => Promise<void>;
  addCard: (listId: string, title: string) => Promise<void>;
  updateCard: (id: string, data: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (cardId: string, targetListId: string, targetPosition: number) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards: [],
  activeBoardId: null,
  lists: [],
  isLoading: false,

  fetchBoards: async () => {
    try {
      const res = await fetch('/api/boards');
      if (!res.ok) {
        set({ boards: [] });
        return;
      }
      const boards = await res.json();
      set({ boards: Array.isArray(boards) ? boards : [] });
    } catch {
      set({ boards: [] });
    }
  },

  createBoard: async (name, icon = '📋', projectId) => {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon, projectId }),
    });
    const board = await res.json();
    set((s) => ({ boards: [...s.boards, board] }));
    return board;
  },

  updateBoard: async (id, data) => {
    await fetch(`/api/boards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    set((s) => ({
      boards: s.boards.map((b) => (b.id === id ? { ...b, ...data } : b)),
    }));
  },

  deleteBoard: async (id) => {
    await fetch(`/api/boards/${id}`, { method: 'DELETE' });
    set((s) => ({ boards: s.boards.filter((b) => b.id !== id), activeBoardId: s.activeBoardId === id ? null : s.activeBoardId }));
  },

  reorderBoards: async (boardIds) => {
    // Optimistic update
    const boardMap = new Map(get().boards.map((b) => [b.id, b]));
    const reordered = boardIds.map((id, index) => {
      const board = boardMap.get(id);
      return board ? { ...board, position: index } : boardMap.get(id)!;
    }).filter(Boolean);
    set({ boards: reordered });

    await fetch('/api/boards/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardIds }),
    });
  },

  setActiveBoard: (id) => set({ activeBoardId: id }),

  fetchBoard: async (id) => {
    set({ isLoading: true });
    const res = await fetch(`/api/boards/${id}`);
    const data = await res.json();
    set({ lists: data.lists, isLoading: false });
  },

  fetchAllBoardsData: async () => {
    const boards = get().boards;
    if (boards.length === 0) return;
    set({ isLoading: true });
    const allLists: List[] = [];
    for (const board of boards) {
      try {
        const res = await fetch(`/api/boards/${board.id}`);
        const data = await res.json();
        if (data.lists) allLists.push(...data.lists);
      } catch { /* skip failed board */ }
    }
    set({ lists: allLists, isLoading: false });
  },

  addList: async (title) => {
    const boardId = get().activeBoardId;
    if (!boardId) return;
    const res = await fetch(`/api/boards/${boardId}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const list = await res.json();
    set((s) => ({ lists: [...s.lists, { ...list, cards: [] }] }));
  },

  updateList: async (id, data) => {
    await fetch(`/api/lists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteList: async (id) => {
    await fetch(`/api/lists/${id}`, { method: 'DELETE' });
    set((s) => ({ lists: s.lists.filter((l) => l.id !== id) }));
  },

  reorderLists: async (listIds) => {
    const boardId = get().activeBoardId;
    if (!boardId) return;

    // Optimistic update
    const listMap = new Map(get().lists.map((l) => [l.id, l]));
    const reordered = listIds.map((id, index) => {
      const list = listMap.get(id);
      return list ? { ...list, position: index } : listMap.get(id)!;
    }).filter(Boolean);
    set({ lists: reordered });

    await fetch(`/api/boards/${boardId}/lists/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listIds }),
    });
  },

  addCard: async (listId, title) => {
    const res = await fetch(`/api/lists/${listId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const card = await res.json();
    const normalized = {
      ...card,
      assignees: card.assignees ?? [],
      labels: card.labels ?? [],
      checklist: card.checklist ?? [],
      _count: card._count ?? { comments: 0 },
    };
    set((s) => ({
      lists: s.lists.map((l) =>
        l.id === listId ? { ...l, cards: [...l.cards, normalized] } : l
      ),
    }));
  },

  updateCard: async (id, data) => {
    const res = await fetch(`/api/cards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set((s) => ({
      lists: s.lists.map((l) => ({
        ...l,
        cards: l.cards.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            ...updated,
            assignees: updated.assignees ?? c.assignees,
            labels: updated.labels ?? c.labels,
            checklist: updated.checklist ?? c.checklist,
          };
        }),
      })),
    }));
  },

  deleteCard: async (id) => {
    await fetch(`/api/cards/${id}`, { method: 'DELETE' });
    set((s) => ({
      lists: s.lists.map((l) => ({
        ...l,
        cards: l.cards.filter((c) => c.id !== id),
      })),
    }));
  },

  moveCard: async (cardId, targetListId, targetPosition) => {
    // Optimistically update local state
    set((s) => {
      let movedCard: Card | null = null;
      const listsWithoutCard = s.lists.map((l) => {
        const idx = l.cards.findIndex((c) => c.id === cardId);
        if (idx !== -1) {
          movedCard = { ...l.cards[idx], listId: targetListId };
          return { ...l, cards: l.cards.filter((c) => c.id !== cardId) };
        }
        return l;
      });

      if (!movedCard) return s;

      const finalLists = listsWithoutCard.map((l) => {
        if (l.id !== targetListId) return l;
        const insertAt = Math.min(targetPosition, l.cards.length);
        const newCards = [...l.cards];
        newCards.splice(insertAt, 0, movedCard!);
        return { ...l, cards: newCards };
      });

      return { lists: finalLists };
    });

    await fetch(`/api/cards/${cardId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetListId, targetPosition }),
    });
  },
}));