# Design: Key Result Dates and Linked Tasks

## Summary

Extend the OKR hierarchy so that each **Key Result** has:
- a **start date** and **end date**
- a list of **linked tasks** (real `Card` records) that can be created directly from the OKR page
- live status visibility on the OKR page, with status changes happening on the taskboard

The relationship stays: **Objective → Key Result → Task**.

Key Result numeric progress remains manually tracked; tasks are the work performed to reach the number, not the measure of it.

---

## Goals

1. Add `startDate` and `endDate` to every Key Result.
2. Allow users to create a task under a Key Result from the OKR page.
3. Let users pick an existing board/list or create a new board + default "To Do" list.
4. Keep the task linked to the Key Result via the existing `CardKeyResult` join table.
5. Show linked tasks under each Key Result with their live status from the taskboard.
6. Clicking a task opens the existing `CardDetailModal` for full editing.

---

## Non-goals

- Tasks do not automatically update Key Result numeric progress.
- No separate task entity; tasks are standard `Card` records.
- No custom statuses beyond the existing card status values (`todo`, `in_progress`, `review`, `done`).

---

## Data model

### Prisma schema changes

```prisma
model KeyResult {
  id          String    @id @default(cuid())
  title       String
  target      Float
  current     Float     @default(0)
  unit        String?
  position    Int       @default(0)
  objectiveId String
  objective   Objective @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  cards       CardKeyResult[]
  startDate   DateTime  // NEW
  endDate     DateTime  // NEW
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([objectiveId, position])
  @@index([position])
}
```

- Add a migration to add `startDate` and `endDate` columns.
- Existing `CardKeyResult` table continues to link cards to key results.

---

## API changes

### `POST /api/okrs/[objectiveId]/key-results`

Accept additional fields:
- `startDate: string` (ISO date, required)
- `endDate: string` (ISO date, required)

Validation:
- Both must be valid dates.
- `endDate` must be the same day or after `startDate`.

### `PATCH /api/okrs/[objectiveId]/key-results/[krId]`

Accept optional updates:
- `startDate`
- `endDate`

Apply the same date validation.

### New: `POST /api/okrs/[objectiveId]/key-results/[krId]/cards`

Create a task linked to the Key Result.

Body:
```json
{
  "title": "string",
  "boardId": "existing-board-id",          // optional if creating a new board
  "listId": "existing-list-id",            // optional if creating a new board
  "newBoardName": "string",                // optional; if provided, creates a board
  "newListName": "string",                 // optional; defaults to "To Do"
  "description": "string",                   // optional
  "dueDate": "string"                      // optional ISO date
}
```

Rules:
- Either `boardId` + `listId` OR `newBoardName` must be provided.
- The board must belong to the same project as the Key Result’s objective.
- On new board creation: create the board with the given name under the project, create a default list named `newListName || "To Do"`, then create the card in that list.
- Create the card with `status: "todo"` and `position: max + 1` in the target list.
- Create a `CardKeyResult` link with default weight `1`.
- Return the created card with its linked key result.

### `GET /api/okrs` and `GET /api/okrs/[id]`

Include linked cards on each key result:
```json
{
  "keyResults": [
    {
      "id": "...",
      "title": "...",
      "startDate": "...",
      "endDate": "...",
      "cards": [
        {
          "id": "...",
          "title": "...",
          "status": "todo | in_progress | review | done",
          "listId": "...",
          "boardId": "...",
          "dueDate": "..."
        }
      ]
    }
  ]
}
```

---

## Frontend changes

### `ObjectiveCard.tsx`

When adding or editing a Key Result, show date inputs for `startDate` and `endDate` alongside title, target, and unit.

### `KeyResultRow.tsx`

- Show the KR date range under the title.
- Render linked task cards in a compact list under the progress bar.
- Each task shows: title + status badge.
- Add a “+ Task” button that opens the picker.
- Clicking a task opens `CardDetailModal` for that card.

### New: `KeyResultTaskPicker.tsx`

Small modal/picker:
1. Choose action: create on existing board/list, or create new board.
2. Existing board path: pick board → pick list → input task title → save.
3. New board path: input board name → input list name (default "To Do") → input task title → save.

### `okrStore.ts`

Add action:
```ts
addKeyResultTask: (
  objectiveId: string,
  krId: string,
  input: CreateKeyResultTaskInput
) => Promise<Card>
```

Optimistically add the card to the KR’s linked cards in the store, then refetch on success or rollback on error.

### `lib/api/okrs.ts`

- Update `KeyResult`, `CreateKeyResultInput`, `UpdateKeyResultInput` types to include `startDate` and `endDate`.
- Add `addKeyResultTask(objectiveId, krId, input)` API helper.

---

## Status sync behavior

- The OKR page fetches objectives with linked cards included.
- Card status changes happen through the taskboard (`PATCH /api/cards/[cardId]`).
- The next OKR page load or store refetch shows the updated status.
- For near-real-time updates, the existing socket `broadcastToBoard` mechanism already emits card changes; the OKR page can listen to the relevant board rooms and refetch when a linked card changes.

---

## Validation and error handling

- Reject task creation if the target board/list is outside the KR’s project.
- Return `400` for invalid dates.
- Return `404` if the Key Result does not exist.
- Return `403` if the caller cannot access the project.
- Wrap board/list/card creation in a Prisma transaction so partial creation cannot happen.

---

## Testing plan

- Unit tests for date validation in the KR create/update routes.
- API tests for `POST .../key-results/[krId]/cards`:
  - creating on existing board/list
  - creating a new board + list
  - rejection when board is in a different project
  - rejection when dates are invalid
- Frontend smoke test: picker opens, creates task, task appears under KR.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Creating cards from OKR page bypasses taskboard auth | Reuse `getSession()` and project/board access checks. |
| Status shown on OKR page becomes stale | Include linked cards in OKR fetch; optionally listen to socket updates. |
| Date inputs behave differently across browsers | Use native date inputs plus server-side validation. |
| New board default list name clashes | If a list with the chosen name exists, use it instead of creating a duplicate. |
| CardKeyResult duplicate links | Use `connectOrCreate` or upsert semantics. |
