import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/db/client';
import { PATCH } from './route';

vi.mock('@/lib/auth/session', () => ({
  getSession: async () => ({ userId: 'test-user', name: 'Test', role: 'member' }),
}));

let testProjectId: string;

async function cleanOkrs() {
  await prisma.keyResult.deleteMany({});
  await prisma.objective.deleteMany({});
}

async function cleanProject() {
  await prisma.project.deleteMany({});
}

beforeAll(async () => {
  await cleanOkrs();
  const project = await prisma.project.create({ data: { name: 'Test Project' } });
  testProjectId = project.id;
});

afterAll(async () => {
  await cleanOkrs();
  await cleanProject();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanOkrs();
});

function mockRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as any;
}

describe('PATCH /api/okrs/[objectiveId]/key-results/reorder', () => {
  it('reorders key results without unique constraint violations', async () => {
    const objective = await prisma.objective.create({
      data: {
        title: 'Test',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        projectId: testProjectId,
        keyResults: {
          create: [
            { title: 'KR A', target: 10, position: 0, startDate: new Date('2026-07-01'), endDate: new Date('2026-07-31') },
            { title: 'KR B', target: 10, position: 1, startDate: new Date('2026-07-01'), endDate: new Date('2026-07-31') },
            { title: 'KR C', target: 10, position: 2, startDate: new Date('2026-07-01'), endDate: new Date('2026-07-31') },
          ],
        },
      },
      include: { keyResults: true },
    });

    const ids = objective.keyResults
      .sort((a, b) => a.position - b.position)
      .map((kr) => kr.id);

    // Reverse the order
    const reversed = [...ids].reverse();

    const res = await PATCH(mockRequest({ krIds: reversed }), {
      params: Promise.resolve({ objectiveId: objective.id }),
    } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
    expect(body.map((kr: { id: string }) => kr.id)).toEqual(reversed);
  });
});
