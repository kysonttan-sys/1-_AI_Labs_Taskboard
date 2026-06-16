import { describe, it, expect, beforeAll } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

// The session module reads SESSION_SECRET at import time, so set it before importing.
beforeAll(() => {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-32-characters-long!!';
});

describe('session', () => {
  it('creates and verifies a session token', () => {
    const data = { userId: 'u1', name: 'Alice', role: 'admin' };
    const token = createSessionToken(data);
    expect(token).toContain(':');
    expect(verifySessionToken(token)).toEqual(data);
  });

  it('rejects an invalid token', () => {
    expect(verifySessionToken('not-a-token')).toBeNull();
  });

  it('rejects a tampered token', () => {
    const token = createSessionToken({ userId: 'u1', name: 'Alice', role: 'admin' });
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(verifySessionToken(tampered)).toBeNull();
  });
});
