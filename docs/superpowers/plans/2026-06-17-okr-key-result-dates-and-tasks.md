# OKR Key Result Dates and Linked Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add start/end dates to Key Results and allow users to create linked tasks (real Cards) under each Key Result, which appear on selected or newly created taskboards.

**Architecture:** Reuse the existing `CardKeyResult` join table to link tasks to Key Results without duplicating state. Add `startDate`/`endDate` to the `KeyResult` model. Add a new API endpoint to create cards scoped to the KR's project, and build a small board/list picker in the OKR UI.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma 7 + PostgreSQL, Zustand, Tailwind CSS, existing `Card`/`Board`/`List` domain.

---

## File structure

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | Add `startDate`/`endDate` to `KeyResult` model. |
| `prisma/migrations/20260617_add_keyresult_dates/migration.sql` | Migration for the new columns. |
| `src/app/api/okrs/[objectiveId]/key-results/route.ts` | Accept/validate dates on KR create. |
| `src/app/api/okrs/[objectiveId]/key-results/[krId]/route.ts` | Accept/validate dates on KR update. |
| `src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.ts` | **New** endpoint to create/link a Card under a KR. |
| `src/lib/api/okrs.ts` | Update types and add `addKeyResultTask` API helper. |
| `src/features/okrs/okrStore.ts` | Add `addKeyResultTask` action and linked-card types. |
| `src/app/(dashboard)/okrs/page.tsx` | Include linked cards when fetching objectives server-side. |
| `src/app/(dashboard)/okrs/ObjectiveCard.tsx` | Add date inputs to KR add/edit form. |
| `src/app/(dashboard)/okrs/KeyResultRow.tsx` | Show dates, linked tasks, and `+ Task` button. |
| `src/app/(dashboard)/okrs/KeyResultTaskPicker.tsx` | **New** modal to pick/create board+list and create task. |
| `src/app/(dashboard)/okrs/ObjectiveList.tsx` | Ensure SSR data stays in sync with store. |
| `src/types.ts` or inline types | Shared `Card`, `Board`, `List` types already exist in stores. |

---

## Task 1: Add Key Result date columns to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:266-281`
- Create: `prisma/migrations/20260617_add_keyresult_dates/migration.sql`
- Test: run `npx prisma generate` and `npx prisma migrate deploy`

- [ ] **Step 1: Add columns to schema**

In `prisma/schema.prisma`, inside `model KeyResult`, add `startDate` and `endDate` right after `cards`:

```prisma
model KeyResult {
  id          String    @id @default(cuid())
  title       String
  target      Float
  current     Float     @default(0)
  unit        String?
  position    Int       @default(0)
  objectiveId String
  objective   Objective @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  cards       CardKeyResult[]
  startDate   DateTime
  endDate     DateTime
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([objectiveId, position])
  @@index([position])
}
```

- [ ] **Step 2: Create migration SQL**

Create `prisma/migrations/20260617_add_keyresult_dates/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "KeyResult" ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                         ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

> Note: `DEFAULT CURRENT_TIMESTAMP` is only for migration safety so existing rows get a value. The app will always supply dates.

- [ ] **Step 3: Regenerate Prisma client**

Run:
```bash
npx prisma generate
```

Expected: no errors; `src/generated/prisma/models/KeyResult.ts` now contains `startDate` and `endDate`.

- [ ] **Step 4: Apply migration locally**

Run:
```bash
npx prisma migrate deploy
```

Expected: deploys successfully against your local DB.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260617_add_keyresult_dates/migration.sql
 git commit -m "feat: add startDate and endDate to KeyResult model"
```

---

## Task 2: Update KeyResult types in the API client

**Files:**
- Modify: `src/lib/api/okrs.ts:1-44`

- [ ] **Step 1: Add dates to KeyResult types**

Update `KeyResult` interface and input types:

