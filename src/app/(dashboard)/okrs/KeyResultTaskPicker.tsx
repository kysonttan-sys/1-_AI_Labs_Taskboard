'use client';

import { useEffect, useState } from 'react';
import { boardsApi } from '@/lib/api/boards';
import type { CreateKeyResultTaskInput } from '@/lib/api/okrs';
import { X, Plus } from 'lucide-react';

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
    'w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add task to Key Result</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            maxLength={200}
            className={inputClass}
          />

          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 py-1.5 rounded border ${
                mode === 'existing'
                  ? 'bg-[var(--accent)] border-[var(--accent)]'
                  : 'border-[var(--border)]'
              }`}
            >
              Existing board
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 py-1.5 rounded border ${
                mode === 'new' ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'
              }`}
            >
              New board
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="flex flex-col gap-2">
              <select
                value={selectedBoardId}
                onChange={(e) => {
                  setSelectedBoardId(e.target.value);
                  const board = boards.find((b) => b.id === e.target.value);
                  setSelectedListId(board?.lists[0]?.id ?? '');
                }}
                className={inputClass}
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className={inputClass}
              >
                {selectedBoard?.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="New board name..."
                className={inputClass}
              />
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="First list name (default: To Do)"
                className={inputClass}
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {isLoading ? 'Adding...' : 'Add task'}
          </button>
        </form>
      </div>
    </div>
  );
}
