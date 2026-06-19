'use client';

import { useState } from 'react';
import { useBoardStore } from '@/features/board/boardStore';
import { useAuthStore } from '@/features/auth/authStore';
import { MoreVertical, Trash2, Pencil } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import NotificationBell from '@/components/notifications/NotificationBell';
import GlobalSearch from '@/components/search/GlobalSearch';
import { getInitials } from '@/lib/utils/initials';

export default function Topbar() {
  const params = useParams();
  const router = useRouter();
  const boardId = params?.boardId as string | undefined;
  const { boards, activeBoardId, deleteBoard, updateBoard } = useBoardStore();
  const { user } = useAuthStore();
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentBoardId = boardId || activeBoardId || boards[0]?.id;
  const activeBoard = boards.find((b) => b.id === currentBoardId);

  async function handleDeleteBoard() {
    if (!currentBoardId) return;
    await deleteBoard(currentBoardId);
    setBoardMenuOpen(false);
    setConfirmDelete(false);
    router.push('/board');
  }

  function startRename() {
    if (!activeBoard) return;
    setRenameValue(activeBoard.name);
    setIsRenaming(true);
    setBoardMenuOpen(false);
  }

  function commitRename() {
    if (!currentBoardId || !renameValue.trim()) {
      setIsRenaming(false);
      return;
    }
    updateBoard(currentBoardId, { name: renameValue.trim() });
    setIsRenaming(false);
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-between px-3 sm:px-6 shrink-0">
      {/* Left: Board name + menu */}
      <div className="flex items-center gap-2 min-w-0">
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="text-base font-semibold bg-[var(--bg-surface)] border border-[var(--border)] rounded px-2 py-0.5 text-[var(--text-primary)] focus-ring min-w-0"
          />
        ) : (
          <h1 className="text-base font-semibold text-[var(--text-primary)] truncate">
            {activeBoard?.icon && <span className="mr-1">{activeBoard.icon}</span>}
            {activeBoard?.name || 'Taskboard'}
          </h1>
        )}

        {currentBoardId && !isRenaming && (
          <div className="relative">
            <button
              onClick={() => setBoardMenuOpen(!boardMenuOpen)}
              className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              title="Board options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {boardMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setBoardMenuOpen(false); setConfirmDelete(false); }} />
                <div className="absolute left-0 top-full mt-1 z-20 w-44 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-md py-1">
                  <button
                    onClick={() => { startRename(); }}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] flex items-center gap-2 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename board
                  </button>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete board
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-xs text-red-400 mb-1.5">Are you sure?</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleDeleteBoard}
                          className="px-2 py-1 text-[11px] font-medium bg-red-600 hover:bg-red-500 text-[var(--text-primary)] rounded transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-2 py-1 text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Center: Global search */}
      <div className="hidden sm:flex flex-1 justify-center px-4">
        <GlobalSearch />
      </div>

      {/* Right: Notifications + Avatar */}
      <div className="flex items-center gap-3">
        <NotificationBell />

        <div className="h-8 w-8 rounded-full bg-[var(--accent-muted)] flex items-center justify-center text-[11px] font-semibold text-[var(--accent)]">
          {getInitials(user?.name)}
        </div>
      </div>
    </header>
  );
}
