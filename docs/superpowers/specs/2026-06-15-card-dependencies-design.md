# Card Dependencies UI Design Spec

## Goal

Surface the existing `CardDependency` model in the UI so users can see and manage card blockers directly. Add a dependency picker inside the card detail modal and a visual blocker indicator on kanban cards when a card has unfinished dependencies.

## Scope

### In scope

- `CardDetailModal` "Dependencies" section: list existing dependencies, search/add new dependency, remove dependency.
- Dependency picker only shows cards from the same board, excluding the current card and already-linked dependencies.
- Only one dependency type for MVP: `finish_to_start` (default), stored in the existing `type` column.
- `KanbanCard` blocker badge: shows count of dependencies that are not `done` and don't have `completedAt`.
- Read-only "blocked by" list in card detail.
- API endpoints:
  - `GET /api/boards/[boardId]/cards` — list all cards in a board for the picker.
  - `POST /api/cards/[cardId]/dependencies` — add dependency `{ dependsOnCardId }`.
  - `DELETE /api/cards/[cardId]/dependencies/[dependsOnCardId]` — remove dependency.
- Card GET/PATCH/Board GET includes `dependsOn` with nested `dependsOnCard`.

### Out of scope

- Multiple dependency types beyond `finish_to_start`.
- Dependency cycle detection (Prisma unique index prevents duplicate pairs; cycles are user-managed for now).
- Gantt chart dependency lines.
- Auto-blocking workflow (cards can still be moved regardless of dependencies).
- Reverse dependents management in card detail (we show who depends on the card, but don't let editing from that side).

## Architecture

### Data model

Existing `CardDependency` model:
- `dependsOnCardId` → the card that must finish first.
- `dependentCardId` → the card that is blocked.
- `type` string, default `finish_to_start`.

No schema changes needed for this phase.

### API surface

1. `GET /api/boards/[boardId]/cards` — returns all cards in the board with minimal fields (`id`, `title`, `status`).
2. `POST /api/cards/[cardId]/dependencies` — creates `CardDependency` from `[cardId]` (dependent) to `dependsOnCardId`. Validates same-board.
3. `DELETE /api/cards/[cardId]/dependencies/[dependsOnCardId]` — deletes the dependency pair.
4. Update `GET /api/cards/[cardId]` and `PATCH /api/cards/[cardId]` to include `dependsOn: { include: { dependsOnCard: true } }`.
5. Update `GET /api/boards/[boardId]` to include `dependsOn: { include: { dependsOnCard: true } }` on cards.

### UI components

- `CardDependencyLinker` (new): dependency list + searchable add/remove inside `CardDetailModal`.
- `KanbanCard` (modified): blocker badge when `card.dependsOn` has items where `dependsOnCard.status !== 'done' && !dependsOnCard.completedAt`.

### Error handling

- 400 if trying to depend on itself, a card from another board, or a duplicate dependency.
- 404 if dependency or card not found.

### Testing

- Type-check and build pass.
