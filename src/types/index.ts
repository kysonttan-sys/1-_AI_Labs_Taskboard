export interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  status: string;
  priority: string;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  listId: string;
  boardId: string;
  assigneeIds: string[];
  assignees?: { user: { id: string; name: string; color: string } }[];
  labels?: { label: { id: string; name: string; color: string } }[];
  checklist?: { id: string; text: string; checked: boolean }[];
  _count?: { comments: number };
}

export interface List {
  id: string;
  title: string;
  position: number;
  boardId: string;
  cards: Card[];
}

export interface Board {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  position: number;
  projectId: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  color: string;
  visibility: string;
  userId: string;
  user?: { id: string; name: string; color: string };
  createdAt: string;
  updatedAt: string;
}