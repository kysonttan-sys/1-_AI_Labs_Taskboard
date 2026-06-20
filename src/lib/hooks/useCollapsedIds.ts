'use client';

import { useState, useEffect, useCallback } from 'react';

function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage errors
  }
}

export function useCollapsedIds(storageKey: string) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readSet(storageKey));

  // Re-read from storage when the key changes (unlikely in practice, but keeps
  // the hook correct if a caller switches keys).
  useEffect(() => {
    setCollapsed(readSet(storageKey));
  }, [storageKey]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const expand = useCallback((id: string) => {
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      writeSet(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const collapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeSet(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed]);

  return { collapsed, toggle, expand, collapse, isCollapsed };
}
