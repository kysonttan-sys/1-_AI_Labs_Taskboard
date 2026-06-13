import { describe, it, expect } from 'vitest';
import { pct, formatValue } from './progress';

describe('pct', () => {
  it('returns 0 for current = 0', () => {
    expect(pct(0, 10)).toBe(0);
  });
  it('returns 50 for current = half of target', () => {
    expect(pct(5, 10)).toBe(50);
  });
  it('returns 100 for current = target', () => {
    expect(pct(10, 10)).toBe(100);
  });
  it('caps at 100 for over-achievement', () => {
    expect(pct(15, 10)).toBe(100);
  });
  it('returns 0 when target is 0 (no division by zero)', () => {
    expect(pct(0, 0)).toBe(0);
  });
  it('returns 0 when target is negative', () => {
    expect(pct(5, -10)).toBe(0);
  });
  it('returns 0 when current is negative', () => {
    expect(pct(-1, 10)).toBe(0);
  });
});

describe('formatValue', () => {
  it('formats with unit when provided', () => {
    expect(formatValue(3, 10, 'users')).toBe('3 / 10 users');
  });
  it('formats without unit when omitted', () => {
    expect(formatValue(3, 10)).toBe('3 / 10 ');
  });
  it('formats with null unit', () => {
    expect(formatValue(3, 10, null)).toBe('3 / 10 ');
  });
  it('handles fractional values', () => {
    expect(formatValue(2.5, 10, 'pts')).toBe('2.5 / 10 pts');
  });
});
