import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Objective, KeyResult } from '@/lib/api/okrs';

// Mock the API client with controllable deferreds so we can interleave
// request resolutions to simulate ordering.
const updateKeyResultMock = vi.fn();
const addKeyResultMock = vi.fn();
const removeKeyResultMock = vi.fn();
const listMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const removeMock = vi.fn();

vi.mock('@/lib/api/okrs', () => ({
  okrsApi: {
    list: () => listMock(),
    create: (input: any) => createMock(input),
    update: (id: string, input: any) => updateMock(id, input),
    remove: (id: string) => removeMock(id),
    addKeyResult: (objectiveId: string, input: any) => addKeyResultMock(objectiveId, input),
    updateKeyResult: (objectiveId: string, krId: string, input: any) =>
      updateKeyResultMock(objectiveId, krId, input),
    removeKeyResult: (objectiveId: string, krId: string) =>
      removeKeyResultMock(objectiveId, krId),
  },
}));

import { useOkrStore } from './okrStore';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeKr(overrides: Partial<KeyResult> = {}): KeyResult {
  return {
    id: 'kr-1',
    title: 'Ship',
    target: 10,
    current: 0,
    unit: null,
    position: 0,
    objectiveId: 'obj-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeObj(krs: KeyResult[] = []): Objective {
  return {
    id: 'obj-1',
    title: 'Objective',
    description: null,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-03-31T00:00:00Z',
    position: 0,
    ownerId: null,
    keyResults: krs,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useOkrStore.setState({ objectives: [], isLoading: false, error: null });
});

describe('okrStore.updateKeyResult', () => {
  it('applies optimistic value and the server response on success', async () => {
    useOkrStore.setState({ objectives: [makeObj([makeKr({ current: 0 })] )] });
    updateKeyResultMock.mockResolvedValueOnce(makeKr({ current: 7 }));

    const p = useOkrStore.getState().updateKeyResult('obj-1', 'kr-1', { current: 7 });
    // Optimistic update is synchronous
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(7);
    await p;
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(7);
  });

  it('drops a stale response when a newer updateKeyResult has started', async () => {
    useOkrStore.setState({ objectives: [makeObj([makeKr({ current: 0 })] )] });

    // Request 1 will resolve LAST; the server returns current=5.
    // Request 2 will resolve FIRST; the server returns current=20.
    // The newer call's value (20) should win.
    const d1 = deferred<KeyResult>();
    const d2 = deferred<KeyResult>();
    updateKeyResultMock
      .mockReturnValueOnce(d1.promise) // first call
      .mockReturnValueOnce(d2.promise); // second call

    const p1 = useOkrStore.getState().updateKeyResult('obj-1', 'kr-1', { current: 5 });
    const p2 = useOkrStore.getState().updateKeyResult('obj-1', 'kr-1', { current: 20 });

    // Optimistic state after both
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(20);

    // Resolve the newer request first
    d2.resolve(makeKr({ current: 20 }));
    await p2;
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(20);

    // Then the stale request — should NOT clobber to 5
    d1.resolve(makeKr({ current: 5 }));
    await p1;
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(20);
  });

  it('does not roll back when a newer call owns the optimistic value', async () => {
    useOkrStore.setState({ objectives: [makeObj([makeKr({ current: 0 })] )] });

    // First call will FAIL; second call succeeds with current=20.
    // The first's rollback must not undo the second's optimistic update.
    const d1 = deferred<KeyResult>();
    const d2 = deferred<KeyResult>();
    updateKeyResultMock
      .mockReturnValueOnce(d1.promise)
      .mockReturnValueOnce(d2.promise);

    const p1 = useOkrStore.getState().updateKeyResult('obj-1', 'kr-1', { current: 5 }).catch((e) => e);
    const p2 = useOkrStore.getState().updateKeyResult('obj-1', 'kr-1', { current: 20 });

    // Optimistic state is current=20 (the second call's value)
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(20);

    // First call fails
    d1.reject(new Error('network blip'));
    await p1;

    // Critical: must still be 20, not rolled back to 0
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(20);

    // Second call succeeds
    d2.resolve(makeKr({ current: 20 }));
    await p2;
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(20);
  });

  it('rolls back the optimistic value when the most recent call fails', async () => {
    useOkrStore.setState({ objectives: [makeObj([makeKr({ current: 3 })] )] });
    updateKeyResultMock.mockRejectedValueOnce(new Error('400 bad request'));

    await expect(
      useOkrStore.getState().updateKeyResult('obj-1', 'kr-1', { current: 99 })
    ).rejects.toThrow('400 bad request');
    expect(useOkrStore.getState().objectives[0].keyResults[0].current).toBe(3);
  });
});
