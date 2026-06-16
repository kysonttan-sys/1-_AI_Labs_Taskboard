# Card ↔ OKR Linking Implementation Plan

**Goal:** Let cards contribute progress to Key Results and surface those links in the card detail panel, kanban cards, and the OKR dashboard.

**Approach:** Add a `CardKeyResult` join table, extend the card API to recompute linked KR `current` values, add a card detail linker UI, and add light read-only KR indicators in the kanban and OKR views.

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_card_key_result_links/migration.sql` (generated)

### Step 1: Add `CardKeyResult` model

Append to `prisma/schema.prisma` after the `KeyResult` model:

```prisma
model CardKeyResult {
  cardId      String
  keyResultId String
  weight      Float    @default(1)
  createdAt   DateTime @default(now())

  card      Card      @relation(fields: [cardId], references: [id], onDelete: Cascade)
  keyResult KeyResult @relation(fields: [keyResultId], references: [id], onDelete: Cascade)

  @@id([cardId, keyResultId])
  @@index([keyResultId])
  @@index([cardId])
}
```

Add `keyResults CardKeyResult[]` to the `Card` model (after `notifications`).

Add `cards CardKeyResult[]` to the `KeyResult` model (after `objective`).

### Step 2: Run migration

```bash
cd "D:/Task Management System/taskboard"
npx prisma migrate dev --name add_card_key_result_links
```

Expected: migration SQL created and applied. If Postgres is unreachable, commit the SQL and the user applies later with `npx prisma migrate deploy`.

### Step 3: Validate schema

```bash
npx prisma validate
```

Expected: schema is valid.

### Step 4: Commit

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(card-okr): add CardKeyResult join model

Adds many-to-many link between Card and KeyResult with weight.
Cascades delete from either side. Indexed for recompute lookups.

Refs: docs/superpowers/specs/2026-06-15-card-okr-linking-design.md"
```

---

## Task 2: Pure progress helper

**Files:**
- Create: `src/features/okrs/cardContribution.ts`
- Create: `src/features/okrs/cardContribution.test.ts`

### Step 1: Write tests

Create `src/features/okrs/cardContribution.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cardContribution, recomputeKrCurrent } from './cardContribution';

describe('cardContribution', () => {
  it('returns 1 for done status', () => {
    expect(cardContribution({ status: 'done', progress: 0, completedAt: null })).toBe(1);
  });

  it('returns 1 when completedAt is set', () => {
    expect(cardContribution({ status: 'todo', progress: 0, completedAt: new Date() })).toBe(1);
  });

  it('returns 0 for blocked status', () => {
    expect(cardContribution({ status: 'blocked', progress: 80, completedAt: null })).toBe(0);
  });

  it('uses progress for in_progress status', () => {
    expect(cardContribution({ status: 'in_progress', progress: 37, completedAt: null })).toBe(0.37);
  });

  it('caps progress above 100', () => {
    expect(cardContribution({ status: 'todo', progress: 150, completedAt: null })).toBe(1);
  });

  it('floors progress below 0', () => {
    expect(cardContribution({ status: 'todo', progress: -10, completedAt: null })).toBe(0);
  });
});

describe('recomputeKrCurrent', () => {
  it('returns current when no links', () => {
    expect(recomputeKrCurrent([], 7, 100)).toBe(7);
  });

  it('computes weighted average contribution times target', () => {
    const links = [
      { weight: 1, card: { status: 'done', progress: 0, completedAt: new Date() } },
      { weight: 1, card: { status: 'todo', progress: 50, completedAt: null } },
    ];
    expect(recomputeKrCurrent(links as any, 0, 100)).toBe(75);
  });

  it('respects different weights', () => {
    const links = [
      { weight: 2, card: { status: 'done', progress: 0, completedAt: new Date() } },
      { weight: 1, card: { status: 'todo', progress: 0, completedAt: null } },
    ];
    expect(recomputeKrCurrent(links as any, 0, 100)).toBeCloseTo(66.67, 1);
  });
});
```

