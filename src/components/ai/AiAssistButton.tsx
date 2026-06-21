'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';

export type AiAssistField =
  | 'card-title'
  | 'card-description'
  | 'objective-title'
  | 'objective-description'
  | 'key-result-title'
  | 'project-context';

interface AiAssistButtonProps {
  field: AiAssistField;
  value: string;
  projectId?: string;
  objectiveId?: string;
  cardId?: string;
  extraContext?: string;
  onApply: (suggestion: string) => void;
  label?: string;
  disabled?: boolean;
}

export function AiAssistButton({
  field,
  value,
  projectId,
  objectiveId,
  cardId,
  extraContext,
  onApply,
  label,
  disabled,
}: AiAssistButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');

  const handleAssist = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setSuggestion('');
    try {
      const res = await fetch('/api/ai/refine', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          field,
          currentText: value,
          projectId,
          objectiveId,
          cardId,
          extraContext,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.suggestion) {
        setError(data.error || 'No suggestion returned.');
      } else {
        setSuggestion(data.suggestion);
        setOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestion.');
    } finally {
      setLoading(false);
    }
  }, [field, value, projectId, objectiveId, cardId, extraContext, loading]);

  const apply = () => {
    onApply(suggestion);
    setOpen(false);
    setSuggestion('');
    setError('');
  };

  const reject = () => {
    setOpen(false);
    setSuggestion('');
    setError('');
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleAssist}
        disabled={disabled || loading}
        title={label || 'AI help'}
        aria-label={label || 'AI help'}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute left-full top-0 z-50 ml-2 w-72 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-lg">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--accent)]">
            <Wand2 className="h-3.5 w-3.5" />
            AI suggestion
          </div>
          <p className="mb-3 max-h-40 overflow-auto whitespace-pre-wrap text-sm text-[var(--text-primary)]">
            {suggestion}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={reject}
              className="rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface)]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Use this
            </button>
          </div>
        </div>
      )}

      {error && !open && (
        <div className="absolute left-full top-0 z-50 ml-2 w-60 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
