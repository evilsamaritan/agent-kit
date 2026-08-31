---
name: init
description: Bootstrap Agent Kit for a software project by detecting its stack, selecting profession profiles and knowledge skills, and materializing native Claude and Codex project agents. Use when setting up Agent Kit in a new project, rebuilding its agent configuration, or asking "create agents for this project" without naming each role. Do NOT use for one narrow agent change (use agent-creator) or to run a task workflow (use agent-orchestrator).
user-invocable: true
argument-hint: "[recipe-name]"
---

# Project Bootstrap

## Critical rules

- Keep Agent Kit as the reusable library. Store only project composition in `.agent-kit/agents.json`.
- Generate native `.claude/agents/` and `.codex/agents/` targets through `agent-creator`; do not copy profile or skill sources into the project.
- Default to both runtimes so the project can switch between Claude and Codex.
- Detect stack and existing conventions before proposing agents.
- Show one compact composition plan. Ask only when a remaining choice materially changes project scope, permissions, or model cost.
- Dispatch writes to `agent-creator` and missing domain knowledge to `skill-creator`. Init is a router, not another generator.
- Re-running is idempotent: preserve unrelated config entries and non-generated native agents.

## Flow

1. Detect the stack with [workflows/detect-stack.md](workflows/detect-stack.md).
2. Read existing `.agent-kit/agents.json`, if present.
3. Infer the primary development and review tasks from the request and repository.
4. Choose the smallest useful set of profession profiles and exact skill combinations using [references/dispatch-matrix.md](references/dispatch-matrix.md).
5. Present the resulting project agents, both runtime targets, access, and any non-default model choice.
6. Invoke `agent-creator` once with the complete composition.
7. Run its materializer and drift check.
8. Report the portable source and generated native targets.

Follow [workflows/bootstrap.md](workflows/bootstrap.md) for the full procedure.

## Recipes

Recipes are profile/skill starting points, not saved teams or execution graphs.

| Recipe | Typical composition |
|--------|---------------------|
| `small-react-app` | frontend-react + tester |
| `go-microservice` | backend-go + tester + security + devops |
| `monorepo-fullstack` | architect + frontend + backend + tester |
| `library` | architect + tester + writer |
| `data-pipeline` | backend + database-focused tester + sre |

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