### Step 2: Run tests (red)

```bash
npx vitest run src/features/okrs/cardContribution.test.ts
```

Expected: FAIL, module not found.

### Step 3: Implement

Create `src/features/okrs/cardContribution.ts`:

```typescript
export interface ContributionCard {
  status: string;
  progress: number;
  completedAt: Date | string | null;
}

export interface WeightedLink {
  weight: number;
  card: ContributionCard;
}

export function cardContribution(card: ContributionCard): number {
  if (card.status === 'done' || card.completedAt) return 1;
  if (card.status === 'blocked') return 0;
  const value = typeof card.progress === 'number' ? card.progress / 100 : 0;
  return Math.max(0, Math.min(1, value));
}

export function recomputeKrCurrent(links: WeightedLink[], current: number, target: number): number {
  if (links.length === 0) return current;
  const totalWeight = links.reduce((sum, link) => sum + (link.weight || 1), 0);
  if (totalWeight === 0) return current;
  const weightedContribution = links.reduce(
    (sum, link) => sum + (link.weight || 1) * cardContribution(link.card),
    0
  );
  return Math.min(target, (weightedContribution / totalWeight) * target);
}
```

### Step 4: Run tests (green)

```bash
npx vitest run src/features/okrs/cardContribution.test.ts
```

Expected: PASS.

### Step 5: Commit

```bash
git add src/features/okrs/cardContribution.ts src/features/okrs/cardContribution.test.ts
git commit -m "feat(card-okr): add card contribution and KR recompute helpers

Pure helpers for deriving KR current from linked cards. Done/completedAt
gives 100%, blocked gives 0%, otherwise card.progress% is used.

Refs: docs/superpowers/specs/2026-06-15-card-okr-linking-design.md"
```

---

## Task 3: Extend card API with links and recompute

**Files:**
- Modify: `src/app/api/cards/[cardId]/route.ts`
- Create: `src/app/api/cards/[cardId]/key-results/route.ts`
- Create: `src/app/api/cards/[cardId]/key-results/[keyResultId]/route.ts`
- Create: `src/app/api/projects/[projectId]/key-results/route.ts`

### Step 1: Add include to card GET and PATCH

In `src/app/api/cards/[cardId]/route.ts`, add `keyResults: { include: { keyResult: true } }` to the `include` objects in both `GET` and `PATCH`.

### Step 2: Add recompute helper and call it after PATCH

At the top of `src/app/api/cards/[cardId]/route.ts`, add:

```typescript
import { cardContribution } from '@/features/okrs/cardContribution';
```

Add a helper function before handlers:

```typescript
async function recomputeLinkedKeyResults(cardId: string) {
  const links = await prisma.cardKeyResult.findMany({
    where: { cardId },
    include: { keyResult: true, card: true },
  });

  for (const link of links) {
    const krLinks = await prisma.cardKeyResult.findMany({
      where: { keyResultId: link.keyResultId },
      include: { card: true },
    });
    const totalWeight = krLinks.reduce((sum, l) => sum + l.weight, 0);
    if (totalWeight === 0) continue;
    const weighted = krLinks.reduce(
      (sum, l) => sum + l.weight * cardContribution(l.card),
      0
    );
    const nextCurrent = Math.min(
      link.keyResult.target,
      (weighted / totalWeight) * link.keyResult.target
    );
    await prisma.keyResult.update({
      where: { id: link.keyResultId },
      data: { current: nextCurrent },
    });
  }
}
```

Call `await recomputeLinkedKeyResults(cardId)` right before `return NextResponse.json(card);` in PATCH.

### Step 3: Create link endpoint

