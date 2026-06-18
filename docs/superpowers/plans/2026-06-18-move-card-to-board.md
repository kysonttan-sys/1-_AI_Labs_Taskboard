# Plan: Move a card/task to another board

## Goal
Allow users to move a single card/task from one board to another within the same project, directly from the card detail modal.

## Current state
- `src/app/api/cards/[cardId]/route.ts` explicitly blocks cross-board moves: `listId does not belong to this card's board`.
- `CardDetailModal.tsx` only shows the Status dropdown (lists from the current board). There is no Board selector.
- `boardStore.updateCard` already handles moving cards between lists, but assumes the lists are in the same board.

## Proposed implementation

### 1. API changes: `src/app/api/cards/[cardId]/route.ts`
- Accept `boardId` in the PATCH body.
- If `boardId` is the same as `before.boardId`, keep existing logic.
- If `boardId` changes:
  - Verify the target board exists and belongs to the **same project** as the current board.
  - Resolve target `listId`:
    - Use provided `listId` if it belongs to the target board.
    - Else if `status` matches a list title in the target board, use that list.
    - Else fall back to the first list of the target board.
  - Update `boardId`, `listId`, and `status` together.
  - If `labelIds` are provided, validate them against the **target** board; otherwise clear labels if they belong to the old board.
  - Reindex source list (old board) and target list (new board).
  - Broadcast `card-updated` to **both** old and new boards.
  - Record `card_moved` activity with `fromBoardId` / `toBoardId` metadata.

### 2. UI changes: `src/components/board/CardDetailModal.tsx`
- Read `boards` and `lists` from `useBoardStore()`.
- Determine the current board's `projectId`.
- Add a **Board** select dropdown above the **Status** dropdown, populated with boards in the same project.
- When the user selects a different board:
  - Update the available Status options to lists in the new board.
  - Pick the best matching list/status:
    - A list with the same title as the current status, or
    - The first list of the new board.
  - Clear labels if they don't exist on the new board.
- On save, call `updateCard(card.id, { boardId, listId, status, ... })`.

### 3. Store changes: `src/features/board/boardStore.ts`
- Extend `updateCard` optimistic logic to handle cross-board moves.
- When the server response shows `boardId` changed:
  - Find the card in the old list and remove it.
  - Add the updated card to the target list in the store.
  - If the target list is not loaded yet (e.g., user hasn't opened that board), the card will be missing until that board is fetched. Acceptable limitation for now.

### 4. Permission/security
- Target board must be in the same project as the source board. Do not allow cross-project moves.
- Labels are board-scoped; clear or revalidate them on cross-board moves.

## Out of scope
- Moving lists/columns to another board.
- Cross-project moves.

## Verification
- `npx tsc --noEmit` passes.
- `npm run build` completes.
- Smoke test: open a card, change Board to another board in the same project, save, verify card appears in the target board.
