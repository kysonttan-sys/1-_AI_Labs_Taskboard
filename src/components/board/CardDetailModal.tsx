'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  X,
  Trash2,
  Calendar,
  User,
  Tag,
} from 'lucide-react';
import CardKeyResultLinker from './CardKeyResultLinker';
import CardDependencyLinker from './CardDependencyLinker';
import CardChecklist from './CardChecklist';
import CardComments from './CardComments';
import { useBoardStore } from '@/features/board/boardStore';
import type { Card, List } from '@/types';
import { getInitials } from '@/lib/utils/initials';
import { AiAssistButton } from '@/components/ai/AiAssistButton';

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
  const { updateCard, deleteCard, lists, boards } = useBoardStore();
  const currentBoard = boards.find((b) => b.id === card.boardId);
  const projectBoards = React.useMemo(
    () => boards.filter((b) => b.projectId === currentBoard?.projectId).sort((a, b) => a.name.localeCompare(b.name)),
    [boards, currentBoard?.projectId]
  );

  const [selectedBoardId, setSelectedBoardId] = useState(card.boardId);
  const [targetLists, setTargetLists] = useState(lists.filter((l) => l.boardId === card.boardId));
  useEffect(() => {
    setSelectedBoardId(card.boardId);
    setTargetLists(lists.filter((l) => l.boardId === card.boardId));
  }, [card.boardId, lists]);

  // Keep target lists in sync with cached lists when they update
  useEffect(() => {
    const listsForBoard = lists.filter((l) => l.boardId === selectedBoardId);
    if (listsForBoard.length > 0) {
      setTargetLists(listsForBoard);
    }
  }, [selectedBoardId, lists]);

  const listStatusOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const opts = targetLists
      .map((l) => ({ value: l.title, label: l.title }))
      .filter((opt) => {
        if (seen.has(opt.value)) return false;
        seen.add(opt.value);
        return true;
      });
    if (card.status && !seen.has(card.status) && selectedBoardId === card.boardId) {
      opts.push({ value: card.status, label: card.status });
    }
    return opts;
  }, [targetLists, selectedBoardId, card.status, card.boardId]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [status, setStatus] = useState(card.status);
  useEffect(() => setStatus(card.status), [card.status]);
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
  const [checklist, setChecklist] = useState(card.checklist ?? [] as { id: string; text: string; checked: boolean }[]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [comments, setComments] = useState<
    { id: string; text: string; createdAt: string; author: { name: string; color: string } }[]
  >([]);

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

  // Board
  async function handleBoardChange(boardId: string) {
    setSelectedBoardId(boardId);
    const cachedLists = lists.filter((l) => l.boardId === boardId);
    let boardLists: List[] = cachedLists;
    if (cachedLists.length === 0) {
      try {
        const data = await fetch(`/api/boards/${boardId}`).then((res) => res.json());
        boardLists = Array.isArray(data.lists) ? data.lists : [];
      } catch {
        boardLists = [];
      }
    }
    setTargetLists(boardLists);
    const matchingList = boardLists.find((l) => l.title.toLowerCase() === status.toLowerCase());
    const targetList = matchingList ?? boardLists[0];
    if (targetList) {
      const nextStatus = targetList.title;
      setStatus(nextStatus);
      persist({
        boardId,
        listId: targetList.id,
        status: nextStatus,
      });
    }
  }

  // Status
  function handleStatusChange(val: string) {
    setStatus(val);
    const targetList = targetLists.find((l) => l.title === val);
    if (targetList) {
      persist({ status: val, listId: targetList.id, boardId: selectedBoardId });
    } else {
      persist({ status: val, boardId: selectedBoardId });
    }
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

  // Delete
  async function handleDelete() {
    await deleteCard(card.id);
    onClose();
  }

  // Get current list title
  const currentList = lists.find((l) => l.id === card.listId);

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
            <div className="flex items-start gap-2">
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
                className="flex-1 text-xl font-semibold bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus-ring"
              />
              <AiAssistButton
                field="card-title"
                value={title}
                projectId={currentBoard?.projectId}
                cardId={card.id}
                onApply={(s) => {
                  const trimmed = s.trim();
                  setTitle(trimmed);
                  if (trimmed && trimmed !== card.title) {
                    persist({ title: trimmed });
                  }
                }}
              />
            </div>
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
            <div className="flex items-start gap-2">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={commitDescription}
                placeholder="Add a description..."
                rows={3}
                className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring resize-none"
              />
              <AiAssistButton
                field="card-description"
                value={description}
                projectId={currentBoard?.projectId}
                cardId={card.id}
                onApply={(s) => {
                  setDescription(s);
                  if (s !== (card.description ?? '')) {
                    persist({ description: s });
                  }
                }}
              />
            </div>
          </div>

          {/* Board, Status & Priority row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Board */}
            <div>
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 block">
                Board
              </label>
              <select
                value={selectedBoardId}
                onChange={(e) => handleBoardChange(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] focus-ring appearance-none"
              >
                {projectBoards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.icon} {b.name}
                  </option>
                ))}
              </select>
            </div>

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
                {listStatusOptions.map((opt) => (
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
          <CardChecklist cardId={card.id} checklist={checklist} onChange={setChecklist} />

          {/* Comments */}
          <CardComments cardId={card.id} comments={comments} onChange={setComments} />

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