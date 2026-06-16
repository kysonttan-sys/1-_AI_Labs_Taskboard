# Real-Time Board Updates Implementation Plan

**Goal:** Broadcast card moves and card updates to all users viewing the same board via the existing Socket.io server.

---

## Task 1: Expose a global io instance and add board room handlers

**Files:**
- Modify: `server.ts`

### Step 1: Store io globally

After `const io = new Server(...)`, add:

```typescript
(globalThis as any).io = io;
```

### Step 2: Add board room handlers in connection callback

Inside `io.on('connection', (socket) => ...)`, add:

```typescript
let currentBoard: string | null = null;

socket.on('join-board', (boardId: string) => {
  if (currentBoard && currentBoard !== boardId) {
    socket.leave(`board:${currentBoard}`);
  }
  currentBoard = boardId;
  socket.join(`board:${boardId}`);
});

socket.on('leave-board', () => {
  if (currentBoard) {
    socket.leave(`board:${currentBoard}`);
    currentBoard = null;
  }
});

socket.on('disconnect', () => {
  if (currentBoard) {
    socket.leave(`board:${currentBoard}`);
  }
  // existing disconnect handling for meeting...
});
```

Make sure to keep existing disconnect logic for meetings intact.

### Step 3: Commit

```bash
git add server.ts
git commit -m "feat(realtime): add board socket rooms and global io instance

Clients can join/leave board:<boardId> rooms. Global io is stored
on globalThis so API routes can emit broadcast events.

Refs: docs/superpowers/specs/2026-06-15-real-time-board-design.md"
```

---

## Task 2: Broadcast card events from API routes

**Files:**
- Modify: `src/app/api/cards/[cardId]/move/route.ts`
- Modify: `src/app/api/cards/[cardId]/route.ts`

### Step 1: Create broadcast helper

Create `src/lib/socket-server.ts`:

```typescript
export function getIo(): any {
  return (globalThis as any).io;
}

export function broadcastToBoard(boardId: string, event: string, payload: Record<string, unknown>, senderId?: string) {
  const io = getIo();
  if (!io) return;
  if (senderId) {
    io.to(`board:${boardId}`).except(senderId).emit(event, payload);
  } else {
    io.to(`board:${boardId}`).emit(event, payload);
  }
}
```

### Step 2: Broadcast card move

In `src/app/api/cards/[cardId]/move/route.ts`, after the move succeeds:

```typescript
import { broadcastToBoard } from '@/lib/socket-server';
```

After fetching `updatedCard`:

```typescript
broadcastToBoard(card.boardId, 'card-moved', { cardId, userId: triggerUserId });
```

### Step 3: Broadcast card update

In `src/app/api/cards/[cardId]/route.ts`, after the update succeeds:

```typescript
import { broadcastToBoard } from '@/lib/socket-server';
```

Before `return NextResponse.json(card)` in PATCH:

```typescript
broadcastToBoard(before.boardId, 'card-updated', { cardId: card.id, userId: triggerUserId });
```

### Step 4: Commit

```bash
git add src/lib/socket-server.ts src/app/api/cards/[cardId]/move/route.ts src/app/api/cards/[cardId]/route.ts
git commit -m "feat(realtime): broadcast card move and update events

Card move and PATCH routes emit socket events to the board room.
Other clients receive card-moved/card-updated and can refetch.

Refs: docs/superpowers/specs/2026-06-15-real-time-board-design.md"
```

---

## Task 3: Client socket module and board page integration

**Files:**
- Create: `src/lib/socket.ts`
- Modify: `src/app/(dashboard)/board/[boardId]/page.tsx`

### Step 1: Create client socket singleton

Create `src/lib/socket.ts`:

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      transports: ['polling', 'websocket'],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

### Step 2: Join/leave board room and listen for events

In `src/app/(dashboard)/board/[boardId]/page.tsx`:

1. Import:

```typescript
import { getSocket } from '@/lib/socket';
```

2. Inside the component, add an effect:

```typescript
useEffect(() => {
  if (!boardId) return;
  const socket = getSocket();

  const handleMove = () => fetchBoard(boardId);
  const handleUpdate = () => fetchBoard(boardId);

  socket.emit('join-board', boardId);
  socket.on('card-moved', handleMove);
  socket.on('card-updated', handleUpdate);

  return () => {
    socket.emit('leave-board');
    socket.off('card-moved', handleMove);
    socket.off('card-updated', handleUpdate);
  };
}, [boardId, fetchBoard]);
```

### Step 3: Commit

```bash
git add src/lib/socket.ts src/app/(dashboard)/board/[boardId]/page.tsx
git commit -m "feat(realtime): listen for board card events via socket

Board page joins a board room and refetches the board when other
users move or update a card. Uses a singleton socket.io-client.

Refs: docs/superpowers/specs/2026-06-15-real-time-board-design.md"
```

---

## Task 4: Verify and push

```bash
npx tsc --noEmit
npm run build
git push origin main
```
