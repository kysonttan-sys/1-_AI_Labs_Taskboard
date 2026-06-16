# Card Dependencies UI Implementation Plan

**Goal:** Surface the existing `CardDependency` model with a card detail picker and a kanban blocker badge.

---

## Task 1: Dependency read endpoints + include dependencies in card payloads

**Files:**
- Modify: `src/app/api/cards/[cardId]/route.ts`
- Modify: `src/app/api/boards/[boardId]/route.ts`
- Create: `src/app/api/boards/[boardId]/cards/route.ts`

### Step 1: Include dependencies in card GET/PATCH

In `src/app/api/cards/[cardId]/route.ts`, add to both `include` objects:

```typescript
dependsOn: {
  include: { dependsOnCard: true },
},
```

### Step 2: Include dependencies in board GET

In `src/app/api/boards/[boardId]/route.ts`, add to card include:

```typescript
dependsOn: { include: { dependsOnCard: true } },
```

### Step 3: Create board cards list endpoint

Create `src/app/api/boards/[boardId]/cards/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const cards = await prisma.card.findMany({
    where: { boardId },
    orderBy: { position: 'asc' },
    select: { id: true, title: true, status: true, listId: true, completedAt: true },
  });

  return NextResponse.json(cards);
}
```

### Step 4: Commit

```bash
git add src/app/api/cards/[cardId]/route.ts src/app/api/boards/[boardId]/route.ts src/app/api/boards/[boardId]/cards/route.ts
git commit -m "feat(deps): include dependencies in card/board payloads and add board cards list endpoint

GET /api/boards/[boardId]/cards lists all board cards for dependency picker.
Card and board detail APIs now include dependsOn with nested cards.

Refs: docs/superpowers/specs/2026-06-15-card-dependencies-design.md"
```

---

## Task 2: Dependency link/unlink endpoints

**Files:**
- Create: `src/app/api/cards/[cardId]/dependencies/route.ts`
- Create: `src/app/api/cards/[cardId]/dependencies/[dependsOnCardId]/route.ts`

### Step 1: Create link endpoint

Create `src/app/api/cards/[cardId]/dependencies/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const body = await request.json();
  const { dependsOnCardId } = body;

  if (!dependsOnCardId || typeof dependsOnCardId !== 'string') {
    return NextResponse.json({ error: 'dependsOnCardId is required' }, { status: 400 });
  }
  if (dependsOnCardId === cardId) {
    return NextResponse.json({ error: 'A card cannot depend on itself' }, { status: 400 });
  }

  const [card, target] = await Promise.all([
    prisma.card.findUnique({ where: { id: cardId }, select: { boardId: true } }),
    prisma.card.findUnique({ where: { id: dependsOnCardId }, select: { boardId: true } }),
  ]);

  if (!card || !target) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  if (card.boardId !== target.boardId) {
    return NextResponse.json({ error: 'Cards must be on the same board' }, { status: 400 });
  }

  try {
    const dep = await prisma.cardDependency.create({
      data: {
        dependentCardId: cardId,
        dependsOnCardId,
        type: 'finish_to_start',
      },
      include: { dependsOnCard: true },
    });
    return NextResponse.json(dep, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
  }
}
```

### Step 2: Create unlink endpoint

Create `src/app/api/cards/[cardId]/dependencies/[dependsOnCardId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; dependsOnCardId: string }> }
) {
  const { cardId, dependsOnCardId } = await params;

  try {
    await prisma.cardDependency.delete({
      where: {
        dependsOnCardId_dependentCardId: { dependsOnCardId, dependentCardId: cardId },
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Dependency not found' }, { status: 404 });
  }
}
```

### Step 3: Commit

```bash
git add src/app/api/cards/[cardId]/dependencies/route.ts src/app/api/cards/[cardId]/dependencies/[dependsOnCardId]/route.ts
git commit -m "feat(deps): add dependency link/unlink endpoints

POST creates a finish_to_start dependency within the same board.
DELETE removes the dependency pair. Same-board and self-dependency guards.

Refs: docs/superpowers/specs/2026-06-15-card-dependencies-design.md"
```

---

## Task 3: Card detail dependency linker UI

**Files:**
- Create: `src/components/board/CardDependencyLinker.tsx`
- Modify: `src/components/board/CardDetailModal.tsx`
- Modify: `src/types/index.ts`
- Modify: `src/features/board/boardStore.ts`

### Step 1: Add dependency type

In `src/types/index.ts`, add to `Card`:

```typescript
dependsOn?: { dependsOnCard: { id: string; title: string; status: string; completedAt: string | null } }[];
```

