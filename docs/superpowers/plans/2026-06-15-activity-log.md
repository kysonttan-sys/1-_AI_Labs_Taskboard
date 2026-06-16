# Activity / Audit Log Implementation Plan

**Goal:** Capture meaningful changes to cards, lists, and boards in a queryable `ActivityEvent` table and surface the log on the board page and digest page.

**Approach:** Add the Prisma model, a shared helper, instrument existing API routes, add two read endpoints, and build two small UI components.

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_activity_events/migration.sql`

### Step 1: Add `ActivityEvent` model

Append to `prisma/schema.prisma` at the end:

```prisma
model ActivityEvent {
  id        String   @id @default(cuid())
  type      String
  actorId   String?
  boardId   String?
  cardId    String?
  listId    String?
  metadata  Json?
  createdAt DateTime @default(now())

  actor User?  @relation(fields: [actorId], references: [id], onDelete: SetNull)
  board Board? @relation(fields: [boardId], references: [id], onDelete: Cascade)
  card  Card?  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  list  List?  @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@index([boardId, createdAt])
  @@index([createdAt])
}
```

Add `activities ActivityEvent[]` to `User`, `Board`, `Card`, and `List` models.

### Step 2: Create migration SQL

Directory name: `20260615_add_activity_events`

```sql
-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "boardId" TEXT,
    "cardId" TEXT,
    "listId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ActivityEvent_boardId_createdAt_idx" ON "ActivityEvent"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");
```

### Step 3: Regenerate client and validate

```bash
cd "D:/Task Management System/taskboard"
npx prisma validate
npx prisma generate
```

### Step 4: Commit

```bash
git add prisma/schema.prisma prisma/migrations/20260615_add_activity_events/
git commit -m "feat(activity): add ActivityEvent model

Tracks actor, board/card/list scope, JSON metadata, and timestamp.
Cascades delete from parent resources.

Refs: docs/superpowers/specs/2026-06-15-activity-log-design.md"
```

---

## Task 2: Shared activity helper

**Files:**
- Create: `src/lib/activity.ts`

### Step 1: Implement helper

```typescript
import { prisma } from '@/lib/db/client';

export type ActivityEventType =
  | 'card_created'
  | 'card_updated'
  | 'card_moved'
  | 'card_deleted'
  | 'comment_added'
  | 'checklist_item_completed'
  | 'list_created'
  | 'list_renamed'
  | 'list_deleted'
  | 'board_renamed'
  | 'okr_linked';

interface CreateActivityParams {
  type: ActivityEventType;
  actorId?: string;
  boardId?: string;
  cardId?: string;
  listId?: string;
  metadata?: Record<string, unknown>;
}

export async function createActivityEvent(params: CreateActivityParams) {
  try {
    return await prisma.activityEvent.create({ data: params });
  } catch (err) {
    console.error('Failed to create activity event:', err);
    return null;
  }
}
```

### Step 2: Commit

```bash
git add src/lib/activity.ts
git commit -m "feat(activity): add createActivityEvent helper

Fire-and-forget helper used by API routes to record events.

Refs: docs/superpowers/specs/2026-06-15-activity-log-design.md"
```

---

## Task 3: Instrument API routes

**Files:**
- Modify: `src/app/api/lists/[listId]/cards/route.ts`
- Modify: `src/app/api/cards/[cardId]/route.ts`
- Modify: `src/app/api/cards/[cardId]/move/route.ts`
- Modify: `src/app/api/cards/[cardId]/comments/route.ts`
- Modify: `src/app/api/checklist/[itemId]/route.ts`
- Modify: `src/app/api/lists/[listId]/route.ts`
- Modify: `src/app/api/boards/[boardId]/route.ts`
- Modify: `src/app/api/cards/[cardId]/key-results/route.ts`

### Step 1: Add import

Add to each file (if not already importing from `@/lib/auth/session`, do so):

```typescript
import { createActivityEvent } from '@/lib/activity';
import { getSession } from '@/lib/auth/session';
```

### Step 2: Instrument card creation

In `src/app/api/lists/[listId]/cards/route.ts`, after successful create:

```typescript
await createActivityEvent({
  type: 'card_created',
  actorId: session.userId,
  boardId: card.boardId,
  cardId: card.id,
  metadata: { title: card.title },
});
```

### Step 3: Instrument card updates and moves

In `src/app/api/cards/[cardId]/route.ts` PATCH, after the update:

```typescript
const metadata: Record<string, unknown> = {};
if (title !== undefined && title !== before?.title) metadata.title = { from: before?.title, to: title };
if (status !== undefined && status !== before?.status) metadata.status = { from: before?.status, to: status };
if (priority !== undefined && priority !== before?.priority) metadata.priority = { from: before?.priority, to: priority };
if (progress !== undefined && progress !== before?.progress) metadata.progress = { from: before?.progress, to: progress };
if (description !== undefined && description !== before?.description) metadata.description = true;
if (startDate !== undefined) metadata.startDate = true;
if (dueDate !== undefined) metadata.dueDate = true;
if (listId !== undefined) metadata.listId = { from: before?.listId, to: listId };

