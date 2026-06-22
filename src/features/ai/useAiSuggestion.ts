'use client';

import { useState, useCallback, useRef } from 'react';

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

interface HistoryResult {
  chatId: string;
  messages: ChatMessage[];
}

function storageKey(projectId?: string) {
  return projectId ? `ai-chat-id:${projectId}` : 'ai-chat-id:global';
}

export function useAiSuggestion() {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const restoredRef = useRef(false);

  // Restore the most recent chat for this scope on first mount.
  const restoreChat = useCallback(async (projectId?: string) => {
    const key = storageKey(projectId);
    const storedId = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!storedId || restoredRef.current) return;
    restoredRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/suggest?chatId=${encodeURIComponent(storedId)}&projectId=${encodeURIComponent(projectId || '')}`);
      if (!res.ok) {
        // Stored chat may have been deleted; clear it.
        localStorage.removeItem(key);
        restoredRef.current = false;
        return;
      }
      const data = (await res.json()) as HistoryResult;
      setChatId(data.chatId);
      setMessages(data.messages || []);
    } catch {
      // Ignore restore errors so the UI stays usable.
      restoredRef.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  const ask = useCallback(async ({ promptType, projectId, question }: AskOptions) => {
    // Ensure a chat is restored before sending the first message in this session.
    if (!restoredRef.current && !chatId) {
      await restoreChat(projectId);
    }

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
      if (newChatId) {
        setChatId(newChatId);
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey(projectId), newChatId);
        }
      }
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
  }, [chatId, restoreChat]);

  const reset = useCallback(() => {
    setSuggestion('');
    setError(null);
    setLastQuestion('');
    setChatId(null);
    setMessages([]);
  }, []);

  const newChat = useCallback((projectId?: string) => {
    setSuggestion('');
    setError(null);
    setLastQuestion('');
    setChatId(null);
    setMessages([]);
    restoredRef.current = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey(projectId));
    }
  }, []);

  return { suggestion, loading, error, ask, reset, newChat, lastQuestion, chatId, messages, restoreChat };
}
