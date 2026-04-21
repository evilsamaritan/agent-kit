---
name: init
description: Bootstrap a new project's Claude Code setup — opinionated zero-to-team initialization. Detects stack, asks 5 questions about project type, primary tasks, team size, quality gates, and shortcuts, then dispatches skill-creator / agent-creator / team-creator / hook-creator / update-config to assemble agents, teams, hooks, and slash commands. Use only for initial project setup or major reset. Do NOT use mid-project for narrow tasks (use the relevant meta-skill directly).
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Bash
user-invocable: true
argument-hint: "[recipe-name]"
---

# Project Initialization (Bootstrap)

Owns nothing on disk — pure router that asks, plans, dispatches, summarizes. Every actual write happens through another meta-skill.

**Hard rules:**
- This skill MUST run in the main conversation (no `context: fork`)
- **Idempotent** — re-running never overwrites without explicit confirmation per item
- **Single global confirmation** — show the full plan once, get one yes, then dispatch all actions. Do NOT ask per-item.
- Never write files directly — delegate everything via Skill tool
- If detection is uncertain, ASK the user — don't guess silently
- If user declines an action mid-plan, skip it and continue with the rest (idempotent)

---

## Flow

```
1. Detect stack
   ├── Glob package.json, go.mod, pyproject.toml, Cargo.toml, *.csproj, ...
   └── Show detected stack to user, ask to confirm or correct

2. Ask 5 questions (AskUserQuestion)
   ├── Project type: web / CLI / library / data pipeline / mixed
   ├── Primary tasks: feature dev / code review / security audits / refactor / docs / mixed
   ├── Team size: single specialist / pair / 3-5 team / experimental Agent Teams
   ├── Quality gates: none / advisory / blocking hooks
   └── Shortcuts: slash commands / scheduled tasks / none

3. Derive plan from (answers × stack)
   └── Use references/dispatch-matrix.md as the lookup table

4. Show full plan
   └── Numbered list of actions with affected files
   └── Get ONE confirmation (yes / no / edit list)

5. Dispatch in order
   ├── Each action invokes a meta-skill via Skill tool
   ├── Track outcomes (succeeded / skipped / failed)
   └── On failure, ask user how to proceed (retry / skip / abort)

6. Final report
   └── What was created, what was skipped, next steps
```

→ Detailed flow: `workflows/bootstrap.md`
→ Stack detection heuristics: `workflows/detect-stack.md`
→ Answer combinations → action lists: `references/dispatch-matrix.md`
→ Named recipes (preset answer bundles): `references/recipes.md`

---

## Recipes (preset answer bundles)

If the user provides a recipe argument (`/init small-react-app`), skip questions and use the preset answer set directly. Always show the resolved plan and get confirmation before dispatching.

| Recipe | Stack assumption | Team | Gates | Shortcuts |
|--------|-----------------|------|-------|-----------|
| `small-react-app` | React + Vite or Next.js | frontend + testing | advisory | `/review`, `/test` |
| `go-microservice` | Go + Docker | backend + devops + testing + security | blocking (lint, tests) | `/lint`, `/test`, `/audit` |
| `monorepo-fullstack` | pnpm workspace + Node + React | architect + frontend + backend + testing + sre | blocking | `/review`, `/test`, `/deploy-check` |
| `library` | Single-package repo | architect + testing + docs | advisory | `/release-check` |
| `data-pipeline` | Python + Airflow / dbt | backend + database + observability + testing | advisory | `/lint`, `/test` |

→ Full recipe definitions: `references/recipes.md`

---

## Dispatch Targets

Init only invokes other meta-skills via the Skill tool. The mapping:

| Plan action | Skill invoked | Args |
|-------------|---------------|------|
| Create custom agent | `agent-creator` | `create <name> with skills <list>` |
| Create custom skill | `skill-creator` | `create <name> for <description>` |
| Create team | `team-creator` | `create <team-name> with flow <type>` |
| Configure quality hook | `hook-creator` | `add <event> matching <matcher>: <command>` |
| Add slash command / permission | `update-config` | natural language describing change |

The Skill tool always runs the target in the main conversation (these are all in-conversation skills, not forked subagents).

---

## Idempotency Contract

Re-running `/init` on an already-bootstrapped project must:

1. Detect existing files (`agents/*.md`, `.claude/teams/`, `.claude/settings.json`)
2. For each planned action, check if the target already exists
3. Show as "[exists]" in the plan, default to **skip**, but offer **overwrite** as an option per item during the single confirmation step
4. Never delete anything — overwrite means call the relevant meta-skill's reconfigure path

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Ask per-item ("create this agent? y/n", repeat ×8) | User abandons after 3 prompts | Show full plan, get single confirmation |
| Write files directly from this skill | Bypasses meta-skill validation | Always delegate via Skill tool |
| Auto-detect and proceed without showing the plan | User loses control | Always show plan + confirm |
| Block on a single failed action | Whole bootstrap fails | Skip failed item, continue, surface in final report |
| Hardcode recipe outputs | Recipes drift from real meta-skills | Recipes only encode answer presets, never outputs |
| Re-run and overwrite silently | Destroys user customizations | Idempotency check; default skip on existing items |
| Use during normal mid-project work | Mid-project changes need targeted meta-skill | Use directly: `/team-creator`, `/hook-creator`, etc. |

---

## Quick Reference

| Task | Resource |
|------|----------|
| Bootstrap flow step-by-step | [workflows/bootstrap.md](workflows/bootstrap.md) |
| Stack detection heuristics | [workflows/detect-stack.md](workflows/detect-stack.md) |
| Answer combinations → actions | [references/dispatch-matrix.md](references/dispatch-matrix.md) |
| Named recipes | [references/recipes.md](references/recipes.md) |

---

## Related Knowledge

- `agent-creator` — creates `agents/*.md` files
- `skill-creator` — creates new skills under `skills/`
- `team-creator` — writes `.claude/teams/<name>/team.json`
- `hook-creator` — designs and validates Claude Code hooks
- `update-config` — writes `settings.json` (permissions, env, hooks, slash commands)
