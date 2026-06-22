'use client';

import { useState, useCallback } from 'react';

export type PromptType = 'focus' | 'suggest-okrs' | 'suggest-tasks' | 'missing-steps' | 'project-next-steps' | 'custom';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AskOptions {
  promptType: PromptType;
  projectId?: string;
  question?: string;
}

interface AskResult {
  suggestion: string;
  chatId: string;
}

export function useAiSuggestion() {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const ask = useCallback(async ({ promptType, projectId, question }: AskOptions) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ promptType, projectId, question, chatId }),
      });

      const data = (await res.json().catch(() => ({ suggestion: 'No response from AI service.' }))) as AskResult | { error?: string };

      if (!res.ok) {
        throw new Error('error' in data ? data.error! : `AI request failed (${res.status})`);
      }

      const { suggestion, chatId: newChatId } = data as AskResult;
      setSuggestion(suggestion || '');
      if (newChatId) setChatId(newChatId);
      if (question) setLastQuestion(question);

      // Append to local conversation history
      const userContent = question || promptType;
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: userContent },
        { role: 'assistant', content: suggestion || '' },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  const reset = useCallback(() => {
    setSuggestion('');
    setError(null);
    setLastQuestion('');
    setChatId(null);
    setMessages([]);
  }, []);

  const newChat = useCallback(() => {
    setSuggestion('');
    setError(null);
    setLastQuestion('');
    setChatId(null);
    setMessages([]);
  }, []);

  return { suggestion, loading, error, ask, reset, newChat, lastQuestion, chatId, messages };
}
