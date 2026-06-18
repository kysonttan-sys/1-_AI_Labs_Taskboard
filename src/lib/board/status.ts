// With Option A, card status is the list title itself. We keep small helpers
// for detecting "done" / "blocked" states from any status text.

function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isCompletedStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === 'done' || normalized === 'complete' || normalized === 'completed';
}

export function isBlockedStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === 'blocked' || normalized === 'block';
}
