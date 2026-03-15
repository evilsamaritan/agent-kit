---
name: agent-creator
description: Create, verify, or improve custom agents (agents/*.md). Use when creating a new agent, scaffolding agent file, verifying agent quality, reviewing an existing agent, or improving agent effectiveness. Do NOT use for skills — use skill-creator instead.
meta: true
internal: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# Agent Creator

## Purpose

Create new custom agents with proper structure, verify existing agents against quality standards, or improve agents based on feedback. Handles standalone agents (full system prompt in body), skill agents (thin wrapper with `skills:` field), and composite agents (role skill + knowledge skills).

## Critical Rules

- **Always edit agents in `agents/`** — this is the source of truth. NEVER edit in `.claude/agents/` (it's a symlink to `../agents/`)
- **Agents are NOT skills** — different frontmatter, different mechanism, different directory
- **Agent descriptions support multiline `|`** — unlike skills which require single-line
- **Subagents cannot spawn other subagents** — use skills or chain from main conversation

## Flow Selection

Determine which flow to run:

1. **User said "create" / "new" / "scaffold"** → Flow 1: Create
2. **User said "verify" / "review" / "check"** → Flow 2: Verify
3. **User said "improve" / "fix" / "refactor"** → Flow 3: Improve
4. **Ambiguous** → Use `AskUserQuestion`:
   - Option A: "Create a new agent"
   - Option B: "Verify an existing agent"
   - Option C: "Improve an existing agent"

## Quick Reference

| Task | Flow | Details |
|------|------|---------|
| Create an agent | Flow 1 | [create.md](workflows/create.md) |
| Verify an agent | Flow 2 | [verify.md](workflows/verify.md) |
| Improve an agent | Flow 3 | [improve.md](workflows/improve.md) |

## Agent Types

```
What kind of agent?
├── Standalone agent — full system prompt in body, no skills dependency
│   Use when: agent needs unique instructions not reusable as a skill
└── Skill agent — thin body + `skills: [skill-name]` preloads skill context
    Use when: a skill already exists with the logic, agent adds model/tools/permissions config
```

## Composite Agents

Composite agents combine a role skill with knowledge skills for specialized work. They are the primary way to create domain-specific workers.

```
When to create a composite agent?
├── Need a specialist for a specific tech stack?
│   Example: "Rust backend with PostgreSQL and gRPC"
│   → skills: [backend, rust, database, api-design]
│
├── Need a cross-domain reviewer?
│   Example: "Security + compliance auditor"
│   → skills: [security, compliance, auth]
│
└── Need a focused implementer?
    Example: "React frontend with accessibility"
    → skills: [frontend, react, accessibility, html-css]
```

**Composition rules:**
- Start with ONE role skill (backend, frontend, architect, etc.) — this defines the primary workflow
- Add as many knowledge skills as the task requires — no artificial limit
- The role skill's workflows guide the agent; knowledge skills provide depth

**Common compositions:**

| Role | + Knowledge Skills | Use Case |
|------|-------------------|----------|
| backend | + typescript + database + auth | Node.js API developer |
| backend | + rust + database + api-design | Rust service developer |
| backend | + kotlin + database + message-queues | JVM microservice developer |
| frontend | + react + html-css + accessibility | React UI developer |
| frontend | + vue + html-css + i18n | Vue i18n developer |
| architect | + database + caching + message-queues | Data architecture reviewer |
| security | + auth + compliance + web-platform | Full security auditor |
| devops | + docker + kubernetes + networking | Platform engineer |
| sre | + observability + performance + networking | Reliability reviewer |

## Frontmatter Fields

| Field | Required | Type | Rules |
|-------|----------|------|-------|
| `name` | Yes | string | Lowercase + hyphens only, must match filename (without .md) |
| `description` | Yes | string/`\|` | When Claude should delegate to this agent. Multiline `\|` for complex descriptions |
| `model` | No | string | `sonnet`, `opus`, `haiku`, full model ID (e.g., `claude-opus-4-6`), or `inherit` (default: `inherit`) |
| `color` | No | string | `orange`, `blue`, `magenta`, `green`, `red`, `purple`, `cyan`, `yellow`, `pink`, `indigo` |
| `tools` | No | string \| array | `Read, Edit, Bash` or `[Read, Edit, Bash]`. Supports `Agent(type)` to restrict spawnable subagents |
| `disallowedTools` | No | string \| array | Tools to explicitly deny |
| `permissionMode` | No | string | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | number | Maximum agentic turns before stopping |
| `skills` | No | array | Skill names to preload — full content injected, not just available for invocation |
| `mcpServers` | No | array | MCP servers: string references (reuse configured) or inline definitions (scoped to agent) |
| `hooks` | No | object | Lifecycle hooks (`PreToolUse`, `PostToolUse`, `Stop`) |
| `memory` | No | string | Persistent memory scope: `user`, `project`, or `local` |
| `background` | No | boolean | `true` to always run as background task (default: `false`) |
| `isolation` | No | string | `worktree` for isolated git worktree |

## Validation

After creating or editing an agent, verify:

1. **File exists**: `ls agents/<agent-name>.md`
2. **Symlink accessible**: `ls .claude/agents/<agent-name>.md`
3. **Quality**: chain to Flow 2 (Verify) for full 30-check validation

## References

- [create.md](workflows/create.md) — Flow 1: Create Agent
- [verify.md](workflows/verify.md) — Flow 2: Verify Agent
- [improve.md](workflows/improve.md) — Flow 3: Improve Agent
- [agent-template.md](references/agent-template.md) — Agent file templates and frontmatter reference
- [verification-checklist.md](references/verification-checklist.md) — 30-check quality validation
