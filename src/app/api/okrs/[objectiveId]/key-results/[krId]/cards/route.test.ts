import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/db/client';

vi.mock('@/lib/auth/session', () => ({
  getSession: async () => ({ userId: 'test-user', name: 'Test', role: 'member' }),
}));

async function cleanup() {
  await prisma.cardKeyResult.deleteMany();
  await prisma.card.deleteMany();
  await prisma.keyResult.deleteMany();
  await prisma.objective.deleteMany();
  await prisma.list.deleteMany();
  await prisma.board.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(cleanup);
afterAll(cleanup);

function makeReq(body: unknown) {
  return { json: () => Promise.resolve(body) } as any;
}

async function seed() {
  const user = await prisma.user.create({ data: { name: 'Admin', pin: '1234', role: 'admin' } });
  const project = await prisma.project.create({ data: { name: 'P1' } });
  const objective = await prisma.objective.create({
    data: {
      title: 'O1',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      projectId: project.id,
      ownerId: user.id,
    },
  });
  const kr = await prisma.keyResult.create({
    data: {
      title: 'KR1',
      target: 100,
      objectiveId: objective.id,
      position: 0,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
    },
  });
  const board = await prisma.board.create({ data: { name: 'B1', projectId: project.id, position: 0 } });
  const list = await prisma.list.create({ data: { title: 'To Do', boardId: board.id, position: 0 } });
  return { user, project, objective, kr, board, list };
}

describe('POST /api/okrs/[objectiveId]/key-results/[krId]/cards', () => {
  it('creates a card on an existing list and links it to the KR', async () => {
    const { objective, kr, list } = await seed();
    const res = await POST(makeReq({ title: 'Task 1', boardId: list.boardId, listId: list.id }), {
      params: Promise.resolve({ objectiveId: objective.id, krId: kr.id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.card.title).toBe('Task 1');
    expect(body.card.status).toBe('todo');

    const link = await prisma.cardKeyResult.findFirst({ where: { cardId: body.card.id } });
    expect(link?.keyResultId).toBe(kr.id);
  });

  it('creates a new board and list when newBoardName is provided', async () => {
    const { objective, kr } = await seed();
    const res = await POST(makeReq({ title: 'Task 2', newBoardName: 'Marketing' }), {
      params: Promise.resolve({ objectiveId: objective.id, krId: kr.id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.card.title).toBe('Task 2');

    const board = await prisma.board.findUnique({ where: { id: body.card.boardId } });
    expect(board?.name).toBe('Marketing');
    const list = await prisma.list.findFirst({ where: { boardId: board!.id } });
    expect(list?.title).toBe('To Do');
  });
});
