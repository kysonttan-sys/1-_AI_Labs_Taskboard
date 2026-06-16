import { describe, it, expect } from 'vitest';
import { cardContribution, recomputeKrCurrent } from './cardContribution';

describe('cardContribution', () => {
  it('returns 1 for done status', () => {
    expect(cardContribution({ status: 'done', progress: 0, completedAt: null })).toBe(1);
  });

  it('returns 1 when completedAt is set', () => {
    expect(cardContribution({ status: 'todo', progress: 0, completedAt: new Date() })).toBe(1);
  });

  it('returns 0 for blocked status', () => {
    expect(cardContribution({ status: 'blocked', progress: 80, completedAt: null })).toBe(0);
  });

  it('uses progress for in_progress status', () => {
    expect(cardContribution({ status: 'in_progress', progress: 37, completedAt: null })).toBe(0.37);
  });

  it('caps progress above 100', () => {
    expect(cardContribution({ status: 'todo', progress: 150, completedAt: null })).toBe(1);
  });

  it('floors progress below 0', () => {
    expect(cardContribution({ status: 'todo', progress: -10, completedAt: null })).toBe(0);
  });
});

describe('recomputeKrCurrent', () => {
  it('returns current when no links', () => {
    expect(recomputeKrCurrent([], 7, 100)).toBe(7);
  });

  it('computes weighted average contribution times target', () => {
    const links = [
      { weight: 1, card: { status: 'done', progress: 0, completedAt: new Date() } },
      { weight: 1, card: { status: 'todo', progress: 50, completedAt: null } },
    ];
    expect(recomputeKrCurrent(links as any, 0, 100)).toBe(75);
  });

  it('respects different weights', () => {
    const links = [
      { weight: 2, card: { status: 'done', progress: 0, completedAt: new Date() } },
      { weight: 1, card: { status: 'todo', progress: 0, completedAt: null } },
    ];
    expect(recomputeKrCurrent(links as any, 0, 100)).toBeCloseTo(66.67, 1);
  });
});
