import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create admin user
  const hashedPin = await bcrypt.hash('1234', 10);
  const admin = await prisma.user.upsert({
    where: { id: 'admin' },
    update: {},
    create: { id: 'admin', name: 'Admin', pin: hashedPin, role: 'admin', color: '#10b981' },
  });

  // Create team members
  const member1 = await prisma.user.create({
    data: { name: 'Alex', pin: await bcrypt.hash('1234', 10), role: 'member', color: '#6366f1' },
  });
  const member2 = await prisma.user.create({
    data: { name: 'Sarah', pin: await bcrypt.hash('1234', 10), role: 'member', color: '#f59e0b' },
  });

  // Create default project for seeded data
  const project = await prisma.project.create({
    data: { name: 'OPCardX', description: 'Default project for existing boards and OKRs' },
  });

  // Create demo board
  const board = await prisma.board.create({
    data: {
      name: 'Product Launch',
      description: 'Track our Q2 product launch',
      icon: '🚀',
      position: 0,
      projectId: project.id,
    },
  });

  // Create labels
  const featureLabel = await prisma.label.create({
    data: { name: 'Feature', color: '#6366f1', boardId: board.id },
  });
  const bugLabel = await prisma.label.create({
    data: { name: 'Bug', color: '#ef4444', boardId: board.id },
  });
  const designLabel = await prisma.label.create({
    data: { name: 'Design', color: '#f59e0b', boardId: board.id },
  });
  const urgentLabel = await prisma.label.create({
    data: { name: 'Urgent', color: '#ec4899', boardId: board.id },
  });

  // Create lists
  const todoList = await prisma.list.create({ data: { title: 'To Do', position: 0, boardId: board.id } });
  const inProgressList = await prisma.list.create({ data: { title: 'In Progress', position: 1, boardId: board.id } });
  const reviewList = await prisma.list.create({ data: { title: 'Review', position: 2, boardId: board.id } });
  const doneList = await prisma.list.create({ data: { title: 'Done', position: 3, boardId: board.id } });

  const now = new Date();
  const addDays = (d: number) => new Date(now.getTime() + d * 86400000);

  // Create cards with assignees using junction table
  const card1 = await prisma.card.create({
    data: { title: 'Design landing page mockups', description: 'Create high-fidelity mockups for the new landing page', position: 0, listId: todoList.id, boardId: board.id, priority: 'high', startDate: addDays(1), dueDate: addDays(5), assignees: { create: [{ userId: member2.id }] } },
  });
  const card2 = await prisma.card.create({
    data: { title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment', position: 1, listId: todoList.id, boardId: board.id, priority: 'medium', assignees: { create: [{ userId: member1.id }] } },
  });
  const card3 = await prisma.card.create({
    data: { title: 'Write API documentation', description: 'Document all REST endpoints with examples', position: 2, listId: todoList.id, boardId: board.id, priority: 'low' },
  });
  const card4 = await prisma.card.create({
    data: { title: 'Implement user authentication', description: 'OAuth2 + JWT token management', position: 0, listId: inProgressList.id, boardId: board.id, priority: 'urgent', status: 'in_progress', progress: 60, startDate: addDays(-3), dueDate: addDays(2), assignees: { create: [{ userId: member1.id }] } },
  });
  const card5 = await prisma.card.create({
    data: { title: 'Create dashboard UI', description: 'Main dashboard with charts and KPIs', position: 1, listId: inProgressList.id, boardId: board.id, priority: 'high', status: 'in_progress', progress: 35, startDate: addDays(-2), dueDate: addDays(4), assignees: { create: [{ userId: member2.id }] } },
  });
  const card6 = await prisma.card.create({
    data: { title: 'Database schema review', description: 'Review and optimize the database schema before launch', position: 0, listId: reviewList.id, boardId: board.id, priority: 'medium', status: 'in_progress', progress: 85, startDate: addDays(-5), dueDate: addDays(-1), assignees: { create: [{ userId: admin.id }] } },
  });
  const card7 = await prisma.card.create({
    data: { title: 'Project kickoff meeting', description: 'Initial planning and task assignment', position: 0, listId: doneList.id, boardId: board.id, priority: 'high', status: 'done', progress: 100, startDate: addDays(-14), dueDate: addDays(-13), completedAt: addDays(-13), assignees: { create: [{ userId: admin.id }] } },
  });
  const card8 = await prisma.card.create({
    data: { title: 'Requirements gathering', description: 'Collect all stakeholder requirements', position: 1, listId: doneList.id, boardId: board.id, priority: 'high', status: 'done', progress: 100, startDate: addDays(-12), dueDate: addDays(-10), completedAt: addDays(-10), assignees: { create: [{ userId: admin.id }] } },
  });

  // Add labels to cards
  const labelAssignments = [
    { cardId: card1.id, labelId: designLabel.id },
    { cardId: card4.id, labelId: featureLabel.id },
    { cardId: card4.id, labelId: urgentLabel.id },
    { cardId: card5.id, labelId: designLabel.id },
    { cardId: card2.id, labelId: featureLabel.id },
  ];

  for (const la of labelAssignments) {
    await prisma.cardLabel.create({ data: { cardId: la.cardId, labelId: la.labelId } });
  }

  // Add checklist items
  await prisma.checklistItem.createMany({
    data: [
      { text: 'Set up OAuth providers', checked: true, position: 0, cardId: card4.id },
      { text: 'JWT token generation', checked: true, position: 1, cardId: card4.id },
      { text: 'Refresh token flow', checked: false, position: 2, cardId: card4.id },
      { text: 'Session management', checked: false, position: 3, cardId: card4.id },
    ],
  });

  // Add some comments
  await prisma.comment.createMany({
    data: [
      { text: 'Started working on the chart components', cardId: card5.id, authorId: member2.id },
      { text: 'Looks good so far! Can we add a date range filter?', cardId: card5.id, authorId: admin.id },
    ],
  });

  // Create second board
  const board2 = await prisma.board.create({
    data: { name: 'Bug Tracker', description: 'Track and fix bugs', icon: '🐛', position: 1, projectId: project.id },
  });

  const bugLabels = await Promise.all([
    prisma.label.create({ data: { name: 'Critical', color: '#ef4444', boardId: board2.id } }),
    prisma.label.create({ data: { name: 'Minor', color: '#22c55e', boardId: board2.id } }),
  ]);

  const bugTodo = await prisma.list.create({ data: { title: 'Reported', position: 0, boardId: board2.id } });
  const bugProgress = await prisma.list.create({ data: { title: 'Fixing', position: 1, boardId: board2.id } });
  const bugDone = await prisma.list.create({ data: { title: 'Fixed', position: 2, boardId: board2.id } });

  await prisma.card.create({ data: { title: 'Login page crashes on mobile', position: 0, listId: bugTodo.id, boardId: board2.id, priority: 'urgent' } });
  await prisma.card.create({ data: { title: 'Sidebar not collapsing properly', position: 0, listId: bugProgress.id, boardId: board2.id, priority: 'high', status: 'in_progress', progress: 50, assignees: { create: [{ userId: member1.id }] } } });
  await prisma.card.create({ data: { title: 'Typo in settings page', position: 1, listId: bugTodo.id, boardId: board2.id, priority: 'low' } });
  await prisma.card.create({ data: { title: 'Fixed date picker timezone issue', position: 0, listId: bugDone.id, boardId: board2.id, status: 'done', progress: 100, completedAt: addDays(-2), assignees: { create: [{ userId: member1.id }] } } });

  // Set up AppSettings
  await prisma.appSettings.upsert({
    where: { id: 'app' },
    update: {},
    create: { id: 'app', setupComplete: true },
  });

  console.log('Seed data created successfully!');
  console.log('Admin PIN: 1234');
  console.log('Team members: Alex (1234), Sarah (1234)');

  // ---- OKR sample data ----
  const okrShipQ2 = await prisma.objective.create({
    data: {
      title: 'Ship Q2 product launch',
      description: 'Public release of the new Taskboard v2.0 to all customers.',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-06-30'),
      position: 0,
      projectId: project.id,
      keyResults: {
        create: [
          { title: 'Beta users', target: 500, current: 312, unit: 'users', position: 0, startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30') },
          { title: 'NPS score', target: 50, current: 47, unit: 'pts', position: 1, startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30') },
          { title: 'Critical bugs at launch', target: 0, current: 3, unit: 'bugs', position: 2, startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30') },
        ],
      },
    },
  });

  await prisma.objective.create({
    data: {
      title: 'Improve onboarding completion',
      description: 'Get new users from signup to first board in under 5 minutes.',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-09-30'),
      position: 1,
      projectId: project.id,
      keyResults: {
        create: [
          { title: 'Onboarding completion rate', target: 80, current: 64, unit: '%', position: 0, startDate: new Date('2026-04-01'), endDate: new Date('2026-09-30') },
          { title: 'Time to first board', target: 5, current: 7, unit: 'min', position: 1, startDate: new Date('2026-04-01'), endDate: new Date('2026-09-30') },
        ],
      },
    },
  });

  await prisma.objective.create({
    data: {
      title: 'Build public API',
      description: 'Expose boards, cards, and OKRs over a versioned REST API with API keys.',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-12-31'),
      position: 2,
      projectId: project.id,
      keyResults: {
        create: [
          { title: 'API endpoints shipped', target: 20, current: 0, unit: 'endpoints', position: 0, startDate: new Date('2026-07-01'), endDate: new Date('2026-12-31') },
          { title: 'API uptime', target: 99.9, current: 0, unit: '%', position: 1, startDate: new Date('2026-07-01'), endDate: new Date('2026-12-31') },
        ],
      },
    },
  });

  console.log('Seeded OKRs including', okrShipQ2.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
