---
name: team-creator
description: Spawn and orchestrate agents — one agent, multiple instances of one agent, or full multi-agent teams. Use when running agents for code review, feature implementation, security audit, architecture review, or any task that benefits from specialist agents. Handles single-agent spawn, multi-instance parallel runs, pre-defined teams, and ad-hoc compositions. Do NOT use for creating new agent definitions (use agent-creator).
allowed-tools: Read, Write, Bash, Glob, Grep, Agent, AskUserQuestion
user-invocable: true
argument-hint: "[team-name or task-description]"
---

# Team Orchestration

Compose and orchestrate multi-agent teams from available agents. Select the right team, choose execution mode, coordinate work.

**Hard rules:**
- This skill MUST run in the main conversation (no `context: fork`) — subagents cannot spawn subagents
- Discover agents dynamically (`glob agents/*.md`) — never hardcode agent availability
- Pipeline mode is the default — parallel/tmux only when tasks are independent AND setup is complete
- Always confirm team composition with the user before executing
- Compress context between pipeline stages (3-5 key findings + file locations, not full output)

---

## Flow Selection

```
What does the user want?
├── Single agent spawn ("review this with security agent", "run frontend on this")
│   └── Identify agent → spawn one instance → done
│
├── Multi-instance ("run 3 qa agents on different modules")
│   └── Same agent type × N instances, each with its own scope/prompt
│
├── Named team ("/team-creator review", "/team-creator poker-ui")
│   ├── Check .claude/teams/<name>/team.json → saved custom team?
│   └── Check team-catalog.md → built-in team?
│
├── Task description ("/team-creator implement OAuth login")
│   └── Analyze → propose agents (type + count) → confirm with user → execute
│
├── Create/configure team ("create a team for React fullstack", "configure review team")
│   └── Analyze needs → check existing agents → create missing via agent-creator
│       → compose team definition → save to .claude/teams.json
│
├── Reconfigure team ("/team-creator reconfigure poker-ui")
│   └── Change flow type, add/remove stages, toggle options — agents untouched
│
├── Ad-hoc spawn ("/team-creator spawn 3 agents for X, Y, Z")
│   └── Each agent gets individual prompt, parallel orchestration
│
└── Setup ("/team-creator setup")
    └── Check prerequisites for Agent Teams mode
```

**Key:** Infer from the request — how many agents, which type(s), one type or mixed. The user shouldn't have to specify the orchestration mode explicitly.

→ Full orchestration workflow: `workflows/orchestrate.md`
→ Setup for parallel mode: `workflows/setup.md`

---

## Approaches

### A) Single Agent

```
/team-creator run security on src/auth/
/team-creator review this PR with architect
```

One agent, one task. Useful when the user wants a specific specialist but doesn't want to remember the Agent tool syntax. Infer the agent from the request.

### B) Multi-Instance (same agent × N)

```
/team-creator run 3 qa agents: one for api/, one for web/, one for workers/
/team-creator 4 frontend reviewers for each page component
```

Same agent type spawned multiple times with different scopes. All run in parallel with `run_in_background: true`. Each instance gets its own prompt with the specific scope.

### C) Pre-defined Team

```
/team-creator review
/team-creator implement
/team-creator my-fullstack  (from .claude/teams.json)
```

Known composition from catalog or saved config. Fastest path — no decisions needed.

### D) Task-based Composition

```
/team-creator implement OAuth with social login
```

Skill analyzes the task, checks available agents (custom first, then default), proposes team (type + count for each), asks for confirmation. Optionally saves for reuse.

### E) Ad-hoc Spawn

```
/team-creator spawn: agent-1 researches auth patterns, agent-2 implements API, agent-3 writes tests
```

No team structure. Each agent gets its own prompt. Just orchestration — parallel execution.

### F) Create Team (interactive)

```
/team-creator create a team for React + Node fullstack
/team-creator configure review team with extra security focus
```

Interactive 5-step flow with questions at each stage:
1. Understand project → scan codebase for tech stack
2. Choose flow type → present 10 flow types via AskUserQuestion
3. Configure agents → check existing, scaffold missing via agent-creator
4. Additional options → twin reviewers? quality gates? approval gates?
5. Generate → create agent files + `.claude/teams/<name>/team.json` + validate

