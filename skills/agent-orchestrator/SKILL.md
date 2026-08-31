---
name: agent-orchestrator
description: Orchestrate profession agents with the host runtime's native subagent and workflow mechanisms. Use when the user asks to assemble a team, choose agents for a task, run several specialists, create an ad-hoc workflow, parallelize review or implementation, or delegate work without spelling out roles, models, effort, and task division. Do NOT use to create or change project agent definitions (use agent-creator) or for a task that should stay in the current thread.
user-invocable: true
argument-hint: "[task or agent composition]"
---

# Agent Orchestrator

## Critical rules

- Use the host runtime's native agents, subagents, workflows, thread controls, and worktree isolation. Agent Kit supplies profiles and decision guidance, not an execution runtime.
- Treat a request to assemble a team, create a workflow, use agents, or delegate as authorization to spawn the required agents. Do not add a redundant confirmation unless the plan changes cost, permissions, external state, or task scope materially.
- Discover project agents first, then verify that the current host can actually select a named custom agent. File presence alone is not a capability check.
- Pick the smallest useful composition. One specialist is a valid team; use several only for independent work or distinct review lenses.
- Give every agent a bounded task, inputs, file scope, expected output, and verification requirement.
- Parallel writers must have disjoint file ownership or native worktree isolation. Otherwise run them sequentially.
- Keep the main thread responsible for requirements, decisions, coordination, and final synthesis. Return compressed findings, not raw agent transcripts.
- Never persist a proprietary `team.json`, loop, graph, or scheduler. Save a workflow only through a native host format when the user explicitly asks.

## Flow selection

| Request | Route |
|---------|-------|
| Named profession | Run one matching project agent |
| Task needing several specialties | Compose the minimum ad-hoc workflow |
| Same role across independent scopes | Run multiple instances with non-overlapping assignments |
| Review or research with independent lenses | Parallelize, then synthesize |
| Dependent implementation stages | Run a pipeline and pass compressed handoffs |
| Missing project agent | Use the bundled profile as an ephemeral fallback, or invoke `agent-creator` when persistence is needed |
| Save/reuse this workflow | Use a native Claude/Codex workflow facility if the current host exposes one |

Follow [workflows/orchestrate.md](workflows/orchestrate.md) for execution.

## Agent discovery

1. Inspect native project agents:
   - Claude Code: `.claude/agents/*.md`
   - Codex: `.codex/agents/*.toml`
2. If `.agent-kit/agents.json` exists, treat it as the source of truth for materialized project agents.
3. Read [references/profile-catalog.md](references/profile-catalog.md) only when a suitable project agent is absent or the user asks what profiles are available.
4. Read one selected profile from `references/profiles/`, not the whole catalog directory. Keep it available as the fallback persona even when a native project file exists.

## Composition heuristics

| Signal | Composition |
|--------|-------------|
| Small, single-domain change | One profession |
| Interfaces or architecture unclear | Architect, then implementer(s) |
| Frontend and backend scopes are independent | Frontend + backend in parallel |
| Implementation needs independent validation | Implementer, then reviewer or tester |
| Security-sensitive change | Implementer + security review |
| Operational rollout | DevOps or SRE after implementation |
| Broad audit | Separate reviewers by evidence axis, then one synthesis |

Start with 1–3 agents. Add another only when it owns a distinct scope or evidence axis.

## Runtime adaptation

Use [references/runtime-adapters.md](references/runtime-adapters.md) to map the composition onto Claude Code, Codex, or another host. Runtime vocabulary belongs there; the orchestration policy above stays portable.

## Quick reference

| Need | Resource |
|------|----------|
| Execute a composition | [workflows/orchestrate.md](workflows/orchestrate.md) |
| Pick pipeline / parallel / validator pattern | [references/orchestration-patterns.md](references/orchestration-patterns.md) |
| Map to native runtime controls | [references/runtime-adapters.md](references/runtime-adapters.md) |
| Browse bundled professions | [references/profile-catalog.md](references/profile-catalog.md) |
| Create persistent project agents | `agent-creator` |