Create `src/app/api/cards/[cardId]/key-results/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { recomputeLinkedKeyResults } from '../_recompute';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const body = await request.json();
  const { keyResultId, weight = 1 } = body;

  if (!keyResultId || typeof keyResultId !== 'string') {
    return NextResponse.json({ error: 'keyResultId is required' }, { status: 400 });
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return NextResponse.json({ error: 'weight must be a positive number' }, { status: 400 });
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { board: { select: { projectId: true } } },
  });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const kr = await prisma.keyResult.findUnique({
    where: { id: keyResultId },
    include: { objective: { select: { projectId: true } } },
  });
  if (!kr) return NextResponse.json({ error: 'Key result not found' }, { status: 404 });

  if (card.board.projectId !== kr.objective.projectId) {
    return NextResponse.json(
      { error: 'Card and key result must belong to the same project' },
      { status: 400 }
    );
  }

  const existing = await prisma.cardKeyResult.findUnique({
    where: { cardId_keyResultId: { cardId, keyResultId } },
  });
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const link = await prisma.cardKeyResult.create({
    data: { cardId, keyResultId, weight },
    include: { keyResult: true },
  });

  await recomputeLinkedKeyResults(cardId);

  return NextResponse.json(link, { status: 201 });
}
```

### Step 4: Create unlink endpoint

Create `src/app/api/cards/[cardId]/key-results/[keyResultId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { recomputeLinkedKeyResults } from '../../_recompute';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; keyResultId: string }> }
) {
  const { cardId, keyResultId } = await params;

  try {
    await prisma.cardKeyResult.delete({
      where: { cardId_keyResultId: { cardId, keyResultId } },
    });
    await recomputeLinkedKeyResults(cardId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }
}
```

### Step 5: Extract shared recompute helper

Create `src/app/api/cards/[cardId]/_recompute.ts`:

```typescript
import { prisma } from '@/lib/db/client';
import { cardContribution } from '@/features/okrs/cardContribution';

export async function recomputeLinkedKeyResults(cardId: string) {
  const links = await prisma.cardKeyResult.findMany({
    where: { cardId },
    include: { keyResult: true },
  });

  for (const link of links) {
    const krLinks = await prisma.cardKeyResult.findMany({
      where: { keyResultId: link.keyResultId },
      include: { card: true },
    });
    const totalWeight = krLinks.reduce((sum, l) => sum + l.weight, 0);
    if (totalWeight === 0) continue;
    const weighted = krLinks.reduce(
      (sum, l) => sum + l.weight * cardContribution(l.card),
      0
    );
    const nextCurrent = Math.min(
      link.keyResult.target,
      (weighted / totalWeight) * link.keyResult.target
    );
    await prisma.keyResult.update({
      where: { id: link.keyResultId },
      data: { current: nextCurrent },
    });
  }
}
```

Import it from the link and unlink routes. Also call it from the main card PATCH.

### Step 6: Create project KR list endpoint

Create `src/app/api/projects/[projectId]/key-results/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const objectives = await prisma.objective.findMany({
    where: { projectId },
    orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
    include: {
      keyResults: {
        orderBy: { position: 'asc' },
        include: { _count: { select: { cards: true } } },
      },
    },
  });

  return NextResponse.json(objectives);
}
```

### Step 7: Update board store types and card serialization

Make sure `Card` type in `src/types.ts` includes `keyResults: { keyResult: KeyResult; weight: number }[]`.

### Step 8: Commit

```bash
git add src/app/api/cards/[cardId]/route.ts \
        src/app/api/cards/[cardId]/_recompute.ts \
        src/app/api/cards/[cardId]/key-results/route.ts \
        src/app/api/cards/[cardId]/key-results/[keyResultId]/route.ts \
        src/app/api/projects/[projectId]/key-results/route.ts \
        src/types.ts
git commit -m "feat(card-okr): link cards to key results and recompute progress

Card PATCH and link/unlink endpoints recompute linked KR current values.
New project KR list endpoint powers the card detail picker.
Same-project guard enforced.

Refs: docs/superpowers/specs/2026-06-15-card-okr-linking-design.md"
```

