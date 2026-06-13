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

describe('POST /api/okrs/[objectiveId]/key-results', () => {
  it('creates a KR and returns 201', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') },
    });
    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ title: 'New KR', target: 100, unit: 'users' }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('New KR');
    expect(body.target).toBe(100);
    expect(body.current).toBe(0);
    expect(body.unit).toBe('users');
  });

  it('returns 400 when title is missing', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') },
    });
    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ target: 10 }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when target is zero or negative', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') },
    });
    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ title: 'X', target: 0 }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(400);
  });
});
