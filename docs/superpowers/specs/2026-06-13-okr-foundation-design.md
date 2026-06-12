# OKR Foundation — Design Spec

**Date:** 2026-06-13
**Status:** Awaiting user review
**Scope:** OKR data model + CRUD UI. Sub-projects #2 (card linking), #3 (public API), #4 (PM dashboard), #5 (fine-grained permissions) are explicitly out of scope.

## Goal

Add Objectives & Key Results (OKRs) to Taskboard as a first-class feature. A project manager can create objectives, attach numeric key results, and update their progress over a custom date range — all in a dedicated `/okrs` dashboard page. This is the foundation; later sub-projects layer on card-linking, public API, and dashboards.

## User-facing value

After this lands, a logged-in user can:
1. Visit `/okrs` and see a list of objectives, each with a title, date range, description, and progress bar.
2. Create a new objective with title, description, start date, and end date.
3. Add key results to an objective: title, target value, current value, optional unit.
4. Update a key result's current value inline (no save button).
5. Edit or delete objectives and key results.
6. See the app's existing T-mark logo in the sidebar plus a new "OKRs" navigation entry.

## Decisions Locked In (from brainstorming)

- **KR model:** Numeric. Each KR has `title`, `target`, `current`, optional `unit`. Progress = `current / target` capped at 100%.
- **Period model:** Custom date range per objective (`startDate`, `endDate`).
- **Permissions:** Org-wide, any logged-in user can edit/delete any OKR. Mirrors the rest of the app today.
- **UI location:** Dedicated `/okrs` page in the `(dashboard)` route group.
- **Approach:** Full CRUD (Approach Y). Not minimal, not dashboard-with-history. Just enough to be useful.

## Data Model

Three new Prisma models. Conventions match the existing schema: `cuid()` IDs, ISO timestamps, `position` for ordering, cascade-delete from parents, `String` for enums (no Prisma enums), `Float` where fractional values matter.

```prisma
model Objective {
  id          String    @id @default(cuid())
  title       String
  description String?
  startDate   DateTime
  endDate     DateTime
  position    Int       @default(0)
  ownerId     String?
  owner       User?     @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  keyResults  KeyResult[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([position])
  @@index([endDate])
}

model KeyResult {
  id          String    @id @default(cuid())
  title       String
  target      Float
  current     Float     @default(0)
  unit        String?
  position    Int       @default(0)
  objectiveId String
  objective   Objective @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([objectiveId])
  @@index([position])
}
```

**Backfill note:** `User` already has many relations, so we add `objectives Objective[]` to it. This is a non-destructive schema change — additive only.

**Rationale for nullable `ownerId`:** the auth model is "any logged-in user can edit," but we still want to record who created each objective. Making `ownerId` nullable with `onDelete: SetNull` lets us layer per-objective permissions later without a migration.

**No `status` field on either model:** "on-track / at-risk / off-track" needs a time-vs-progress model we don't have yet. Deferred to a later sub-project.

**`Float` for `target` / `current`:** lets a user measure things like "1.5M users" or "$12.5k" without a schema change.

**`unit` is a free-form string:** different objectives have wildly different units ("%", "users", "$k", "deploys"). The UI shows it as a suffix on the input.

## API Surface

All routes piggyback on the existing PIN-based session cookie auth. The plan will verify the exact auth helper used by existing routes and copy the pattern.

```
GET    /api/okrs                                  → list all objectives (with keyResults)
POST   /api/okrs                                  → create objective
GET    /api/okrs/[objectiveId]                    → get one objective (with keyResults)
PATCH  /api/okrs/[objectiveId]                    → update objective
DELETE /api/okrs/[objectiveId]                    → delete objective (cascade-deletes KRs)
POST   /api/okrs/[objectiveId]/key-results        → create KR under this objective
PATCH  /api/okrs/[objectiveId]/key-results/[krId] → update KR
DELETE /api/okrs/[objectiveId]/key-results/[krId] → delete KR
```

**Response shapes:**
- `GET /api/okrs` returns an array of objectives, each with `keyResults: KeyResult[]` (nested). No pagination — total expected to be small (5-20).
- Single-resource endpoints (`GET /api/okrs/[id]`) return the objective with KRs nested.
- Error shape: `{ error: string }` for 4xx. Plain JSON for 2xx. Matches existing routes.

**Validation (server-side):**
- `title` required, non-empty, max 200 chars.
- `description` optional, max 2000 chars.
- `endDate > startDate` (rejected with `400`).
- `target > 0` for KRs.
- `current >= 0` for KRs (no upper bound — over-achievement allowed).
- `unit` optional, max 32 chars if present.

**Out of scope (deferred):** public API keys, bulk import, KR reorder, per-objective permissions, status field.

## File Layout

