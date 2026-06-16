import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/db/client';

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
  const project = await prisma.project.create({
    data: { name: 'Test Project' },
  });
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

// Route handlers use NextRequest.json(); jsdom's Request/NextRequest don't
// expose .json() reliably, so we pass a minimal duck-typed object.
function mockRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as any;
}

describe('GET /api/okrs/[objectiveId]', () => {
  it('returns the objective with nested key results', async () => {
    const obj = await prisma.objective.create({
      data: {
        title: 'Test',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        projectId: testProjectId,
        keyResults: { create: [{ title: 'KR 1', target: 10, current: 5 }] },
      },
    });
    const { GET } = await import('./route');
    const res = await GET(mockRequest(undefined), {
      params: Promise.resolve({ objectiveId: obj.id }),
    } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(obj.id);
    expect(body.keyResults).toHaveLength(1);
  });

  it('returns 404 when the objective does not exist', async () => {
    const { GET } = await import('./route');
    const res = await GET(mockRequest(undefined), {
      params: Promise.resolve({ objectiveId: 'missing' }),
    } as any);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/okrs/[objectiveId]', () => {
  it('updates the title and returns the updated objective', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Old', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), projectId: testProjectId },
    });
    const { PATCH } = await import('./route');
    const res = await PATCH(
      mockRequest({ title: 'New' }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('New');
  });

  it('returns 400 when endDate would be before startDate', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-03-31'), endDate: new Date('2026-06-30'), projectId: testProjectId },
    });
    const { PATCH } = await import('./route');
    const res = await PATCH(
      mockRequest({ endDate: '2026-01-01' }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/okrs/[objectiveId]', () => {
  it('deletes the objective and cascades to its key results', async () => {
    const obj = await prisma.objective.create({
      data: {
        title: 'Test',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        projectId: testProjectId,
        keyResults: { create: [{ title: 'KR 1', target: 10 }] },
      },
    });
    const { DELETE } = await import('./route');
    const res = await DELETE(
      mockRequest(undefined),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(200);
    const krs = await prisma.keyResult.count({ where: { objectiveId: obj.id } });
    expect(krs).toBe(0);
  });
});
