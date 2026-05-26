export type Theme = 'dark' | 'light';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  } catch {
    // ignore
  }
}

export function toggleTheme(): Theme {
  const current = getStoredTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

interface PriorityColorSet {
  border: string;
  bg: string;
  text: string;
  label: string;
}

export const priorityColors: Record<'dark' | 'light', Record<string, PriorityColorSet>> = {
  dark: {
    urgent: { border: '#ef4444', bg: '#2d1515', text: '#fca5a5', label: 'Urgent' },
    high: { border: '#f97316', bg: '#2d1f12', text: '#fdba74', label: 'High' },
    medium: { border: '#3b82f6', bg: '#141c2d', text: '#93c5fd', label: 'Medium' },
    low: { border: '#6b7280', bg: '#1e1e20', text: '#9ca3af', label: 'Low' },
    done: { border: '#10b981', bg: '#0f2d1f', text: '#6ee7b7', label: 'Done' },
  },
  light: {
    urgent: { border: '#ef4444', bg: '#fef2f2', text: '#ef4444', label: 'Urgent' },
    high: { border: '#f97316', bg: '#fff7ed', text: '#f97316', label: 'High' },
    medium: { border: '#3b82f6', bg: '#eff6ff', text: '#3b82f6', label: 'Medium' },
    low: { border: '#6b7280', bg: '#f4f4f5', text: '#6b7280', label: 'Low' },
    done: { border: '#10b981', bg: '#f0fdf4', text: '#10b981', label: 'Done' },
  },
};

export function getPriorityConfig(priority: string, isDone: boolean): PriorityColorSet {
  const theme = typeof window !== 'undefined'
    ? (document.documentElement.getAttribute('data-theme') as Theme) || 'dark'
    : 'dark';
  const palette = priorityColors[theme] || priorityColors.dark;
  if (isDone) return palette.done;
  return palette[priority] || palette.low;
}

export function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
