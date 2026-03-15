---
name: team-creator
description: Orchestrate multi-agent teams for complex tasks — code review, feature implementation, security audit, architecture review. Use when a task needs multiple specialists working together. Spawns pre-defined or custom agent teams as pipelines or parallel workers. Do NOT use for single-domain tasks or creating agents (use agent-creator).
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
├── Named team ("/team-creatorreview", "/team-creatormy-fullstack")
│   ├── Check .claude/teams.json → saved custom team?
│   └── Check team-catalog.md → built-in team?
│
├── Task description ("/team-creatorimplement OAuth login")
│   └── Analyze → propose agents → confirm with user → execute
│
├── Ad-hoc spawn ("/team-creatorspawn 3 agents for X, Y, Z")
│   └── Each agent gets individual prompt, parallel orchestration
│
└── Setup ("/team-creatorsetup")
    └── Check prerequisites for parallel mode
```

→ Full orchestration workflow: `workflows/orchestrate.md`
→ Setup for parallel mode: `workflows/setup.md`

---

## Three Approaches

### A) Pre-defined Team

```
/team-creator review
/team-creator implement
/team-creator my-fullstack  (from .claude/teams.json)
```

Known composition from catalog or saved config. Fastest path — no decisions needed.

### B) Task-based Composition

```
/team-creator implement OAuth with social login
```

Skill analyzes the task, checks available agents (custom first, then default), proposes team, asks for confirmation. Optionally saves for reuse.

### C) Ad-hoc Spawn

```
/team-creator spawn: agent-1 researches auth patterns, agent-2 implements API, agent-3 writes tests
```

No team structure. Each agent gets its own prompt. Just orchestration — tmux layout + parallel execution.

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

Full peer-to-peer teams with shared task list, mailbox, tmux panes.

- Requires: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + tmux
- Run `/team-creator setup` to check and configure prerequisites
- Native tmux integration: `teammateMode: "tmux"`
- **Delegate mode:** `Shift+Tab` — restricts lead to coordination only (no code edits)
- **Task list:** `Ctrl+T` to view, tasks support dependency DAGs (task B blocked until A completes)
- **Cycle teammates:** `Shift+Down` to switch between teammate panes
- **Worktree isolation:** `claude --worktree task-name --tmux` for independent branches
- **Cost:** 3 teammates ≈ 3-4x token usage vs single session

→ tmux layouts: `references/tmux-layouts.md`

### Builder-Validator Pattern

Split implementation and review into separate agents with different permissions:

```
Builder (Write, Edit, Bash) → writes code
Validator (Read, Grep, Glob only) → reviews, cannot edit — creates tasks back to builder
```

Validator's read-only constraint forces it to surface problems rather than silently "fixing" them. Use for implementation teams where quality matters.

---

## Custom Agents in Teams

Custom agents created via `/agent-creator` with pre-configured skills are preferred over generic role agents:

```
Custom agent (react-specialist: frontend + react + html-css)
  > Generic agent (frontend: decides skills at runtime)
```

**Priority:** custom agent with matching skills > default role agent.

After composing a team, save it to `.claude/teams.json` for reuse:

```json
{
  "teams": {
    "my-fullstack": {
      "agents": ["react-specialist", "node-api-dev", "qa"],
      "flow": "pipeline",
      "description": "Full-stack React + Node implementation"
    }
  }
}
```

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
| Spawn team for single-domain task | Overhead, slower | Use one agent directly |
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
| Orchestrate a team | [workflows/orchestrate.md](workflows/orchestrate.md) |
| Setup parallel mode | [workflows/setup.md](workflows/setup.md) |
| Pre-defined team details | [references/team-catalog.md](references/team-catalog.md) |
| Advanced patterns | [references/orchestration-patterns.md](references/orchestration-patterns.md) |
| tmux pane layouts | [references/tmux-layouts.md](references/tmux-layouts.md) |
| Check prerequisites | `scripts/check-env.sh` |

---

## Related Knowledge

- `/agent-creator` — create custom specialist agents for teams
- `/agent-engineering` — orchestration patterns, multi-agent design
- `/qa` > `references/multi-pass-review.md` — dimension-isolated review methodology
