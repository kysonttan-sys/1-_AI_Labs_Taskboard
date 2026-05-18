import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  text: string;
  boardId: string;
  userId: string | null;
  user: { id: string; name: string; color: string } | null;
  replyToId: string | null;
  replyTo: { id: string; text: string; user: { id: string; name: string; color: string } | null } | null;
  createdAt: string;
}

let chatAudio: HTMLAudioElement | null = null;

function playChatSound() {
  const soundEnabled = typeof window !== 'undefined'
    ? localStorage.getItem('notification-sound-enabled') !== 'false'
    : true;
  if (!soundEnabled) return;

  if (!chatAudio) {
    chatAudio = new Audio('/sounds/Message sound.mp3');
    chatAudio.volume = 0.35;
  }
  chatAudio.currentTime = 0;
  chatAudio.play().catch(() => {});
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  boardId: string | null;
  currentUserId: string | null;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setCurrentUserId: (id: string) => void;
  fetchMessages: (boardId: string) => Promise<void>;
  sendMessage: (boardId: string, text: string, replyToId?: string) => Promise<void>;
  startPolling: (boardId: string) => void;
  stopPolling: () => void;
}

let pollIntervalId: ReturnType<typeof setInterval> | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  boardId: null,
  currentUserId: null,

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setCurrentUserId: (id) => set({ currentUserId: id }),

  fetchMessages: async (boardId) => {
    try {
      const res = await fetch(`/api/chat?boardId=${boardId}`);
      if (!res.ok) return;
      const data = await res.json();
      const incoming: ChatMessage[] = data.messages || [];

      const prevMessages = get().messages;
      const prevIds = new Set(prevMessages.map((m) => m.id));
      const newFromOthers = incoming.filter(
        (m) => !prevIds.has(m.id) && m.userId !== get().currentUserId
      );

      if (newFromOthers.length > 0 && prevMessages.length > 0) {
        playChatSound();
      }

      set({ messages: incoming, boardId });
    } catch {
      // Silently fail
    }
  },

  sendMessage: async (boardId, text, replyToId) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, boardId, ...(replyToId ? { replyToId } : {}) }),
      });
      if (!res.ok) return;
      const message = await res.json();
      set((s) => ({ messages: [...s.messages, message] }));
    } catch {
      // Silently fail
    }
  },

  startPolling: (boardId) => {
    if (pollIntervalId) return;

    get().fetchMessages(boardId);
    pollIntervalId = setInterval(() => {
      const currentBoardId = get().boardId || boardId;
      get().fetchMessages(currentBoardId);
    }, 5000);
  },

  stopPolling: () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  },
}));