```
src/app/(dashboard)/okrs/
  page.tsx                        # server component, fetches initial data
  ObjectiveList.tsx               # client component, list + create button
  ObjectiveCard.tsx               # client component, single objective with KRs
  KeyResultRow.tsx                # client component, single KR with progress bar + edit
  ObjectiveCreateModal.tsx        # client component, create/edit form
src/features/okrs/
  okrStore.ts                     # Zustand store (mirrors boardStore pattern)
  progress.ts                     # pure functions: pct(), formatValue()
  progress.test.ts                # unit tests for progress.ts
src/lib/api/okrs.ts               # typed fetch helpers
src/app/api/okrs/
  route.ts                        # GET, POST (+ .test.ts)
  [objectiveId]/
    route.ts                      # GET, PATCH, DELETE (+ .test.ts)
    key-results/
      route.ts                    # POST (+ .test.ts)
      [krId]/
        route.ts                  # PATCH, DELETE (+ .test.ts)
prisma/
  schema.prisma                   # add 3 models
  migrations/<ts>_add_okr_models/ # generated by `prisma migrate dev`
  seed.ts                         # add 3 sample objectives with 2-3 KRs each
src/components/layout/Sidebar.tsx # add OKRs nav entry
src/lib/db/client.ts              # no change unless Prisma client needs regen
```

