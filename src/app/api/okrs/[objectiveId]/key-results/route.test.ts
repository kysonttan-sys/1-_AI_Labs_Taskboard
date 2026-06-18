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

describe('POST /api/okrs/[objectiveId]/key-results', () => {
  it('creates a KR and returns 201', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), projectId: testProjectId },
    });
    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ title: 'New KR', target: 100, unit: 'users', startDate: '2026-07-01', endDate: '2026-07-31' }),
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
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), projectId: testProjectId },
    });
    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ target: 10, startDate: '2026-07-01', endDate: '2026-07-31' }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when target is zero or negative', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), projectId: testProjectId },
    });
    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ title: 'X', target: 0, startDate: '2026-07-01', endDate: '2026-07-31' }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(400);
  });

  it('recovers from a position-collision race by retrying with a new position', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), projectId: testProjectId },
    });

    const realCreate = prisma.keyResult.create.bind(prisma.keyResult);
    const { Prisma } = await import('@/generated/prisma/client');
    let firstCall = true;
    (prisma.keyResult as any).create = (args: any) => {
      if (firstCall) {
        firstCall = false;
        return Promise.reject(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          })
        );
      }
      return realCreate(args);
    };

    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ title: 'New', target: 5, startDate: '2026-07-01', endDate: '2026-07-31' }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('New');
    expect(body.position).toBe(0);
  });

  it('returns 400 when current exceeds target on create', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), projectId: testProjectId },
    });
    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ title: 'Over', target: 10, current: 50, startDate: '2026-07-01', endDate: '2026-07-31' }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/current.*target/i);
  });

  it('rejects endDate before startDate', async () => {
    const obj = await prisma.objective.create({
      data: { title: 'Test', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), projectId: testProjectId },
    });
    const { POST } = await import('./route');
    const res = await POST(
      mockRequest({ title: 'Bad dates', target: 100, startDate: '2026-07-31', endDate: '2026-07-01' }),
      { params: Promise.resolve({ objectiveId: obj.id }) } as any
    );
    expect(res.status).toBe(400);
  });
});
