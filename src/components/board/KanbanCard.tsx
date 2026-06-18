'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckSquare, MessageSquare, CheckCircle, Target, Link2 } from 'lucide-react';
import type { Card } from '@/types';
import { getInitials } from '@/lib/utils/initials';
import { getPriorityConfig } from '@/lib/utils/theme';
import { isCompletedStatus } from '@/lib/board/status';
import { useBulkSelectionStore } from '@/features/board/bulkSelectionStore';

interface KanbanCardProps {
  card: Card;
  onClick: () => void;
}

export default function KanbanCard({ card, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const { isSelecting, selectedIds, toggle } = useBulkSelectionStore();
  const isSelected = selectedIds.has(card.id);

  const isDone = isCompletedStatus(card.status) || !!card.completedAt;
  const config = getPriorityConfig(card.priority, isDone);
  const checkedCount = card.checklist?.filter((c) => c.checked).length ?? 0;
  const totalCount = card.checklist?.length ?? 0;
  const blockerCount =
    card.dependsOn?.filter((d) => !isCompletedStatus(d.dependsOnCard.status) && !d.dependsOnCard.completedAt).length ?? 0;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: config.bg,
    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
    borderRadius: 8,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderLeftWidth: 3,
    borderLeftColor: config.border,
    padding: 12,
  };

  function handleClick(e: React.MouseEvent) {
    if (isSelecting) {
      e.preventDefault();
      e.stopPropagation();
      toggle(card.id);
      return;
    }
    onClick();
  }

  function handleCheckboxClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(card.id);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`cursor-pointer hover:brightness-110 transition-all duration-150 ${isSelected ? 'ring-1 ring-[var(--accent)]' : ''}`}
    >
      {/* Selection checkbox / done badge row */}
      <div className="flex items-center justify-between mb-1.5">
        {isSelecting ? (
          <button
            onClick={handleCheckboxClick}
            className={`flex items-center justify-center h-4 w-4 rounded border text-[10px] font-medium transition-colors ${
              isSelected
                ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-[var(--border)] text-transparent hover:border-[var(--accent)]'
            }`}
          >
            {isSelected && '✓'}
          </button>
        ) : isDone ? (
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-[var(--accent)]" />
            <span className="text-[10px] font-medium text-[var(--accent)]">Done</span>
          </div>
        ) : null}
      </div>

      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map(({ label }) => (
            <span
              key={label.id}
              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: `${label.color}22`,
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className={`text-sm leading-snug ${isDone ? 'text-[var(--accent)] line-through opacity-70' : 'text-[var(--text-primary)]'}`}>
        {card.title}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-[var(--text-tertiary)]">
        {!isDone && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: config.bg,
              color: config.text,
              border: `1px solid ${config.border}44`,
            }}
          >
            {config.label}
          </span>
        )}

        {card.dueDate && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            <Calendar className="h-3 w-3" />
            {new Date(card.dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}

        {totalCount > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            {checkedCount}/{totalCount}
          </span>
        )}

        {card._count && card._count.comments > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {card._count.comments}
          </span>
        )}

        {card.keyResults && card.keyResults.length > 0 && (
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            {card.keyResults.length}
          </span>
        )}

        {blockerCount > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <Link2 className="h-3 w-3" />
            {blockerCount}
          </span>
        )}

        {card.assignees && card.assignees.length > 0 && (
          <div className="flex -space-x-1.5 ml-auto">
            {card.assignees.slice(0, 3).map(({ user }) => (
              <div
                key={user.id}
                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold ring-1 ring-[var(--bg-card)]"
                style={{
                  backgroundColor: `${user.color}22`,
                  color: user.color,
                }}
                title={user.name}
              >
                {getInitials(user.name)}
              </div>
            ))}
            {card.assignees.length > 3 && (
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-[var(--bg-surface)] text-[var(--text-tertiary)] ring-1 ring-[var(--border)]">
                +{card.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
