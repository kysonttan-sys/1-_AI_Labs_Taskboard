'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  X,
  Trash2,
  Calendar,
  User,
  Tag,
  CheckSquare,
  Plus,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import CardKeyResultLinker from './CardKeyResultLinker';
import CardDependencyLinker from './CardDependencyLinker';
import { useBoardStore } from '@/features/board/boardStore';
import type { Card } from '@/types';
import { getInitials } from '@/lib/utils/initials';

interface UserOption {
  id: string;
  name: string;
  color: string;
}

interface LabelOption {
  id: string;
  name: string;
  color: string;
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

interface CardDetailModalProps {
  card: Card;
  onClose: () => void;
}

export default function CardDetailModal({ card, onClose }: CardDetailModalProps) {
  const { updateCard, deleteCard, lists } = useBoardStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [status, setStatus] = useState(card.status);
  const [priority, setPriority] = useState(card.priority);
  const [progress, setProgress] = useState(card.progress);
  const [startDate, setStartDate] = useState(
    card.startDate ? format(new Date(card.startDate), 'yyyy-MM-dd') : ''
  );
  const [dueDate, setDueDate] = useState(
    card.dueDate ? format(new Date(card.dueDate), 'yyyy-MM-dd') : ''
  );
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    card.assignees?.map((a) => a.user.id) ?? []
  );
  const [users, setUsers] = useState<UserOption[]>([]);
  const [boardLabels, setBoardLabels] = useState<LabelOption[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(
    new Set((card.labels ?? []).map((l) => l.label.id))
  );
  const [linkedKeyResults, setLinkedKeyResults] = useState(
    (card.keyResults ?? []).map((l) => ({
      keyResultId: l.keyResultId,
      weight: l.weight,
      keyResult: l.keyResult,
    }))
  );
  const [dependencies, setDependencies] = useState(
    (card.dependsOn ?? []).map((d) => ({
      dependsOnCardId: d.dependsOnCard.id,
      dependsOnCard: d.dependsOnCard,
    }))
  );
  const [checklist, setChecklist] = useState(card.checklist ?? []);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [comments, setComments] = useState<{ id: string; text: string; createdAt: string; author: { name: string; color: string } }[]>([]);
  const [newComment, setNewComment] = useState('');

  // Fetch users for assignee dropdown
  useEffect(() => {
    fetch('/api/users', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => {});
  }, []);

  // Fetch board labels
  useEffect(() => {
    const boardId = card.boardId;
    fetch(`/api/boards/${boardId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.labels) {
          setBoardLabels(data.labels);
        }
      })
      .catch(() => {});
  }, [card.boardId]);

  // Fetch comments
  useEffect(() => {
    fetch(`/api/cards/${card.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.comments) {
          setComments(data.comments);
        }
      })
      .catch(() => {});
  }, [card.id]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Persist helper
  function persist(patch: Record<string, unknown>) {
    updateCard(card.id, patch);
  }

  // Title
  function commitTitle() {
    if (title.trim() && title !== card.title) {
      persist({ title: title.trim() });
    }
    setIsEditingTitle(false);
  }

  // Description
  function commitDescription() {
    if (description !== (card.description ?? '')) {
      persist({ description });
    }
  }

  // Status
  function handleStatusChange(val: string) {
    setStatus(val);
    persist({ status: val });
  }

  // Priority
  function handlePriorityChange(val: string) {
    setPriority(val);
    persist({ priority: val });
  }

  // Progress
  function handleProgressChange(val: number) {
    setProgress(val);
    persist({ progress: val });
  }

  // Dates
  function handleStartDateChange(val: string) {
    setStartDate(val);
    persist({ startDate: val || null });
  }

  function handleDueDateChange(val: string) {
    setDueDate(val);
    persist({ dueDate: val || null });
  }

  // Assignees
  function toggleAssignee(userId: string) {
    setSelectedAssigneeIds((prev) => {
      const next = prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId];
      persist({ assigneeIds: next });
      return next;
    });
  }

