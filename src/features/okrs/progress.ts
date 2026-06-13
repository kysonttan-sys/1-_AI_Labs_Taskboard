export function pct(current: number, target: number): number {
  if (target <= 0 || current < 0) return 0;
  return Math.min(100, (current / target) * 100);
}

export function formatValue(current: number, target: number, unit?: string | null): string {
  return `${current} / ${target} ${unit ?? ''}`;
}
