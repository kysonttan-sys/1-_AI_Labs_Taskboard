import { create } from 'zustand';
import { startOfMonth, endOfMonth } from 'date-fns';
import type { CalendarEvent } from '@/types';

interface CalendarState {
  view: 'month' | 'gantt';
  currentDate: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  setView: (view: 'month' | 'gantt') => void;
  setCurrentDate: (date: Date) => void;
  setSelectedDate: (date: Date | null) => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  fetchEvents: (date?: Date) => Promise<void>;
  createEvent: (data: { title: string; description?: string; startDate: string; endDate?: string; allDay?: boolean; color?: string; visibility?: string }) => Promise<CalendarEvent | null>;
  updateEvent: (id: string, data: Partial<{ title: string; description: string; startDate: string; endDate: string; allDay: boolean; color: string; visibility: string }>) => Promise<CalendarEvent | null>;
  deleteEvent: (id: string) => Promise<boolean>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  view: 'month',
  currentDate: new Date(),
  selectedDate: null,
  events: [],
  setView: (view) => set({ view }),
  setCurrentDate: (date) => set({ currentDate: date }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  goToPrevMonth: () =>
    set((s) => {
      const d = new Date(s.currentDate);
      d.setMonth(d.getMonth() - 1);
      return { currentDate: d };
    }),
  goToNextMonth: () =>
    set((s) => {
      const d = new Date(s.currentDate);
      d.setMonth(d.getMonth() + 1);
      return { currentDate: d };
    }),
  fetchEvents: async (date) => {
    const d = date ?? get().currentDate;
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    try {
      const res = await fetch(`/api/events?start=${start.toISOString()}&end=${end.toISOString()}`);
      if (!res.ok) return;
      const events = await res.json();
      set({ events });
    } catch { /* ignore */ }
  },
  createEvent: async (data) => {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const event = await res.json();
      set((s) => ({ events: [...s.events, event] }));
      return event;
    } catch { return null; }
  },
  updateEvent: async (id, data) => {
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const updated = await res.json();
      set((s) => ({ events: s.events.map((e) => (e.id === id ? updated : e)) }));
      return updated;
    } catch { return null; }
  },
  deleteEvent: async (id) => {
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) return false;
      set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
      return true;
    } catch { return false; }
  },
}));