→ Full workflow: `workflows/create-team.md`

### G) Reconfigure Team

```
/team-creator reconfigure poker-ui
```

Change flow type, add/remove stages, toggle options — without touching agent files.
Agents are building blocks; flow config is assembly instructions. Changing the flow never breaks agents.

---

## Team Catalog

| Team | Agents | Flow | Use When |
|------|--------|------|----------|
| **review** | architect → security → qa | Sequential | Code/PR review |
| **implement** | architect → (frontend ∥ backend) → qa | Pipeline | Feature implementation |
| **full-audit** | cto → security → sre → qa | Sequential | Project-wide audit |
| **security** | security → sre → devops | Sequential | Security-focused review |
| **frontend** | frontend → qa | Pipeline | UI work + tests |
| **backend** | backend → qa → security | Pipeline | API/service + tests + security |
| **ai-feature** | ai-engineer → architect → qa | Pipeline | AI/ML feature development |

→ Detailed compositions with prompts: `references/team-catalog.md`

**Custom teams** override built-in: if `.claude/teams.json` has a team named "review", it takes priority over the catalog.

---

## Launch Mode Decision Tree

```
How should I launch agents?
├── Need isolated agent for ONE task?
│   └── Agent tool with subagent_type: "<agent-name>"
│       Skills from frontmatter auto-injected. Default for most work.
│
├── Need parallel agents (same or different types)?
│   └── Agent tool × N with run_in_background: true
│       Each gets own context window. Results aggregated after completion.
│
├── Need agents to coordinate, share tasks, message each other?
│   └── Agent Teams (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)
│       Lead spawns teammates. Display: in-process (Shift+Down) or split panes (auto in tmux/iTerm2).
│
├── Need git isolation (parallel file edits)?
│   └── claude --worktree <name> per agent session
│       Each gets own branch + directory. No merge conflicts.
│
└── Need full CLI session as specific agent?
    └── claude --agent <name> "<prompt>"
        Entire session adopts agent persona, skills, and tools.
```

## Execution Modes

### Pipeline (default — works everywhere)

Sequential/parallel agent spawning via Agent tool. Each agent runs as a subagent, returns results, next stage starts.

```
architect (plan) → frontend + backend (parallel, background) → qa (test) → done
```

- No setup required
- Context compressed between stages
- Parallel stages use `run_in_background: true`

### Agent Teams (opt-in — needs setup)

Full peer-to-peer teams with shared task list and direct messaging.

- Requires: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (env or settings.json `env` field)
- Lead session spawns teammates automatically — no separate flag needed
- **Display modes:**
  - In-process (default): `Shift+Down` to cycle teammates, type to message
  - Split panes: automatic when running inside tmux or iTerm2
- **Delegate mode:** `Shift+Tab` — restricts lead to coordination only (no code edits)
- **Task list:** `Ctrl+T` to view, tasks support dependency DAGs (task B blocked until A completes)
- **Worktree isolation:** `claude --worktree task-name` for independent branches
- **Cost:** 3 teammates ≈ 3-4x token usage vs single session
- **Limitation:** No session resumption, one team per session, no nested teams

→ Run `/team-creator setup` to check prerequisites
→ tmux layouts: `references/tmux-layouts.md`

### Builder-Validator Pattern

Split implementation and review into separate agents with different permissions:

```
Builder (Write, Edit, Bash) → writes code
Validator (Read, Grep, Glob only) → reviews, cannot edit — creates tasks back to builder
```

Validator's read-only constraint forces it to surface problems rather than silently "fixing" them. Use for implementation teams where quality matters.

---

## Flow Types (10)

| Category | Type | Pattern | Cost |
|----------|------|---------|------|
| Dev | `pipeline` | explorer → implementer → tester → reviewer | 2-4x |
| Dev | `pipeline-parallel` | planner → [frontend ∥ backend] → tester | 3-5x |
| Dev | `builder-validator` | implementer ↔ reviewer (loop, max N) | 2-3x |
| Review | `twin-review` | [reviewer-1 ∥ reviewer-2] → merge | 2x |
| Review | `swarm-review` | [security ∥ perf ∥ quality ∥ tests] → synthesis | 4x |
| Review | `devils-advocate` | 6 adversarial rounds (fatal → errors → perf → security → maint → tests) | 1.5x |
| Research | `fan-out` | planner → [worker × N] → aggregator | 2-5x |
| Research | `diverge-converge` | [approach × N] → evaluator → best | 3-4x |
| Security | `purple-team` | red (find) → blue (fix) → red (verify) → report | 3x |
| Any | `custom` | user-defined stages | varies |

