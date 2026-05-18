'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useBoardStore } from '@/features/board/boardStore';
import { useChatStore } from '@/features/chat/chatStore';
import { useAuthStore } from '@/features/auth/authStore';
import KanbanBoard from '@/components/board/KanbanBoard';
import CardDetailModal from '@/components/board/CardDetailModal';
import TeamChat from '@/components/chat/TeamChat';
import AISuggestionPanel from '@/components/ai/AISuggestionPanel';
import { Lightbulb, X } from 'lucide-react';

export default function BoardPage() {
  const params = useParams();
  const boardId = params.boardId as string;
  const { lists, isLoading, fetchBoard, setActiveBoard } = useBoardStore();
  const { isOpen: chatOpen } = useChatStore();
  const { user } = useAuthStore();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  // Find the selected card from the current lists
  const selectedCard = useMemo(() => {
    if (!selectedCardId) return null;
    for (const list of lists) {
      const card = list.cards.find((c) => c.id === selectedCardId);
      if (card) return card;
    }
    return null;
  }, [selectedCardId, lists]);

  if (!boardId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-gray-500 text-sm">Select a board to get started</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 rounded-md bg-emerald-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full relative">
      <div className="flex-1 min-w-0">
        <KanbanBoard onCardClick={(card) => setSelectedCardId(card.id)} />
      </div>
      {showSuggestions && (
        <div className="hidden sm:block w-80 shrink-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 overflow-y-auto">
          <AISuggestionPanel />
        </div>
      )}
      <div className="flex items-start gap-2 shrink-0">
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className={`shrink-0 self-start p-2 rounded-md border transition-colors ${
            showSuggestions
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-[var(--bg-card)] border-[var(--border)] text-gray-500 hover:text-gray-300'
          }`}
          title="AI Suggestions"
        >
          <Lightbulb className="h-4 w-4" />
        </button>
        {!chatOpen && (
          <TeamChat boardId={boardId} />
        )}
      </div>
      {chatOpen && (
        <TeamChat boardId={boardId} />
      )}
      {/* Mobile suggestion overlay */}
      {showSuggestions && (
        <div className="sm:hidden fixed inset-0 z-40 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSuggestions(false)} />
          <div className="relative w-full max-h-[70vh] bg-[var(--bg-card)] border-t border-[var(--border)] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <h3 className="text-sm font-medium text-white">AI Suggestions</h3>
              <button
                onClick={() => setShowSuggestions(false)}
                className="p-1 rounded hover:bg-[var(--bg-base)] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <AISuggestionPanel />
            </div>
          </div>
        </div>
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