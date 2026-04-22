---
name: agent-creator
description: Create, verify, or improve custom agents (agents/*.md). Use when creating a new agent, scaffolding agent file, picking role-template(s) and knowledge skills, verifying an existing agent, or improving agent effectiveness. Do NOT use for creating skills (use skill-creator), creating teams of agents (use team-creator), running existing agents (use team-orchestrator), configuring hooks (use hook-creator), or initial project setup that bundles many of the above (use init).
meta: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
---

# Agent Creator

## Concept

An agent is named after a **profession** and is built from two ingredients:

- **Role-template(s)** — behavioral primitives that describe how to think and structure work. Live at `templates/architect.md`, `templates/implementer.md`, `templates/reviewer.md`, `templates/operator.md`, `templates/writer.md`. Inlined into the agent body at creation time — copy the Mental model, Operating modes, Hard rules, and Anti-patterns sections and condense only where verbatim copy would be unreadable. The agent body should read as one voice, not a stitched-together checklist.
- **Knowledge skills** — domain expertise (react, database, security, etc.). Referenced via the `skills:` array in the agent frontmatter; preloaded into the agent's context by the runtime.

Put together with a short persona line that says who this agent is professionally. The agent body is:
1. Persona line ("You are a senior <profession> specialized in <domain>.")
2. Inlined role-template content (one or more)
3. Output format + "done means" specific to this agent

## Critical Rules

- **Always edit agents in `agents/`** — this is the source of truth. NEVER edit in `.claude/agents/` (it's a symlink to `../agents/`)
- **Agents are NOT skills** — different frontmatter, different mechanism, different directory
- **Inlining, not linking** — the role-template content is copied into the agent body. Future edits to a template do NOT propagate to existing agents automatically.
- **Subagents cannot spawn other subagents** — keep that in mind when choosing `tools`
- **Agent names are professions, one word** — `frontend`, `devops`, `writer`. Not `frontend-dev`, not `senior-writer-agent`.

## Flow Selection

1. **"Create" / "new" / "scaffold"** → Flow 1: Create
2. **"Verify" / "review" / "check"** → Flow 2: Verify
3. **"Improve" / "fix" / "refactor"** → Flow 3: Improve
4. **Ambiguous** → `AskUserQuestion` with create / verify / improve options

## Quick Reference

| Task | Workflow |
|------|----------|
| Create an agent | [workflows/create.md](workflows/create.md) |
| Verify an agent | [workflows/verify.md](workflows/verify.md) |
| Improve an agent | [workflows/improve.md](workflows/improve.md) |

## Composition — picking ingredients

### Step 1: pick role-template(s)

Each template defines behavior for one kind of work. An agent may inline one or several templates when the profession spans multiple modes.

| template | use for |
|----------|---------|
| `architect` | agents that design before building — architects, designers (UX) |
| `implementer` | agents that produce artifacts — frontend, backend, tester, devops |
| `reviewer` | agents that judge artifacts against criteria — reviewer, security, tester (for audits) |
| `operator` | agents that run live systems — devops, sre |
| `writer` | agents that produce human-facing text — writer |

When multiple templates are inlined, order them by the workflow sequence: architect → implementer → reviewer → operator → writer (some skipped). Within the agent body, label each section clearly.

### Step 2: pick knowledge skills

Preload the smallest useful set. A skill costs context; only add it if the agent routinely needs that knowledge preloaded rather than auto-triggered.

Examples of typical agent compositions:

```
frontend   → implementer + [frontend, web, html, css, accessibility]
backend    → implementer + [api-design, database, auth, caching, backend]
devops     → implementer + operator + [docker, kubernetes, ci-cd, release-engineering]
sre        → operator + reviewer + [reliability, observability, performance]
security   → reviewer + [security, auth, compliance]
tester     → implementer + reviewer + [testing]
designer   → architect + implementer + [design, html, css, accessibility]
architect  → architect + [architecture]
reviewer   → reviewer + []  (generic — picks up knowledge by context)
writer     → writer + [documentation]
```

### Step 3: write the persona + done criteria

Short. One sentence each:
- Who this agent is ("You are a senior frontend engineer focused on React-based SPAs with strict accessibility requirements.")
- What "done" looks like for this agent ("Deliver a reviewable diff with tests, run type-check + unit tests locally, report files touched and caveats.")

## Agent Types

```
Agent composition options:
├── Template agent — inlines role-template(s) + preloaded skills (DEFAULT)
│   The standard profession agent described above.
├── Standalone agent — fully custom body, no role-template
│   Use when: the agent's behavior doesn't fit any template and is not reusable.
└── Skill-wrapper agent — thin body + single skill preloaded via `skills:`
    Use when: a meta skill (e.g., hook-creator) is the entire behavior.
```

**Note:** For composing teams of multiple agents, use `team-creator` — it composes existing agents from `agents/` into a team, but it does NOT create new agents. If the team needs a new agent, this skill creates it first.

## Frontmatter Fields

| Field | Required | Type | Rules |
|-------|----------|------|-------|
| `name` | Yes | string | Lowercase, single word, must match filename |
| `description` | Yes | string/`\|` | When to delegate to this agent. Multiline `\|` for complex descriptions |
| `model` | No | string | `sonnet`, `opus`, `haiku`, full model ID, or `inherit` (default: `inherit`) |
| `color` | No | string | `orange`, `blue`, `magenta`, `green`, `red`, `purple`, `cyan`, `yellow`, `pink`, `indigo` |
| `tools` | No | string \| array | `Read, Edit, Bash` or `[Read, Edit, Bash]` |
| `disallowedTools` | No | string \| array | Tools to explicitly deny |
| `permissionMode` | No | string | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | number | Maximum agentic turns before stopping |
| `skills` | No | array | Knowledge skills to preload |
| `mcpServers` | No | array | MCP servers: string references or inline definitions |
| `hooks` | No | object | Lifecycle hooks (`PreToolUse`, `PostToolUse`, `Stop`) |
| `memory` | No | string | Persistent memory scope: `user`, `project`, or `local` |
| `background` | No | boolean | `true` to always run as background task (default: `false`) |
| `isolation` | No | string | `worktree` for isolated git worktree |

## Validation

After creating or editing an agent, verify:
1. **File exists**: `ls agents/<agent-name>.md`
2. **Symlink accessible**: `ls .claude/agents/<agent-name>.md`
3. **Quality**: run Flow 2 (Verify) for checklist validation

## References

- [templates/](templates/) — role-template assets inlined into agents
- [workflows/create.md](workflows/create.md) — Flow 1: Create Agent
- [workflows/verify.md](workflows/verify.md) — Flow 2: Verify Agent
- [workflows/improve.md](workflows/improve.md) — Flow 3: Improve Agent
- [references/agent-template.md](references/agent-template.md) — Agent file template and frontmatter reference
- [references/verification-checklist.md](references/verification-checklist.md) — Quality validation checklist
