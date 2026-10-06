---
name: init
description: "Bootstrap Agent Kit in a project: detect the stack and propose project agents in .agent-kit/agents.json. Use for set up agent-kit, create agents for this repo, or init agent-kit. Not the host's built-in /init that writes a project instruction file."
user-invocable: true
argument-hint: "[responsibility or stack hint]"
---

# Project Bootstrap

## Critical rules

- Keep Agent Kit as the reusable library. Store only project composition in `.agent-kit/agents.json`.
- Generate native `.claude/agents/`, `.codex/agents/`, and (when used) `.kimi-code/agents/` targets through `agent-creator`; do not copy profile or skill sources into the project.
- Default to Claude and Codex so the project can switch between them; add Kimi Code when the project uses it.
- Detect the stack from repository evidence before proposing agents. State what was detected in the plan; ask only when the primary stack is ambiguous or a choice materially changes scope, permissions, or model cost.
- Dispatch writes to `agent-creator` and missing domain knowledge to `skill-creator`. Init is a router, not another generator.
- Re-running is idempotent: preserve unrelated config entries and non-generated native agents.

## Flow

Follow [workflows/bootstrap.md](workflows/bootstrap.md): read the stack signals and existing configuration, derive recurring responsibilities, pick compositions from the shared recipes, present one plan, and hand the complete composition to `agent-creator`, which materializes and checks the native targets.

## Quick reference

| Need | Resource |
|------|----------|
| Bootstrap procedure | [workflows/bootstrap.md](workflows/bootstrap.md) |
| Stack signals, responsibility → profile, sizing | [references/dispatch-matrix.md](references/dispatch-matrix.md) |
| Compositions (profile + exact skills) and agent names | [project-agent-recipes.md](../agent-creator/references/project-agent-recipes.md) |
| Create or sync native agents | `agent-creator` |
| Run a task team | `agent-orchestrator` |
