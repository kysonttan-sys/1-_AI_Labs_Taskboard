# Real-Time Board Updates Design Spec

## Goal

Use the existing Socket.io server to broadcast card moves and card edits to all users viewing the same board, so the kanban board stays in sync across clients without requiring a page refresh.

## Scope

### In scope

- Socket room per `boardId` that clients join when on a board page.
- Server emits two events:
  - `card-moved` — when a card is moved to a different list/position via `/api/cards/[cardId]/move`.
  - `card-updated` — when a card is patched via `/api/cards/[cardId]/route.ts` (title, status, priority, progress, dates, description, assignees, labels, dependencies, key results).
- Client listens for those events and refetches the full board when received.
- Debounce/refetch guard to prevent refetch storms when local user makes rapid changes.
- Only apply remote updates (ignore events triggered by the current socket client itself).

### Out of scope

- Real-time activity feed updates (already covered by activity log, can be refreshed manually).
- Real-time OKR progress updates from other users.
- Live cursor/presence indicators.
- Optimistic cross-client state merging (we refetch the whole board for simplicity).

## Architecture

### Server

In `server.ts`, add handlers:
- `join-board` (socket event) — joins a room named `board:<boardId>`.
- `leave-board` (socket event) — leaves the room.
- Helper `broadcastToBoard(boardId, event, payload)` that emits to `board:<boardId>` excluding the sender.

In API routes:
- `src/app/api/cards/[cardId]/move/route.ts` — after successful move, call `broadcastToBoard(boardId, 'card-moved', { cardId, triggerUserId })`.
- `src/app/api/cards/[cardId]/route.ts` PATCH — after successful update, call `broadcastToBoard(boardId, 'card-updated', { cardId, triggerUserId })`.

The server must be able to emit from API routes. Use a global `io` instance attached to `globalThis` after `new Server()` is created, or pass via a module export.

### Client

In `src/app/(dashboard)/board/[boardId]/page.tsx`:
- Initialize socket connection using `socket.io-client`.
- On mount / boardId change, emit `join-board` for the current board.
- On unmount / boardId change, emit `leave-board` for the previous board.
- Listen for `card-moved` and `card-updated`.
- When an event arrives, if the socket ID is not the sender and the board is not currently being edited (optional guard), call `fetchBoard(boardId)`.
- Disconnect on unmount.

### Socket module

Create `src/lib/socket.ts`:
- Singleton `socket` instance from `socket.io-client`.
- Connects to `/` (same origin).
- Auth via the existing `session` cookie (browser sends automatically).

## Error handling

- Socket connection failures are silent; the board still works via manual refresh.
- If a broadcast fails, it does not affect the API response.

## Testing

- Type-check and build pass.
- Manual smoke test: open two browser windows on the same board, move/edit a card in one, verify the other refreshes.
