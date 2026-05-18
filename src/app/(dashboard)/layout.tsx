'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/authStore';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import AIChatSidebar from '@/components/ai/AIChatSidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkSession } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    checkSession().then(() => {
      setReady(true);
    });
  }, [checkSession]);

  useEffect(() => {
    if (ready && !isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [ready, isLoading, isAuthenticated, router]);

  // Don't render anything until session check completes
  if (!ready || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-base)]">
        <div className="h-8 w-8 rounded-lg bg-emerald-500 animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
      <Sidebar />

      {/* Main content area - offset by sidebar width */}
      <div className="flex-1 flex flex-col min-w-0 ml-0 md:ml-60 transition-all duration-200">
        <Topbar />
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
      <AIChatSidebar />
    </div>
  );
}