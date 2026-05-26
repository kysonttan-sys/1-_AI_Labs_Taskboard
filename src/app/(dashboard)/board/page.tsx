'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBoardStore } from '@/features/board/boardStore';
import { LayoutDashboard } from 'lucide-react';

export default function BoardIndexPage() {
  const router = useRouter();
  const { boards, fetchBoards, createBoard } = useBoardStore();

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (boards.length > 0) {
      router.replace(`/board/${boards[0].id}`);
    }
  }, [boards, router]);

  async function handleCreateBoard() {
    const board = await createBoard('My Board');
    router.replace(`/board/${board.id}`);
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">
        <LayoutDashboard className="h-6 w-6 text-[var(--accent)]" />
      </div>
      <p className="text-[var(--text-tertiary)] text-sm">No boards yet</p>
      <button
        onClick={handleCreateBoard}
        className="px-4 py-2 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-md transition-colors"
      >
        Create your first board
      </button>
    </div>
  );
}