---
name: team-creator
description: Compose agent teams from existing agents. Saves team.json describing which agents participate and how they coordinate (flow). Use when creating a new team for a project or reconfiguring an existing team's flow. Do NOT use to create new agents (use agent-creator), run/spawn teams (use team-orchestrator), or configure hooks (use hook-creator).
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "[create|reconfigure] [team-name]"
---

# Team Creation

Compose, validate, and persist team configurations. Writes `.claude/teams/<name>/team.json` — a declaration of which already-existing agents participate and in what flow. Pure producer of team definitions — runtime is team-orchestrator's job.

**Hard rules:**
- This skill MUST run in the main conversation (no `context: fork`) — subagents cannot spawn subagents.
- **Does NOT create agents.** Only composes agents already present in `agents/`. If a needed agent is missing, delegate to `agent-creator` first (or instruct the user to run it), then return here.
- Never spawn agents to test the team — that's team-orchestrator's job.
- Discover existing agents dynamically (`glob agents/*.md`) — never hardcode availability.
- Always confirm composition with the user before writing files.
- Bump `version` in `team.json` on schema-affecting changes — see `references/migrations.md`.

---

## Flow Selection

```
What does the user want?
├── Create team for a project ("create a team for React fullstack", "I need a security review team")
│   └── Approach F → 5-step interactive flow → write team.json
│
├── Reconfigure existing team ("reconfigure poker-ui", "change review team flow")
│   └── Approach G → modify flow config only — agents untouched
│
└── Setup ("/team-creator setup")
    └── Check creation prerequisites (jq, agents/ dir, plugin version)
```

→ Full create workflow: `workflows/create-team.md`
→ Setup check: `workflows/setup.md`

---

## Approaches

### F) Create Team (interactive)

```
/team-creator create a team for React + Node fullstack
/team-creator configure review team with extra security focus
```

Interactive 5-step flow:

1. **Understand project** — scan codebase for tech stack (`package.json`, `go.mod`, `pyproject.toml`).
2. **Choose flow type** — present flow types via AskUserQuestion (see Flow Types below).
3. **Configure roster** — list agents that exist in `agents/`. If any needed agent is missing, delegate to `agent-creator` to build it (or ask the user to run it), then continue.
4. **Additional options** — twin reviewers? quality gates? approval gates?
5. **Generate** — write `.claude/teams/<name>/team.json` and validate.

→ Full workflow: `workflows/create-team.md`

### G) Reconfigure Team

```
/team-creator reconfigure poker-ui
```

Change flow type, add/remove stages, toggle options — without touching agent files. Agents are building blocks; flow config is assembly instructions. Changing the flow never breaks agents.

---

## Flow Types

| Category | Type | Pattern | Cost |
|----------|------|---------|------|
| Dev | `pipeline` | explorer → implementer → tester → reviewer | 2-4x |
| Dev | `pipeline-parallel` | planner → [frontend ∥ backend] → tester | 3-5x |
| Dev | `builder-validator` | implementer ↔ reviewer (loop, max N) | 2-3x |
| Review | `twin-review` | [reviewer-1 ∥ reviewer-2] → merge | 2x |
| Review | `swarm-review` | [security ∥ perf ∥ quality ∥ tests] → synthesis | 4x |
| Review | `devils-advocate` | adversarial rounds (fatal → errors → perf → security → maint → tests) | 1.5x |
| Research | `fan-out` | planner → [worker × N] → aggregator | 2-5x |
| Research | `diverge-converge` | [approach × N] → evaluator → best | 3-4x |
| Security | `purple-team` | red (find) → blue (fix) → red (verify) → report | 3x |
| Any | `custom` | user-defined stages | varies |

→ Details: `references/flow-catalog.md`

---

## Pre-defined Team Catalog

Default teams available without creation:

| Team | Agents | Flow | Use When |
|------|--------|------|----------|
| **review** | architect → security → tester | Sequential | Code/PR review |
| **implement** | architect → (frontend ∥ backend) → tester | Pipeline | Feature implementation |
| **full-audit** | architect → security → sre → tester | Sequential | Project-wide audit |
| **security** | security → sre → devops | Sequential | Security-focused review |
| **frontend** | frontend → tester | Pipeline | UI work + tests |
| **backend** | backend → tester → security | Pipeline | API/service + tests + security |

→ Detailed compositions with prompts: `references/team-catalog.md`

**Custom teams** override built-in: if `.claude/teams/<name>/team.json` exists, it takes priority over the catalog.

---

## Team Config

Teams are stored in `.claude/teams/<name>/team.json`. Agents are building blocks in flat `agents/` — they never reference their team. Flow configs reference agents by name. **Change flow without touching agents.**

```
agents/                          ← building blocks (independent, created by agent-creator)
├── frontend.md                  ← base profession, or
├── poker-ui-frontend.md         ← specialized agent (created by agent-creator)
└── …

.claude/teams/poker-ui/          ← flow config (swappable)
└── team.json
```

Config version tracks plugin schema version. On team launch, `validate-team.sh` checks version — if mismatch, see `references/migrations.md` for migration steps.

→ Validate: `bash scripts/validate-team.sh .claude/teams/<name>/team.json`
→ Lint agents: `bash scripts/check-agents.sh`

> Need a specialized agent for this team? Delegate to `agent-creator` — do not fork logic here.

---

## Specialized Agents in Teams

Specialized agents (base profession + team-specific preloaded skills) are preferred over generic base agents when the team needs consistent, narrow focus:

```
Specialized agent (poker-ui-frontend: implementer + react + html + css + accessibility)
  > Generic base agent (frontend: picks skills by context)
```

**Priority:** specialized agent with matching skills > base profession agent.

When building a team's roster, the workflow checks `agents/` for matching specialized agents first. When no suitable agent exists, stop and delegate to `agent-creator` to build it, then resume.

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Run/test the team in this skill | That's orchestration, not creation | Delegate to `/team-orchestrator` |
| Bake team-specific logic into a base profession agent | Agent reuse breaks across teams | Create a dedicated specialized agent via `/agent-creator` |
| Skip the version field in team.json | Migrations break on plugin updates | Always include `version` matching plugin.json |
| Mutate team.json from `/team-orchestrator` | Schema drift; orchestrator is read-only | All schema changes go through `/team-creator reconfigure` |
| Hardcode default agents in flow config | Specialized agents lose priority | Reference by name; orchestrator resolves specialized-first |
| Create team before required agents exist | Validation fails on launch | Ensure agents/ has every referenced agent before writing team.json |

---

## Quick Reference

| Task | Resource |
|------|----------|
| Create a team (interactive) | [workflows/create-team.md](workflows/create-team.md) |
| Setup creation prerequisites | [workflows/setup.md](workflows/setup.md) |
| Flow type details | [references/flow-catalog.md](references/flow-catalog.md) |
| Pre-defined team details | [references/team-catalog.md](references/team-catalog.md) |
| Config schema versions | [references/migrations.md](references/migrations.md) |
| Validate team config | `bash scripts/validate-team.sh` |
| Lint agent files | `bash scripts/check-agents.sh` |

---

## Related Knowledge

- `/team-orchestrator` — run, monitor, and stop existing teams (consumes team.json)
- `/agent-creator` — create base or specialized agents for teams
- `/hook-creator` — configure quality gates (TeammateIdle, TaskCompleted)
