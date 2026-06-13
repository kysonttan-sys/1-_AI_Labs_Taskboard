import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/client';

async function cleanOkrs() {
  await prisma.keyResult.deleteMany({});
  await prisma.objective.deleteMany({});
}

beforeAll(async () => { await cleanOkrs(); });
afterAll(async () => { await cleanOkrs(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanOkrs(); });

// Route handlers use NextRequest.json(); jsdom's Request/NextRequest don't
// expose .json() reliably, so we pass a minimal duck-typed object.
function mockRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as any;
}

async function makeObj() {
  return prisma.objective.create({
    data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') },
  });
}

async function makeKr(objId: string, overrides: Partial<{ title: string; target: number; current: number; unit: string | null }> = {}) {
  return prisma.keyResult.create({
    data: {
      title: 'KR',
      target: 100,
      current: 0,
      objectiveId: objId,
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