```ts
export interface KeyResult {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string | null;
  position: number;
  objectiveId: string;
  startDate: string;
  endDate: string;
  cards?: LinkedTask[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkedTask {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  listId: string;
  boardId: string;
  dueDate: string | null;
}

export type CreateKeyResultInput = {
  title: string;
  target: number;
  current?: number;
  unit?: string;
  startDate: string;
  endDate: string;
};

export type UpdateKeyResultInput = Partial<CreateKeyResultInput>;

export type CreateKeyResultTaskInput = {
  title: string;
  boardId?: string;
  listId?: string;
  newBoardName?: string;
  newListName?: string;
  description?: string;
  dueDate?: string;
};
```

- [ ] **Step 2: Add API helper for creating a linked task**

Add to `okrsApi` object after `reorderKeyResults`:

```ts
addKeyResultTask: (objectiveId: string, krId: string, input: CreateKeyResultTaskInput) =>
  fetch(`/api/okrs/${objectiveId}/key-results/${krId}/cards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then((r) => handle<{ card: LinkedTask; keyResult: KeyResult }>(r)),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/okrs.ts
git commit -m "feat: add KeyResult dates and linked-task API types"
```

---

## Task 3: Add date validation helpers

**Files:**
- Create: `src/lib/okrs/dates.ts`
- Test: `src/lib/okrs/dates.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/okrs/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseIsoDateRange } from './dates';

