import { describe, it, expect } from 'vitest';
import { parseIsoDateRange } from './dates';

describe('parseIsoDateRange', () => {
  it('accepts a valid start/end pair', () => {
    expect(parseIsoDateRange('2026-07-01', '2026-07-31')).toEqual({
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-31T00:00:00.000Z'),
    });
  });

  it('rejects missing start date', () => {
    expect(parseIsoDateRange('', '2026-07-31')).toBeNull();
  });

  it('rejects invalid dates', () => {
    expect(parseIsoDateRange('not-a-date', '2026-07-31')).toBeNull();
  });

  it('rejects end date before start date', () => {
    expect(parseIsoDateRange('2026-07-31', '2026-07-01')).toBeNull();
  });
});
