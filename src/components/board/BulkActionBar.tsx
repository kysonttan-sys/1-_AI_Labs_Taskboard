'use client';

import React, { useState, useEffect } from 'react';
import {
  Move,
  Archive,
  Trash2,
  User,
  Tag,
  CheckCircle,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useBoardStore } from '@/features/board/boardStore';
import { useBulkSelectionStore } from '@/features/board/bulkSelectionStore';

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

export default function BulkActionBar() {
  const { lists, bulkUpdateCards } = useBoardStore();
  const { selectedIds, clear, setIsSelecting, toggle, setSelection } = useBulkSelectionStore();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [labels, setLabels] = useState<LabelOption[]>([]);

  useEffect(() => {
    fetch('/api/users', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => (Array.isArray(data) ? setUsers(data) : setUsers([])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const boardId = lists[0]?.boardId;
    if (!boardId) return;
    fetch(`/api/boards/${boardId}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { labels?: LabelOption[] }) => {
        if (Array.isArray(data.labels)) setLabels(data.labels);
      })
      .catch(() => {});
  }, [lists]);

  const selectedCount = selectedIds.size;
  const selectedArray = Array.from(selectedIds);
  const allCardIds = lists.flatMap((l) => l.cards.map((c) => c.id));
  const allSelected = allCardIds.length > 0 && allCardIds.every((id) => selectedIds.has(id));

  async function run(operation: string, payload?: Record<string, unknown>) {
    await bulkUpdateCards(operation as Parameters<typeof bulkUpdateCards>[0], selectedArray, payload);
    clear();
    setIsSelecting(false);
  }

  if (selectedCount === 0) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg mb-3">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <CheckSquare className="h-4 w-4 text-[var(--accent)]" />
          <span>Select mode</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelection(allCardIds)}
            className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            Select all
          </button>
          <button
            onClick={() => setIsSelecting(false)}
            className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg mb-3">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <button
          onClick={() => setSelection(allSelected ? [] : allCardIds)}
          className="flex items-center gap-1.5 text-xs font-medium hover:text-[var(--accent)] transition-colors"
          title={allSelected ? 'Deselect all' : 'Select all'}
        >
          {allSelected ? <CheckSquare className="h-4 w-4 text-[var(--accent)]" /> : <Square className="h-4 w-4" />}
          <span>{selectedCount} selected</span>
        </button>
      </div>

      <div className="w-px h-4 bg-[var(--border)] mx-1" />

      {/* Move */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
          <Move className="h-3.5 w-3.5" />
          Move
        </button>
        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-30 w-44 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl py-1">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => run('move', { targetListId: list.id })}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              {list.title}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
          <CheckCircle className="h-3.5 w-3.5" />
          Status
        </button>
        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-30 w-36 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl py-1">
          {['todo', 'in_progress', 'done', 'blocked'].map((s) => (
            <button
              key={s}
              onClick={() => run('status', { status: s })}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors capitalize"
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Assign */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
          <User className="h-3.5 w-3.5" />
          Assign
        </button>
        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-30 w-48 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl py-1">
          <div className="px-3 py-1 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Replace</div>
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => run('assign', { assigneeIds: [user.id] })}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              {user.name}
            </button>
          ))}
          {users.length === 0 && (
            <div className="px-3 py-1.5 text-xs text-[var(--text-tertiary)]">No users</div>
          )}
        </div>
      </div>

      {/* Labels */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
          <Tag className="h-3.5 w-3.5" />
          Label
        </button>
        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-30 w-48 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl py-1">
          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => run('label', { labelIds: [label.id], appendLabels: true })}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-1.5"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
              {label.name}
            </button>
          ))}
          {labels.length === 0 && (
            <div className="px-3 py-1.5 text-xs text-[var(--text-tertiary)]">No labels</div>
          )}
        </div>
      </div>

      {/* Archive */}
      <button
        onClick={() => run('archive')}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
      >
        <Archive className="h-3.5 w-3.5" />
        Archive
      </button>

      {/* Delete */}
      <button
        onClick={() => {
          if (confirm(`Delete ${selectedCount} selected cards?`)) {
            run('delete');
          }
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>

      <div className="flex-1" />

      <button
        onClick={() => {
          clear();
          setIsSelecting(false);
        }}
        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
}
