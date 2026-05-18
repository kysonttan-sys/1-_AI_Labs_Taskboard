'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, GripVertical, ChevronDown } from 'lucide-react';
import KanbanCard from './KanbanCard';
import { useBoardStore } from '@/features/board/boardStore';
import type { Card, List } from '@/types';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortCards(cards: Card[], isDoneColumn: boolean): Card[] {
  return [...cards].sort((a, b) => {
    if (isDoneColumn) {
      // Done column: latest due date on top, null dates at bottom
      if (a.dueDate && b.dueDate) {
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.position - b.position;
    }

    // Done cards go to the bottom within non-done columns
    const aDone = a.status === 'done' ? 1 : 0;
    const bDone = b.status === 'done' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    // Priority: urgent first
    const aPri = PRIORITY_ORDER[a.priority] ?? 2;
    const bPri = PRIORITY_ORDER[b.priority] ?? 2;
    if (aPri !== bPri) return aPri - bPri;

    // Due date: soonest first, null dates last
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Fallback: original position
    return a.position - b.position;
  });
}

interface KanbanColumnProps {
  list: List;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onCardClick: (card: Card) => void;
}

function AddCardInput({
  listId,
  onAdd,
}: {
  listId: string;
  onAdd: (listId: string, title: string) => Promise<void>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');

  async function handleAdd() {
    if (!title.trim()) return;
    await onAdd(listId, title.trim());
    setTitle('');
    setIsAdding(false);
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full flex items-center gap-1 px-2 py-1.5 rounded-md text-sm
          text-gray-600 hover:text-gray-400 hover:bg-[var(--bg-card-hover)] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add card</span>
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Card title..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
          if (e.key === 'Escape') setIsAdding(false);
        }}
        onBlur={() => {
          if (!title.trim()) setIsAdding(false);
        }}
        className="w-full px-2 py-1.5 text-sm bg-[var(--bg-base)] border border-[var(--border)]
          rounded-md text-white placeholder:text-gray-600 focus-ring"
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleAdd}
          className="px-2.5 py-1 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-white rounded-md transition-colors"
        >
          Add
        </button>
        <button
          onClick={() => setIsAdding(false)}
          className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function KanbanColumn({ list, onAddCard, onCardClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: list.id });
  const { deleteList, updateList } = useBoardStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const isDoneColumn = list.cards.length > 0 && list.cards.every((c) => c.status === 'done');
  const sortedCards = sortCards(list.cards, isDoneColumn);
  const VISIBLE_LIMIT = 10;
  const visibleCards = showAll ? sortedCards : sortedCards.slice(0, VISIBLE_LIMIT);
  const hiddenCount = sortedCards.length - VISIBLE_LIMIT;

  return (
    <div
      className="group flex flex-col w-[85vw] sm:w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg"
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
          <h3 className="text-sm font-medium text-white truncate">{list.title}</h3>
          <span className="text-xs text-gray-600 shrink-0">{list.cards.length}</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded hover:bg-[var(--bg-card-hover)] text-gray-600 hover:text-gray-400 transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl py-1">
                <button
                  onClick={() => {
                    const newTitle = prompt('Rename list:', list.title);
                    if (newTitle?.trim()) {
                      updateList(list.id, { title: newTitle.trim() });
                    }
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[var(--bg-base)] transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this list and all its cards?')) {
                      deleteList(list.id);
                    }
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete list
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cards droppable area */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
        <SortableContext
          items={visibleCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleCards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>
        {hiddenCount > 0 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center justify-center gap-1 w-full py-2 text-xs text-gray-500 hover:text-emerald-400 transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {hiddenCount} more card{hiddenCount !== 1 ? 's' : ''}
          </button>
        )}
        {showAll && sortedCards.length > VISIBLE_LIMIT && (
          <button
            onClick={() => setShowAll(false)}
            className="flex items-center justify-center gap-1 w-full py-2 text-xs text-gray-500 hover:text-emerald-400 transition-colors"
          >
            Show less
          </button>
        )}
      </div>

      {/* Add card */}
      <div className="px-2 pb-2">
        <AddCardInput listId={list.id} onAdd={onAddCard} />
      </div>
    </div>
  );
}