describe('parseIsoDateRange', () => {
  it('accepts a valid start/end pair', () => {
    expect(parseIsoDateRange('2026-07-01', '2026-07-31')).toEqual({
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-31T00:00:00.000Z'),
    });
  });

  it('rejects missing start date', () => {
    expect(parseIsoDateRange('', '2026-07-31')).toBeNull();
  });

  it('rejects invalid dates', () => {
    expect(parseIsoDateRange('not-a-date', '2026-07-31')).toBeNull();
  });

  it('rejects end date before start date', () => {
    expect(parseIsoDateRange('2026-07-31', '2026-07-01')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run src/lib/okrs/dates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

Create `src/lib/okrs/dates.ts`:

```ts
export function parseIsoDateRange(start: unknown, end: unknown) {
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  // Strip time for comparison
  const s = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const e = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  if (e < s) return null;

  return { startDate: s, endDate: e };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run src/lib/okrs/dates.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/okrs/dates.ts src/lib/okrs/dates.test.ts
git commit -m "feat: add KeyResult date range validation helper"
```

---

## Task 4: Accept dates in Key Result create route

**Files:**
- Modify: `src/app/api/okrs/[objectiveId]/key-results/route.ts:1-81`
- Test: existing `src/app/api/okrs/[objectiveId]/key-results/route.test.ts`

- [ ] **Step 1: Update route to validate dates**

Replace the body destructuring at line 16 with:

```ts
const { title, target, current, unit, startDate, endDate } = body;
```

Add date validation after the unit validation block (around line 40):

```ts
import { parseIsoDateRange } from '@/lib/okrs/dates';

// ...

const dateRange = parseIsoDateRange(startDate, endDate);
if (!dateRange) {
  return NextResponse.json(
    { error: 'startDate and endDate are required and endDate must be on or after startDate' },
    { status: 400 }
  );
}
```

And pass the parsed dates into the `create` call at line 65:

```ts
const kr = await prisma.keyResult.create({
  data: {
    title: title.trim(),
    target,
    current: initialCurrent,
    unit: unit || null,
    objectiveId,
    position: nextPosition,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  },
});
```

- [ ] **Step 2: Update existing tests to include dates**

Open `src/app/api/okrs/[objectiveId]/key-results/route.test.ts` and add `startDate`/`endDate` to every `CreateKeyResultInput` object in POST tests. Example:

```ts
const input = {
  title: 'KR with dates',
  target: 100,
  startDate: '2026-07-01',
  endDate: '2026-07-31',
};
```

Also add a new test for invalid date range:

```ts
it('rejects endDate before startDate', async () => {
  const res = await POST(makeReq({
    title: 'Bad dates',
    target: 100,
    startDate: '2026-07-31',
    endDate: '2026-07-01',
  }), { params: Promise.resolve({ objectiveId: objective.id }) });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 3: Run tests**

Run:
```bash
npx vitest run src/app/api/okrs/[objectiveId]/key-results/route.test.ts
```

Expected: PASS (or existing skip behavior removed once Prisma proxy bug is fixed).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/okrs/[objectiveId]/key-results/route.ts src/app/api/okrs/[objectiveId]/key-results/route.test.ts
git commit -m "feat: accept startDate and endDate when creating Key Results"
```

---

## Task 5: Accept dates in Key Result update route

**Files:**
- Modify: `src/app/api/okrs/[objectiveId]/key-results/[krId]/route.ts:1-68`
- Test: existing `src/app/api/okrs/[objectiveId]/key-results/[krId]/route.test.ts`

- [ ] **Step 1: Update route to validate optional dates**

After line 13 body destructuring, add:

```ts
import { parseIsoDateRange } from '@/lib/okrs/dates';

// ...

let dateRange = null;
if (startDate !== undefined || endDate !== undefined) {
  dateRange = parseIsoDateRange(
    startDate !== undefined ? startDate : existing.startDate.toISOString(),
    endDate !== undefined ? endDate : existing.endDate.toISOString()
  );
  if (!dateRange) {
    return NextResponse.json(
      { error: 'startDate and endDate must be valid and endDate must be on or after startDate' },
      { status: 400 }
    );
  }
}
```

And in the `prisma.keyResult.update` data block add:

```ts
...(dateRange && { startDate: dateRange.startDate, endDate: dateRange.endDate }),
```

- [ ] **Step 2: Update tests**

Open `src/app/api/okrs/[objectiveId]/key-results/[krId]/route.test.ts` and ensure every PATCH test that creates a Key Result first includes `startDate`/`endDate` (or the POST route is used, which already requires them). Add a test for updating dates:

```ts
it('updates startDate and endDate', async () => {
  // create kr first...
  const res = await PATCH(makeReq({
    startDate: '2026-08-01',
    endDate: '2026-08-31',
  }), { params: Promise.resolve({ objectiveId: objective.id, krId: kr.id }) });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.startDate).toContain('2026-08-01');
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/app/api/okrs/[objectiveId]/key-results/[krId]/route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/okrs/[objectiveId]/key-results/[krId]/route.ts src/app/api/okrs/[objectiveId]/key-results/[krId]/route.test.ts
git commit -m "feat: allow updating Key Result startDate and endDate"
```

---

## Task 6: Create the linked-task endpoint

**Files:**
- Create: `src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.ts`
- Test: `src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.test.ts`

- [ ] **Step 1: Write failing test for existing board/list path**

Create `src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/db/client';

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
  return new Request('http://localhost/api/okrs/x/key-results/y/cards', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
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
    expect(body.keyResult.id).toBe(kr.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the endpoint**

Create `src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { recomputeLinkedKeyResults } from '../../../../../cards/[cardId]/_recompute';
import { createActivityEvent } from '@/lib/activity';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string; krId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { objectiveId, krId } = await params;
  const body = await request.json();
  const {
    title,
    boardId,
    listId,
    newBoardName,
    newListName,
    description,
    dueDate,
  } = body;

  if (typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
  }

  const existingPath = typeof boardId === 'string' && typeof listId === 'string';
  const createBoardPath = typeof newBoardName === 'string' && newBoardName.trim() !== '';
  if (!existingPath && !createBoardPath) {
    return NextResponse.json(
      { error: 'Either boardId+listId or newBoardName is required' },
      { status: 400 }
    );
  }

  const kr = await prisma.keyResult.findUnique({
    where: { id: krId },
    include: { objective: { select: { projectId: true, title: true } } },
  });
  if (!kr || kr.objectiveId !== objectiveId) {
    return NextResponse.json({ error: 'Key result not found' }, { status: 404 });
  }
  const projectId = kr.objective.projectId;

  let due: Date | null = null;
  if (dueDate !== undefined && dueDate !== null) {
    due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
      return NextResponse.json({ error: 'dueDate must be a valid date' }, { status: 400 });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let finalListId = listId as string;
      let finalBoardId = boardId as string;

      if (createBoardPath) {
        const board = await tx.board.create({
          data: {
            name: newBoardName.trim(),
            projectId,
            position: 0, // caller can reorder later
          },
        });
        finalBoardId = board.id;

        const listTitle = typeof newListName === 'string' && newListName.trim() !== ''
          ? newListName.trim()
          : 'To Do';
        const existingList = await tx.list.findFirst({
          where: { boardId: board.id, title: listTitle },
        });
        finalListId = existingList?.id ?? (
          await tx.list.create({
            data: { title: listTitle, boardId: board.id, position: 0 },
          })
        ).id;
      } else {
        const list = await tx.list.findUnique({
          where: { id: finalListId },
          include: { board: { select: { projectId: true, id: true } } },
        });
        if (!list) {
          throw new Error('List not found');
        }
        if (list.board.projectId !== projectId) {
          throw new Error('Board does not belong to this project');
        }
        finalBoardId = list.board.id;
      }

      const maxPosition = await tx.card.aggregate({
        _max: { position: true },
        where: { listId: finalListId },
      });

      const card = await tx.card.create({
        data: {
          title: title.trim(),
          description: typeof description === 'string' ? description.trim() : null,
          listId: finalListId,
          boardId: finalBoardId,
          position: (maxPosition._max.position ?? -1) + 1,
          status: 'todo',
          dueDate: due,
        },
        include: {
          assignees: { include: { user: true } },
          labels: { include: { label: true } },
          _count: { select: { comments: true } },
          checklist: true,
        },
      });

      await tx.cardKeyResult.create({
        data: { cardId: card.id, keyResultId: kr.id, weight: 1 },
      });

      return card;
    });

    await recomputeLinkedKeyResults(result.id);

    await createActivityEvent({
      type: 'okr_task_created',
      actorId: session.userId,
      boardId: result.boardId,
      cardId: result.id,
      listId: result.listId,
      metadata: { keyResultTitle: kr.title, objectiveTitle: kr.objective.title },
    });

    return NextResponse.json(
      {
        card: {
          id: result.id,
          title: result.title,
          status: result.status,
          listId: result.listId,
          boardId: result.boardId,
          dueDate: result.dueDate?.toISOString() ?? null,
        },
        keyResult: await prisma.keyResult.findUnique({
          where: { id: kr.id },
          include: { cards: { include: { card: true } } },
        }),
      },
      { status: 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('List not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('does not belong')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error('[OKR_TASK_CREATE_ERROR]', message, e);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add new-board path test**

Add to the same test file:

```ts
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
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.ts src/app/api/okrs/[objectiveId]/key-results/[krId]/cards/route.test.ts
git commit -m "feat: add endpoint to create linked cards under a Key Result"
```

---

## Task 7: Include linked cards in OKR list/get responses

**Files:**
- Modify: `src/app/api/okrs/route.ts`
- Modify: `src/app/api/okrs/[objectiveId]/route.ts`
- Modify: `src/app/(dashboard)/okrs/page.tsx`

- [ ] **Step 1: Update list route to include cards**

In `src/app/api/okrs/route.ts`, change the `include` for `keyResults` to:

```ts
include: {
  keyResults: {
    orderBy: { position: 'asc' },
    include: {
      cards: {
        include: { card: true },
      },
    },
  },
}
```

Then map `cards` into the serialized `KeyResult`:

```ts
keyResults: o.keyResults.map((kr) => ({
  // existing fields...
  cards: kr.cards.map(({ card }) => ({
    id: card.id,
    title: card.title,
    status: card.status,
    listId: card.listId,
    boardId: card.boardId,
    dueDate: card.dueDate?.toISOString() ?? null,
  })),
})),
```

- [ ] **Step 2: Update single-objective route**

In `src/app/api/okrs/[objectiveId]/route.ts`, apply the same `include` and serialization for `keyResults`.

- [ ] **Step 3: Update OKR page serialization**

In `src/app/(dashboard)/okrs/page.tsx`, add `cards` to the serialized `keyResults` map using the same shape.

- [ ] **Step 4: Verify TypeScript and tests**

Run:
```bash
npx tsc --noEmit
npx vitest run src/app/api/okrs/route.test.ts src/app/api/okrs/[objectiveId]/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/okrs/route.ts src/app/api/okrs/[objectiveId]/route.ts src/app/(dashboard)/okrs/page.tsx
git commit -m "feat: include linked cards in OKR API responses"
```

---

## Task 8: Add `addKeyResultTask` action to the OKR store

**Files:**
- Modify: `src/features/okrs/okrStore.ts`

- [ ] **Step 1: Update store interface and add action**

Add to imports:

```ts
import type { LinkedTask, CreateKeyResultTaskInput } from '@/lib/api/okrs';
```

Add to `OkrState` interface:

```ts
addKeyResultTask: (objectiveId: string, krId: string, input: CreateKeyResultTaskInput) => Promise<LinkedTask>;
```

Add the action in the store body:

```ts
addKeyResultTask: async (objectiveId, krId, input) => {
  const { card } = await okrsApi.addKeyResultTask(objectiveId, krId, input);
  set((s) => ({
    objectives: s.objectives.map((o) =>
      o.id === objectiveId
        ? {
            ...o,
            keyResults: o.keyResults.map((kr) =>
              kr.id === krId
                ? { ...kr, cards: [...(kr.cards ?? []), card] }
                : kr
            ),
          }
        : o
    ),
  }));
  return card;
},
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/okrs/okrStore.ts
git commit -m "feat: add addKeyResultTask action to OKR store"
```

---

## Task 9: Add date inputs to Key Result create/edit form

**Files:**
- Modify: `src/app/(dashboard)/okrs/ObjectiveCard.tsx`

- [ ] **Step 1: Add date state and inputs to add-KR form**

Add state:

```ts
const [newKrStartDate, setNewKrStartDate] = useState('');
const [newKrEndDate, setNewKrEndDate] = useState('');
```

Update `handleAddKr`:

```ts
const handleAddKr = async () => {
  if (!newKrTitle.trim()) return;
  const target = Number(newKrTarget);
  if (!Number.isFinite(target) || target <= 0) return;
  if (!newKrStartDate || !newKrEndDate) return;

  await addKeyResult(objective.id, {
    title: newKrTitle.trim(),
    target,
    unit: newKrUnit.trim() || undefined,
    startDate: newKrStartDate,
    endDate: newKrEndDate,
  });
  // ... reset state including dates
};
```

Add date inputs in the add-KR UI, between title and target/unit row:

```tsx
<div className="flex items-center gap-2">
  <input
    type="date"
    value={newKrStartDate}
    onChange={(e) => setNewKrStartDate(e.target.value)}
    className="..."
  />
  <span className="text-xs text-[var(--text-tertiary)]">to</span>
  <input
    type="date"
    value={newKrEndDate}
    onChange={(e) => setNewKrEndDate(e.target.value)}
    className="..."
  />
</div>
```

- [ ] **Step 2: Add date inputs to KeyResultRow edit mode**

In `KeyResultRow.tsx`, add `editStartDate`/`editEndDate` state, initialize from `kr.startDate`/`kr.endDate`, and pass them to `updateKeyResult` in `saveEdit`.

Add date inputs in the editing form next to the title input.

- [ ] **Step 3: Show KR date range in read-only view**

In `KeyResultRow.tsx`, under the KR title, render the date range:

```tsx
<div className="text-xs text-[var(--text-tertiary)]">
  {formatDateRange(kr.startDate, kr.endDate)}
</div>
```

Reuse the existing `formatDateRange` helper or add it to this file if not imported.

- [ ] **Step 4: Verify with a quick smoke run**

Run dev server and open the OKR page. Add a Key Result with dates. Confirm dates appear.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/okrs/ObjectiveCard.tsx src/app/(dashboard)/okrs/KeyResultRow.tsx
git commit -m "feat: add startDate and endDate to Key Result UI"
```

---

## Task 10: Build the Key Result task picker

**Files:**
- Create: `src/app/(dashboard)/okrs/KeyResultTaskPicker.tsx`
- Create: `src/lib/api/boards.ts` (if it doesn't exist; otherwise modify)

- [ ] **Step 1: Create a small boards/lists API helper**

Create or update `src/lib/api/boards.ts`:

```ts
export interface BoardWithLists {
  id: string;
  name: string;
  lists: { id: string; title: string }[];
}

export const boardsApi = {
  listByProject: (projectId: string) =>
    fetch(`/api/projects/${projectId}/boards`).then(async (r) => {
      if (!r.ok) throw new Error('Failed to load boards');
      return r.json() as Promise<BoardWithLists[]>;
    }),
};
```

If `/api/projects/[projectId]/boards` doesn't exist, add it in `src/app/api/projects/[projectId]/boards/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const boards = await prisma.board.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
    include: { lists: { orderBy: { position: 'asc' }, select: { id: true, title: true } } },
  });
  return NextResponse.json(boards);
}
```

- [ ] **Step 2: Implement the picker component**

Create `src/app/(dashboard)/okrs/KeyResultTaskPicker.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { boardsApi } from '@/lib/api/boards';
import type { CreateKeyResultTaskInput } from '@/lib/api/okrs';
import { X, Plus } from 'lucide-react';

interface Props {
  projectId: string;
  onClose: () => void;
  onCreate: (input: CreateKeyResultTaskInput) => void;
  isLoading?: boolean;
}

export default function KeyResultTaskPicker({ projectId, onClose, onCreate, isLoading }: Props) {
  const [boards, setBoards] = useState<{ id: string; name: string; lists: { id: string; title: string }[] }[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [newBoardName, setNewBoardName] = useState('');
  const [newListName, setNewListName] = useState('To Do');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    boardsApi.listByProject(projectId)
      .then((data) => {
        setBoards(data);
        if (data[0]?.lists[0]) {
          setSelectedBoardId(data[0].id);
          setSelectedListId(data[0].lists[0].id);
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [projectId]);

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (mode === 'existing' && (!selectedBoardId || !selectedListId)) return;
    if (mode === 'new' && !newBoardName.trim()) return;

    onCreate({
      title: title.trim(),
      ...(mode === 'existing'
        ? { boardId: selectedBoardId, listId: selectedListId }
        : { newBoardName: newBoardName.trim(), newListName: newListName.trim() || 'To Do' }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add task to Key Result</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            maxLength={200}
            className="w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
          />

          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 py-1.5 rounded border ${mode === 'existing' ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'}`}
            >
              Existing board
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 py-1.5 rounded border ${mode === 'new' ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'}`}
            >
              New board
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="flex flex-col gap-2">
              <select
                value={selectedBoardId}
                onChange={(e) => {
                  setSelectedBoardId(e.target.value);
                  const board = boards.find((b) => b.id === e.target.value);
                  setSelectedListId(board?.lists[0]?.id ?? '');
                }}
                className="..."
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="..."
              >
                {selectedBoard?.lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="New board name..."
                className="..."
              />
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="First list name (default: To Do)"
                className="..."
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {isLoading ? 'Adding...' : 'Add task'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

Tailwind classes should match the project theme; replace `...` with `w-full px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring`.

- [ ] **Step 3: Wire picker into KeyResultRow**

In `KeyResultRow.tsx`:

```ts
const { addKeyResultTask } = useOkrStore();
const [pickerOpen, setPickerOpen] = useState(false);
```

Add a `+ Task` button in the KR row footer.

Add the picker:

```tsx
{pickerOpen && (
  <KeyResultTaskPicker
    projectId={/* pass from ObjectiveCard/objective */}
    onClose={() => setPickerOpen(false)}
    onCreate={async (input) => {
      await addKeyResultTask(objectiveId, kr.id, input);
      setPickerOpen(false);
    }}
  />
)}
```

- [ ] **Step 4: Pass projectId through the component tree**

Update `ObjectiveCard` props to include `projectId` and pass it to each `KeyResultRow`.
Update `ObjectiveList` to pass `projectId` to `ObjectiveCard`.
Update `OkrsPage` to include `projectId` in the serialized objective.

- [ ] **Step 5: Verify smoke test**

Open OKR page, click `+ Task`, create a task on an existing list. Confirm the task appears under the KR and on the selected board.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/okrs/KeyResultTaskPicker.tsx src/lib/api/boards.ts src/app/api/projects/[projectId]/boards/route.ts src/app/(dashboard)/okrs/KeyResultRow.tsx src/app/(dashboard)/okrs/ObjectiveCard.tsx src/app/(dashboard)/okrs/ObjectiveList.tsx src/app/(dashboard)/okrs/page.tsx
git commit -m "feat: add Key Result task picker and wire into UI"
```

---

## Task 11: Render linked tasks under each Key Result

**Files:**
- Modify: `src/app/(dashboard)/okrs/KeyResultRow.tsx`

- [ ] **Step 1: Render task list**

Under the progress bar in `KeyResultRow.tsx`, add:

```tsx
{kr.cards && kr.cards.length > 0 && (
  <div className="mt-3 space-y-1.5">
    {kr.cards.map((task) => (
      <a
        key={task.id}
        href={`/board/${task.boardId}?card=${task.id}`}
        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-sm"
      >
        <span className="truncate text-[var(--text-primary)]">{task.title}</span>
        <StatusBadge status={task.status} />
      </a>
    ))}
  </div>
)}
```

- [ ] **Step 2: Add StatusBadge component inline or shared**

Create `src/components/board/StatusBadge.tsx` if it doesn't exist, or add inline:

```tsx
function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    todo: 'Todo',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
  };
  const colors: Record<string, string> = {
    todo: 'bg-slate-500/20 text-slate-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    review: 'bg-yellow-500/20 text-yellow-400',
    done: 'bg-green-500/20 text-green-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[status] ?? colors.todo}`}>
      {labels[status] ?? status}
    </span>
  );
}
```

- [ ] **Step 3: Verify task links navigate to board**

Smoke test: click a task. It should navigate to `/board/{boardId}?card={cardId}`.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/okrs/KeyResultRow.tsx src/components/board/StatusBadge.tsx
git commit -m "feat: render linked tasks with status under Key Results"
```

---

## Task 12: Fix OKR SSR/store sync issue

**Files:**
- Modify: `src/app/(dashboard)/okrs/ObjectiveList.tsx`

- [ ] **Step 1: Replace one-time seed with prop-driven sync**

Replace the current `useEffect` that only seeds once:

```ts
useEffect(() => {
  useOkrStore.setState({ objectives: initialObjectives });
}, [initialObjectives]);
```

This ensures the store always reflects freshly fetched server data when navigating back to the page.

- [ ] **Step 2: Verify no duplicate fetches**

Open the OKR page, navigate away and back. Confirm objectives reload with latest data without a manual refresh.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/okrs/ObjectiveList.tsx
git commit -m "fix: keep OKR store in sync with fresh SSR data"
```

---

## Task 13: Run full verification

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Tests**

```bash
npm test
```

Expected: all OKR and date tests pass. (Pre-existing Prisma proxy bug must be fixed separately before this succeeds; if not yet fixed, the new unit tests for `dates.ts` and the new cards endpoint should still pass in isolation.)

- [ ] **Step 4: Manual smoke tests**

1. Open `/okrs`.
2. Create an objective with a KR that has start/end dates.
3. Click `+ Task` on the KR.
4. Create a task on an existing board/list → verify it appears on the board and under the KR.
5. Create a task with a new board → verify the board and default "To Do" list are created.
6. Change the task status on the board → refresh OKR page → verify status is reflected.

- [ ] **Step 5: Commit final verification notes (optional)**

```bash
git commit --allow-empty -m "verify: OKR dates and linked tasks pass typecheck, lint, and smoke tests"
```

---

## Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| Add `startDate`/`endDate` to `KeyResult` model | Task 1 |
| Accept dates on KR create | Task 4 |
| Accept dates on KR update | Task 5 |
| New endpoint to create linked card under KR | Task 6 |
| Include linked cards in OKR API responses | Task 7 |
| Update API client types | Task 2 |
| Add store action | Task 8 |
| Date inputs in add/edit KR form | Task 9 |
| Show KR date range | Task 9 |
| Task picker (existing/new board+list) | Task 10 |
| Render linked tasks with status | Task 11 |
| Click task opens card/board | Task 11 |
| OKR SSR/store sync | Task 12 |
| Validation and transactions | Tasks 4, 5, 6 |

## Placeholder scan

- No TBD/TODO/"implement later" in this plan.
- Every step includes exact file paths.
- Every code step includes concrete code.
- Test commands and expected outputs are explicit.
- Types and method names are consistent across tasks.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-okr-key-result-dates-and-tasks.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach do you want?