### Step 2: Preserve dependencies in board store

In `src/features/board/boardStore.ts`, update `updateCard` merge and addCard normalization to keep `dependsOn`.

### Step 3: Create linker component

Create `src/components/board/CardDependencyLinker.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link2, Plus, X } from 'lucide-react';

interface DepCard {
  id: string;
  title: string;
  status: string;
  completedAt: string | null;
}

interface Dependency {
  dependsOnCardId: string;
  dependsOnCard: DepCard;
}

interface Props {
  cardId: string;
  boardId: string;
  dependencies: Dependency[];
  onChange: (deps: Dependency[]) => void;
}

export default function CardDependencyLinker({ cardId, boardId, dependencies, onChange }: Props) {
  const [boardCards, setBoardCards] = useState<DepCard[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch(`/api/boards/${boardId}/cards`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBoardCards(data);
      })
      .catch(() => {});
  }, [boardId]);

  const linkedIds = useMemo(
    () => new Set(dependencies.map((d) => d.dependsOnCardId)),
    [dependencies]
  );

  const available = useMemo(
    () =>
      boardCards
        .filter((c) => c.id !== cardId && !linkedIds.has(c.id))
        .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6),
    [boardCards, cardId, linkedIds, query]
  );

  async function addDep(target: DepCard) {
    const res = await fetch(`/api/cards/${cardId}/dependencies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dependsOnCardId: target.id }),
    });
    if (!res.ok) return;
    onChange([...dependencies, { dependsOnCardId: target.id, dependsOnCard: target }]);
    setQuery('');
  }

  async function removeDep(dependsOnCardId: string) {
    const res = await fetch(`/api/cards/${cardId}/dependencies/${dependsOnCardId}`, {
      method: 'DELETE',
    });
    if (!res.ok) return;
    onChange(dependencies.filter((d) => d.dependsOnCardId !== dependsOnCardId));
  }

  const isDone = (c: DepCard) => c.status === 'done' || c.completedAt;

  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Link2 className="h-3 w-3" />
        Dependencies
      </label>

      {dependencies.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {dependencies.map((d) => (
            <div
              key={d.dependsOnCardId}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs border ${
                isDone(d.dependsOnCard)
                  ? 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-tertiary)]'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              <span className="truncate">{d.dependsOnCard.title}</span>
              <button
                onClick={() => removeDep(d.dependsOnCardId)}
                className="text-[var(--text-tertiary)] hover:text-red-400 shrink-0"
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
          placeholder="Search cards..."
          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring"
        />
        {query && available.length > 0 && (
          <div className="absolute z-10 mt-1 w-full card-base border border-[var(--border)] max-h-48 overflow-y-auto">
            {available.map((c) => (
              <button
                key={c.id}
                onClick={() => addDep(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-card-hover)] flex items-center justify-between"
              >
                <span className="text-[var(--text-primary)] truncate">{c.title}</span>
                <Plus className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Wire into CardDetailModal

Add import and render `CardDependencyLinker` in `CardDetailModal`, after Key Results section.

### Step 5: Commit

```bash
git add src/components/board/CardDependencyLinker.tsx src/components/board/CardDetailModal.tsx src/types/index.ts src/features/board/boardStore.ts
git commit -m "feat(deps): add card detail dependency linker

Searchable picker to add/remove finish_to_start dependencies within
the same board. Blocked dependencies highlighted in red.

Refs: docs/superpowers/specs/2026-06-15-card-dependencies-design.md"
```

---

## Task 4: Kanban blocker badge

**Files:**
- Modify: `src/components/board/KanbanCard.tsx`

### Step 1: Compute blocker count

Add helper inside `KanbanCard`:

```typescript
const blockerCount =
  card.dependsOn?.filter((d) => d.dependsOnCard.status !== 'done' && !d.dependsOnCard.completedAt).length ?? 0;
```

### Step 2: Render badge

After the KR badge in the meta row, add:

```tsx
{blockerCount > 0 && (
  <span className="flex items-center gap-1 text-red-400">
    <Link2 className="h-3 w-3" />
    {blockerCount}
  </span>
)}
```

### Step 3: Commit

```bash
git add src/components/board/KanbanCard.tsx
git commit -m "feat(deps): show blocker count on kanban cards

Red badge with dependency count when a card has unfinished dependencies.

Refs: docs/superpowers/specs/2026-06-15-card-dependencies-design.md"
```

---

## Task 5: Verify and push

```bash
npx tsc --noEmit
npm run build
git push origin main
```
