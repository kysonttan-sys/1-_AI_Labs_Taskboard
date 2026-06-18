'use client';

import { useEffect, useState } from 'react';
import { boardsApi } from '@/lib/api/boards';
import type { CreateKeyResultTaskInput } from '@/lib/api/okrs';
import { X, Plus, Layout, FolderKanban } from 'lucide-react';

interface Props {
  projectId: string;
  onClose: () => void;
  onCreate: (input: CreateKeyResultTaskInput) => void;
  isLoading?: boolean;
}

export default function KeyResultTaskPicker({ projectId, onClose, onCreate, isLoading }: Props) {
  const [boards, setBoards] = useState<{ id: string; name: string; lists: { id: string; title: string }[] }[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [newBoardName, setNewBoardName] = useState('');
  const [newListName, setNewListName] = useState('To Do');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    boardsApi
      .listByProject(projectId)
      .then((data) => {
        setBoards(data);
        if (data[0]?.lists[0]) {
          setSelectedBoardId(data[0].id);
          setSelectedListId(data[0].lists[0].id);
        } else if (data.length > 0) {
          // Board exists but has no lists — switch to new board mode
          setMode('new');
        } else {
          // No boards at all — default to new board mode
          setMode('new');
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [projectId]);

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (mode === 'existing' && (!selectedBoardId || !selectedListId)) return;
    if (mode === 'new' && !newBoardName.trim()) return;

    onCreate({
      title: title.trim(),
      ...(mode === 'existing'
        ? { boardId: selectedBoardId, listId: selectedListId }
        : { newBoardName: newBoardName.trim(), newListName: newListName.trim() || 'To Do' }),
    });
  };

  const inputClass =
    'w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-ring';

  const selectClass =
    'w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-md text-[var(--text-primary)] focus-ring appearance-none';

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[var(--backdrop)] p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--accent)]/20">
              <Plus className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add task to Key Result</h3>
              <p className="text-xs text-[var(--text-tertiary)]">Create a card that is linked to this KR.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Task title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              maxLength={200}
              disabled={isLoading}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Board</label>
            <div className="flex gap-2 p-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${mode === 'existing'
                    ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
              >
                <Layout className="h-3.5 w-3.5" />
                Existing
              </button>
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${mode === 'new'
                    ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
              >
                <FolderKanban className="h-3.5 w-3.5" />
                New
              </button>
            </div>
          </div>

          {mode === 'existing' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Board</label>
                {boards.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] py-2">No boards in this project. Switch to “New board”.</p>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedBoardId}
                      onChange={(e) => {
                        setSelectedBoardId(e.target.value);
                        const board = boards.find((b) => b.id === e.target.value);
                        setSelectedListId(board?.lists[0]?.id ?? '');
                      }}
                      disabled={isLoading}
                      className={selectClass}
                    >
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="h-3.5 w-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">List</label>
                {selectedBoard && selectedBoard.lists.length > 0 ? (
                  <div className="relative">
                    <select
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value)}
                      disabled={isLoading}
                      className={selectClass}
                    >
                      {selectedBoard.lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="h-3.5 w-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)] py-2">No lists on this board.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">New board name</label>
                <input
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="e.g. Marketing Q3"
                  disabled={isLoading}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">First list</label>
                <input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="To Do"
                  disabled={isLoading}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isLoading ||
                !title.trim() ||
                (mode === 'existing' && (boards.length === 0 || !selectedBoardId || !selectedListId)) ||
                (mode === 'new' && !newBoardName.trim())
              }
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-[var(--text-primary)]/30 border-t-[var(--text-primary)] rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
