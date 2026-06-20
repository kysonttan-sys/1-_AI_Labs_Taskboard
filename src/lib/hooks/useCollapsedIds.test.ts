import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollapsedIds } from './useCollapsedIds';

describe('useCollapsedIds', () => {
  const storageKey = 'test-collapsed-ids';

  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty when localStorage has no value', () => {
    const { result } = renderHook(() => useCollapsedIds(storageKey));
    expect(result.current.collapsed.size).toBe(0);
    expect(result.current.isCollapsed('a')).toBe(false);
  });

  it('reads existing ids from localStorage after mount', () => {
    localStorage.setItem(storageKey, JSON.stringify(['a', 'b']));
    const { result } = renderHook(() => useCollapsedIds(storageKey));
    expect(result.current.isCollapsed('a')).toBe(true);
    expect(result.current.isCollapsed('b')).toBe(true);
    expect(result.current.isCollapsed('c')).toBe(false);
  });

  it('toggles an id and persists the change', () => {
    const { result } = renderHook(() => useCollapsedIds(storageKey));

    act(() => {
      result.current.toggle('x');
    });

    expect(result.current.isCollapsed('x')).toBe(true);
    expect(JSON.parse(localStorage.getItem(storageKey) || '[]')).toEqual(['x']);

    act(() => {
      result.current.toggle('x');
    });

    expect(result.current.isCollapsed('x')).toBe(false);
    expect(JSON.parse(localStorage.getItem(storageKey) || '[]')).toEqual([]);
  });

  it('collapse and expand individual ids', () => {
    const { result } = renderHook(() => useCollapsedIds(storageKey));

    act(() => {
      result.current.collapse('a');
      result.current.collapse('b');
    });

    expect(result.current.isCollapsed('a')).toBe(true);
    expect(result.current.isCollapsed('b')).toBe(true);

    act(() => {
      result.current.expand('a');
    });

    expect(result.current.isCollapsed('a')).toBe(false);
    expect(result.current.isCollapsed('b')).toBe(true);
    expect(JSON.parse(localStorage.getItem(storageKey) || '[]')).toEqual(['b']);
  });

  it('is isolated by storage key', () => {
    const { result: a } = renderHook(() => useCollapsedIds('key-a'));
    const { result: b } = renderHook(() => useCollapsedIds('key-b'));

    act(() => {
      a.current.toggle('shared');
    });

    expect(a.current.isCollapsed('shared')).toBe(true);
    expect(b.current.isCollapsed('shared')).toBe(false);
  });
});
