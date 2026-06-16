# Card ↔ OKR Linking Design Spec

## Goal

Let any card on a board contribute progress to one or more Key Results. Users can link/unlink cards to KRs from the card detail panel. A linked card’s progress automatically rolls up into the KR’s `current` value using a clear, deterministic rule, so OKR progress reflects actual delivery work without manual double-entry.

## Scope

### In scope

- Many-to-many relation between `Card` and `KeyResult` with a `weight` column (default 1.0).
- Card detail UI to search/select/unlink KRs within the same project.
- KR `current` derived from linked cards based on `Card.status` and `Card.progress`:
  - `done` or `completedAt` set → 100%
  - `blocked` → 0%
  - everything else → `Card.progress`%
- KR `current` is recomputed on card changes via Prisma transactions in the card PATCH endpoint and exposed through existing KR PATCH / list endpoints.
- Read-only badge on `KanbanCard` showing linked KR count and overall completion.
- Read-only panel on `/okrs` ObjectiveCard listing linked cards and their contribution.

### Out of scope

- Cross-project linking (KRs and cards must belong to the same project).
- Per-card manual contribution override.
- Historical audit / changelog of KR values.
- Notifications triggered by KR progress changes.
- Back-sync from KR to card (KR progress does not update cards).

## Architecture

### Data model

Add one join table:

```prisma
model CardKeyResult {
  cardId      String
  keyResultId String
  weight      Float  @default(1)
  createdAt   DateTime @default(now())

  card      Card      @relation(fields: [cardId], references: [id], onDelete: Cascade)
  keyResult KeyResult @relation(fields: [keyResultId], references: [id], onDelete: Cascade)

  @@id([cardId, keyResultId])
  @@index([keyResultId])
  @@index([cardId])
}
```

Add `keyResults CardKeyResult[]` to the `Card` model and `cards CardKeyResult[]` to the `KeyResult` model.

### Derived progress rule

```typescript
function cardContribution(card: Card): number {
  if (card.status === 'done' || card.completedAt) return 1;
  if (card.status === 'blocked') return 0;
  return Math.max(0, Math.min(1, card.progress / 100));
}
```

For each linked KR, recompute:

```typescript
kr.current = sum(link.weight * cardContribution(link.card)) / sum(link.weight) * kr.target
```

If the KR has no linked cards, `current` is left unchanged (manual mode). If links exist, the computed value overrides `current`.

### API surface

1. `GET /api/projects/[projectId]/key-results` — list all KRs in a project for the picker.
2. `POST /api/cards/[cardId]/key-results` — link card to KR (`{ keyResultId, weight? }`).
3. `DELETE /api/cards/[cardId]/key-results/[keyResultId]` — unlink.
4. `PATCH /api/cards/[cardId]` — existing route extended to recompute linked KR `current` values after any update.
5. `GET /api/cards/[cardId]` — include `keyResults` with nested KR.
6. `GET /api/okrs` and `GET /api/okrs/[objectiveId]` — include linked `cards` count (read-only).

### UI components

- `CardKeyResultLinker` (new, in card detail): searchable list of project KRs, add/remove, show contribution preview.
- `KanbanCard` (modified): small KR badge if `card.keyResults.length > 0`.
- `ObjectiveCard` / `KeyResultRow` (modified): show linked-card count and a hover list.

### Error handling

- 400 if linking a card and KR from different projects.
- 404 if KR or card does not exist.
- 409 if link already exists (POST returns 200/409 gracefully).
- Recompute failures leave DB in previous valid state (transaction rollback).

### Testing

- Unit tests for `cardContribution` and `recomputeKrCurrent` pure helpers.
- API tests for link/unlink and recomputation on status/progress change.
- Build + typecheck pass.

## Design decisions

1. **Weight default 1.0**: simple to understand; no UI for editing weight in MVP.
2. **Same-project constraint**: keeps ownership and permissions simple; avoids cross-project confusion.
3. **Manual fallback when no links**: existing KRs keep working until cards are attached.
4. **Recompute in card PATCH only**: cards change far more often than KRs; this is the cheapest place to keep values consistent.
5. **Done via status OR completedAt**: robust against users who mark done either way.

## Risks / follow-ups

- Large projects with many linked cards could make card PATCH slower. If observed, move recomputation to a background queue.
- Users may want per-card fixed contribution (e.g., a card is worth 5 users regardless of progress). Add an optional `fixedValue` column on `CardKeyResult` later.
