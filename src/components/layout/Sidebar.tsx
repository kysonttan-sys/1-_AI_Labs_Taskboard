'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { useBoardStore } from '@/features/board/boardStore';
import { getInitials } from '@/lib/utils/initials';
import { toggleTheme } from '@/lib/utils/theme';

export default function Sidebar() {
  const router = useRouter();
  const params = useParams();
  const { user, logout } = useAuthStore();
  const { boards, fetchBoards, createBoard, setActiveBoard, reorderBoards, activeBoardId: storedActiveBoardId } = useBoardStore();
  const [collapsed, setCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const theme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
    if (theme) setCurrentTheme(theme);
  }, []);

  function handleToggleTheme() {
    const next = toggleTheme();
    setCurrentTheme(next);
  }

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const activeBoardId = (params?.boardId as string | undefined) || storedActiveBoardId;

  async function handleCreateBoard() {
    if (!newBoardName.trim()) return;
    const board = await createBoard(newBoardName.trim());
    setNewBoardName('');
    setIsCreating(false);
    router.push(`/board/${board.id}`);
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  function handleDragStart(index: number) {
    dragItemRef.current = index;
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDragEnd() {
    if (dragItemRef.current !== null && dragOverIndex !== null && dragItemRef.current !== dragOverIndex) {
      const newOrder = [...boards.map((b) => b.id)];
      const [moved] = newOrder.splice(dragItemRef.current, 1);
      newOrder.splice(dragOverIndex, 0, moved);
      reorderBoards(newOrder);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  }

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-[var(--backdrop)] z-20 md:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-30 h-full
          bg-[var(--bg-sidebar)] border-r border-[var(--border)]
          flex flex-col transition-all duration-200 ease-in-out
          ${collapsed ? 'w-0 md:w-14 overflow-hidden' : 'w-60'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border)] shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 shrink-0 rounded theme-logo" />
              <span className="font-semibold text-[var(--text-primary)] text-sm tracking-tight">
                TaskBoard
              </span>
            </div>
          ) : (
            <img src="/logo.png" alt="Logo" className="h-7 w-7 rounded mx-auto theme-logo" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors hidden md:flex"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Board list */}
        <div className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
          {!collapsed && (
            <p className="px-2 mb-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              Boards
            </p>
          )}

          {boards.map((board, index) => {
            const isActive = activeBoardId === board.id;
            const isDragTarget = dragOverIndex === index && dragItemRef.current !== index;
            const isDragging = dragIndex === index;

            return (
              <div
                key={board.id}
                draggable={!collapsed}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => setDragOverIndex(null)}
                className={`
                  group w-full flex items-center gap-1 px-1 py-1 rounded-md text-sm transition-all mb-0.5
                  ${isDragging ? 'opacity-50 scale-95' : ''}
                  ${isDragTarget ? 'border-t-2 border-t-[var(--accent)]' : ''}
                  ${isActive
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
                  }
                `}
                onClick={() => {
                  setActiveBoard(board.id);
                  router.push(`/board/${board.id}`);
                }}
                style={{ cursor: 'grab' }}
              >
                <div
                  className={`p-0.5 rounded hover:bg-[var(--bg-surface)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${collapsed ? 'hidden' : ''}`}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                </div>
                <span className="text-base shrink-0">{board.icon}</span>
                {!collapsed && (
                  <span className="truncate">{board.name}</span>
                )}
              </div>
            );
          })}

          {/* New board */}
          {!collapsed && (
            <div className="mt-2">
              {isCreating ? (
                <form onSubmit={handleCreateBoard} className="px-1">
                  <input
                    autoFocus
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder="Board name..."
                    className="w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)]
                      rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-ring"
                    onBlur={() => {
                      if (!newBoardName.trim()) setIsCreating(false);
                    }}
                  />
                </form>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
                    text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>New Board</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Settings link */}
        <div className="border-t border-[var(--border)] px-2 py-2 shrink-0">
          <button
            onClick={() => router.push('/settings')}
            className={`
              w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
              text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]
            `}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
        </div>

        {/* User section */}
        <div className="border-t border-[var(--border)] p-3 shrink-0">
          {!collapsed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full bg-[var(--accent-muted)] flex items-center justify-center text-[10px] font-semibold text-[var(--accent)] shrink-0">
                  {getInitials(user?.name)}
                </div>
                <span className="text-sm text-[var(--text-secondary)] truncate">
                  {user?.name || 'User'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleToggleTheme}
                  className="p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  title={currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {currentTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`
          fixed top-4 z-30 p-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)]
          text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-all md:hidden
          ${collapsed ? 'left-3' : 'left-[15.5rem]'}
        `}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </>
  );
}