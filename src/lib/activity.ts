import { prisma } from '@/lib/db/client';

export type ActivityEventType =
  | 'card_created'
  | 'card_updated'
  | 'card_moved'
  | 'card_deleted'
  | 'comment_added'
  | 'checklist_item_completed'
  | 'list_created'
  | 'list_renamed'
  | 'list_deleted'
  | 'board_renamed'
  | 'okr_linked';

interface CreateActivityParams {
  type: ActivityEventType;
  actorId?: string;
  boardId?: string;
  cardId?: string;
  listId?: string;
  metadata?: Record<string, unknown>;
}

export async function createActivityEvent(params: CreateActivityParams) {
  try {
    return await prisma.activityEvent.create({ data: params });
  } catch (err) {
    console.error('Failed to create activity event:', err);
    return null;
  }
}
