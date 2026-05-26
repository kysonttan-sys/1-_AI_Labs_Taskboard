'use client';

import React, { useState, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useBoardStore } from '@/features/board/boardStore';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import type { Card, List } from '@/types';

function AddListInput({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');

  async function handleAdd() {
    if (!title.trim()) return;
    await onAdd(title.trim());
    setTitle('');
    setIsAdding(false);
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm
          bg-[var(--bg-elevated)] border border-[var(--border)] border-dashed
          text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors shrink-0"
      >
        <Plus className="h-4 w-4" />
        <span>Add list</span>
      </button>
    );
  }

  return (
    <div className="w-full sm:w-72 shrink-0 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius)] p-3 space-y-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="List title..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
          if (e.key === 'Escape') setIsAdding(false);
        }}
        onBlur={() => {
          if (!title.trim()) setIsAdding(false);
        }}
        className="w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)]
          rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-ring"
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleAdd}
          className="px-2.5 py-1 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-md transition-colors"
        >
          Add
        </button>
        <button
          onClick={() => setIsAdding(false)}
          className="px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  onCardClick: (card: Card) => void;
}

export default function KanbanBoard({ onCardClick }: KanbanBoardProps) {
  const { lists, addCard, addList, moveCard, reorderLists } = useBoardStore();
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [listDragIdx, setListDragIdx] = useState<number | null>(null);
  const [listDragOverIdx, setListDragOverIdx] = useState<number | null>(null);
  const listDragItemRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const activeId = active.id as string;

    // Dragging a card
    for (const l of lists) {
      const card = l.cards.find((c) => c.id === activeId);
      if (card) {
        setActiveCard(card);
        break;
      }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    let sourceList: List | undefined;
    let targetList: List | undefined;

    for (const list of lists) {
      if (list.cards.find((c) => c.id === activeId)) {
        sourceList = list;
      }
      if (list.id === overId || list.cards.find((c) => c.id === overId)) {
        targetList = list;
      }
    }

    if (!sourceList || !targetList) return;

    if (sourceList.id !== targetList.id) {
      const activeCard = sourceList.cards.find((c) => c.id === activeId);
      if (!activeCard) return;

      const overCard = targetList.cards.find((c) => c.id === overId);
      const overIndex = overCard
        ? targetList.cards.indexOf(overCard)
        : targetList.cards.length;

      useBoardStore.setState((state) => ({
        lists: state.lists.map((l) => {
          if (l.id === sourceList.id) {
            return { ...l, cards: l.cards.filter((c) => c.id !== activeId) };
          }
          if (l.id === targetList.id) {
            const newCards = [...l.cards];
            newCards.splice(overIndex, 0, { ...activeCard, listId: targetList.id });
            return { ...l, cards: newCards };
          }
          return l;
        }),
      }));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // Card move
    setActiveCard(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    let sourceListId = '';
    let targetListId = '';
    let targetPosition = 0;

    for (const list of lists) {
      if (list.cards.find((c) => c.id === activeId)) {
        sourceListId = list.id;
      }
      if (list.id === overId) {
        targetListId = list.id;
        targetPosition = list.cards.length;
      } else if (list.cards.find((c) => c.id === overId)) {
        targetListId = list.id;
        const overCard = list.cards.find((c) => c.id === overId)!;
        targetPosition = overCard.position;
      }
    }

    if (!sourceListId || !targetListId) return;
    if (activeId === overId) return;

    moveCard(activeId, targetListId, targetPosition);
  }

  // --- HTML5 native drag for list reordering ---
  function handleListDragStart(index: number) {
    listDragItemRef.current = index;
    setListDragIdx(index);
  }

  function handleListDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setListDragOverIdx(index);
  }

  function handleListDragEnd() {
    if (listDragItemRef.current !== null && listDragOverIdx !== null && listDragItemRef.current !== listDragOverIdx) {
      const newListIds = lists.map((l) => l.id);
      const [moved] = newListIds.splice(listDragItemRef.current, 1);
      newListIds.splice(listDragOverIdx, 0, moved);
      reorderLists(newListIds);
    }
    setListDragIdx(null);
    setListDragOverIdx(null);
    listDragItemRef.current = null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-thin">
        {lists.map((list, index) => (
          <div
            key={list.id}
            draggable
            onDragStart={() => handleListDragStart(index)}
            onDragOver={(e) => handleListDragOver(e, index)}
            onDrop={() => {}}
            onDragEnd={handleListDragEnd}
            onDragLeave={() => setListDragOverIdx(null)}
            className={`shrink-0 transition-opacity ${
              listDragIdx === index ? 'opacity-40' : ''
            } ${
              listDragOverIdx === index && listDragItemRef.current !== index
                ? 'border-l-2 border-l-emerald-500'
                : ''
            }`}
          >
            <KanbanColumn
              list={list}
              onAddCard={addCard}
              onCardClick={onCardClick}
            />
          </div>
        ))}

        <AddListInput onAdd={addList} />
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-[85vw] sm:w-72">
            <KanbanCard card={activeCard} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}