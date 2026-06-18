export function parseIsoDateRange(start: unknown, end: unknown) {
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  // Strip time for comparison
  const s = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const e = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  if (e < s) return null;

  return { startDate: s, endDate: e };
}
