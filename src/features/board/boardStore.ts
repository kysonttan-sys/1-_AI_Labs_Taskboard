import { create } from 'zustand';
import type { Card, List, Board } from '@/types';
import { isCompletedStatus } from '@/lib/board/status';

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
  fetchProjectBoardsData: (projectId: string) => Promise<void>;
  addList: (title: string) => Promise<void>;
  updateList: (id: string, data: Partial<Pick<List, 'title' | 'position'>>) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  reorderLists: (listIds: string[]) => Promise<void>;
  addCard: (listId: string, title: string) => Promise<void>;
  updateCard: (id: string, data: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (cardId: string, targetListId: string, targetPosition: number) => Promise<void>;
  bulkUpdateCards: (
    operation: 'move' | 'archive' | 'delete' | 'assign' | 'label' | 'status',
    cardIds: string[],
    payload?: Record<string, unknown>
  ) => Promise<void>;
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
    try {
      const res = await fetch(`/api/boards/${id}`);
      if (!res.ok) {
        console.error(`[fetchBoard] failed: ${res.status} for board ${id}`);
        set({ lists: [], isLoading: false });
        return;
      }
      const data = await res.json();
      set({ lists: data.lists ?? [], isLoading: false });
    } catch (err) {
      console.error('[fetchBoard] error:', err);
      set({ lists: [], isLoading: false });
    }
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

  fetchProjectBoardsData: async (projectId) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/projects/${projectId}/boards`);
      if (!res.ok) {
        set({ lists: [], isLoading: false });
        return;
      }
      const projectBoards = await res.json();
      const allLists: List[] = [];
      for (const board of projectBoards) {
        try {
          const boardRes = await fetch(`/api/boards/${board.id}`);
          const data = await boardRes.json();
          if (data.lists) allLists.push(...data.lists);
        } catch { /* skip failed board */ }
      }
      set({ lists: allLists, isLoading: false });
    } catch {
      set({ lists: [], isLoading: false });
    }
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
    const newTitle = data.title;
    set((s) => ({
      lists: s.lists.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...data };
        if (newTitle) {
          updated.cards = l.cards.map((c) => ({
            ...c,
            status: newTitle,
            completedAt: isCompletedStatus(newTitle) ? new Date().toISOString() : null,
          }));
        }
        return updated;
      }),
    }));

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
      keyResults: card.keyResults ?? [],
      dependsOn: card.dependsOn ?? [],
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
    set((s) => {
      const prevList = s.lists.find((l) => l.cards.some((c) => c.id === id));
      const prevListId = prevList?.id;
      const targetListId = updated.listId as string | undefined;

      const mergeCard = (base: Card): Card => ({
        ...base,
        ...updated,
        assignees: updated.assignees ?? base.assignees,
        labels: updated.labels ?? base.labels,
        checklist: updated.checklist ?? base.checklist,
        keyResults: updated.keyResults ?? base.keyResults,
        dependsOn: updated.dependsOn ?? base.dependsOn,
      });

      const targetBoardId = updated.boardId as string | undefined;
      const prevBoardId = prevList?.boardId;
      const isCrossBoardMove = targetBoardId !== undefined && targetBoardId !== prevBoardId;

      if (prevListId && targetListId && (prevListId !== targetListId || isCrossBoardMove)) {
        const baseCard = prevList.cards.find((c) => c.id === id);
        if (!baseCard) {
          return {
            lists: s.lists.map((l) => ({
              ...l,
              cards: l.cards.map((c) => (c.id === id ? mergeCard(c) : c)),
            })),
          };
        }
        const movedCard = mergeCard(baseCard);
        // If target list isn't loaded yet (e.g., another board not fetched), try to find it in the store.
        const targetList = s.lists.find((l) => l.id === targetListId);
        if (!targetList) {
          // Target list not loaded; just remove from old list. Card will appear when target board is fetched.
          return {
            lists: s.lists.map((l) =>
              l.id === prevListId ? { ...l, cards: l.cards.filter((c) => c.id !== id) } : l
            ),
          };
        }
        return {
          lists: s.lists.map((l) => {
            if (l.id === prevListId) {
              return { ...l, cards: l.cards.filter((c) => c.id !== id) };
            }
            if (l.id === targetListId) {
              return { ...l, cards: [...l.cards, movedCard] };
            }
            return l;
          }),
        };
      }

      return {
        lists: s.lists.map((l) => ({
          ...l,
          cards: l.cards.map((c) => (c.id === id ? mergeCard(c) : c)),
        })),
      };
    });
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
      const sourceList = s.lists.find((l) => l.cards.some((c) => c.id === cardId));
      if (!sourceList) return s;

      const cardToMove = sourceList.cards.find((c) => c.id === cardId);
      if (!cardToMove) return s;

      const movedCard: Card = { ...cardToMove, listId: targetListId };
      const targetList = s.lists.find((l) => l.id === targetListId);
      if (targetList) {
        movedCard.status = targetList.title;
        movedCard.completedAt = isCompletedStatus(targetList.title) ? new Date().toISOString() : null;
      }

      const listsWithoutCard = s.lists.map((l) =>
        l.id === sourceList.id ? { ...l, cards: l.cards.filter((c) => c.id !== cardId) } : l
      );

      const finalLists = listsWithoutCard.map((l) => {
        if (l.id !== targetListId) return l;
        const insertAt = Math.min(targetPosition, l.cards.length);
        const newCards = [...l.cards];
        newCards.splice(insertAt, 0, movedCard);
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

  bulkUpdateCards: async (operation, cardIds, payload) => {
    const state = get();
    const activeBoardId = state.activeBoardId;
    if (!activeBoardId || cardIds.length === 0) return;

    const targetListId = typeof payload?.targetListId === 'string' ? payload.targetListId : undefined;
    const nextStatus = typeof payload?.status === 'string' ? payload.status : undefined;
    const assigneeIds = Array.isArray(payload?.assigneeIds) ? (payload.assigneeIds as string[]) : [];
    const appendAssignees = payload?.appendAssignees === true;
    const labelIds = Array.isArray(payload?.labelIds) ? (payload.labelIds as string[]) : [];
    const appendLabels = payload?.appendLabels === true;

    // Optimistic update
    set((s) => {
      const mutateCard = (card: Card): Card => {
        switch (operation) {
          case 'move':
            return targetListId ? { ...card, listId: targetListId } : card;
          case 'archive': {
            const doneList = s.lists.find((l) => isCompletedStatus(l.title));
            const archiveStatus = doneList?.title ?? 'Done';
            return { ...card, status: archiveStatus, completedAt: new Date().toISOString(), progress: 100 };
          }
          case 'status':
            return nextStatus
              ? {
                  ...card,
                  status: nextStatus,
                  completedAt: isCompletedStatus(nextStatus) ? new Date().toISOString() : null,
                }
              : card;
          case 'assign':
            if (assigneeIds.length === 0) return card;
            return {
              ...card,
              assignees: appendAssignees
                ? [
                    ...(card.assignees ?? []).filter((a) => !assigneeIds.includes(a.user.id)),
                    ...assigneeIds.map((id: string) => ({
                      user: { id, name: '', color: '#6366f1' },
                    })),
                  ]
                : assigneeIds.map((id: string) => ({
                    user: { id, name: '', color: '#6366f1' },
                  })),
            };
          case 'label':
            if (labelIds.length === 0) return card;
            return {
              ...card,
              labels: appendLabels
                ? [
                    ...(card.labels ?? []).filter((l) => !labelIds.includes(l.label.id)),
                    ...labelIds.map((id: string) => ({
                      label: { id, name: '', color: '#6366f1' },
                    })),
                  ]
                : labelIds.map((id: string) => ({
                    label: { id, name: '', color: '#6366f1' },
                  })),
            };
          case 'delete':
            return card;
        }
      };

      if (operation === 'delete') {
        return {
          lists: s.lists.map((l) => ({
            ...l,
            cards: l.cards.filter((c) => !cardIds.includes(c.id)),
          })),
        };
      }

      if (operation === 'move' && targetListId) {
        let movedCards: Card[] = [];
        const listsWithoutCards = s.lists.map((l) => {
          const toMove = l.cards.filter((c) => cardIds.includes(c.id));
          if (toMove.length > 0) {
            movedCards = [...movedCards, ...toMove.map((c) => ({ ...c, listId: targetListId }))];
          }
          return { ...l, cards: l.cards.filter((c) => !cardIds.includes(c.id)) };
        });
        const targetList = listsWithoutCards.find((l) => l.id === targetListId);
        if (!targetList) return s;
        const completedAt = isCompletedStatus(targetList.title) ? new Date().toISOString() : null;
        movedCards = movedCards.map((c) => ({
          ...c,
          status: targetList.title,
          completedAt,
        }));
        const finalLists = listsWithoutCards.map((l) =>
          l.id === targetListId ? { ...l, cards: [...l.cards, ...movedCards] } : l
        );
        return { lists: finalLists };
      }

      return {
        lists: s.lists.map((l) => ({
          ...l,
          cards: l.cards.map((c) => (cardIds.includes(c.id) ? mutateCard(c) : c)),
        })),
      };
    });

    try {
      const res = await fetch('/api/cards/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, cardIds, ...payload }),
      });
      if (!res.ok) throw new Error('Bulk operation failed');
      const data = await res.json();
      if (data.updated || data.deleted) {
        await get().fetchBoard(activeBoardId);
      }
    } catch (err) {
      console.error('[bulkUpdateCards] failed:', err);
      await get().fetchBoard(activeBoardId);
    }
  },
}));