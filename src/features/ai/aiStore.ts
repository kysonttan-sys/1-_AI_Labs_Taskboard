import { create } from 'zustand';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIState {
  isOpen: boolean;
  isStreaming: boolean;
  messages: Message[];
  error: string | null;
  ollamaConnected: boolean;
  aiDisabled: boolean;
  toggleOpen: () => void;
  setOpen: (v: boolean) => void;
  sendMessage: (content: string, boardId: string, cardId?: string) => Promise<void>;
  clearMessages: () => void;
  checkConnection: () => Promise<void>;
}

export const useAiStore = create<AIState>((set) => ({
  isOpen: false,
  isStreaming: false,
  messages: [],
  error: null,
  ollamaConnected: false,
  aiDisabled: false,

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (v) => set({ isOpen: v }),

  sendMessage: async (content, boardId, cardId) => {
    const userMessage: Message = { role: 'user', content };
    set((s) => ({
      messages: [...s.messages, userMessage],
      isStreaming: true,
      error: null,
    }));

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...useAiStore.getState().messages, userMessage],
          boardId,
          cardId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      // Add empty assistant message that we'll stream into
      set((s) => ({
        messages: [...s.messages, { role: 'assistant', content: '' }],
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.done) continue;
            if (parsed.content) {
              assistantContent += parsed.content;
              set((s) => ({
                messages: [
                  ...s.messages.slice(0, -1),
                  { role: 'assistant', content: assistantContent },
                ],
              }));
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }

      set({ isStreaming: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      set((s) => ({
        isStreaming: false,
        error: errorMsg,
        messages: [
          ...s.messages,
          { role: 'assistant', content: `Error: ${errorMsg}` },
        ],
      }));
    }
  },

  clearMessages: () => set({ messages: [], error: null }),

  checkConnection: async () => {
    try {
      const res = await fetch('/api/ai/models');
      if (res.ok) {
        const data = await res.json();
        if (data.disabled) {
          set({ ollamaConnected: false, aiDisabled: true });
        } else {
          set({ ollamaConnected: data.connected, aiDisabled: false });
        }
      } else {
        set({ ollamaConnected: false });
      }
    } catch {
      set({ ollamaConnected: false });
    }
  },
}));