  // Labels toggle
  function toggleLabel(labelId: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      persist({ labelIds: Array.from(next) });
      return next;
    });
  }

  // Checklist
  function toggleCheckItem(id: string) {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
    fetch(`/api/checklist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: !checklist.find((i) => i.id === id)?.checked }),
    }).catch(() => {});
  }

  function addCheckItem() {
    if (!newCheckItem.trim()) return;
    const text = newCheckItem.trim();
    setNewCheckItem('');
    fetch(`/api/cards/${card.id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((res) => res.json())
      .then((item) => {
        setChecklist((prev) => [...prev, item]);
      })
      .catch(() => {});
  }

  function deleteCheckItem(id: string) {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
    fetch(`/api/checklist/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  function deleteComment(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    fetch(`/api/comments/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  // Delete
  async function handleDelete() {
    await deleteCard(card.id);
    onClose();
  }

  // Get current list title
  const currentList = lists.find((l) => l.id === card.listId);
  const checkedCount = checklist.filter((i) => i.checked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--backdrop)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[85vh] overflow-y-auto bg-[var(--bg-elevated)] border border-[var(--border)] rounded-none sm:rounded-xl shadow-2xl sm:mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 sm:p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-4 sm:p-6 space-y-5">
          {/* List name */}
          {currentList && (
            <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wide">
              in {currentList.title}
            </p>
          )}

          {/* Title */}
          {isEditingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') {
                  setTitle(card.title);
                  setIsEditingTitle(false);
                }
              }}
              className="w-full text-xl font-semibold bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus-ring"
            />
          ) : (
            <h2
              onClick={() => setIsEditingTitle(true)}
              className="text-xl font-semibold text-[var(--text-primary)] cursor-pointer hover:text-[var(--accent-hover)] transition-colors"
            >
              {card.title}
            </h2>
          )}

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              placeholder="Add a description..."
              rows={3}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring resize-none"
            />
          </div>

          {/* Status & Priority row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Status */}
            <div>
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 block">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] focus-ring appearance-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 block">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] focus-ring appearance-none"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Progress */}
          <div>
            <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 flex items-center justify-between">
              <span>Progress</span>
              <span className="text-[var(--text-tertiary)]">{progress}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              onMouseUp={() => {}}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[var(--accent)] bg-[var(--border)]"
            />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] focus-ring cursor-pointer"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Due Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] focus-ring cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <User className="h-3 w-3" />
              Assignees
            </label>
            <div className="flex flex-wrap gap-2 mt-1">
              {users.map((user) => {
                const isSelected = selectedAssigneeIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleAssignee(user.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      isSelected
                        ? 'ring-1 ring-[var(--accent)]/50'
                        : ''
                    }`}
                    style={{
                      backgroundColor: isSelected ? `${user.color}22` : 'var(--bg-base)',
                      color: isSelected ? user.color : '#9ca3af',
                      border: `1px solid ${isSelected ? user.color : 'var(--border)'}`,
                    }}
                  >
                    <div
                      className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-semibold"
                      style={{
                        backgroundColor: `${user.color}22`,
                        color: user.color,
                      }}
                    >
                      {getInitials(user.name)}
                    </div>
                    {user.name}
                  </button>
                );
              })}
              {users.length === 0 && (
                <span className="text-xs text-[var(--text-tertiary)]">No team members</span>
              )}
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              Labels
            </label>
            <div className="flex flex-wrap gap-2">
              {boardLabels.map((label) => {
                const isSelected = selectedLabelIds.has(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                    style={{
                      backgroundColor: isSelected ? `${label.color}33` : 'transparent',
                      color: isSelected ? label.color : '#6b7280',
                      border: `1px solid ${isSelected ? label.color : 'var(--border)'}`,
                    }}
                  >
                    {label.name}
                  </button>
                );
              })}
              {boardLabels.length === 0 && (
                <span className="text-xs text-[var(--text-tertiary)]">No labels on this board</span>
              )}
            </div>
          </div>

          {/* Key Results */}
          <CardKeyResultLinker
            cardId={card.id}
            boardId={card.boardId}
            linked={linkedKeyResults}
            onChange={setLinkedKeyResults}
          />

          {/* Dependencies */}
          <CardDependencyLinker
            cardId={card.id}
            boardId={card.boardId}
            dependencies={dependencies}
            onChange={setDependencies}
          />

          {/* Checklist */}
          <div>
            <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <CheckSquare className="h-3 w-3" />
              Checklist
              {checklist.length > 0 && (
                <span className="text-[var(--text-tertiary)]">
                  {checkedCount}/{checklist.length}
                </span>
              )}
            </label>

            {checklist.length > 0 && (
              <div className="space-y-1 mb-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors group"
                  >
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleCheckItem(item.id)}
                        className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]/40 bg-[var(--bg-surface)]"
                      />
                      <span
                        className={`text-sm ${
                          item.checked
                            ? 'line-through text-[var(--text-tertiary)]'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {item.text}
                      </span>
                    </label>
                    <button
                      onClick={() => deleteCheckItem(item.id)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-400 transition-all shrink-0"
                      title="Delete item"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCheckItem();
                }}
                placeholder="Add item..."
                className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring"
              />
              <button
                onClick={addCheckItem}
                disabled={!newCheckItem.trim()}
                className="px-2.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:bg-[var(--accent)] text-[var(--text-primary)] rounded-md transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              Comments
            </label>
            {comments.length > 0 && (
              <div className="space-y-2 mb-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-surface)] group">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                      style={{ backgroundColor: `${comment.author?.color || '#6366f1'}22`, color: comment.author?.color || '#6366f1' }}
                    >
                      {getInitials(comment.author?.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--text-secondary)] break-words">{comment.text}</p>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        {comment.author?.name || 'Unknown'} &middot; {new Date(comment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-400 transition-all shrink-0 self-start mt-0.5"
                      title="Delete comment"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newComment.trim()) {
                    const text = newComment.trim();
                    setNewComment('');
                    fetch(`/api/cards/${card.id}/comments`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text }),
                    })
                      .then((res) => res.json())
                      .then((comment) => {
                        setComments((prev) => [...prev, comment]);
                      })
                      .catch(() => {});
                  }
                }}
                placeholder="Write a comment..."
                className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring"
              />
              <button
                onClick={() => {
                  if (!newComment.trim()) return;
                  const text = newComment.trim();
                  setNewComment('');
                  fetch(`/api/cards/${card.id}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                  })
                    .then((res) => res.json())
                    .then((comment) => {
                      setComments((prev) => [...prev, comment]);
                    })
                    .catch(() => {});
                }}
                disabled={!newComment.trim()}
                className="px-2.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:bg-[var(--accent)] text-[var(--text-primary)] rounded-md transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Delete */}
          <div className="pt-4 border-t border-[var(--border)]">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete card
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-red-400">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 text-xs font-medium bg-red-600 hover:bg-red-500 text-[var(--text-primary)] rounded-md transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}