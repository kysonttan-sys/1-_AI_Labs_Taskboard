# Bulk Card Operations Implementation Plan

**Goal:** Add multi-select and bulk actions (move, archive, delete, assign, label, status) to the kanban board.

---

## Task 1: Add bulk selection store

**Files:**
- Create: `src/features/board/bulkSelectionStore.ts`

### Step 1: Create store

```ts
import { create } from 'zustand';

interface BulkSelectionState {
  selectedIds: Set<string>;
  isSelecting: boolean;
  toggle: (cardId: string) => void;
  select: (cardId: string) => void;
  deselect: (cardId: string) => void;
  setSelection: (ids: string[]) => void;
  clear: () => void;
  setIsSelecting: (value: boolean) => void;
}

export const useBulkSelectionStore = create<BulkSelectionState>((set) => ({
  selectedIds: new Set(),
  isSelecting: false,
  toggle: (cardId) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return { selectedIds: next };
    }),
  select: (cardId) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      next.add(cardId);
      return { selectedIds: next };
    }),
  deselect: (cardId) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      next.delete(cardId);
      return { selectedIds: next };
    }),
  setSelection: (ids) => set({ selectedIds: new Set(ids) }),
  clear: () => set({ selectedIds: new Set() }),
  setIsSelecting: (value) => set({ isSelecting: value }),
}));
```

### Step 2: Commit

```bash
git add src/features/board/bulkSelectionStore.ts
git commit -m "feat(bulk): add bulk selection store

Refs: docs/superpowers/specs/2026-06-15-bulk-card-operations-design.md"
```

---

## Task 2: Add bulk API endpoint

**Files:**
- Create: `src/app/api/cards/bulk/route.ts`

### Step 1: Implement route

Handle operations: `move`, `archive`, `delete`, `assign`, `label`, `status`.
Validate session, fetch cards to get boardId, perform Prisma updates, create activity events, and broadcast `card-updated` for affected cards.

### Step 2: Commit

```bash
git add src/app/api/cards/bulk/route.ts
git commit -m "feat(bulk): add bulk card operations API

POST /api/cards/bulk supports move, archive, delete, assign, label, status.
Creates activity events and broadcasts updates.

Refs: docs/superpowers/specs/2026-06-15-bulk-card-operations-design.md"
```

---

## Task 3: Add board store bulk method

**Files:**
- Modify: `src/features/board/boardStore.ts`

### Step 1: Add bulkUpdateCards action

Optimistically update local lists, call `/api/cards/bulk`, and fall back to `fetchBoard` on failure.

### Step 2: Commit

```bash
git add src/features/board/boardStore.ts
git commit -m "feat(bulk): add bulkUpdateCards board store action

Refs: docs/superpowers/specs/2026-06-15-bulk-card-operations-design.md"
```

---

## Task 4: Update UI components

**Files:**
- Create: `src/components/board/BulkActionBar.tsx`
- Modify: `src/components/board/KanbanCard.tsx`
- Modify: `src/components/board/KanbanBoard.tsx`

### Step 1: BulkActionBar component

Sticky bar showing selection count and dropdowns/buttons for:
- Move to list
- Set status
- Assign to user
- Apply labels
- Archive
- Delete
- Clear selection

### Step 2: KanbanCard checkbox

Show checkbox when `useBulkSelectionStore.isSelecting` is true. Toggle selection on click without opening the card modal.

### Step 3: KanbanBoard header toggle

Add a "Select" button in the board header to toggle multi-select mode.
Render `<BulkActionBar />` when selection is active.

### Step 4: Commit

```bash
git add src/components/board/BulkActionBar.tsx \
  src/components/board/KanbanCard.tsx \
  src/components/board/KanbanBoard.tsx
git commit -m "feat(bulk): wire multi-select UI and bulk action bar

Refs: docs/superpowers/specs/2026-06-15-bulk-card-operations-design.md"
```

---

## Task 5: Verify and push

```bash
npx tsc --noEmit
npm run build
git push origin main
```