**Modified files:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/components/layout/Sidebar.tsx`. Possibly `src/generated/prisma/*` (regenerated by Prisma).

**New files:** all the ones listed above.

## Components & Data Flow

### `okrStore.ts` (Zustand)

State:
```typescript
interface OkrState {
  objectives: ObjectiveWithKRs[];
  activeObjectiveId: string | null;
  loading: boolean;
  error: string | null;
  fetchObjectives: () => Promise<void>;
  createObjective: (input: CreateObjectiveInput) => Promise<Objective>;
  updateObjective: (id: string, input: UpdateObjectiveInput) => Promise<Objective>;
  deleteObjective: (id: string) => Promise<void>;
  addKeyResult: (objectiveId: string, input: CreateKeyResultInput) => Promise<KeyResult>;
  updateKeyResult: (objectiveId: string, krId: string, input: UpdateKeyResultInput) => Promise<KeyResult>;
  deleteKeyResult: (objectiveId: string, krId: string) => Promise<void>;
}
```

All writes go through `/api/okrs/*` and update local state from the response. Optimistic update with rollback for the high-frequency "update current" path.

### `progress.ts`

```typescript
export function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

export function formatValue(current: number, target: number, unit?: string | null): string {
  if (unit) return `${current} / ${target} ${unit}`;
  return `${current} / ${target}`;
}
```

### `page.tsx` (server component)

Calls `prisma.objective.findMany({ orderBy: [{ position: 'asc' }, { endDate: 'asc' }], include: { keyResults: { orderBy: { position: 'asc' } } } })` directly. No API round-trip on first load. Passes data as a prop to `<ObjectiveList>`. Matches the pattern used by other dashboard pages (to verify in plan).

### `ObjectiveList.tsx`

Receives `initialObjectives` as a prop. On mount, calls `okrStore.fetchObjectives()` to sync client state. Renders the list. "+ Objective" button at top opens `ObjectiveCreateModal` (create mode).

### `ObjectiveCard.tsx`

Renders one objective: title, date range ("Jan 1 – Mar 31, 2026"), description, overall progress bar (avg of KR pcts, computed via `pct` and `Array.reduce`), and a "+ Key Result" button. Edit and delete buttons in the header. Edit re-opens `ObjectiveCreateModal` in edit mode.

### `KeyResultRow.tsx`

Renders one KR: title, current input, "/", target input, unit suffix, progress bar between them, delete button. Updating `current` calls `updateKeyResult` immediately (no save button). Optimistic update with rollback on error.

### `ObjectiveCreateModal.tsx`

Form with title, description, startDate, endDate. Validates `endDate > startDate` client-side. Calls `createObjective` or `updateObjective` based on mode. Closes on success.

### Sidebar entry

In `src/components/layout/Sidebar.tsx`, add a `<Link href="/okrs">` next to the existing Settings link, with the `Target` icon from `lucide-react`. Matches the existing button pattern.

## Error Handling

- **API errors** follow `{ error: string }` shape with 400/401/404/500 status codes.
- **Date validation** is done both client-side (immediate feedback) and server-side (source of truth).
- **Zustand store** exposes `error` state on every action; the components display it inline. No global toast system — the project doesn't have one.
- **Optimistic update with rollback** for the high-frequency "update current" path. The UI shows the new value immediately; if the API call fails, the value reverts and an error is shown.
- **First-load errors** (server component fetch fails) throw to the nearest `error.tsx`. The project already has `src/app/(dashboard)/error.tsx`.

## Testing Strategy

**Unit tests** (Vitest, matching whatever the project uses — verify in plan):
- `src/features/okrs/progress.test.ts`:
  - `pct(0, 10)` → 0
  - `pct(5, 10)` → 50
  - `pct(10, 10)` → 100
  - `pct(15, 10)` → 100 (capped)
  - `pct(0, 0)` → 0 (no division by zero)
  - `pct(-1, 10)` → 0 (negative current → 0%)
  - `formatValue(3, 10, 'users')` → `"3 / 10 users"`
  - `formatValue(3, 10)` → `"3 / 10"`
  - `formatValue(3, 10, '%')` → `"3% / 10%"` (units that are themselves units render inline; actually we keep this simple — see spec note below)

**Spec note on `formatValue`:** simpler-than-discussed — just `${current} / ${target} ${unit || ''}`. So `formatValue(3, 10, 'users')` → `"3 / 10 users"`, `formatValue(3, 10)` → `"3 / 10 "`. The plan tests will assert exact strings and we can refine formatting later.

**API integration tests** (Vitest hitting a real or test Postgres — match the project's existing pattern):
- `src/app/api/okrs/route.test.ts`:
  - `GET` returns empty list, then returns 1 after create
  - `POST` with missing title → `400`
  - `POST` with `endDate < startDate` → `400`
  - `POST` happy path → `201` with the created objective
- `src/app/api/okrs/[objectiveId]/route.test.ts`:
  - `PATCH` updates title, returns updated objective
  - `DELETE` cascades to keyResults
- `src/app/api/okrs/[objectiveId]/key-results/route.test.ts`:
  - `POST` happy path → `201`
- `src/app/api/okrs/[objectiveId]/key-results/[krId]/route.test.ts`:
  - `PATCH` updates `current` only (other fields unchanged)
  - `PATCH` with `current < 0` → `400`
  - `DELETE` removes the KR

**UI tests:** skipped for this PR. The project has no existing UI test setup. The store and API are tested; the components are thin pass-throughs. (Verified in the plan: if the project does have UI tests, we'll add a smoke test for the create flow.)

## Rollout

1. Fresh worktree on `feature/okr-foundation` branch (off `main`).
2. Commit 1: schema + migration + seed.
3. Commit 2: API routes with tests (TDD).
4. Commit 3: `okrStore` + pure `progress.ts` helpers with tests (TDD).
5. Commit 4: UI components + sidebar entry.
6. Manual smoke test (user): `npm run dev` (assumes Postgres running), navigate to `/okrs`, create, add KRs, update progress, delete.
7. Open a PR.

**Commits 2 and 3 are TDD:** test first, fail, implement, pass. The plan will follow this strictly.

## Risk

- **The app's existing test setup** is something to verify. If the project has no test runner configured, we'll need to add Vitest as a dev dep in a separate setup commit. The plan verifies this first.
- **Migration on a populated DB.** The user's existing local DB has the seed data from `prisma/seed.ts`. The new migration adds three tables — non-destructive. Safe.
- **Auth pattern.** I need to verify exactly how the existing routes authenticate (server-side session check, middleware, or none) and follow it. The plan verifies this and copies the pattern.
- **Prisma client regen.** Adding three models means the generated client (`src/generated/prisma/*`) needs to be regenerated. The `postinstall` script already runs `prisma generate`, so this happens automatically on `npm install`. The plan will call this out.

## Out of Scope (deferred)

These are explicitly **not** part of this work and will be separate sub-projects with their own specs:

1. **Task ↔ KR linking** (sub-project #2). KR progress auto-derived from linked cards.
2. **Public API keys / external API** (sub-project #3). API key management, rate limiting, OpenAPI spec.
3. **PM dashboard** (sub-project #4). Cross-objective rollup, status widgets, on-track/at-risk indicators.
4. **Per-team / per-user OKR scoping** (sub-project #5). Multi-tenancy for OKRs.
5. **Status field** (on-track / at-risk / off-track auto-computation). Needs a time-vs-progress model.
6. **History / audit log** for OKR updates.
7. **Drag-to-reorder UI** for objectives and KRs. The `position` column exists; the UI does not.
8. **Notifications** when KRs are updated or approach their target.
9. **Custom OKR templates** or a "duplicate from previous period" workflow.

## Open Questions Resolved During Spec

- **Auth pattern:** unknown until plan execution. Plan will copy existing pattern.
- **Test runner:** unknown until plan execution. Plan will use whatever the project uses; default to Vitest.
- **Server-component initial fetch pattern:** unknown until plan execution. Plan will copy pattern from `/board` page.
- **Date input UX:** native `<input type="date">` for v1. Can swap to a date picker later. Captured as a YAGNI note in the plan.
- **Sidebar entry icon:** `Target` from `lucide-react`. Final call during plan execution if `Target` doesn't exist; will pick another (`Crosshair`, `Goal`).
