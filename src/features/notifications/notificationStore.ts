import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  cardId: string | null;
  boardId: string | null;
  triggerUser: { id: string; name: string; color: string } | null;
  card: { id: string; title: string } | null;
  board: { id: string; name: string } | null;
  createdAt: string;
}

let audioElement: HTMLAudioElement | null = null;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let dueDateIntervalId: ReturnType<typeof setInterval> | null = null;

function playNotificationSound() {
  const state = useNotificationStore.getState();
  if (!state.soundEnabled) return;

  if (!audioElement) {
    audioElement = new Audio('/sounds/Message sound.mp3');
    audioElement.volume = 0.5;
  }

  audioElement.currentTime = 0;
  audioElement.play().catch(() => {});
}

function showBrowserNotification(notification: NotificationItem) {
  const state = useNotificationStore.getState();
  if (!state.browserPermissionGranted) return;
  if (!('Notification' in window)) return;
  if (document.hasFocus()) return;

  new Notification(notification.title, {
    body: notification.body || '',
    icon: '/favicon.ico',
    tag: notification.id,
  });
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  isDropdownOpen: boolean;
  lastSeenId: string | null;
  browserPermissionGranted: boolean;
  browserNotificationSupported: boolean;
  soundEnabled: boolean;

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  toggleDropdown: () => void;
  setDropdownOpen: (open: boolean) => void;
  requestBrowserPermission: () => Promise<void>;
  toggleSound: () => void;
  checkDueDates: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isDropdownOpen: false,
  lastSeenId: null,
  browserPermissionGranted:
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission === 'granted'
      : false,
  browserNotificationSupported:
    typeof window !== 'undefined' && 'Notification' in window,
  soundEnabled:
    typeof window !== 'undefined'
      ? localStorage.getItem('notification-sound-enabled') !== 'false'
      : true,

  fetchNotifications: async () => {
    try {
      const res = await fetch('/api/notifications?limit=50');
      if (!res.ok) return;
      const data = await res.json();
      const incoming: NotificationItem[] = data.notifications;
      const currentLastSeenId = get().lastSeenId;

      // Detect new notifications
      if (currentLastSeenId && incoming.length > 0 && incoming[0].id !== currentLastSeenId) {
        const newItems = incoming.filter(
          (n) => !get().notifications.some((existing) => existing.id === n.id)
        );
        for (const n of newItems) {
          if (!n.read) {
            playNotificationSound();
            showBrowserNotification(n);
          }
        }
      }

      set({
        notifications: incoming,
        unreadCount: data.unreadCount,
        lastSeenId: incoming.length > 0 ? incoming[0].id : currentLastSeenId,
      });
    } catch {
      // Silently fail
    }
  },

  markAsRead: async (id) => {
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    });
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  markAllAsRead: async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (id) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    set((s) => {
      const wasUnread = s.notifications.find((n) => n.id === id && !n.read);
      return {
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: wasUnread ? s.unreadCount - 1 : s.unreadCount,
      };
    });
  },

  toggleDropdown: () => set((s) => ({ isDropdownOpen: !s.isDropdownOpen })),
  setDropdownOpen: (open) => set({ isDropdownOpen: open }),

  requestBrowserPermission: async () => {
    if (!('Notification' in window)) {
      // Not available on HTTP — show explanation
      alert('Browser notifications require HTTPS. If accessing over LAN/HTTP, this feature is unavailable. Use the Cloudflare Tunnel URL (HTTPS) instead.');
      return;
    }
    const result = await Notification.requestPermission();
    const granted = result === 'granted';
    set({ browserPermissionGranted: granted });
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    set({ soundEnabled: next });
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification-sound-enabled', String(next));
    }
  },

  checkDueDates: async () => {
    try {
      await fetch('/api/notifications/check-due', { method: 'POST' });
    } catch {
      // Silently fail
    }
  },

  startPolling: () => {
    if (pollIntervalId) return;

    // Fetch immediately
    get().fetchNotifications();
    get().checkDueDates();

    pollIntervalId = setInterval(() => get().fetchNotifications(), 15000);
    dueDateIntervalId = setInterval(() => get().checkDueDates(), 300000);
  },

  stopPolling: () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    if (dueDateIntervalId) {
      clearInterval(dueDateIntervalId);
      dueDateIntervalId = null;
    }
  },
}));