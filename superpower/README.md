# Superpowers Starter Kit

> Reusable Superpowers agentic development framework by Jesse Vincent (@obra).
> https://github.com/obra/superpowers | MIT License

## What is this?

This folder contains everything you need to bootstrap the **Superpowers** methodology in any new project. Drop these files into a new repo, and Claude Code will automatically follow the structured workflow: **Brainstorm → Plan → Execute → Test → Review → Merge**.

## Quick Setup (30 seconds)

Copy this entire `superpower/` folder into your new project's root:

```bash
# From this repo
cp -r superpower /path/to/new-project/

# Then rename the folder contents to the standard locations:
cd /path/to/new-project
mv superpower/CLAUDE.md CLAUDE.md
mkdir -p .claude
cp -r superpower/skills .claude/skills
mkdir -p docs/superpowers/plans
cp -r superpower/docs/* docs/superpowers/
rm -rf superpower
```

**Or simply:**
```bash
# Copy everything to new project root
cp -r superpower/* /path/to/new-project/
mkdir -p /path/to/new-project/.claude
mv /path/to/new-project/skills /path/to/new-project/.claude/skills
mv /path/to/new-project/CLAUDE.md /path/to/new-project/CLAUDE.md
```

## Files Included

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Bootstrap instructions loaded automatically by Claude Code |
| `.claude/skills/LICENSE` | MIT license attribution for Superpowers skills |
| `.claude/skills/using-superpowers/SKILL.md` | Bootstrap skill — triggers all others |
| `.claude/skills/brainstorming/SKILL.md` | Explore requirements before coding |
| `.claude/skills/writing-plans/SKILL.md` | Create detailed implementation plans |
| `.claude/skills/executing-plans/SKILL.md` | Follow plans step by step |
| `.claude/skills/subagent-driven-development/SKILL.md` | Delegate to fresh subagents |
| `.claude/skills/test-driven-development/SKILL.md` | RED → GREEN → REFACTOR |
| `.claude/skills/verification-before-completion/SKILL.md` | Test before saying "done" |
| `.claude/skills/finishing-a-development-branch/SKILL.md` | Clean merge workflow |
| `.claude/skills/requesting-code-review/SKILL.md` | Self-review before merging |
| `.claude/skills/receiving-code-review/SKILL.md` | Process review feedback |
| `.claude/skills/systematic-debugging/SKILL.md` | Structured debugging |
| `docs/superpowers/plans/` | Where implementation plans are saved |

## How It Works

Once installed, Claude Code will:

1. **Brainstorm** — Ask clarifying questions, present 2-3 approaches, get your approval
2. **Plan** — Write a bite-sized plan in `docs/superpowers/plans/YYYY-MM-DD-feature.md`
3. **Execute** — Create a git worktree, delegate subagents for each task
4. **TDD** — Write failing tests first, make them pass, then refactor
5. **Verify** — Run the app, test the feature, check for regressions
6. **Review** — Do a self-review, fix issues, show you the diff
7. **Finish** — Clean commit, merge, delete the worktree

## Skip It When Needed

To bypass Superpowers for a quick fix, just say: **"skip superpowers for this"**

## Full Documentation

See https://github.com/obra/superpowers for the original project, philosophy, and community.
