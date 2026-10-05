---
name: init
description: "Set up Agent Kit for a project. Use for stack discovery and an initial agent composition; agent-creator materializes native files."
user-invocable: true
argument-hint: "[recipe-name]"
---

# Project Bootstrap

## Critical rules

- Keep Agent Kit as the reusable library. Store only project composition in `.agent-kit/agents.json`.
- Generate native `.claude/agents/`, `.codex/agents/`, and (when used) `.kimi-code/agents/` targets through `agent-creator`; do not copy profile or skill sources into the project.
- Default to Claude and Codex so the project can switch between them; add Kimi Code when the project uses it.
- Detect stack and existing conventions before proposing agents.
- Show one compact composition plan. Ask only when a remaining choice materially changes project scope, permissions, or model cost.
- Dispatch writes to `agent-creator` and missing domain knowledge to `skill-creator`. Init is a router, not another generator.
- Re-running is idempotent: preserve unrelated config entries and non-generated native agents.

## Flow

1. Detect the stack with [workflows/detect-stack.md](workflows/detect-stack.md).
2. Read existing `.agent-kit/agents.json`, if present.
3. Infer the primary development and review tasks from the request and repository.
4. Choose the smallest useful set of profession profiles and exact skill combinations using [references/dispatch-matrix.md](references/dispatch-matrix.md).
5. Present the resulting project agents, runtime targets, access, and any pinned model.
6. Invoke `agent-creator` once with the complete composition.
7. Run its materializer and drift check.
8. Report the portable source and generated native targets. If `.claude/agents/` was created in this run, say that Claude selects the new agents after a session restart.

Follow [workflows/bootstrap.md](workflows/bootstrap.md) for the full procedure.

## Recipes

Recipes are profile/skill starting points, not saved teams or execution graphs.

| Recipe | Typical composition |
|--------|---------------------|
| `small-react-app` | frontend-developer + tester |
| `go-microservice` | backend-developer + tester + security + devops |
| `monorepo-fullstack` | architect + UI/service developer instances + tester |
| `library` | architect + tester + writer |
| `data-pipeline` | data-processing developer + database-focused tester + sre |
| `web-game` | game-developer (+ frontend-developer only for a substantial web UI) + game-tester |
| `mobile-app` | mobile-developer + backend-developer when it owns the sync API + tester |

Read [references/recipes.md](references/recipes.md) when a recipe is named.

## Quick reference

| Need | Resource |
|------|----------|
| Bootstrap procedure | [workflows/bootstrap.md](workflows/bootstrap.md) |
| Stack signals | [workflows/detect-stack.md](workflows/detect-stack.md) |
| Stack/tasks → profiles and skills | [references/dispatch-matrix.md](references/dispatch-matrix.md) |
| Preset compositions | [references/recipes.md](references/recipes.md) |
| Create/sync native agents | `agent-creator` |
| Run a task team | `agent-orchestrator` |
