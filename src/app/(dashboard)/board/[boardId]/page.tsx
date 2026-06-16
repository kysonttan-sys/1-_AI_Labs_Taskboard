'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useBoardStore } from '@/features/board/boardStore';
import { useChatStore } from '@/features/chat/chatStore';
import { useAuthStore } from '@/features/auth/authStore';
import KanbanBoard from '@/components/board/KanbanBoard';
import CardDetailModal from '@/components/board/CardDetailModal';
import TeamChat from '@/components/chat/TeamChat';
import BoardFilters, { makeEmptyFilters, filterCards, type BoardFiltersState } from '@/components/board/BoardFilters';

export default function BoardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const boardId = params.boardId as string;
  const cardParam = searchParams.get('card');
  const { lists, isLoading, fetchBoard, setActiveBoard } = useBoardStore();
  const { isOpen: chatOpen } = useChatStore();
  const { user } = useAuthStore();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(cardParam);
  const [filters, setFilters] = useState<BoardFiltersState>(makeEmptyFilters());

  useEffect(() => {
    if (boardId) {
      setActiveBoard(boardId);
      fetchBoard(boardId);
    }
  }, [boardId, fetchBoard, setActiveBoard]);

  // Set current user ID in chat store for sound filtering
  useEffect(() => {
    if (user?.id) {
      useChatStore.getState().setCurrentUserId(user.id);
    }
  }, [user?.id]);

  // Apply filters to lists (cards only; list structure preserved)
  const filteredLists = useMemo(() => {
    return lists.map((list) => ({
      ...list,
      cards: filterCards(list.cards, filters),
    }));
  }, [lists, filters]);

  // Find the selected card from the current lists
  const selectedCard = useMemo(() => {
    if (!selectedCardId) return null;
    for (const list of filteredLists) {
      const card = list.cards.find((c) => c.id === selectedCardId);
      if (card) return card;
    }
    return null;
  }, [selectedCardId, filteredLists]);

  if (!boardId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-[var(--text-tertiary)] text-sm">Select a board to get started</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 rounded-md bg-[var(--accent)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full relative">
      <div className="flex-1 min-w-0 flex flex-col">
        <BoardFilters lists={lists} filters={filters} onChange={setFilters} />
        <div className="flex-1 min-h-0">
          <KanbanBoard lists={filteredLists} onCardClick={(card) => setSelectedCardId(card.id)} />
        </div>
      </div>
      <div className="flex items-start gap-2 shrink-0">
        {!chatOpen && (
          <TeamChat boardId={boardId} />
        )}
      </div>
      {chatOpen && (
        <TeamChat boardId={boardId} />
      )}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </div>
  );
}