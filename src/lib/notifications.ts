import { prisma } from '@/lib/db/client';

export type NotificationType =
  | 'card_assigned'
  | 'comment_added'
  | 'card_moved'
  | 'card_status_changed'
  | 'card_priority_changed'
  | 'due_date_approaching'
  | 'due_date_overdue'
  | 'chat_mentioned';

interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  body?: string;
  userId: string;
  cardId?: string;
  boardId?: string;
  triggerUserId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({ data: params });
}