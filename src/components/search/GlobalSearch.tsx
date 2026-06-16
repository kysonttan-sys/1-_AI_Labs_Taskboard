'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, LayoutGrid, Target, MessageSquare } from 'lucide-react';

interface SearchResult {
  cards: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    boardId: string;
    board: { id: string; name: string };
  }>;
  objectives: Array<{
    id: string;
    title: string;
    description: string | null;
    project: { id: string; name: string };
  }>;
  comments: Array<{
    id: string;
    text: string;
    card: { id: string; title: string; boardId: string };
    author: { name: string } | null;
  }>;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ cards: [], objectives: [], comments: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults({ cards: [], objectives: [], comments: [] });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults({ cards: [], objectives: [], comments: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => search(query), 250);
    return () => clearTimeout(handler);
  }, [query, search]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function navigateToBoardCard(cardId: string, boardId: string) {
    router.push(`/board/${boardId}?card=${cardId}`);
    setOpen(false);
    setQuery('');
  }

  function navigateToObjective(id: string) {
    router.push(`/okrs?objective=${id}`);
    setOpen(false);
    setQuery('');
  }

  const total = results.cards.length + results.objectives.length + results.comments.length;

  return (
    <div ref={containerRef} className="relative w-full max-w-md hidden sm:block">
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
          bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-tertiary)]
          hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Search cards, OKRs, comments...</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border)]">Ctrl+K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-24">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-50 w-full max-w-xl bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
              <Search className="h-5 w-5 text-[var(--text-tertiary)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cards, OKRs, comments..."
                className="flex-1 bg-transparent text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                  className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-[var(--text-tertiary)] px-2 py-1 rounded bg-[var(--bg-base)] border border-[var(--border)]"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length > 0 && query.trim().length < 2 && (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-6">Type at least 2 characters...</p>
              )}

              {loading && (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                </div>
              )}

              {!loading && query.trim().length >= 2 && total === 0 && (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-6">No results found.</p>
              )}

              {results.cards.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-2 py-1">Cards</p>
                  {results.cards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => navigateToBoardCard(card.id, card.boardId)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-[var(--accent)] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--text-primary)] truncate">{card.title}</p>
                          <p className="text-xs text-[var(--text-tertiary)] truncate">{card.board.name}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.objectives.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-2 py-1">OKRs</p>
                  {results.objectives.map((obj) => (
                    <button
                      key={obj.id}
                      onClick={() => navigateToObjective(obj.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--text-primary)] truncate">{obj.title}</p>
                          <p className="text-xs text-[var(--text-tertiary)] truncate">{obj.project.name}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.comments.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-2 py-1">Comments</p>
                  {results.comments.map((comment) => (
                    <button
                      key={comment.id}
                      onClick={() => navigateToBoardCard(comment.card.id, comment.card.boardId)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors"

                      >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-cyan-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--text-primary)] line-clamp-2">{comment.text}</p>
                          <p className="text-xs text-[var(--text-tertiary)] truncate">On &ldquo;{comment.card.title}&rdquo; {comment.author && `• ${comment.author.name}`}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
