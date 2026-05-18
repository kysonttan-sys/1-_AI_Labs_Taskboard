'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/authStore';
import { useBoardStore } from '@/features/board/boardStore';

export default function Home() {
  const router = useRouter();
  const { checkSession } = useAuthStore();
  const { fetchBoards } = useBoardStore();

  useEffect(() => {
    async function redirect() {
      try {
        await checkSession();
        const authed = useAuthStore.getState().isAuthenticated;
        if (authed) {
          await fetchBoards();
          const boardList = useBoardStore.getState().boards;
          if (boardList.length > 0) {
            router.replace(`/board/${boardList[0].id}`);
          } else {
            router.replace('/board');
          }
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
      }
    }
    redirect();
  }, [checkSession, fetchBoards, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-emerald-500 animate-pulse" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}