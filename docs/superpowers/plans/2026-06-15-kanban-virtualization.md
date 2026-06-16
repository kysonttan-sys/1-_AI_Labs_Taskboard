# Kanban Virtualization Implementation Plan

**Goal:** Improve rendering performance for large kanban columns by virtualizing the card list.

---

## Task 1: Add virtualization dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (via npm install)

### Step 1: Install dependency

```bash
cd "D:/Task Management System/taskboard"
npm install @tanstack/react-virtual
```

### Step 2: Commit

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @tanstack/react-virtual for kanban virtualization

Adds virtualizer dependency for rendering only visible cards
inside large kanban columns.

Refs: docs/superpowers/specs/2026-06-15-kanban-virtualization-design.md"
```

---

## Task 2: Virtualize KanbanColumn card list

**Files:**
- Modify: `src/components/board/KanbanColumn.tsx`

### Step 1: Add imports

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
```

### Step 2: Add virtualizer in KanbanColumn

Inside `KanbanColumn`, after `sortedCards` is computed:

```tsx
const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: visibleCards.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 84,
  overscan: 3,
});
```

### Step 3: Update droppable div and card rendering

Wrap the droppable div with `parentRef`. Render:

```tsx
<div
  ref={setNodeRef}
  className="flex-1 overflow-y-auto p-2 scrollbar-thin"
  style={{ position: 'relative' }}
>
  <SortableContext items={sortedCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
    <div ref={parentRef} style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const card = visibleCards[virtualItem.index];
        return (
          <div
            key={card.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <KanbanCard card={card} onClick={() => onCardClick(card)} />
          </div>
        );
      })}
    </div>
  </SortableContext>
  {/* Show more/less buttons below */}
</div>
```

### Step 4: Commit

```bash
git add src/components/board/KanbanColumn.tsx
git commit -m "feat(perf): virtualize kanban card lists

Uses @tanstack/react-virtual to render only visible cards per
column with overscan. Keeps SortableContext items as full list so
drag-and-drop ordering continues to work.

Refs: docs/superpowers/specs/2026-06-15-kanban-virtualization-design.md"
```

---

## Task 3: Verify and push

```bash
npx tsc --noEmit
npm run build
git push origin main
```
