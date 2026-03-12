---
name: agent-creator
description: Create, verify, or improve custom agents (agents/*.md). Use when creating a new agent, scaffolding agent file, verifying agent quality, reviewing an existing agent, or improving agent effectiveness.
internal: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# Agent Creator

## Purpose

Create new custom agents with proper structure, verify existing agents against quality standards, or improve agents based on feedback. Handles both standalone agents (full system prompt in body) and skill agents (thin wrapper with `skills:` field delegating to a skill).

## Critical Rules

- **Always edit agents in `agents/`** — this is the source of truth. NEVER edit in `.claude/agents/` or `.cursor/agents/` (those are symlinks to `../agents/`)
- **Agents are NOT skills** — different frontmatter, different mechanism
- **Description field uses `|` for multiline** — unlike skills which require single-line

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

## Frontmatter Fields

| Field | Required | Type | Rules |
|-------|----------|------|-------|
| `name` | Yes | string | Lowercase + hyphens only, must match filename (without .md) |
| `description` | Yes | string/`\|` | When Claude should delegate to this agent. Multiline `\|` for complex descriptions |
| `model` | No | string | `sonnet`, `opus`, `haiku`, or `inherit` (default: `inherit`) |
| `color` | No | string | `orange`, `blue`, `magenta`, `green`, `red`, `purple`, `cyan`, `yellow`, `pink`, `indigo` |
| `tools` | No | string | Comma-separated: `Read, Edit, Write, Bash, Glob, Grep, WebFetch, WebSearch` |
| `disallowedTools` | No | string | Tools to explicitly deny |
| `permissionMode` | No | string | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | number | Maximum agentic turns before stopping |
| `skills` | No | array | Skill names to preload into agent context at startup |
| `mcpServers` | No | object | MCP servers available to this agent |
| `hooks` | No | object | Lifecycle hooks (`PreToolUse`, `PostToolUse`, `Stop`) |
| `memory` | No | string | `user`, `project`, or `local` for persistent memory |
| `isolation` | No | string | `worktree` for isolated git worktree |

## References

- [create.md](workflows/create.md) — Flow 1: Create Agent
- [verify.md](workflows/verify.md) — Flow 2: Verify Agent
- [improve.md](workflows/improve.md) — Flow 3: Improve Agent
- [agent-template.md](references/agent-template.md) — Agent file template
- [verification-checklist.md](references/verification-checklist.md) — Quality checks
