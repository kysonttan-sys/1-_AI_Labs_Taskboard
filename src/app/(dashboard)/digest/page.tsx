'use client';

import { useState } from 'react';
import { CalendarDays, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useBoardStore } from '@/features/board/boardStore';

interface Digest {
  id: string;
  content: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export default function DigestPage() {
  const { activeBoardId } = useBoardStore();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateDigest = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: activeBoardId }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();
      setDigest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate digest');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-emerald-500" />
          <h1 className="text-lg font-semibold text-white">Weekly Digest</h1>
        </div>
        <button
          onClick={generateDigest}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate New Digest
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      {isLoading && !digest && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          <p className="text-sm text-gray-500">Generating your weekly digest...</p>
        </div>
      )}

      {digest && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>
              {new Date(digest.startDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}{' '}
              &ndash;{' '}
              {new Date(digest.endDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="prose prose-invert prose-sm max-w-none [&_code]:text-emerald-400 [&_a]:text-emerald-400 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {digest.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {!digest && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Sparkles className="h-12 w-12 text-gray-600" />
          <div className="text-center">
            <p className="text-sm text-gray-400 font-medium">No digest yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Generate a weekly summary of your board&apos;s activity and progress
            </p>
          </div>
        </div>
      )}
    </div>
  );
}