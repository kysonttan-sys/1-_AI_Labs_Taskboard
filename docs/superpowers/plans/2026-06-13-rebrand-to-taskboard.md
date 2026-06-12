# Rebrand to Taskboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the user-facing brand string from `TaskBoard` to `Taskboard` in 7 source files and replace the default Next.js favicon with a Taskboard mark generated from the existing `public/logo.png`.

**Architecture:** Pure presentational rebrand. No new components, no new state, no new routes. Two commits on a `rebrand/taskboard` worktree branch: (1) the 7 string edits, (2) the new `favicon.ico`. The favicon is produced by a one-shot Node script that uses `to-ico` to package `public/logo.png` into a multi-size `.ico`; the script and dependency are removed before the final commit.

**Tech Stack:** Next.js 14 (app router), TypeScript, Node.js, `to-ico` (dev dep, removed after use — packs PNG buffers into a multi-size .ico), `sharp` (dev dep, removed after use — resizes the source PNG to favicon target sizes). `to-ico` requires pre-sized PNG buffers as input, so `sharp` is needed to resize `public/logo.png` to 16/32/48 before packing.

---

## File Structure

**Files modified (string edits):**
- `src/app/layout.tsx` — page `<title>` (line 5)
- `src/app/(auth)/login/page.tsx` — login H1 (line 53)
- `src/app/(auth)/register/page.tsx` — register subtitle (line 81)
- `src/app/(auth)/setup/page.tsx` — setup H1 (line 90)
- `src/components/layout/Sidebar.tsx` — sidebar brand text (line 108)
- `src/components/layout/Topbar.tsx` — topbar fallback (line 99)
- `src/features/ai/prompts.ts` — AI system prompt (line 1)

**Files modified (binary asset):**
- `src/app/favicon.ico` — replaced with new multi-size .ico generated from `public/logo.png`

**Files created and immediately removed (one-shot tooling):**
- `scripts/build-favicon.mjs` — Node script that reads `public/logo.png` and writes `src/app/favicon.ico`
- `package.json` (devDependencies) — adds `sharp` and `to-ico` temporarily
- `package-lock.json` — updates from the temporary install; reverted in the final commit

**Files NOT touched (out of scope):**
- `public/logo.png` — kept as-is (user chose to keep the existing T-mark)
- `README.md` — default Next.js boilerplate, no brand mention
- `node_modules/`, `.next/`, `superpower/` — vendored/generated

---

## Task 1: Create the rebrand worktree

**Files:** None (worktree creation only)

- [ ] **Step 1: Check the current branch and verify clean tree**

Run:
```bash
cd "D:/Task Management System/1-_AI_Labs_Taskboard"
git status
git symbolic-ref --short HEAD
```
Expected: `On branch main` and `nothing to commit, working tree clean` (the spec doc commit is already in). Branch is `main`.

- [ ] **Step 2: Create a new worktree on a `rebrand/taskboard` branch**

Run:
```bash
cd "D:/Task Management System/1-_AI_Labs_Taskboard"
git worktree add ../taskboard-rebrand -b rebrand/taskboard
```
Expected: `Preparing worktree (new branch 'rebrand/taskboard')` then `HEAD is now at <hash>`. The new worktree lives at `D:\Task Management System\taskboard-rebrand`. The spec doc is NOT in this worktree (it lives on `main`); the new worktree branches off the commit before the spec — that's correct, the spec doesn't need to ride along with the rebrand commits.

