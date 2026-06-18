'use client';

import { getInitials } from '@/lib/utils/initials';

interface ActivityActor {
  id: string;
  name: string;
  color: string;
}

interface ActivityEvent {
  id: string;
  type: string;
  actor: ActivityActor | null;
  boardId: string | null;
  cardId: string | null;
  listId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Props {
  event: ActivityEvent;
  showBoard?: boolean;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function describeEvent(event: ActivityEvent): string {
  const { type, metadata } = event;
  switch (type) {
    case 'card_created':
      return `created card "${(metadata?.title as string) ?? 'Untitled'}"`;
    case 'card_updated':
      return `updated card "${(metadata?.title as string) ?? 'Untitled'}"`;
    case 'card_moved': {
      const from = (metadata?.fromListTitle as string) ?? '';
      const to = (metadata?.toListTitle as string) ?? '';
      const statusNote = (metadata?.status as string) ? ` (status: ${metadata?.status})` : '';
      if (from && to) return `moved card "${(metadata?.title as string) ?? 'Untitled'}" from ${from} to ${to}${statusNote}`;
      return `moved card "${(metadata?.title as string) ?? 'Untitled'}"${statusNote}`;
    }
    case 'card_deleted':
      return `deleted card "${(metadata?.title as string) ?? 'Untitled'}"`;
    case 'comment_added':
      return `commented on card`;
    case 'checklist_item_completed':
      return `completed checklist item "${(metadata?.text as string) ?? ''}"`;
    case 'list_created':
      return `created list "${(metadata?.title as string) ?? ''}"`;
    case 'list_renamed': {
      const from = (metadata?.from as string) ?? '';
      const to = (metadata?.to as string) ?? '';
      return `renamed list from "${from}" to "${to}"`;
    }
    case 'list_deleted':
      return `deleted list "${(metadata?.title as string) ?? ''}"`;
    case 'board_renamed': {
      const from = (metadata?.from as string) ?? '';
      const to = (metadata?.to as string) ?? '';
      return `renamed board from "${from}" to "${to}"`;
    }
    case 'okr_linked': {
      const kr = (metadata?.keyResultTitle as string) ?? 'a key result';
      return `linked card to key result "${kr}"`;
    }
    default:
      return `performed action ${type}`;
  }
}

export default function ActivityRow({ event, showBoard }: Props) {
  const actor = event.actor;
  return (
    <div className="flex items-start gap-2 py-2">
      {actor ? (
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
          style={{ backgroundColor: `${actor.color}22`, color: actor.color }}
        >
          {getInitials(actor.name)}
        </div>
      ) : (
        <div className="h-6 w-6 rounded-full bg-[var(--bg-surface)] text-[var(--text-tertiary)] flex items-center justify-center text-[10px] shrink-0">
          ?
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{actor?.name ?? 'Someone'}</span>{' '}
          {describeEvent(event)}
          {showBoard && event.boardId && <span className="text-[var(--text-tertiary)]"> · board</span>}
        </p>
        <p className="text-[10px] text-[var(--text-tertiary)]">{formatTime(event.createdAt)}</p>
      </div>
    </div>
  );
}
