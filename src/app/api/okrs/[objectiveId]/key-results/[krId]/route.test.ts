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

async function makeObj() {
  return prisma.objective.create({
    data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), projectId: testProjectId },
  });
}

async function makeKr(objId: string, overrides: Partial<{ title: string; target: number; current: number; unit: string | null; startDate: Date; endDate: Date }> = {}) {
  return prisma.keyResult.create({
    data: {
      title: 'KR',
      target: 100,
      current: 0,
      objectiveId: objId,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      ...overrides,
    },
  });
}

describe('PATCH /api/okrs/[objectiveId]/key-results/[krId]', () => {
  it('updates only current and leaves other fields unchanged', async () => {
    const obj = await makeObj();
    const kr = await makeKr(obj.id, { title: 'Original', target: 50, current: 10, unit: 'users' });
    const { PATCH } = await import('./route');
    const res = await PATCH(
      mockRequest({ current: 25 }),
      { params: Promise.resolve({ objectiveId: obj.id, krId: kr.id }) } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBe(25);
    expect(body.title).toBe('Original');
    expect(body.target).toBe(50);
    expect(body.unit).toBe('users');
  });

  it('returns 400 when current is negative', async () => {
    const obj = await makeObj();
    const kr = await makeKr(obj.id);
    const { PATCH } = await import('./route');
    const res = await PATCH(
      mockRequest({ current: -1 }),
      { params: Promise.resolve({ objectiveId: obj.id, krId: kr.id }) } as any
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when the KR does not exist', async () => {
    const obj = await makeObj();
    const { PATCH } = await import('./route');
    const res = await PATCH(
      mockRequest({ current: 5 }),
      { params: Promise.resolve({ objectiveId: obj.id, krId: 'missing' }) } as any
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when current would exceed target', async () => {
    const obj = await makeObj();
    const kr = await makeKr(obj.id, { target: 10, current: 5 });
    const { PATCH } = await import('./route');
    const res = await PATCH(
      mockRequest({ current: 99 }),
      { params: Promise.resolve({ objectiveId: obj.id, krId: kr.id }) } as any
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/current.*target/i);
  });

  it('returns 400 when target would drop below current', async () => {
    const obj = await makeObj();
    const kr = await makeKr(obj.id, { target: 100, current: 50 });
    const { PATCH } = await import('./route');
    const res = await PATCH(
      mockRequest({ target: 10 }),
      { params: Promise.resolve({ objectiveId: obj.id, krId: kr.id }) } as any
    );
    expect(res.status).toBe(400);
  });

  it('updates startDate and endDate', async () => {
    const obj = await makeObj();
    const kr = await makeKr(obj.id);
    const { PATCH } = await import('./route');
    const res = await PATCH(
      mockRequest({ startDate: '2026-08-01', endDate: '2026-08-31' }),
      { params: Promise.resolve({ objectiveId: obj.id, krId: kr.id }) } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.startDate).toContain('2026-08-01');
    expect(body.endDate).toContain('2026-08-31');
  });
});

describe('DELETE /api/okrs/[objectiveId]/key-results/[krId]', () => {
  it('removes the KR', async () => {
    const obj = await makeObj();
    const kr = await makeKr(obj.id);
    const { DELETE } = await import('./route');
    const res = await DELETE(
      mockRequest(undefined),
      { params: Promise.resolve({ objectiveId: obj.id, krId: kr.id }) } as any
    );
    expect(res.status).toBe(200);
    const found = await prisma.keyResult.findUnique({ where: { id: kr.id } });
    expect(found).toBeNull();
  });
});