- [ ] **Step 3: Verify the new worktree's clean state**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git status
git symbolic-ref --short HEAD
git log --oneline -1
```
Expected: `On branch rebrand/taskboard`, `nothing to commit, working tree clean`, last commit is `6bcc8cc fix: enable echo cancellation and noise suppression on walkie-talkie mic`.

- [ ] **Step 4: Set the working directory for all subsequent tasks**

From this point on, all file paths are relative to `D:\Task Management System\taskboard-rebrand`. **Do not edit files in the original `1-_AI_Labs_Taskboard` directory.**

---

## Task 2: Apply 7 string edits

**Files:**
- Modify: `src/app/layout.tsx:5`
- Modify: `src/app/(auth)/login/page.tsx:53`
- Modify: `src/app/(auth)/register/page.tsx:81`
- Modify: `src/app/(auth)/setup/page.tsx:90`
- Modify: `src/components/layout/Sidebar.tsx:108`
- Modify: `src/components/layout/Topbar.tsx:99`
- Modify: `src/features/ai/prompts.ts:1`

- [ ] **Step 1: Verify no `TaskBoard` or `1%` / `AI Labs` references exist in `src/` before editing (sanity check)**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git grep -n "TaskBoard" src/
git grep -n "1_AI_Labs\|AI Labs" src/
```
Expected: First command prints 7 lines (one per file). Second command prints nothing (the brand string is the only `TaskBoard` occurrence in `src/`; the "1% / AI Labs" patterns don't appear in user-facing code).

- [ ] **Step 2: Edit `src/app/layout.tsx`**

Open `src/app/layout.tsx`. Change line 5 from:
```typescript
  title: 'TaskBoard',
```
to:
```typescript
  title: 'Taskboard',
```

- [ ] **Step 3: Edit `src/app/(auth)/login/page.tsx`**

Open `src/app/(auth)/login/page.tsx`. Change line 53 from:
```tsx
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">TaskBoard</h1>
```
to:
```tsx
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Taskboard</h1>
```

- [ ] **Step 4: Edit `src/app/(auth)/register/page.tsx`**

Open `src/app/(auth)/register/page.tsx`. Change line 81 from:
```tsx
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Join your team on TaskBoard</p>
```
to:
```tsx
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Join your team on Taskboard</p>
```

- [ ] **Step 5: Edit `src/app/(auth)/setup/page.tsx`**

Open `src/app/(auth)/setup/page.tsx`. Change line 90 from:
```tsx
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Welcome to TaskBoard</h1>
```
to:
```tsx
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Welcome to Taskboard</h1>
```

- [ ] **Step 6: Edit `src/components/layout/Sidebar.tsx`**

Open `src/components/layout/Sidebar.tsx`. Change line 108 from:
```tsx
                TaskBoard
```
to:
```tsx
                Taskboard
```
(Three lines of context: the surrounding lines 107-109 are the `<span className="font-semibold ...">TaskBoard</span>` block.)

- [ ] **Step 7: Edit `src/components/layout/Topbar.tsx`**

Open `src/components/layout/Topbar.tsx`. Change line 99 from:
```tsx
            {activeBoard?.name || 'TaskBoard'}
```
to:
```tsx
            {activeBoard?.name || 'Taskboard'}
```

- [ ] **Step 8: Edit `src/features/ai/prompts.ts`**

Open `src/features/ai/prompts.ts`. Change line 1 from:
```typescript
export const CHAT_SYSTEM_PROMPT = `You are an AI project management assistant for a task management system called TaskBoard. You help teams manage their work by answering questions about tasks, providing insights, and suggesting actions.
```
to:
```typescript
export const CHAT_SYSTEM_PROMPT = `You are an AI project management assistant for a task management system called Taskboard. You help teams manage their work by answering questions about tasks, providing insights, and suggesting actions.
```

- [ ] **Step 9: Verify all 7 edits applied and nothing else changed**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git grep -n "TaskBoard" src/
git diff --stat src/
```
Expected:
- First command: prints nothing (no `TaskBoard` left in `src/`).
- Second command: prints 7 files changed, each with a 1-line addition and 1-line deletion.

- [ ] **Step 10: Verify no other 1% / AI Labs references leaked in**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git grep -n "1_AI_Labs\|AI Labs" src/
```
Expected: Prints nothing.

- [ ] **Step 11: Commit the string edits**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git add src/app/layout.tsx \
        "src/app/(auth)/login/page.tsx" \
        "src/app/(auth)/register/page.tsx" \
        "src/app/(auth)/setup/page.tsx" \
        src/components/layout/Sidebar.tsx \
        src/components/layout/Topbar.tsx \
        src/features/ai/prompts.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" \
    commit -m "rebrand: normalize visible brand string to Taskboard

Replace the camel-case TaskBoard with one-word Taskboard across
all user-facing surfaces (page title, auth pages, sidebar, topbar)
and the AI system prompt. The package.json name was already
taskboard; this aligns the rendered brand with that.

Refs: docs/superpowers/specs/2026-06-13-rebrand-to-taskboard-design.md"
```
Expected: `7 files changed, 7 insertions(+), 7 deletions(-)`.

---

## Task 3: Generate new favicon from logo.png

**Files:**
- Create (temporary): `scripts/build-favicon.mjs`
- Create (temporary): adds `sharp` and `to-ico` to `package.json` devDependencies
- Modify: `src/app/favicon.ico` (replaced with the generated multi-size .ico)
- Delete (temporary): `scripts/build-favicon.mjs` and the dev deps (after `.ico` is built)

- [ ] **Step 1: Verify `public/logo.png` exists and is readable**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
ls -la public/logo.png
file public/logo.png
```
Expected: File exists, ~88 KB, `PNG image data, 1236 x 1384, 8-bit/color RGBA`.

- [ ] **Step 2: Verify the current `src/app/favicon.ico` is the default Next.js favicon (sanity check)**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
ls -la src/app/favicon.ico
file src/app/favicon.ico
```
Expected: File exists, ~1-2 KB (default Next.js favicon is small).

- [ ] **Step 3: Install temporary dev dependencies (`sharp` for resizing, `to-ico` for packing)**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
npm install --save-dev sharp to-ico
```
Expected: `added 2 packages` (sharp will pull in some platform binaries; total install size increases by ~30 MB, that's fine — none of this stays in the final commit). Exit code 0.

- [ ] **Step 4: Create the favicon build script**

Create the file `scripts/build-favicon.mjs` with the following exact contents:

```javascript
// scripts/build-favicon.mjs
// One-shot script: read public/logo.png, resize to favicon sizes,
// pack into a multi-size .ico, and write to src/app/favicon.ico.
// Removed before final commit; not part of the build pipeline.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const srcPng = resolve(root, 'public/logo.png');
const outIco = resolve(root, 'src/app/favicon.ico');

const SIZES = [16, 32, 48];

async function main() {
  const png = await readFile(srcPng);
  const buffers = await Promise.all(
    SIZES.map((size) =>
      sharp(png)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );
  const ico = await toIco(buffers);
  await writeFile(outIco, ico);
  console.log(`Wrote ${outIco} (${ico.length} bytes, sizes: ${SIZES.join(', ')})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run the script to generate the new favicon**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
node scripts/build-favicon.mjs
```
Expected: `Wrote D:\Task Management System\taskboard-rebrand\src\app\favicon.ico (<size> bytes, sizes: 16, 32, 48)`. Exit code 0.

- [ ] **Step 6: Verify the new `favicon.ico` is a valid multi-size .ico**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
ls -la src/app/favicon.ico
file src/app/favicon.ico
```
Expected: File is now ~3-10 KB (multi-size .ico is larger than the default Next.js single-size .ico), and `file` reports it as `MS Windows icon resource` with multiple icons.

- [ ] **Step 7: Commit the favicon (without committing the script or the dev-deps)**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git add src/app/favicon.ico
git -c user.name="Claude" -c user.email="noreply@anthropic.com" \
    commit -m "rebrand: replace default Next.js favicon with Taskboard mark

Generate a multi-size .ico (16, 32, 48) from public/logo.png so the
browser tab icon matches the sidebar/topbar logo. The default Next.js
'N' favicon is replaced with the existing purple T-mark.

Refs: docs/superpowers/specs/2026-06-13-rebrand-to-taskboard-design.md"
```
Expected: `1 file changed`. The new `.ico` is committed; `package.json`, `package-lock.json`, and `scripts/build-favicon.mjs` are NOT in this commit (still untracked / modified).

- [ ] **Step 8: Remove the temporary script and dev dependencies**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
rm scripts/build-favicon.mjs
rmdir scripts 2>/dev/null || true
npm uninstall sharp to-ico
```
Expected: `removed 2 packages`. `scripts/` directory is gone (or empty, in which case `rmdir` is a no-op). `package.json` and `package-lock.json` are back to their pre-Task-3 state.

- [ ] **Step 9: Verify only the intended files changed in this task**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git status
git log --oneline -3
```
Expected: `working tree clean` (no untracked or modified files), and the last 3 commits are:
- (HEAD) rebrand: replace default Next.js favicon...
- rebrand: normalize visible brand string to Taskboard
- fix: enable echo cancellation...

---

## Task 4: Manual verification

**Files:** None (read-only checks)

- [ ] **Step 1: Verify no `TaskBoard` references remain in `src/`**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git grep -n "TaskBoard" src/
```
Expected: Prints nothing.

- [ ] **Step 2: Verify no `1_AI_Labs` or `AI Labs` references remain in `src/`**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git grep -n "1_AI_Labs\|AI Labs" src/
```
Expected: Prints nothing.

- [ ] **Step 3: Verify 7 `Taskboard` references now exist (one per edited file)**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git grep -n "Taskboard" src/
```
Expected: Prints 7 lines, one per file edited in Task 2.

- [ ] **Step 4: Verify the new favicon file is committed and is a valid .ico**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git log --oneline --stat -2 src/app/favicon.ico
file src/app/favicon.ico
```
Expected: The favicon commit shows `src/app/favicon.ico` as the changed file, and `file` reports it as a Windows icon resource.

- [ ] **Step 5: Verify the working tree is clean and the spec doc is NOT in this branch (it lives on main)**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git status
ls docs/superpowers/specs/ 2>&1
```
Expected: `working tree clean`. The `docs/` directory is NOT present in this worktree (it was never in the rebase base commit) — that's correct.

- [ ] **Step 6: Hand-off note for browser verification (USER ACTION, after merge)**

Items 3–7 of the spec's manual verification checklist (browser tab title shows "Taskboard", favicon renders, sidebar shows "Taskboard", topbar shows the active board or "Taskboard" fallback, `npm run dev` starts without errors) require a running dev server with PostgreSQL configured. These are not covered by the automated checks above and must be verified by the user after merging.

The prerequisites for that dev-server check are: (a) PostgreSQL running with the `DATABASE_URL` reachable, (b) `SESSION_SECRET` set in `.env`, (c) `npx prisma migrate dev` applied, (d) `npm install` completed. None of these are present in the worktree by default.

---

## Task 5: Push branch and open PR

**Files:** None (git operations only)

- [ ] **Step 1: Push the branch to origin**

Run:
```bash
cd "D:/Task Management System/taskboard-rebrand"
git push -u origin rebrand/taskboard
```
Expected: Branch is pushed, upstream tracking is set. The `1-_AI_Labs_Taskboard` repo on GitHub now has a `rebrand/taskboard` branch with 2 commits ahead of `main`.

- [ ] **Step 2: Open a pull request**

The user has not authorized a `gh pr create` call. **Stop here and tell the user the branch is ready, with the PR title and body they can use.**

PR title:
```
rebrand: normalize brand to Taskboard + replace favicon
```

PR body:
```markdown
## Summary

Normalize the user-facing brand string from `TaskBoard` to `Taskboard` in 7 source files and replace the default Next.js favicon with a Taskboard mark generated from the existing `public/logo.png`.

## Changes

- 7 source files updated: page title, login/register/setup screens, sidebar, topbar, AI system prompt
- `src/app/favicon.ico` replaced with a multi-size .ico (16/32/48) generated from the existing purple T-mark logo

## Out of scope (follow-ups)

- Rename local clone folder from `1-_AI_Labs_Taskboard` to `taskboard` (manual)
- Rename GitHub repo on github.com (manual)
- Custom Taskboard wordmark/logo image (user chose to keep existing T-mark for now)

## Spec

`docs/superpowers/specs/2026-06-13-rebrand-to-taskboard-design.md` (on `main`)
```

---

## Self-Review Notes

- **Spec coverage:** All 7 string edits from the spec are in Task 2. Favicon generation from logo.png is in Task 3. Out-of-scope items (folder/repo renames, README, logo image) are explicitly listed in the spec and excluded from this plan. ✅
- **No placeholders:** All edits show exact line numbers and exact `from`/`to` text. The build script in Task 3 is complete (no `// TODO` comments). ✅
- **Type consistency:** N/A — no new types, methods, or functions. The build script is a one-shot utility with no exports. ✅
