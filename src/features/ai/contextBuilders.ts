import { prisma } from '@/lib/db/client';

function formatAssignees(card: { assignees: { user: { name: string } }[] }): string {
  if (card.assignees.length === 0) return '';
  if (card.assignees.length === 1) return ` [Assigned: ${card.assignees[0].user.name}]`;
  return ` [Assigned: ${card.assignees.map((a) => a.user.name).join(', ')}]`;
}

export async function buildChatContext(boardId?: string, cardId?: string): Promise<string> {
  let context = '';

  if (boardId) {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        lists: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
              include: {
                assignees: { include: { user: { select: { id: true, name: true } } } },
                labels: { include: { label: { select: { name: true, color: true } } } },
              },
            },
          },
        },
      },
    });
    if (board) {
      context += `\n=== CURRENT BOARD: "${board.name}" ===\n`;
      for (const list of board.lists) {
        context += `\n--- ${list.title} (${list.cards.length} cards) ---\n`;
        for (const card of list.cards) {
          const assignee = formatAssignees(card);
          const due = card.dueDate ? ` [Due: ${card.dueDate.toISOString().split('T')[0]}]` : '';
          const status = card.status !== 'todo' ? ` [${card.status}]` : '';
          const priority = card.priority !== 'medium' ? ` [${card.priority}]` : '';
          context += `  - ${card.title}${assignee}${due}${status}${priority}\n`;
        }
      }
    }
  }

  if (cardId) {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        assignees: { include: { user: { select: { name: true } } } },
        labels: { include: { label: { select: { name: true } } } },
        checklist: { orderBy: { position: 'asc' } },
        comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (card) {
      context += `\n=== SELECTED CARD ===\n`;
      context += `Title: ${card.title}\n`;
      context += `Description: ${card.description || '(none)'}\n`;
      context += `Status: ${card.status} | Priority: ${card.priority} | Progress: ${card.progress}%\n`;
      if (card.startDate) context += `Start: ${card.startDate.toISOString().split('T')[0]}\n`;
      if (card.dueDate) context += `Due: ${card.dueDate.toISOString().split('T')[0]}\n`;
      if (card.assignees.length > 0) context += `Assignees: ${card.assignees.map((a) => a.user.name).join(', ')}\n`;
      if (card.checklist.length) {
        context += `Checklist:\n`;
        for (const item of card.checklist) context += `  [${item.checked ? 'x' : ' '}] ${item.text}\n`;
      }
      if (card.comments.length) {
        context += `Recent comments:\n`;
        for (const c of card.comments) context += `  ${c.author?.name || 'Unknown'}: ${c.text}\n`;
      }
    }
  }

  const members = await prisma.user.findMany({ select: { name: true, role: true } });
  context += `\n=== TEAM MEMBERS ===\n`;
  for (const m of members) context += `- ${m.name} (${m.role})\n`;

  return context;
}

export async function buildSuggestionContext(boardId: string): Promise<string> {
  const cards = await prisma.card.findMany({
    where: { boardId },
    include: {
      assignees: { include: { user: { select: { name: true } } } },
      list: { select: { title: true } },
    },
  });

  const now = new Date();
  let context = `\n=== BOARD SUMMARY FOR SUGGESTIONS ===\n`;
  context += `Total cards: ${cards.length}\n`;

  const byStatus: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};
  let overdue = 0;

  for (const card of cards) {
    byStatus[card.status] = (byStatus[card.status] || 0) + 1;
    const name = card.assignees.length > 0 ? card.assignees.map((a) => a.user.name).join(', ') : 'Unassigned';
    byAssignee[name] = (byAssignee[name] || 0) + 1;
    if (card.dueDate && card.dueDate < now && card.status !== 'done') overdue++;
  }

  context += `By status: ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
  context += `By assignee: ${Object.entries(byAssignee).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
  context += `Overdue: ${overdue}\n\n`;

  for (const card of cards) {
    const assignee = card.assignees.length > 0 ? card.assignees.map((a) => a.user.name).join(', ') : 'Unassigned';
    const due = card.dueDate ? `Due: ${card.dueDate.toISOString().split('T')[0]}` : '';
    context += `- [${card.list.title}] ${card.title} (${card.status}, ${card.priority}, ${assignee}) ${due}\n`;
  }

  return context;
}

export async function buildDigestContext(boardId?: string): Promise<string> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const where = boardId ? { boardId } : {};
  const cards = await prisma.card.findMany({
    where,
    include: {
      assignees: { include: { user: { select: { name: true } } } },
      list: { select: { title: true } },
    },
  });

  const now = new Date();
  const completed = cards.filter((c) => c.completedAt && c.completedAt >= oneWeekAgo);
  const overdueCards = cards.filter((c) => c.dueDate && c.dueDate < now && c.status !== 'done');
  const upcoming = cards.filter((c) => c.dueDate && c.dueDate >= now && c.dueDate <= new Date(now.getTime() + 7 * 86400000) && c.status !== 'done');

  const assigneeNames = (c: typeof cards[0]) => c.assignees.length > 0 ? c.assignees.map((a) => a.user.name).join(', ') : 'unassigned';

  let context = `\n=== WEEKLY DIGEST DATA ===\n`;
  context += `Period: ${oneWeekAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}\n\n`;

  context += `COMPLETED THIS WEEK (${completed.length}):\n`;
  for (const c of completed) context += `  - ${c.title} (by ${assigneeNames(c)})\n`;

  context += `\nOVERDUE (${overdueCards.length}):\n`;
  for (const c of overdueCards) context += `  - ${c.title} (Due: ${c.dueDate!.toISOString().split('T')[0]}, ${assigneeNames(c)})\n`;

  context += `\nUPCOMING THIS WEEK (${upcoming.length}):\n`;
  for (const c of upcoming) context += `  - ${c.title} (Due: ${c.dueDate!.toISOString().split('T')[0]}, ${assigneeNames(c)})\n`;

  context += `\nIN PROGRESS:\n`;
  const inProgress = cards.filter((c) => c.status === 'in_progress');
  for (const c of inProgress) context += `  - ${c.title} (${c.progress}%, ${assigneeNames(c)})\n`;

  return context;
}