→ Details: `references/flow-catalog.md`

## Team Config

Teams are stored in `.claude/teams/<name>/team.json`. Agents are building blocks in flat `agents/` — they never reference their team. Flow configs reference agents by name. **Change flow without touching agents.**

```
agents/                          ← building blocks (independent)
├── poker-ui-explorer.md         ← naming convention: <team>-<role>
├── poker-ui-implementer.md
└── poker-ui-reviewer.md

.claude/teams/poker-ui/          ← flow config (swappable)
└── team.json
```

Config version tracks plugin schema version. On team launch, `validate-team.sh` checks version — if mismatch, see `references/migrations.md` for migration steps.

→ Scaffold: `bash scripts/scaffold-team.sh <team> <roles...> [--skills s1,s2]`
→ Validate: `bash scripts/validate-team.sh .claude/teams/<name>/team.json`
→ Lint agents: `bash scripts/check-agents.sh`

## Custom Agents in Teams

Custom agents with pre-configured skills are preferred over generic role agents:

```
Custom agent (poker-ui-reviewer: frontend + react + html-css)
  > Generic agent (frontend: decides skills at runtime)
```

**Priority:** custom agent with matching skills > default role agent.

---

## Quality Gates (Agent Teams)

Use hooks to enforce quality before agents can stop or complete tasks:

```json
{
  "hooks": {
    "TeammateIdle": [{ "command": "./scripts/run-tests.sh" }],
    "TaskCompleted": [{ "command": "./scripts/validate-task.sh" }]
  }
}
```

- **TeammateIdle** — exit code 2 sends feedback, agent continues working (e.g., "tests still failing")
- **TaskCompleted** — exit code 2 blocks completion (e.g., lint fails → task stays in-progress)

→ Details: `references/quality-gates.md` (load from agent-engineering skill for hook patterns)

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Force team when user asked for one agent | Overhead, slower | Spawn single agent directly |
| Skip architect/planning stage | Implementers work without design | Always plan first in pipeline |
| Pass full agent output between stages | Context bloat | Compress to key findings + files |
| Parallel mode without worktree isolation | Git conflicts | `claude --worktree name` or sequential |
| Too many agents (> 5) | Coordination overhead exceeds benefit | 2-4 agents is the sweet spot |
| Hardcode agent names | Breaks when custom agents added | Discover via glob + match by capability |
| Agent reviews its own code | Confirmation bias | Builder-Validator: separate write/read agents |
| No quality hooks in agent teams | Agents mark tasks "done" with broken tests | TeammateIdle + TaskCompleted hooks |
| Overlapping file edits in parallel | Merge conflicts | Ensure truly independent tasks or use worktrees |

---

## Quick Reference

| Task | Resource |
|------|----------|
| Create a team (interactive) | [workflows/create-team.md](workflows/create-team.md) |
| Orchestrate a team | [workflows/orchestrate.md](workflows/orchestrate.md) |
| Setup parallel mode | [workflows/setup.md](workflows/setup.md) |
| Flow type details | [references/flow-catalog.md](references/flow-catalog.md) |
| Pre-defined team details | [references/team-catalog.md](references/team-catalog.md) |
| Advanced patterns | [references/orchestration-patterns.md](references/orchestration-patterns.md) |
| Config schema versions | [references/migrations.md](references/migrations.md) |
| tmux pane layouts | [references/tmux-layouts.md](references/tmux-layouts.md) |
| Validate team config | `scripts/validate-team.sh` |
| Scaffold team agents | `scripts/scaffold-team.sh` |
| Lint agent files | `scripts/check-agents.sh` |
| Check prerequisites | `scripts/check-env.sh` |

---

## Related Knowledge

- `/agent-creator` — create custom specialist agents for teams
- `/agent-engineering` — orchestration patterns, multi-agent design
- `/qa` > `references/multi-pass-review.md` — dimension-isolated review methodology