---

## Task 4: Card detail linker UI

**Files:**
- Create: `src/components/board/CardKeyResultLinker.tsx`
- Modify: `src/components/board/CardDetailModal.tsx`

### Step 1: Create linker component

Create `src/components/board/CardKeyResultLinker.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Target, Plus, X } from 'lucide-react';
import type { Objective, KeyResult } from '@/lib/api/okrs';

interface LinkedKeyResult {
  keyResultId: string;
  weight: number;
  keyResult: KeyResult;
}

interface Props {
  cardId: string;
  projectId: string;
  linked: LinkedKeyResult[];
  onChange: (linked: LinkedKeyResult[]) => void;
}

export default function CardKeyResultLinker({ cardId, projectId, linked, onChange }: Props) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch(`/api/projects/${projectId}/key-results`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setObjectives(data);
      })
      .catch(() => {});
  }, [projectId]);

  const linkedIds = useMemo(() => new Set(linked.map((l) => l.keyResultId)), [linked]);

  const allKrs = useMemo(
    () => objectives.flatMap((o) => o.keyResults.map((kr) => ({ ...kr, objectiveTitle: o.title }))),
    [objectives]
  );

  const available = useMemo(
    () =>
      allKrs
        .filter((kr) => !linkedIds.has(kr.id))
        .filter(
          (kr) =>
            kr.title.toLowerCase().includes(query.toLowerCase()) ||
            kr.objectiveTitle.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 6),
    [allKrs, linkedIds, query]
  );

  async function linkKr(kr: KeyResult) {
    const res = await fetch(`/api/cards/${cardId}/key-results`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyResultId: kr.id }),
    });
    if (!res.ok) return;
    onChange([...linked, { keyResultId: kr.id, weight: 1, keyResult: kr }]);
    setQuery('');
  }

  async function unlinkKr(keyResultId: string) {
    const res = await fetch(`/api/cards/${cardId}/key-results/${keyResultId}`, {
      method: 'DELETE',
    });
    if (!res.ok) return;
    onChange(linked.filter((l) => l.keyResultId !== keyResultId));
  }

  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Target className="h-3 w-3" />
        Key Results
      </label>

      {linked.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {linked.map((l) => (
            <div
              key={l.keyResultId}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]"
            >
              <span className="truncate max-w-[180px]">{l.keyResult.title}</span>
              <button
                onClick={() => unlinkKr(l.keyResultId)}
                className="text-[var(--text-tertiary)] hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search key results..."
          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring"
        />
        {query && available.length > 0 && (
          <div className="absolute z-10 mt-1 w-full card-base border border-[var(--border)] max-h-48 overflow-y-auto">
            {available.map((kr) => (
              <button
                key={kr.id}
                onClick={() => linkKr(kr)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-card-hover)] flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[var(--text-primary)] truncate">{kr.title}</p>
                  <p className="text-xs text-[var(--text-tertiary)] truncate">{kr.objectiveTitle}</p>
                </div>
                <Plus className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {objectives.length === 0 && (
        <p className="text-xs text-[var(--text-tertiary)] mt-1">No OKRs in this project.</p>
      )}
    </div>
  );
}
```

### Step 2: Wire into CardDetailModal

In `src/components/board/CardDetailModal.tsx`:

1. Add import:
   ```tsx
   import CardKeyResultLinker from './CardKeyResultLinker';
   import { Target } from 'lucide-react';
   ```

2. Add state near other state:
   ```tsx
   const [linkedKeyResults, setLinkedKeyResults] = useState(
     (card.keyResults ?? []).map((l) => ({
       keyResultId: l.keyResultId,
       weight: l.weight,
       keyResult: l.keyResult,
     }))
   );
   ```

3. Render a new section after Labels and before Checklist:
   ```tsx
   {/* Key Results */}
   <CardKeyResultLinker
     cardId={card.id}
     projectId={card.boardId ? /* need project id */ '' : ''}
     linked={linkedKeyResults}
     onChange={setLinkedKeyResults}
   />
   ```

