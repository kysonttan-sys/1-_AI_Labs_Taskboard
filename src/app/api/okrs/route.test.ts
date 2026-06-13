import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/client';

async function cleanOkrs() {
  await prisma.keyResult.deleteMany({});
  await prisma.objective.deleteMany({});
}

beforeAll(async () => {
  await cleanOkrs();
});

afterAll(async () => {
  await cleanOkrs();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanOkrs();
});

describe('GET /api/okrs', () => {
  it('returns an empty array when there are no objectives', async () => {
    const { GET } = await import('./route');
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns objectives with their key results', async () => {
    await prisma.objective.create({
      data: {
        title: 'Test objective',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        keyResults: { create: [{ title: 'KR 1', target: 10, current: 5 }] },
      },
    });
    const { GET } = await import('./route');
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('Test objective');
    expect(body[0].keyResults).toHaveLength(1);
    expect(body[0].keyResults[0].title).toBe('KR 1');
  });
});

describe('POST /api/okrs', () => {
  it('returns 400 when title is missing', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://test/api/okrs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-01-01', endDate: '2026-03-31' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/title/i);
  });

  it('returns 400 when endDate is before startDate', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://test/api/okrs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Bad', startDate: '2026-03-31', endDate: '2026-01-01' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('creates an objective and returns 201', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://test/api/okrs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Ship product',
        description: 'Public launch',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Ship product');
    expect(body.id).toBeDefined();
  });
});
