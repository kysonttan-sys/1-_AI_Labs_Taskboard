# Plan: Project-level Gantt chart

## Goal
As a Project Manager, I want to open a project and see a single Gantt chart that shows every task/objective/event across **all boards in that project**, without having to enter each board individually.

## Current state
- The only Gantt view is inside `/calendar`, which renders `<GanttChart objectives={objectives} />`.
- `GanttChart` reads all cards from `boardStore.lists` and then filters by `activeBoardId`. If the user last visited a single board, the calendar Gantt is effectively scoped to that board only.
- The project detail page (`/projects/[projectId]`) already has **Boards** and **OKRs** tabs, but no Gantt tab.

## Proposed implementation

### 1. Add a new route
Create `src/app/(dashboard)/projects/[projectId]/gantt/page.tsx`.

It will:
- Read `projectId` from URL params.
- Fetch project boards and load full card data for every board in the project into `boardStore.lists`.
- Fetch objectives and filter to the current project.
- Render `<GanttChart objectives={projectObjectives} boardIds={projectBoardIds} />`.

### 2. Extend `boardStore.ts`
Add `fetchProjectBoardsData: (projectId: string) => Promise<void>` that:
- Calls `/api/projects/${projectId}/boards` to get the project's boards and list IDs.
- Calls `/api/boards/${boardId}` for each board to load lists + cards + relations.
- Sets `boardStore.lists` to the merged result.

This is an N+1 fetch pattern (one board list call + N board-detail calls). It matches the existing `fetchAllBoardsData` implementation and is acceptable for typical project sizes. We can optimize later with a dedicated endpoint if needed.

### 3. Extend `GanttChart.tsx`
Add an optional prop `boardIds?: string[]`.

Card filtering logic changes from:
```ts
const filtered = activeBoardId
  ? allCards.filter((c) => c.boardId === activeBoardId)
  : allCards;
```
to:
```ts
const filtered = boardIds?.length
  ? allCards.filter((c) => boardIds.includes(c.boardId))
  : activeBoardId
    ? allCards.filter((c) => c.boardId === activeBoardId)
    : allCards;
```

This keeps the existing `/calendar` behavior unchanged while allowing explicit project scoping.

### 4. Add a Gantt tab to the project detail page
In `src/app/(dashboard)/projects/[projectId]/page.tsx`:
- Add a third tab **Gantt** next to **Boards** and **OKRs**, using the `BarChart3` icon.
- Clicking the tab navigates to `/projects/${projectId}/gantt`.
- (Optional) Keep local `activeTab` state in sync when the tab is active.

### 5. Navigation / routing check
- The route will be available at `/projects/[projectId]/gantt`.
- The existing dashboard layout (`(dashboard)/layout.tsx`) with Sidebar + Topbar is automatically applied.
- The project detail page’s “Back to projects” link still works.

## Out of scope / future work
- A global Gantt view across **all projects**. This can reuse the same component later with a wider `boardIds` array.
- Server-side project-scoped card API. Not needed for the first version; the existing per-board API is sufficient.
- Drag-and-drop interactions already work via the existing `updateCard` / `updateObjective` store methods.

## Verification
- `npx tsc --noEmit` passes.
- `npm run build` completes.
- Smoke test: open a project with multiple boards, click the **Gantt** tab, verify cards from all project boards appear.
