import { create } from 'zustand';

interface AuthState {
  user: { id: string; name: string; role: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (name: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (name, pin) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    set({ user: { id: data.id, name: data.name, role: data.role }, isAuthenticated: true });
    return true;
  },

  logout: async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    set({ user: null, isAuthenticated: false });
  },

  checkSession: async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        set({ user: { id: data.id, name: data.name, role: data.role }, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));