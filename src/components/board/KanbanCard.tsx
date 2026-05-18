'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckSquare, MessageSquare, CheckCircle } from 'lucide-react';
import type { Card } from '@/types';
import { getInitials } from '@/lib/utils/initials';

interface KanbanCardProps {
  card: Card;
  onClick: () => void;
}

const priorityConfig: Record<string, { border: string; bg: string; text: string; label: string }> = {
  urgent: { border: '#ef4444', bg: '#2d1515', text: '#fca5a5', label: 'Urgent' },
  high: { border: '#f97316', bg: '#2d1f12', text: '#fdba74', label: 'High' },
  medium: { border: '#3b82f6', bg: '#141c2d', text: '#93c5fd', label: 'Medium' },
  low: { border: '#6b7280', bg: '#1e1e20', text: '#9ca3af', label: 'Low' },
};

const doneConfig = { border: '#10b981', bg: '#0f2d1f', text: '#6ee7b7', label: 'Done' };

export default function KanbanCard({ card, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const isDone = card.status === 'done';
  const config = isDone ? doneConfig : (priorityConfig[card.priority] || priorityConfig.medium);
  const checkedCount = card.checklist?.filter((c) => c.checked).length ?? 0;
  const totalCount = card.checklist?.length ?? 0;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: config.bg,
    borderColor: 'var(--border)',
    borderRadius: 8,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderLeftWidth: 3,
    borderLeftColor: config.border,
    padding: 12,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-pointer hover:brightness-110 transition-all duration-150"
    >
      {/* Done badge */}
      {isDone && (
        <div className="flex items-center gap-1 mb-1.5">
          <CheckCircle className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] font-medium text-emerald-400">Done</span>
        </div>
      )}

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
      <p className={`text-sm leading-snug ${isDone ? 'text-emerald-300 line-through' : 'text-gray-200'}`}>
        {card.title}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-gray-500">
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
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-[var(--bg-base)] text-gray-400 ring-1 ring-[var(--bg-card)]">
                +{card.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}