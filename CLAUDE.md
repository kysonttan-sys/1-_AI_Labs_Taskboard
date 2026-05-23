# Taskboard - Superpowers Development Framework

> This project uses the **Superpowers** agentic development methodology by Jesse Vincent (@obra).
> Superpowers is licensed under MIT. https://github.com/obra/superpowers

## How We Build Software Here

When you start any task in this project, follow the Superpowers workflow:

### 1. Brainstorm First
Before touching any code, invoke the `brainstorming` skill. Understand what the user is REALLY trying to do. Ask clarifying questions. Break the problem into chunks small enough to read and approve.

### 2. Write a Plan
Invoke the `writing-plans` skill. Create an implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`. The plan must:
- Be bite-sized (each task should take < 30 minutes)
- Include exact file paths
- Show full code samples, never "TODO" or "TBD"
- Emphasize true red/green TDD, YAGNI, and DRY

Get human approval on the plan before proceeding.

### 3. Execute with Subagents
Invoke the `subagent-driven-development` skill. Delegate implementation to fresh subagents. Each subagent gets a single task with full context. Review their work before merging.

### 4. Test-Driven Development
Invoke the `test-driven-development` skill. Write failing tests first. Make them pass. Then refactor. RED → GREEN → REFACTOR.

### 5. Verify Before Completion
Invoke the `verification-before-completion` skill. Run the app. Test the golden path AND edge cases. Check for regressions in other features.

### 6. Code Review
Invoke the `requesting-code-review` and `receiving-code-review` skills. Do a self-review first. Check for security, performance, and correctness issues.

### 7. Finish the Branch
Invoke the `finishing-a-development-branch` skill. Clean up. Squash if needed. Write a proper commit message. Merge only when everything is verified.

## Mandatory Rules

- **Use git worktrees** for every significant task. Isolate your work.
- **Invoke skills before acting.** If there's even a 1% chance a skill applies, use it.
- **Never rationalize skipping steps.** "This is simple" or "I know what to do" are red flags.
- **User instructions always win.** If the user says "skip TDD for this quick fix," skip it. The user is in control.

## Project Context

This is a Next.js 14 task management app with:
- React 18 + TypeScript + Tailwind CSS
- Prisma ORM with PostgreSQL
- Socket.io + WebRTC walkie-talkie feature
- Google Calendar integration
- Zustand state management
- PIN-based authentication with AES-256-GCM sessions

Key directories:
- `src/app/api/` — API routes (REST)
- `src/components/` — React components
- `src/features/` — Zustand stores + business logic
- `src/lib/` — Utilities, auth, DB client
- `prisma/` — Database schema
- `server.ts` — Custom Next.js server with Socket.io
- `docs/superpowers/plans/` — Implementation plans

## Skill Index

| Skill | When to Use |
|-------|-------------|
| `brainstorming` | Starting any new task |
| `writing-plans` | Before writing code |
| `executing-plans` | During implementation |
| `subagent-driven-development` | Delegating work |
| `test-driven-development` | Writing tests |
| `verification-before-completion` | Before saying "done" |
| `requesting-code-review` | Before merging |
| `receiving-code-review` | When reviewing code |
| `systematic-debugging` | When something is broken |
| `finishing-a-development-branch` | Wrapping up |

## How to Access Skills

Use the **Skill** tool with the skill name. Example:
```
Skill({"skill": "brainstorming"})
```

Skills are loaded from `.claude/skills/` in this project.
