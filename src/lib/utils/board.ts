import type { Card } from '@/types';
import { isCompletedStatus } from '@/lib/board/status';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortCards(cards: Card[], isDoneColumn: boolean): Card[] {
  return [...cards].sort((a, b) => {
    if (isDoneColumn) {
      // Done column: latest due date on top, null dates at bottom
      if (a.dueDate && b.dueDate) {
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.position - b.position;
    }

    // Done cards go to the bottom within non-done columns
    const aDone = isCompletedStatus(a.status) || !!a.completedAt ? 1 : 0;
    const bDone = isCompletedStatus(b.status) || !!b.completedAt ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    // Priority: urgent first
    const aPri = PRIORITY_ORDER[a.priority] ?? 2;
    const bPri = PRIORITY_ORDER[b.priority] ?? 2;
    if (aPri !== bPri) return aPri - bPri;

    // Due date: soonest first, null dates last
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Fallback: original position
    return a.position - b.position;
  });
}
