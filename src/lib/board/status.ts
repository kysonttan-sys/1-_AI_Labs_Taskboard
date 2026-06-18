// Maps common list titles to card statuses. Users can rename lists freely;
// if the title matches one of these we keep the card status in sync.
const LIST_TITLE_STATUS_MAP: Record<string, string> = {
  'todo': 'todo',
  'to do': 'todo',
  'inprogress': 'in_progress',
  'in progress': 'in_progress',
  'in-progress': 'in_progress',
  'progress': 'in_progress',
  'review': 'review',
  'done': 'done',
  'complete': 'done',
  'completed': 'done',
};

export function deriveStatusFromListTitle(title: string): string | null {
  const normalized = title.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  return LIST_TITLE_STATUS_MAP[normalized] ?? null;
}
