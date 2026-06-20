'use client';

import { useState, useCallback } from 'react';

export type PromptType = 'focus' | 'suggest-okrs' | 'suggest-tasks' | 'missing-steps' | 'project-next-steps';

interface AskOptions {
  promptType: PromptType;
  projectId?: string;
}

export function useAiSuggestion() {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async ({ promptType, projectId }: AskOptions) => {
    setLoading(true);
    setError(null);
    setSuggestion('');
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ promptType, projectId }),
      });

      const data = await res.json().catch(() => ({ suggestion: 'No response from AI service.' }));

      if (!res.ok) {
        throw new Error(data.suggestion || data.error || `AI request failed (${res.status})`);
      }

      setSuggestion(data.suggestion || '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSuggestion('');
    setError(null);
  }, []);

  return { suggestion, loading, error, ask, reset };
}
