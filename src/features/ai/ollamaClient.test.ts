import { describe, it, expect, vi, beforeEach } from 'vitest';

// We assert on the Ollama constructor calls — vi.mock the package.
const ctor = vi.fn();
vi.mock('ollama', () => ({
  Ollama: class {
    constructor(opts: { host: string }) {
      ctor(opts.host);
    }
  },
}));

import { getOllamaClient, resolveOllamaUrl } from './ollamaClient';

beforeEach(() => {
  ctor.mockClear();
  // The module keeps a module-level Map cache. To exercise isolation per
  // test we have to re-import, which vitest does via vi.resetModules.
  vi.resetModules();
});

describe('getOllamaClient', () => {
  it('caches a single client for the default URL across calls', async () => {
    vi.resetModules();
    const { getOllamaClient: get } = await import('./ollamaClient');
    delete process.env.OLLAMA_URL;
    const a = get();
    const b = get();
    expect(a).toBe(b);
    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh client when an explicit URL differs from the cached one', async () => {
    vi.resetModules();
    const { getOllamaClient: get } = await import('./ollamaClient');
    delete process.env.OLLAMA_URL;
    const defaultClient = get();
    const explicitClient = get('http://other-host:11434');
    expect(defaultClient).not.toBe(explicitClient);
    expect(ctor).toHaveBeenCalledTimes(2);
    expect(ctor.mock.calls[0][0]).toBe('http://localhost:11434');
    expect(ctor.mock.calls[1][0]).toBe('http://other-host:11434');
  });

  it('caches per-explicit-URL across calls', async () => {
    vi.resetModules();
    const { getOllamaClient: get } = await import('./ollamaClient');
    const a = get('http://h1:11434');
    const b = get('http://h1:11434');
    expect(a).toBe(b);
    expect(ctor).toHaveBeenCalledTimes(1);
  });
});

describe('resolveOllamaUrl', () => {
  it('prefers an explicit argument over env and default', async () => {
    vi.resetModules();
    const { resolveOllamaUrl: r } = await import('./ollamaClient');
    process.env.OLLAMA_URL = 'http://env-host:11434';
    expect(r('http://explicit:11434')).toBe('http://explicit:11434');
    delete process.env.OLLAMA_URL;
  });
});
