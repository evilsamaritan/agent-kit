# agent-kit v2.1.0

## Purpose

Production-grade agents and skills — domain expertise packaged as context, not code.

## Concept

Agents are named after **professions**. Each profession is assembled from two ingredients:

- **Role-templates** — behavioral primitives ("how to think, how to structure work"). Live in `skills/agent-creator/templates/*.md`. NOT runtime skills — `agent-creator` inlines them into the agent body at creation time. Templates: `architect`, `implementer`, `reviewer`, `operator`, `writer`.
- **Knowledge skills** — domain expertise. Vendor-neutral (`database`, `caching`) or technology-specific (`react`, `rust`). Auto-triggered by Claude Code at runtime OR preloaded into agents via `skills:` frontmatter.

**Meta skills** — create and manage the rest (agents, skills, hooks, teams, project init).

**Base agent professions:** `architect`, `frontend`, `backend`, `devops`, `sre`, `security`, `tester`, `designer`, `reviewer`, `writer`.

## Rules

- Edit skills in `skills/`, NEVER in `.claude/skills/` (it's a symlink to `../skills/`)
- Edit agents in `agents/`, NEVER in `.claude/agents/` (it's a symlink to `../agents/`)
- One skill = one domain. Do not merge unrelated domains into a single skill.
- Every skill MUST have `name` and `description` in YAML frontmatter.
- Skill `name` must match its directory name exactly (lowercase, hyphens only).
- Description is the sole trigger — include WHAT it does + WHEN to use it + trigger phrases.
- Do not duplicate content between SKILL.md and sub-files. SKILL.md routes; sub-files contain depth.
- SKILL.md: soft target 500 lines, ceiling ~550 (applies uniformly to all skill classes). References have no hard limit — split by topic.
- Do NOT add `Co-Authored-By` to commit messages.
- **Teach patterns, not products** — SKILL.md teaches the pattern (what and when). Reference files may use specific tools as *examples*, but SKILL.md must not assume a particular tool or vendor.
- **Framework refs = extensions** — Framework-specific content (Next.js, Nuxt, Node.js) belongs in a separate reference file with an explicit name. SKILL.md covers the core technology only.
- **Decision trees before vendor tables** — Every skill that compares tools/vendors must lead with a decision tree, not a feature comparison table.
- **Version on every meaningful commit** — bump version in `CLAUDE.md` header, `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`. Use semver: patch for fixes, minor for new features/skills/agents, major for breaking changes.

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `agents/` | Base agents (one-word profession names) |
| `skills/` | **Flat** — knowledge skills + meta skills, no subcategories, no `category:` field |
| `skills/agent-creator/templates/` | Role-templates (architect, implementer, reviewer, operator, writer) |
| `.claude-plugin/` | Plugin manifest and marketplace metadata |

## Skills are flat

No `category:` field, no subdirectories. Meta skills are identified by function (names ending in `-creator`, or `init`, `team-*`). Everything else is knowledge.

## Skill Standard

- **SKILL.md** — soft target 500 lines, ceiling ~550. Compact core guide with decision trees, patterns, anti-patterns, context adaptation, quick references. For multi-procedure skills, also acts as entry point/router to workflows.
- **references/** — Split by topic, loaded on demand. No size limit per file — depth matters. Split when a single reference exceeds ~500 lines or covers clearly distinct subtopics.
- **workflows/** — Step-by-step procedures (review protocols, creation flows). Optional — not every skill needs workflows.
- All user-facing skills are `user-invocable: true`.
- Framework-specific content belongs in a separate reference file with an explicit name. SKILL.md covers the core technology only.
- Agents can preload any combination of skills via `skills:` field.
- Volatile content (dates, prices, enforcement trends) belongs in references/, not core SKILL.md.

### Structure Templates by Class

**Broad knowledge skill:**
```
## Scope and boundaries
## Decision tree
## Core rules / patterns
## Context Adaptation
## Anti-Patterns
## Related Knowledge
## References
```

**Specialized / language / framework skill:**
```
## Core concepts / Mental model
## Decision points
## Hard rules
## Anti-Patterns
## Related Knowledge / Sibling boundaries
## References
```

**Regulatory skill:**
```
## Scope and boundaries
## Decision tree
## Core rules / patterns
## Context Adaptation
## Anti-Patterns
## Related Knowledge
## References
```
Note: Evergreen principles in SKILL.md, volatile data (dates, fines, enforcement trends) in references/.

**Meta skill:**
```
## Purpose            # Optional — only if it adds context beyond description
## Critical rules
## Flow selection
## Quick reference
## Validation         # Optional — include for producer meta-skills (write files/configs), skip for routers/dispatchers that delegate
## References
```

Meta sub-types: **Producer** (writes files — `skill-creator`, `agent-creator`, `update-config`, `hook-creator`) includes Validation. **Router / dispatcher** (delegates — `init`, `team-creator`, `team-orchestrator`) may skip Validation.

## Role-template standard (special asset — NOT a skill)

Role-templates live in `skills/agent-creator/templates/*.md`. They are plain markdown files (no YAML frontmatter, no directory) — assets consumed by `agent-creator` which inlines them into new agent bodies.

```
## Mental model        # How this role thinks
## Operating modes     # Plan / Implement / Verify / Report
## Hard rules          # Must-do and never-do
## Output format       # What the agent produces
## Anti-patterns       # Common failure modes
```

Role-templates:
- Are **domain-agnostic** — never mention `react`, `docker`, `go`, etc.
- Describe **behavior only** — how to think, how to structure work, how to communicate.
- Are **short** — 100–200 lines. Longer means domain crept in.
- Are **composable** — an agent may inline 1–3 templates without conflict.

## Context Engineering Principles

Context window is a shared resource. Every token competes with the user's actual work.

1. **Context is finite** — tool outputs consume ~84% of tokens in agent workflows. Budget accordingly.
2. **Progressive disclosure (3 levels):**
   - Level 1: YAML frontmatter → always in system prompt (description = trigger)
   - Level 2: SKILL.md body → loaded when skill is relevant
   - Level 3: Linked files (workflows/, references/) → loaded on demand
3. **Description is the sole trigger** — must answer WHAT + WHEN. Include phrases users would actually say. Add negative triggers ("Do NOT use for...") if over-triggering.
4. **Lost-in-Middle effect** — models have U-shaped attention. Place critical info at start and end of documents.
5. **Four-Bucket strategy** — Write (store externally), Select (retrieve relevant), Compress (summarize), Isolate (split across sub-agents).
6. **Code over language** — scripts are deterministic; natural language interpretation is not. Use `scripts/` for validation.
7. **Composability** — skills load simultaneously. Each skill must work alongside others without conflicts.
8. **Size budgets** — SKILL.md maximum 500 lines (ceiling, not target). References: no hard limit, split by topic. Skill descriptions ~ 2% of context window.
9. **Tool consolidation** — favor comprehensive tools over fragmented ones. If a human can't decide which tool to use, an agent won't either.
10. **Test triggering** — skill should trigger on 90%+ of relevant queries AND not trigger on unrelated topics.

## Skill Anatomy

### Frontmatter (Level 1 — always loaded)

```yaml
---
name: skill-name                    # Required. Lowercase + hyphens, max 64 chars, matches directory.
description: Verb phrase. Use when trigger phrases.  # Required. Single line; soft target 80-500 chars, hard cap 1024.
allowed-tools: Read, Edit, Bash     # Comma-separated string (NOT YAML list).
user-invocable: true                # Show in /slash menu (default: true). Recommended for all skills.
context: fork                       # Isolated sub-agent execution.
agent: general-purpose              # Agent type when context: fork.
model: model-id                     # Override model.
argument-hint: "[issue-number]"     # Autocomplete hint for arguments.
disable-model-invocation: false     # Prevent auto-loading.
hooks: {}                           # Lifecycle hooks (PreToolUse, PostToolUse, Stop).
---
```

`$ARGUMENTS` (or `$1`, `$2`, `$ARGUMENTS[0]`) substitutes user input. Dynamic context: `` `!command` `` injects live output.

### Directory structure (Levels 2-3)

```
skill-name/
├── SKILL.md              # Entry point — overview, decision logic, quick reference
├── workflows/            # Step-by-step procedures (loaded on demand)
├── references/           # Documentation and knowledge (loaded on demand)
├── scripts/              # Executable validation/generation code
└── assets/               # Output files — never loaded into context
```

## Agent Anatomy

Agents are sub-agent definitions in `agents/`. YAML frontmatter configures behavior; body contains the inlined role-template(s) + persona + reference pointers.

### Frontmatter fields

```yaml
---
name: agent-name                    # Required. One word, profession-style (architect, frontend, devops).
description: What + when.           # Required.
tools: [Read, Edit, Bash]           # Allowed tools (array or comma-separated string).
disallowedTools: [Write]            # Denied tools (array or comma-separated string).
model: sonnet                       # Model override (sonnet, opus, haiku, full ID, inherit).
permissionMode: bypassPermissions   # default | acceptEdits | dontAsk | bypassPermissions | plan
maxTurns: 20                        # Max agentic turns.
skills: [skill-a, skill-b]         # Preload knowledge skills into agent context.
mcpServers: [server-name]           # Available MCP servers (string refs or inline defs).
memory: project                     # Persistent memory scope: user, project, local.
background: true                    # Run in background.
isolation: worktree                 # Git worktree isolation.
color: blue                         # Visual distinction (orange, blue, magenta, green, red, purple, cyan, yellow, pink, indigo).
hooks: {}                           # Lifecycle hooks.
---
```

### Body structure

The body is assembled by `agent-creator`:

1. **Inlined role-template(s)** — copy of `skills/agent-creator/templates/{role}.md` content, one per role.
2. **Persona** — "You are a [profession] who [specialization]" — domain focus specific to this agent.
3. **Skill pointers** — references to preloaded knowledge skills for reasoning about domain.
4. **Output format + Done criteria** — concrete deliverables.

## Creating Skills

Use `skill-creator`: describe what you need ("create a skill for X"). See `skills/skill-creator/`.

## Creating Agents

Use `agent-creator`: describe what you need ("create an agent for X"). See `skills/agent-creator/`.

1. Pick **role-template(s)** from `skills/agent-creator/templates/` — defines behavior.
2. Pick **knowledge skills** to preload — defines domain.
3. Write the **persona** line — who this agent is professionally.
4. Set constraints (permissions, tools, max turns).
5. Place the file in `agents/` with a one-word profession name.

## References

- [skill-creator](skills/skill-creator/) — authoring knowledge and meta skills
- [agent-creator](skills/agent-creator/) — assembling agents from role-templates + knowledge skills
- [team-creator](skills/team-creator/) — composing teams from existing agents
- [team-orchestrator](skills/team-orchestrator/) — running saved teams
- [hook-creator](skills/hook-creator/) — lifecycle hooks
- [init](skills/init/) — project bootstrap router
