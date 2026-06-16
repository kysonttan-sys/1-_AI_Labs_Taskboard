# Activity / Audit Log Design Spec

## Goal

Capture every meaningful change to cards, lists, and boards in a persistent, queryable activity log. Surface the log as a per-board activity feed and a project-wide recent-activity panel on the digest page, so project managers can see who changed what and when without relying on notifications.

## Scope

### In scope

- `ActivityEvent` model storing: type, actor user id, board id, card id, list id, before/after snapshot metadata, createdAt.
- Event types: `card_created`, `card_updated` (title, status, priority, progress, dates, description), `card_moved`, `card_deleted`, `comment_added`, `checklist_item_completed`, `list_created`, `list_renamed`, `list_deleted`, `board_renamed`, `okr_linked`.
- Capture events inside existing API routes via a helper function `createActivityEvent`.
- `GET /api/boards/[boardId]/activity` — paginated feed for a board.
- `GET /api/activity` — recent feed across all boards for the digest page (no auth beyond middleware).
- UI: activity feed panel on board page, recent activity section on digest page.
- Human-readable activity row component with actor name, action verb, target, and timestamp.

### Out of scope

- Full historical diff / rollback.
- Activity log for OKR edits (objective/key-result changes are not tracked; only card↔OKR linking).
- Real-time activity updates (will be covered in Phase 5C).
- Filtering, search, or export of activity events.
- Per-user activity timeline.

## Architecture

### Data model

```prisma
model ActivityEvent {
  id          String   @id @default(cuid())
  type        String
  actorId     String?
  boardId     String?
  cardId      String?
  listId      String?
  metadata    Json?    // { before, after, description, etc. }
  createdAt   DateTime @default(now())

  actor User?   @relation(fields: [actorId], references: [id], onDelete: SetNull)
  board Board?  @relation(fields: [boardId], references: [id], onDelete: Cascade)
  card  Card?   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  list  List?   @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@index([boardId, createdAt])
  @@index([createdAt])
}
```

Add `activities ActivityEvent[]` to `User`, `Board`, `Card`, and `List` models.

### Event capture

A single helper:

```typescript
export async function createActivityEvent(params: {
  type: string;
  actorId?: string;
  boardId?: string;
  cardId?: string;
  listId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activityEvent.create({ data: params });
}
```

Called from existing API routes after successful mutations:
- `src/app/api/lists/[listId]/cards/route.ts` → `card_created`
- `src/app/api/cards/[cardId]/route.ts` PATCH → `card_updated` / `card_moved`
- `src/app/api/cards/[cardId]/route.ts` DELETE → `card_deleted`
- `src/app/api/cards/[cardId]/move/route.ts` → `card_moved`
- `src/app/api/cards/[cardId]/comments/route.ts` → `comment_added`
- `src/app/api/checklist/[itemId]/route.ts` PATCH (checked=true) → `checklist_item_completed`
- `src/app/api/lists/[listId]/route.ts` PATCH title → `list_renamed`
- `src/app/api/lists/[listId]/route.ts` DELETE → `list_deleted`
- `src/app/api/boards/[boardId]/route.ts` PATCH name → `board_renamed`
- `src/app/api/cards/[cardId]/key-results/route.ts` POST → `okr_linked`

### API endpoints

1. `GET /api/boards/[boardId]/activity?limit=&cursor=` — paginated descending by `createdAt`.
2. `GET /api/activity?limit=` — global recent activity across all boards.

### UI components

- `ActivityFeed` (new): fetches board activity, renders `ActivityRow`s.
- `ActivityRow` (new): actor avatar + name, action text, timestamp.
- `DigestPage` (modify): add recent activity section.
- `BoardPage` (modify): add activity panel below the board or in a side panel.

### Error handling

- Activity logging is fire-and-forget inside route handlers; failures are caught and logged, never returned to the client.
- Unknown actor resolves to `actorId: null` and renders as "Someone".

### Testing

- Unit test for `createActivityEvent` metadata normalization.
- Build + typecheck pass.