if (Object.keys(metadata).length > 0) {
  await createActivityEvent({
    type: listId !== undefined && listId !== before?.listId ? 'card_moved' : 'card_updated',
    actorId: triggerUserId,
    boardId: before?.boardId,
    cardId: card.id,
    listId: card.listId,
    metadata,
  });
}
```

In DELETE:

```typescript
await createActivityEvent({
  type: 'card_deleted',
  actorId: session?.userId,
  boardId: before?.boardId,
  cardId,
  metadata: { title: before?.title },
});
```

Note: fetch `before` card before delete.

### Step 4: Instrument card move endpoint

In `src/app/api/cards/[cardId]/move/route.ts`, after successful move:

```typescript
await createActivityEvent({
  type: 'card_moved',
  actorId: session.userId,
  boardId: card.boardId,
  cardId: card.id,
  listId: card.listId,
  metadata: { fromListId, toListId: targetListId },
});
```

### Step 5: Instrument comment creation

In `src/app/api/cards/[cardId]/comments/route.ts`, after create:

```typescript
await createActivityEvent({
  type: 'comment_added',
  actorId: session.userId,
  boardId: card.boardId,
  cardId: card.id,
  metadata: { text: text.trim().substring(0, 200) },
});
```

### Step 6: Instrument checklist completion

In `src/app/api/checklist/[itemId]/route.ts` PATCH, when `checked` becomes true:

```typescript
await createActivityEvent({
  type: 'checklist_item_completed',
  actorId: session.userId,
  boardId: item.card.boardId,
  cardId: item.card.id,
  metadata: { text: item.text },
});
```

### Step 7: Instrument list updates

In `src/app/api/lists/[listId]/route.ts` PATCH, when title changes:

```typescript
await createActivityEvent({
  type: 'list_renamed',
  actorId: session.userId,
  boardId: list.boardId,
  listId: list.id,
  metadata: { from: beforeTitle, to: list.title },
});
```

In DELETE:

```typescript
await createActivityEvent({
  type: 'list_deleted',
  actorId: session.userId,
  boardId: list.boardId,
  listId,
  metadata: { title: list.title },
});
```

### Step 8: Instrument board rename

In `src/app/api/boards/[boardId]/route.ts` PATCH:

```typescript
await createActivityEvent({
  type: 'board_renamed',
  actorId: session.userId,
  boardId,
  metadata: { from: beforeName, to: board.name },
});
```

### Step 9: Instrument OKR linking

In `src/app/api/cards/[cardId]/key-results/route.ts` POST:

```typescript
await createActivityEvent({
  type: 'okr_linked',
  actorId: session.userId,
  boardId: card.boardId,
  cardId,
  metadata: { keyResultTitle: kr.title, objectiveTitle: kr.objective.title },
});
```

### Step 10: Commit

```bash
git add src/app/api/lists/[listId]/cards/route.ts \
        src/app/api/cards/[cardId]/route.ts \
        src/app/api/cards/[cardId]/move/route.ts \
        src/app/api/cards/[cardId]/comments/route.ts \
        src/app/api/checklist/[itemId]/route.ts \
        src/app/api/lists/[listId]/route.ts \
        src/app/api/boards/[boardId]/route.ts \
        src/app/api/cards/[cardId]/key-results/route.ts
git commit -m "feat(activity): instrument API routes to create activity events

Records card, list, board, comment, checklist, and OKR-link events.
Events are fire-and-forget; failures do not affect API responses.

