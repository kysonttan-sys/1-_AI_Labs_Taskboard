'use client';

import { CalendarDays } from 'lucide-react';

export default function DigestPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Weekly Digest</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-sm text-[var(--text-secondary)] font-medium">AI digest is currently unavailable</p>
        <p className="text-xs text-[var(--text-tertiary)] max-w-md">
          This feature was powered by a local Ollama instance, which is not available in this deployment.
        </p>
      </div>
    </div>
  );
}
