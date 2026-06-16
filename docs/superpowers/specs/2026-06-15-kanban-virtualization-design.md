# Kanban Virtualization / Performance Design Spec

## Goal

Improve rendering performance for large kanban boards by virtualizing the card list inside each column. Keep drag-and-drop and the existing card-limit "Show more" behavior intact.

## Scope

### In scope

- Replace the static card map in `KanbanColumn` with a virtualized list using `@tanstack/react-virtual`.
- Render only visible cards plus a small overscan buffer; recycle DOM nodes for off-screen cards.
- Keep `SortableContext` working with the virtualized list by passing the full sorted card ids to `items`.
- Preserve the existing `VISIBLE_LIMIT = 10` soft cap and "Show more/less" button.
- Keep the existing card sorting logic unchanged.

### Out of scope

- Server-side pagination for board cards (current board API still returns all cards).
- Column-level virtualization.
- Changes to drag-and-drop reordering behavior.

## Architecture

### UI

In `src/components/board/KanbanColumn.tsx`:
- Use `useVirtualizer` from `@tanstack/react-virtual` with a fixed estimate size equal to the current card height (~84 px including margin).
- The virtualizer parent is the existing scrollable droppable div.
- Render a single tall spacer div whose height equals `virtualizer.getTotalSize()`.
- Map `virtualizer.getVirtualItems()` to rendered `KanbanCard` instances positioned absolutely within the spacer.
- Keep `SortableContext items={sortedCards.map((c) => c.id)}` so dnd-kit knows the full list order.
- The "Show more/less" button remains below the virtual list; clicking "Show more" expands the list and the virtualizer handles it.

### Dependencies

Add `@tanstack/react-virtual` as a dependency.

### Error handling

- If virtualization fails to initialize, fall back to the current static rendering.
- `@tanstack/react-virtual` SSR-safe; it measures after mount.

### Testing

- Type-check and build pass.
- Manual smoke test: board with many cards in one column scrolls smoothly and drag-drop still works.
