---
name: team-orchestrator
description: Run, monitor, and stop existing agent teams. Reads team.json from .claude/teams/, spawns agents (single, multi-instance, or full team), aggregates findings. Use when launching a saved team, running ad-hoc multi-agent compositions, or executing pre-defined teams (review, implement, full-audit). Do NOT use to create or modify teams (use team-creator) or to configure hooks (use hook-creator).
allowed-tools: Read, Bash, Glob, Grep, Agent, AskUserQuestion
user-invocable: true
argument-hint: "[team-name or task-description]"
---

# Team Orchestration Runtime

Read existing team configurations from `.claude/teams/<name>/team.json`, spawn agents according to the flow, monitor execution, aggregate results. Pure consumer of team definitions — never mutates them.

**Hard rules:**
- This skill MUST run in the main conversation (no `context: fork`) — subagents cannot spawn subagents
- Discover agents dynamically (`glob agents/*.md`) — never hardcode agent availability
- Pipeline mode is the default — parallel/tmux only when tasks are independent AND setup is complete
- Always confirm team composition with the user before executing
- Compress context between pipeline stages (3-5 key findings + file locations, not full output)
- Never write to `team.json` — that's team-creator's job
- Schema validation before launch via `bash skills/team-creator/scripts/validate-team.sh`

---

## Flow Selection

```
What does the user want?
├── Single agent spawn ("review this with security agent", "run frontend on this")
│   └── Identify agent → spawn one instance → done
│
├── Multi-instance ("run 3 tester agents on different modules")
│   └── Same agent type × N instances, each with its own scope/prompt
│
├── Named team ("/team-orchestrator review", "/team-orchestrator poker-ui")
│   ├── Check .claude/teams/<name>/team.json → saved custom team?
│   └── Check team-creator's team-catalog.md → built-in team?
│
├── Task description ("/team-orchestrator implement OAuth login")
│   └── Analyze → propose agents (type + count) → confirm with user → execute
│
├── Ad-hoc spawn ("/team-orchestrator spawn 3 agents for X, Y, Z")
│   └── Each agent gets individual prompt, parallel orchestration
│
└── Setup ("/team-orchestrator setup")
    └── Check prerequisites for Agent Teams mode
```

**Key:** Infer from the request — how many agents, which type(s), one type or mixed. The user shouldn't have to specify the orchestration mode explicitly.

→ Full orchestration workflow: `workflows/orchestrate.md`
→ Setup for parallel mode: `workflows/setup.md`

---

## Approaches

### A) Single Agent

```
/team-orchestrator run security on src/auth/
/team-orchestrator review this PR with architect
```

One agent, one task. Useful when the user wants a specific specialist but doesn't want to remember the Agent tool syntax. Infer the agent from the request.

### B) Multi-Instance (same agent × N)

```
/team-orchestrator run 3 tester agents: one for api/, one for web/, one for workers/
/team-orchestrator 4 frontend reviewers for each page component
```

Same agent type spawned multiple times with different scopes. All run in parallel with `run_in_background: true`. Each instance gets its own prompt with the specific scope.

### C) Pre-defined or Saved Team

```
/team-orchestrator review
/team-orchestrator implement
/team-orchestrator my-fullstack  (from .claude/teams/my-fullstack/team.json)
```

Known composition. Fastest path — no decisions needed. Custom teams in `.claude/teams/<name>/` override built-in catalog.

### D) Task-based Composition (ad-hoc)

```
/team-orchestrator implement OAuth with social login
```

Skill analyzes the task, checks available agents (custom first, then default), proposes team (type + count for each), asks for confirmation. Does NOT save the composition — for persistence, the user goes to team-creator.

### E) Ad-hoc Spawn

```
/team-orchestrator spawn: agent-1 researches auth patterns, agent-2 implements API, agent-3 writes tests
```

No team structure. Each agent gets its own prompt. Just orchestration — parallel execution.

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
architect (plan) → frontend + backend (parallel, background) → tester (test) → done
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

→ Run `/team-orchestrator setup` to check prerequisites
→ tmux layouts: `references/tmux-layouts.md`

### Builder-Validator Pattern

Split implementation and review into separate agents with different permissions:

```
Builder (Write, Edit, Bash) → writes code
Validator (Read, Grep, Glob only) → reviews, cannot edit — creates tasks back to builder
```

Validator's read-only constraint forces it to surface problems rather than silently "fixing" them. Use for implementation teams where quality matters.

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

→ For configuring these hooks safely, delegate to `/hook-creator`.

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
| Modifying team.json from orchestrator | Schema drift | Use team-creator for any team config changes |

---

## Quick Reference

| Task | Resource |
|------|----------|
| Orchestrate a team | [workflows/orchestrate.md](workflows/orchestrate.md) |
| Setup parallel/Agent Teams mode | [workflows/setup.md](workflows/setup.md) |
| Advanced patterns | [references/orchestration-patterns.md](references/orchestration-patterns.md) |
| tmux pane layouts | [references/tmux-layouts.md](references/tmux-layouts.md) |
| Pre-defined team details | `skills/team-creator/references/team-catalog.md` |
| Validate team config | `bash skills/team-creator/scripts/validate-team.sh` |
| Check Agent Teams prerequisites | `bash scripts/check-env.sh` |

---

## Related Knowledge

- `/team-creator` — create or reconfigure team definitions (writes team.json)
- `/agent-creator` — create custom specialist agents for teams
- `/testing` > `references/multi-pass-review.md` — dimension-isolated review methodology
