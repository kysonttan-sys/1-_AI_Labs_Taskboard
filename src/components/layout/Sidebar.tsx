'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import {
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Settings,
  Sun,
  Moon,
  Target,
  FolderKanban,
  LayoutGrid,
  BarChart3,
  Home,
  CalendarDays,
  Newspaper,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { useBoardStore } from '@/features/board/boardStore';
import { useProjectStore } from '@/features/projects/projectStore';
import { getInitials } from '@/lib/utils/initials';
import { toggleTheme } from '@/lib/utils/theme';

export default function Sidebar() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { boards, fetchBoards, reorderBoards, setActiveBoard, activeBoardId: storedActiveBoardId } = useBoardStore();
  const { projects, fetchProjects } = useProjectStore();
  const [collapsed, setCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('dark');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());

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
    fetchProjects();
  }, [fetchBoards, fetchProjects]);

  // Auto-expand the project whose page we are on, and the boards section
  // if we are on a board in that project.
  useEffect(() => {
    const projectId = params?.projectId as string | undefined;
    const boardId = (params?.boardId as string | undefined) || storedActiveBoardId;
    if (!projects.length) return;

    const nextExpandedProjects = new Set(expandedProjects);
    const nextExpandedBoards = new Set(expandedBoards);

    if (projectId) {
      nextExpandedProjects.add(projectId);
      const board = boards.find((b) => b.id === boardId);
      if (board?.projectId === projectId) {
        nextExpandedBoards.add(projectId);
      }
    } else if (boardId) {
      const board = boards.find((b) => b.id === boardId);
      if (board?.projectId) {
        nextExpandedProjects.add(board.projectId);
        nextExpandedBoards.add(board.projectId);
      }
    }

    setExpandedProjects(nextExpandedProjects);
    setExpandedBoards(nextExpandedBoards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.projectId, params?.boardId, storedActiveBoardId, projects.length, boards.length]);

  const activeBoardId = (params?.boardId as string | undefined) || storedActiveBoardId;
  const boardsByProject = projects.map((project) => ({
    project,
    boards: boards.filter((b) => b.projectId === project.id),
  }));

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  async function handleCreateBoard(projectId: string) {
    if (!newBoardName.trim()) return;
    const board = await useBoardStore.getState().createBoard(newBoardName.trim(), '📋', projectId);
    setNewBoardName('');
    setIsCreating(false);
    setActiveBoard(board.id);
    router.push(`/board/${board.id}`);
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

  function toggleProject(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleBoards(projectId: string) {
    setExpandedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function isActive(href: string) {
    return pathname === href;
  }

  function isActiveProject(projectId: string) {
    return pathname.startsWith(`/projects/${projectId}`);
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
                Taskboard
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

        {/* Project tree */}
        <div className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
          {!collapsed && (
            <p className="px-2 mb-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              Projects
            </p>
          )}

          {boardsByProject.map(({ project, boards: projectBoards }) => {
            const projectExpanded = expandedProjects.has(project.id);
            const boardsExpanded = expandedBoards.has(project.id);
            const projectActive = isActiveProject(project.id);

            return (
              <div key={project.id} className="mb-1">
                {/* Project row */}
                <div
                  className={`
                    group flex items-center gap-1 px-1 py-1.5 rounded-md text-sm transition-all cursor-pointer
                    ${projectActive || projectExpanded
                      ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
                    }
                  `}
                >
                  {!collapsed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleProject(project.id); }}
                      className="p-0.5 rounded hover:bg-[var(--bg-surface)] shrink-0"
                    >
                      {projectExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRightIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  <div
                    className="flex-1 flex items-center gap-2 min-w-0"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <FolderKanban className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{project.name}</span>}
                  </div>
                </div>

                {/* Expanded project children */}
                {!collapsed && projectExpanded && (
                  <div className="ml-2 pl-3 border-l border-[var(--border)] space-y-0.5 mt-0.5">
                    {/* Overview */}
                    <button
                      onClick={() => router.push(`/projects/${project.id}`)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors
                        ${isActive(`/projects/${project.id}`)
                          ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                          : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
                        }
                      `}
                    >
                      <Home className="h-3.5 w-3.5 shrink-0" />
                      <span>Overview</span>
                    </button>

                    {/* OKRs */}
                    <button
                      onClick={() => router.push(`/projects/${project.id}/okrs`)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors
                        ${isActive(`/projects/${project.id}/okrs`)
                          ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                          : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
                        }
                      `}
                    >
                      <Target className="h-3.5 w-3.5 shrink-0" />
                      <span>OKRs</span>
                    </button>

                    {/* Boards sub-section */}
                    <div>
                      <button
                        onClick={() => toggleBoards(project.id)}
                        className={`
                          w-full flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors
                          ${boardsExpanded
                            ? 'text-[var(--text-secondary)]'
                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                          }
                        `}
                      >
                        {boardsExpanded ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRightIcon className="h-3 w-3 shrink-0" />
                        )}
                        <LayoutGrid className="h-3.5 w-3.5 shrink-0 ml-0.5" />
                        <span>Boards</span>
                      </button>

                      {boardsExpanded && (
                        <div className="ml-2 pl-2 border-l border-[var(--border)] mt-0.5 space-y-0.5">
                          {projectBoards.map((board, index) => {
                            const isActiveBoard = activeBoardId === board.id;
                            const isDragTarget = dragOverIndex === index && dragItemRef.current !== index;
                            const isDragging = dragIndex === index;

                            return (
                              <div
                                key={board.id}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                onDragLeave={() => setDragOverIndex(null)}
                                className={`
                                  group flex items-center gap-1 px-1 py-1 rounded-md text-sm transition-all cursor-pointer
                                  ${isDragging ? 'opacity-50 scale-95' : ''}
                                  ${isDragTarget ? 'border-t-2 border-t-[var(--accent)]' : ''}
                                  ${isActiveBoard
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
                                  className="p-0.5 rounded hover:bg-[var(--bg-surface)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <GripVertical className="h-3 w-3 text-[var(--text-tertiary)]" />
                                </div>
                                <span className="text-base shrink-0">{board.icon}</span>
                                <span className="truncate">{board.name}</span>
                              </div>
                            );
                          })}

                          {/* New board */}
                          {isCreating ? (
                            <form
                              onSubmit={(e) => { e.preventDefault(); handleCreateBoard(project.id); }}
                              className="px-1"
                            >
                              <input
                                autoFocus
                                value={newBoardName}
                                onChange={(e) => setNewBoardName(e.target.value)}
                                placeholder="Board name..."
                                className="w-full px-2 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border)]
                                  rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-ring"
                                onBlur={() => {
                                  if (!newBoardName.trim()) setIsCreating(false);
                                }}
                              />
                            </form>
                          ) : (
                            <button
                              onClick={() => setIsCreating(true)}
                              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs
                                text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
                            >
                              <Plus className="h-3 w-3 shrink-0" />
                              <span>New board</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Gantt */}
                    <button
                      onClick={() => router.push(`/projects/${project.id}/gantt`)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors
                        ${isActive(`/projects/${project.id}/gantt`)
                          ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                          : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
                        }
                      `}
                    >
                      <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                      <span>Gantt</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* New Project button */}
          {!collapsed && (
            <button
              onClick={() => router.push('/projects')}
              className="w-full flex items-center gap-2 px-2 py-1.5 mt-2 rounded-md text-sm
                text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>New Project</span>
            </button>
          )}
        </div>

        {/* Global links */}
        <div className="border-t border-[var(--border)] px-2 py-2 shrink-0">
          <button
            onClick={() => router.push('/calendar')}
            className={`
              w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
              ${pathname === '/calendar'
                ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
              }
            `}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Timeline</span>}
          </button>
          <button
            onClick={() => router.push('/digest')}
            className={`
              w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
              ${pathname === '/digest'
                ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
              }
            `}
          >
            <Newspaper className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Digest</span>}
          </button>
          <button
            onClick={() => router.push('/settings')}
            className={`
              w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
              ${pathname === '/settings'
                ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
              }
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
