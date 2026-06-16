# Code Organization Design Spec

## Goal

Improve maintainability of the Taskboard codebase by consolidating duplicated patterns, introducing barrel exports for heavily-imported modules, and splitting oversized stores/components into focused, colocated files.

## Scope

### In scope

- Add barrel `index.ts` exports for:
  - `src/components/board/*` (components consumed by board pages)
  - `src/features/*/*Store.ts` (Zustand stores consumed across the app)
  - `src/lib/utils/*` (small shared utilities)
- Extract reusable helper functions from `src/features/meeting/meetingStore.ts` into `src/features/meeting/webrtc.ts`:
  - `getIceServers`
  - `bufferedCandidates` + candidate flushing helpers
  - `createOfferForPeer`
  - `handleRemoteOffer`
- Extract `sortCards` from `src/components/board/KanbanColumn.tsx` into `src/lib/utils/board.ts` so the sort order is shared and unit-testable.
- Move inline `AddCardInput` component in `KanbanColumn.tsx` to `src/components/board/AddCardInput.tsx`.
- Reduce `CardDetailModal.tsx` size by extracting checklist and comment sections into `src/components/board/CardChecklist.tsx` and `src/components/board/CardComments.tsx`.

### Out of scope

- Rewriting stores to a different state library.
- Moving API routes to a different structure.
- Full feature-based folder rearchitecture.
- Adding comprehensive tests for extracted helpers (existing test patterns remain).

## Architecture

### Barrel exports

Each barrel file re-exports public members only. Keep imports stable so consumers can opt-in gradually:

```ts
// src/components/board/index.ts
export { default as KanbanBoard } from './KanbanBoard';
export { default as KanbanCard } from './KanbanCard';
export { default as KanbanColumn } from './KanbanColumn';
export { default as CardDetailModal } from './CardDetailModal';
export { default as CardDependencyLinker } from './CardDependencyLinker';
export { default as CardKeyResultLinker } from './CardKeyResultLinker';
export { default as BoardFilters } from './BoardFilters';
export { default as AddCardInput } from './AddCardInput';
```

Store barrels follow the same pattern.

### WebRTC helpers

Move pure peer-connection logic out of the store so `meetingStore.ts` focuses on state and actions:

```ts
// src/features/meeting/webrtc.ts
export function getIceServers(turnServers: RTCIceServer[] | null): RTCIceServer[];
export function flushBufferedCandidates(pc: RTCPeerConnection): Promise<void>;
export function bufferCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): void;
export async function createOfferForPeer(...): Promise<void>;
export async function handleRemoteOffer(...): Promise<void>;
```

These helpers receive the socket and store-state callbacks they need as arguments, avoiding direct Zustand imports where possible.

### Sort helper

```ts
// src/lib/utils/board.ts
export function sortCards(cards: Card[], isDoneColumn: boolean): Card[];
```

### Smaller components

- `AddCardInput`: self-contained input for adding a card to a list.
- `CardChecklist`: renders and manages checklist items inside the card modal.
- `CardComments`: renders and posts comments inside the card modal.

## Error handling

- Keep all existing runtime behavior; changes are purely structural.
- Barrel files must not introduce circular imports.
- Type-check and build after each move.

## Testing

- `npx tsc --noEmit`
- `npm run build`
- Manual smoke test: board, card modal, checklist, comments, and meeting room still function.
