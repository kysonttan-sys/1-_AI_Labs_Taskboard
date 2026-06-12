# Rebrand to Taskboard — Design Spec

**Date:** 2026-06-13
**Status:** Draft (awaiting user review)
**Scope:** Approach A — text normalization + favicon swap

## Goal

Normalize the user-facing brand from `TaskBoard` (camel-case) to `Taskboard` (one word, lowercase 'b') and replace the default Next.js favicon with a Taskboard mark. Keep the existing `public/logo.png` (purple T-mark) as the logo asset.

## Motivation

The user reported the brand should be "just Taskboard, remove the 1%". Investigation found:

- **"1%" is not in the rendered app.** It lives only in the GitHub repo name (`1-_AI_Labs_Taskboard`) and the local clone folder name. The clone folder is out of scope for this work (renaming the working directory mid-session risks breaking open file references).
- **The on-screen brand is already "TaskBoard"** in 5 user-facing locations, with the literal camel-case spelling inconsistent with `package.json` (`"name": "taskboard"`).
- **The favicon is the default Next.js "N"**, which doesn't match the purple T-mark used in the sidebar/topbar. This is a visible inconsistency that the user did not see until now.

## In Scope

### 1. String normalization (7 edits)

Replace `TaskBoard` with `Taskboard` in these exact locations:

| File | Line | From | To |
|------|------|------|------|
| `src/app/layout.tsx` | 5 | `title: 'TaskBoard',` | `title: 'Taskboard',` |
| `src/app/(auth)/login/page.tsx` | 53 | `>TaskBoard</h1>` | `>Taskboard</h1>` |
| `src/app/(auth)/register/page.tsx` | 81 | `Join your team on TaskBoard` | `Join your team on Taskboard` |
| `src/app/(auth)/setup/page.tsx` | 90 | `Welcome to TaskBoard` | `Welcome to Taskboard` |
| `src/components/layout/Sidebar.tsx` | 108 | `TaskBoard` | `Taskboard` |
| `src/components/layout/Topbar.tsx` | 99 | `'TaskBoard'` | `'Taskboard'` |
| `src/features/ai/prompts.ts` | 1 | `... called TaskBoard.` | `... called Taskboard.` |

These are the only 7 user-facing (or AI-prompt-visible) occurrences of the brand string in the codebase. The literal "1%" appears in the codebase only inside Superpowers skill instructions ("even a 1% chance a skill applies...") which is methodology, not branding, and is not in scope.

### 2. Favicon replacement

Replace `src/app/favicon.ico` with a multi-size `.ico` generated from `public/logo.png` (the existing purple T-mark). Sizes packed: 16×16, 32×32, 48×48.

Mechanism:
- Add `to-ico` as a dev dependency (~1KB, MIT, no transitive deps).
- Add a one-time build script `scripts/build-favicon.mjs` that reads `public/logo.png` and writes `src/app/favicon.ico`.
- Run the script once. Commit the resulting `favicon.ico`. Delete the script and the `to-ico` dependency after the `.ico` is produced (the script is one-shot, not part of the build pipeline).
- Next.js 14's app router auto-serves `src/app/favicon.ico` — no layout metadata changes needed.

The favicon will then visually match the sidebar/topbar T-mark.

## Out of Scope (Follow-up Items)

These are explicitly **not** part of this work. The spec notes them so they're not forgotten:

1. **Rename the local clone folder** from `D:\Task Management System\1-_AI_Labs_Taskboard` to `D:\Task Management System\taskboard`. This is a manual `mv` after the current session closes (renaming mid-session breaks open file handles).
2. **Rename the GitHub repo** from `1-_AI_Labs_Taskboard` to `taskboard`. Done on github.com (Settings → General → Rename repository). After the rename, update the local `origin` URL: `git remote set-url origin https://github.com/kysonttan-sys/taskboard.git`.
3. **Replace `public/logo.png`** with a custom Taskboard wordmark/logo image. User explicitly chose to keep the existing T-mark for now.
4. **Update the README**, which is the default Next.js boilerplate. It does not mention the brand and is not user-facing in the app, so no change.
5. **Anything in `node_modules/`, `.next/`, or `superpower/`** (vendored or generated content).

## Architecture

No architectural changes. This is a string-replacement + asset-replacement task. No new components, no new state, no new routes.

## Data Flow

N/A — no data flow changes. The brand string is purely presentational; no API responses, database fields, or env vars reference it.

## Error Handling

N/A — no error paths introduced.

## Testing

Per the project's `CLAUDE.md`, TDD applies to "any feature or bugfix." This task is neither — it is a presentational rebrand of UI strings and a static binary asset. Writing tests for a 7-line string change would violate YAGNI.

Manual verification checklist (the implementation will complete each step):

1. `git grep -n "TaskBoard" src/` returns no results.
2. `git grep -n "1_AI_Labs\|AI Labs" src/` returns no results (defensive — confirms no missed occurrences).
3. `npm run dev` starts the server with no console errors.
4. Browser tab title shows "Taskboard" on `/login`, `/register`, `/setup`, and inside the dashboard (`/board`).
5. Browser tab favicon renders the purple T-mark (no 404 in DevTools → Network; visually a "T" in the tab).
6. Sidebar shows "Taskboard" next to the T-mark when expanded; shows only the T-mark when collapsed.
7. Topbar shows the active board name when one is selected, or "Taskboard" as the fallback.
8. `git status` shows only the intended files modified at the end: 7 `.tsx`/`.ts` source files, 1 `.ico` file (the new `src/app/favicon.ico`), and 1 spec doc. The `to-ico` dependency and `scripts/build-favicon.mjs` are intermediate-only and must be removed before the final commit (see Rollout step 4).
9. `npm run lint` reports no new issues.

## Risk

- **Favicon script depends on `to-ico`.** If the npm registry is down or the package is yanked, the favicon build fails. **Mitigation:** if `npm install` of `to-ico` fails, fall back to Option F2 (delete `src/app/favicon.ico`, add `icons: { icon: '/logo.png' }` to the `metadata` export in `src/app/layout.tsx`; browsers will downscale the PNG).
- **Renaming the local folder mid-session breaks open file references.** The implementation will note the rename as a follow-up, not perform it.
- **The existing `src/app/favicon.ico` may be the default Next.js favicon.** Replacing it changes the visual identity in browser tabs on first deploy. The user approved this when selecting Approach A.

## Rollout

1. Create a fresh git worktree off the default branch (`main` or `master`, whatever the upstream uses) on a `rebrand/taskboard` branch.
2. Apply the 7 string edits in a working commit (kept locally; will be amended).
3. Add `to-ico` dev dep, add `scripts/build-favicon.mjs`, run it to produce the new `src/app/favicon.ico`.
4. `git rm scripts/build-favicon.mjs`, `npm uninstall to-ico`, amend the working commit so the final rebrand commit contains **only**: 7 source-file edits, 1 new `src/app/favicon.ico`, 1 spec doc. No temporary script, no transient dep.
5. Run the manual verification checklist.
6. Push branch + open a PR (or merge to main, depending on user's preference).

## Decision Log

- **Approach A vs B vs C:** User selected A (text + favicon only). Folder and repo renames deferred.
- **Logo asset strategy:** User selected "Keep existing T-mark" — `public/logo.png` stays; favicon generated from it.
- **Casing:** User selected "Taskboard" (one word, lowercase 'b').
- **Favicon build strategy:** F1 (generate `.ico` from PNG) is recommended. F2 (Next.js metadata + existing PNG) is the fallback.