Refs: docs/superpowers/specs/2026-06-15-activity-log-design.md"
```

---

## Task 4: Activity read endpoints

**Files:**
- Create: `src/app/api/boards/[boardId]/activity/route.ts`
- Create: `src/app/api/activity/route.ts`

### Step 1: Board activity endpoint

Create `src/app/api/boards/[boardId]/activity/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);
  const cursor = searchParams.get('cursor');

  const events = await prisma.activityEvent.findMany({
    where: { boardId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    include: { actor: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json({
    events,
    nextCursor: events.length === limit ? events[events.length - 1]?.id : null,
  });
}
```

### Step 2: Global activity endpoint

Create `src/app/api/activity/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);

  const events = await prisma.activityEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      actor: { select: { id: true, name: true, color: true } },
      board: { select: { id: true, name: true } },
      card: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({ events });
}
```

### Step 3: Commit

```bash
git add src/app/api/boards/[boardId]/activity/route.ts src/app/api/activity/route.ts
git commit -m "feat(activity): add activity feed read endpoints

GET /api/boards/[boardId]/activity returns paginated board events.
GET /api/activity returns recent global events for the digest.

Refs: docs/superpowers/specs/2026-06-15-activity-log-design.md"
```

---

## Task 5: UI components

**Files:**
- Create: `src/components/activity/ActivityRow.tsx`
- Create: `src/components/activity/ActivityFeed.tsx`
- Modify: `src/app/(dashboard)/board/[boardId]/page.tsx`
- Modify: `src/app/(dashboard)/digest/page.tsx`

### Step 1: ActivityRow

Create `src/components/activity/ActivityRow.tsx`:

```tsx
'use client';

import { getInitials } from '@/lib/utils/initials';

interface ActivityActor {
  id: string;
  name: string;
  color: string;
}

interface ActivityEvent {
  id: string;
  type: string;
  actor: ActivityActor | null;
  boardId: string | null;
  cardId: string | null;
  listId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Props {
  event: ActivityEvent;
  showBoard?: boolean;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function describeEvent(event: ActivityEvent): string {
  const { type, metadata } = event;
  switch (type) {
    case 'card_created':
      return `created card "${metadata?.title ?? 'Untitled'}"`;
    case 'card_updated':
      return `updated card "${metadata?.title ?? 'Untitled'}"`;
    case 'card_moved': {
      const from = metadata?.fromListId ?? metadata?.listId ?? 'another list';
      return `moved card`;
    }
    case 'card_deleted':
      return `deleted card "${metadata?.title ?? 'Untitled'}"`;
    case 'comment_added':
      return `commented on card`;
    case 'checklist_item_completed':
      return `completed checklist item "${metadata?.text ?? ''}"`;
    case 'list_created':
      return `created list "${metadata?.title ?? ''}"`;
    case 'list_renamed': {
      const from = (metadata?.from as string) ?? '';
      const to = (metadata?.to as string) ?? '';
      return `renamed list from "${from}" to "${to}"`;
    }
    case 'list_deleted':
      return `deleted list "${metadata?.title ?? ''}"`;
    case 'board_renamed': {
      const from = (metadata?.from as string) ?? '';
      const to = (metadata?.to as string) ?? '';
      return `renamed board from "${from}" to "${to}"`;
    }
    case 'okr_linked': {
      const kr = (metadata?.keyResultTitle as string) ?? 'a key result';
      return `linked card to key result "${kr}"`;
    }
    default:
      return `performed action ${type}`;
  }
}

export default function ActivityRow({ event, showBoard }: Props) {
  const actor = event.actor;
  return (
    <div className="flex items-start gap-2 py-2">
      {actor ? (
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
          style={{ backgroundColor: `${actor.color}22`, color: actor.color }}
        >
          {getInitials(actor.name)}
        </div>
      ) : (
        <div className="h-6 w-6 rounded-full bg-[var(--bg-surface)] text-[var(--text-tertiary)] flex items-center justify-center text-[10px] shrink-0">
          ?
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{actor?.name ?? 'Someone'}</span>{' '}
          {describeEvent(event)}
          {showBoard && event.boardId && <span className="text-[var(--text-tertiary)]"> · board</span>}
        </p>
        <p className="text-[10px] text-[var(--text-tertiary)]">{formatTime(event.createdAt)}</p>
      </div>
    </div>
  );
}
```

### Step 2: ActivityFeed

Create `src/components/activity/ActivityFeed.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import ActivityRow from './ActivityRow';

interface Props {
  boardId?: string;
  showBoard?: boolean;
  limit?: number;
}

export default function ActivityFeed({ boardId, showBoard, limit = 50 }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const url = boardId ? `/api/boards/${boardId}/activity?limit=${limit}` : `/api/activity?limit=${limit}`;
    setIsLoading(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setEvents(boardId ? data.events ?? [] : data.events ?? []);
      })
      .catch(() => setEvents([]))
      .finally(() => setIsLoading(false));
  }, [boardId, limit]);

  return (
    <div className="card-base p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Activity</h2>
      </div>
      {isLoading ? (
        <p className="text-xs text-[var(--text-tertiary)]">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)]">No activity yet.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} showBoard={showBoard} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Wire into board page

Modify `src/app/(dashboard)/board/[boardId]/page.tsx` to render `<ActivityFeed boardId={boardId} />` below the board area.

### Step 4: Wire into digest page

Modify `src/app/(dashboard)/digest/page.tsx` to render `<ActivityFeed showBoard limit={20} />` below the AI digest placeholder.

### Step 5: Commit

```bash
git add src/components/activity/ActivityRow.tsx \
        src/components/activity/ActivityFeed.tsx \
        src/app/(dashboard)/board/[boardId]/page.tsx \
        src/app/(dashboard)/digest/page.tsx
git commit -m "feat(activity): add activity feed UI on board and digest pages

ActivityRow renders human-readable event descriptions. ActivityFeed
fetches board or global activity and renders a scrollable list.

Refs: docs/superpowers/specs/2026-06-15-activity-log-design.md"
```

---

## Task 6: Verify and push

### Step 1: Type-check

```bash
npx tsc --noEmit
```

### Step 2: Build

```bash
npm run build
```

### Step 3: Commit fixes

If any TS/ESLint fixes needed, commit them.

### Step 4: Push

```bash
git push origin main
```

---

## Out of scope notes

- OKR edit history, real-time activity updates, and activity filtering/search are deferred to later phases.
