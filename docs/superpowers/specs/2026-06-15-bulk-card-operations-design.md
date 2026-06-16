# Bulk Card Operations Design Spec

## Goal

Allow users to perform actions on multiple cards at once from the kanban board: select cards across columns and bulk move, archive, delete, assign, label, or change status.

## Scope

### In scope

- Multi-select mode on the board with a selectable checkbox on each card.
- Selection persisted per board session via a new `useBulkSelectionStore`.
- Bulk action toolbar rendered above the board when one or more cards are selected.
- Bulk operations:
  - Move selected cards to a target list
  - Archive selected cards (set status to `done` and record `completedAt`)
  - Delete selected cards
  - Assign selected cards to a user (replace assignees or append)
  - Apply labels to selected cards (replace or append)
  - Change status of selected cards
- New API route: `POST /api/cards/bulk` that accepts `operation` + `cardIds` + payload.
- Board store method `bulkUpdateCards` to update local state after a bulk operation.
- Activity events created for bulk updates where applicable.
- Clear selection after successful bulk action.

### Out of scope

- Drag-to-select region or shift-range selection (checkbox only for this phase).
- Undo/redo for bulk actions.
- Keyboard shortcuts for selection.
- Server-side transaction guarantees across many cards (best-effort via Promise.all).

## Architecture

### State

A lightweight Zustand store tracks selected card IDs per board:

```ts
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
```

The store is global; selection clears when the user toggles mode off or leaves the board.

### UI

- Each `KanbanCard` shows a checkbox in multi-select mode (top-left or top-right).
- `KanbanBoard` renders a sticky `BulkActionBar` when selection is active.
- `BulkActionBar` contains buttons/dropdowns for each bulk operation.
- A "Select mode" toggle in the board header activates/deactivates multi-select.

### API

`POST /api/cards/bulk`

Request body:

```ts
{
  operation: 'move' | 'archive' | 'delete' | 'assign' | 'label' | 'status';
  cardIds: string[];
  // operation-specific fields:
  targetListId?: string;
  assigneeIds?: string[];
  appendAssignees?: boolean;
  labelIds?: string[];
  appendLabels?: boolean;
  status?: string;
}
```

Response: `{ updated: number }` or `{ deleted: number }`.

The endpoint fetches the board ID from the first card, authorizes via session, and performs the operation.

### Local state update

`boardStore.bulkUpdateCards(operation, cardIds, payload)` updates `lists` optimistically and then calls the API.

### Activity / notifications

- Bulk move creates one `card_moved` event per moved card.
- Bulk status change creates one `card_updated` event per card.
- Bulk archive creates `card_updated` events with status done.
- Bulk assign/label create `card_updated` events.
- Bulk delete creates `card_deleted` events.

Notifications are intentionally skipped for bulk actions to avoid spam; only activity events are logged.

## Error handling

- Partial failures are surfaced to the user as a warning count.
- If the API fails, the store re-fetches the board to reconcile state.

## Testing

- Type-check and build pass.
- Manual smoke test: select multiple cards across columns, move them, change status, assign, label, archive, and delete.