Since `Card` does not currently carry `projectId`, extend the card type / store to include it, or fetch board project in the modal. For simplicity, add `projectId` to the `Card` type and ensure board store loads it.

### Step 3: Commit

```bash
git add src/components/board/CardKeyResultLinker.tsx src/components/board/CardDetailModal.tsx
git commit -m "feat(card-okr): add card detail key result linker

Searchable picker to link/unlink a card to same-project key results.
Badges show linked KRs; clicking X unlinks.

Refs: docs/superpowers/specs/2026-06-15-card-okr-linking-design.md"
```

---

## Task 5: Kanban card KR badge

**Files:**
- Modify: `src/components/board/KanbanCard.tsx`
- Modify: `src/types.ts`

### Step 1: Add keyResults to card type

Ensure `Card` type includes `keyResults: { keyResultId: string; weight: number; keyResult: { id: string; title: string } }[]`.

### Step 2: Render badge

In `KanbanCard.tsx`, add a small badge when `card.keyResults?.length > 0`:

```tsx
{card.keyResults && card.keyResults.length > 0 && (
  <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] mt-1.5">
    <Target className="h-3 w-3" />
    {card.keyResults.length} KR{card.keyResults.length > 1 ? 's' : ''}
  </div>
)}
```

Import `Target` from `lucide-react`. If `Target` is unavailable, use `Flag`.

### Step 3: Commit

```bash
git add src/components/board/KanbanCard.tsx src/types.ts
git commit -m "feat(card-okr): show linked KR count on kanban cards

Lightweight read-only badge indicates cards tied to OKRs.

Refs: docs/superpowers/specs/2026-06-15-card-okr-linking-design.md"
```

---

## Task 6: OKR dashboard linked-card indicator

**Files:**
- Modify: `src/app/(dashboard)/okrs/KeyResultRow.tsx`
- Modify: `src/app/api/okrs/[objectiveId]/route.ts` and `src/app/api/okrs/route.ts`

### Step 1: Include linked card count in OKR API

In both `src/app/api/okrs/route.ts` and `src/app/api/okrs/[objectiveId]/route.ts`, update the `keyResults` include to:

```typescript
include: {
  keyResults: {
    orderBy: { position: 'asc' },
    include: {
      cards: { include: { card: { select: { id: true, title: true, status: true, progress: true } } } },
    },
  },
}
```

### Step 2: Show linked card count in KeyResultRow

In `KeyResultRow.tsx`, add after the value line:

```tsx
{kr.cards && kr.cards.length > 0 && (
  <span className="text-xs text-[var(--text-tertiary)] ml-2">
    {kr.cards.length} linked card{kr.cards.length > 1 ? 's' : ''}
  </span>
)}
```

### Step 3: Commit

```bash
git add src/app/api/okrs/route.ts src/app/api/okrs/[objectiveId]/route.ts src/app/(dashboard)/okrs/KeyResultRow.tsx
git commit -m "feat(card-okr): show linked card count in OKR dashboard

OKR endpoints include linked cards; KeyResultRow shows count.

Refs: docs/superpowers/specs/2026-06-15-card-okr-linking-design.md"
```

---

## Task 7: Type-check, build, and test

### Step 1: Run tests

```bash
npm test 2>&1 | tail -40
```

Expected: existing tests still pass; new card contribution tests pass.

### Step 2: Type-check

```bash
npx tsc --noEmit
```

Expected: no new errors.

### Step 3: Build

```bash
npm run build
```

Expected: succeeds.

### Step 4: Commit any fixes

If any small TS/ESLint fixes were needed, commit them with a `fix(card-okr): ...` message.

---

## Task 8: Push Phase 4

### Step 1: Push

```bash
git push origin main
```

Expected: branch pushed.

### Step 2: Report

Tell the user Phase 4 is complete.
