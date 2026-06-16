# Code Organization Implementation Plan

**Goal:** Improve maintainability by adding barrel exports, extracting oversized helpers, and splitting large components.

---

## Task 1: Add barrel exports

**Files:**
- Create: `src/components/board/index.ts`
- Create: `src/features/index.ts`
- Create: `src/lib/utils/index.ts`

### Step 1: Board component barrel

```ts
export { default as KanbanBoard } from './KanbanBoard';
export { default as KanbanCard } from './KanbanCard';
export { default as KanbanColumn } from './KanbanColumn';
export { default as CardDetailModal } from './CardDetailModal';
export { default as CardDependencyLinker } from './CardDependencyLinker';
export { default as CardKeyResultLinker } from './CardKeyResultLinker';
export { default as BoardFilters } from './BoardFilters';
export { default as AddCardInput } from './AddCardInput';
```

### Step 2: Feature store barrel

```ts
export { useAuthStore } from './auth/authStore';
export { useBoardStore } from './board/boardStore';
export { useCalendarStore } from './calendar/calendarStore';
export { useChatStore } from './chat/chatStore';
export { useMeetingStore } from './meeting/meetingStore';
export { useNotificationStore } from './notifications/notificationStore';
export { useOkrStore } from './okrs/okrStore';
export { useProjectStore } from './projects/projectStore';
```

### Step 3: Utility barrel

```ts
export { getInitials } from './initials';
export { getPriorityConfig } from './theme';
export { reorder } from './reorder';
export { sortCards } from './board';
```

### Step 4: Commit

```bash
git add src/components/board/index.ts src/features/index.ts src/lib/utils/index.ts
git commit -m "chore(organization): add barrel exports for components, stores, and utils

Adds index.ts re-exports for board components, feature stores, and
shared utilities to reduce import verbosity.

Refs: docs/superpowers/specs/2026-06-15-code-organization-design.md"
```

---

## Task 2: Extract reusable helpers

**Files:**
- Create: `src/lib/utils/board.ts`
- Create: `src/features/meeting/webrtc.ts`
- Modify: `src/components/board/KanbanColumn.tsx`
- Modify: `src/features/meeting/meetingStore.ts`

### Step 1: Move sortCards to lib/utils/board.ts

Copy the `sortCards` function and `PRIORITY_ORDER` constant into `src/lib/utils/board.ts` and export `sortCards`. Import it from there in `KanbanColumn.tsx`.

### Step 2: Extract AddCardInput

Move the inline `AddCardInput` component from `KanbanColumn.tsx` to `src/components/board/AddCardInput.tsx` and export it. Update `KanbanColumn.tsx` to import it.

### Step 3: Move WebRTC helpers to webrtc.ts

Extract from `meetingStore.ts`:
- `getIceServers`
- `bufferedCandidates` map + `flushBufferedCandidates` + `bufferCandidate`
- `createOfferForPeer`
- `handleRemoteOffer`

Import them back into `meetingStore.ts` and remove the duplicate definitions.

### Step 4: Commit

```bash
git add src/lib/utils/board.ts src/components/board/AddCardInput.tsx \
  src/components/board/KanbanColumn.tsx src/features/meeting/webrtc.ts \
  src/features/meeting/meetingStore.ts
git commit -m "refactor(organization): extract helpers and split KanbanColumn AddCardInput

- Move sortCards to lib/utils/board.ts
- Extract AddCardInput into its own component
- Move WebRTC peer connection logic to meeting/webrtc.ts

Refs: docs/superpowers/specs/2026-06-15-code-organization-design.md"
```

---

## Task 3: Split CardDetailModal

**Files:**
- Create: `src/components/board/CardChecklist.tsx`
- Create: `src/components/board/CardComments.tsx`
- Modify: `src/components/board/CardDetailModal.tsx`

### Step 1: Extract checklist section

Move checklist rendering, add/update/toggle/delete handlers into `CardChecklist.tsx`. Accept props:
- `cardId`, `checklist`, `onChange` (callback to refresh card data).

### Step 2: Extract comments section

Move comment list and add form into `CardComments.tsx`. Accept props:
- `cardId`, `comments`, `onChange`.

### Step 3: Update CardDetailModal

Replace inline checklist and comments blocks with the new components. Keep modal header, tabs, fields, and OKR/dependency linkers.

### Step 4: Commit

```bash
git add src/components/board/CardChecklist.tsx src/components/board/CardComments.tsx \
  src/components/board/CardDetailModal.tsx
git commit -m "refactor(organization): split CardDetailModal into checklist and comments components

Extract CardChecklist and CardComments to reduce modal size and
improve testability.

Refs: docs/superpowers/specs/2026-06-15-code-organization-design.md"
```

---

## Task 4: Verify and push

```bash
npx tsc --noEmit
npm run build
git push origin main
```
