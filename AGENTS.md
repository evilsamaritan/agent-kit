# agent-kit

## Purpose

Production-grade agents and skills — domain expertise packaged as context, not code.

## Rules

- Edit skills in `skills/`, NEVER in `.claude/skills/` (it's a symlink to `../skills/`)
- Edit agents in `agents/`, NEVER in `.claude/agents/` (it's a symlink to `../agents/`)
- One skill = one domain. Do not merge unrelated domains into a single skill.
- Every skill MUST have `name` and `description` in YAML frontmatter.
- Skill `name` must match its directory name exactly (lowercase, hyphens only).
- Description is the sole trigger — include WHAT it does + WHEN to use it + trigger phrases.
- Do not duplicate content between SKILL.md and sub-files. SKILL.md routes; sub-files contain depth.
- SKILL.md: maximum 500 lines (ceiling, not target). References have no hard limit — split by topic.
- Do NOT add `Co-Authored-By` to commit messages.
- **Teach patterns, not products** — SKILL.md teaches the pattern (what and when). Reference files may use specific tools as *examples*, but SKILL.md must not assume a particular tool or vendor.
- **Framework refs = extensions** — Framework-specific content (Next.js, Nuxt, Node.js) belongs in a separate reference file with an explicit name. SKILL.md covers the core technology only.
- **Decision trees before vendor tables** — Every skill that compares tools/vendors must lead with a decision tree, not a feature comparison table.

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `agents/` | Sub-agent definitions (YAML frontmatter + persona + workflow) |
| `skills/` | Skill packages (SKILL.md + workflows/ + references/ + scripts/) |
| `.claude-plugin/` | Plugin manifest and marketplace metadata |
| `docs/` | Project documentation and roadmaps |

## Skill Taxonomy

Skills are classified by **type** and **scope**:

| Type | Purpose | Examples |
|------|---------|---------|
| **role** | Persona with workflows, owns a domain | frontend, backend, security, ai-engineer |
| **knowledge** | Domain expertise loaded on demand | database, auth, caching, react, rust |
| **meta** | Skills that create/manage other skills or agents | skill-creator, agent-creator |

Knowledge skills have a **scope** sub-level:

| Scope | Meaning | Agnostic rule | Examples |
|-------|---------|---------------|---------|
| **broad** | Wide domain, multiple technologies | Must be vendor/framework agnostic in SKILL.md | database, search, caching |
| **specialized** | Narrow sub-domain | May be specific by design | graphql, realtime, payments |
| **language** | Programming language | Specific by design | typescript, rust, kotlin |
| **framework** | Framework/library | Specific by design | react, vue, feature-sliced-design |
| **platform-tech** | Platform-level technology | Specific by design | docker, kubernetes |
| **regulatory** | Compliance/regulatory domain | Evergreen principles in core, volatile data in references/ | compliance |

**Rule:** Broad/role skills must be framework/vendor agnostic in core SKILL.md. Specialized/framework skills may be specific by design.

## Skill Standard

- **SKILL.md** — maximum 500 lines (ceiling, not target). Compact core guide with decision trees, patterns, anti-patterns, context adaptation, quick references. For multi-procedure skills, also acts as entry point/router to workflows.
- **references/** — Split by topic, loaded on demand. No size limit per file — depth matters. Split when a single reference exceeds ~500 lines or covers clearly distinct subtopics.
- **workflows/** — Step-by-step procedures (review protocols, creation flows). Optional — not every skill needs workflows.
- All skills are `user-invocable: true` unless marked `internal: true`
- Framework-specific content belongs in a separate reference file with an explicit name. SKILL.md covers the core technology only.
- Cross-domain skills include a **Context Adaptation** section showing relevant aspects per role
- Agents can preload any combination of skills via `skills:` field
- Volatile content (dates, prices, enforcement trends) belongs in references/, not core SKILL.md

### Structure Templates by Class

**Role skill:**
```
## What this role owns
## What this role does not own
## Operating modes
## Critical rules
## Workflow routing
## Anti-Patterns
## Related Knowledge
## References
```

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
## Purpose
## Critical rules
## Flow selection
## Quick reference
## Validation
## References
```

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
description: Verb phrase. Use when trigger phrases.  # Required. Single line, max 1024 chars.
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

Agents are sub-agent definitions in `agents/`. YAML frontmatter configures behavior; body defines persona and workflow.

### Frontmatter fields

```yaml
---
name: agent-name                    # Required.
description: What + when.           # Required.
tools: [Read, Edit, Bash]           # Allowed tools (array or comma-separated string).
disallowedTools: [Write]            # Denied tools (array or comma-separated string).
model: sonnet                       # Model override (sonnet, opus, haiku, full ID, inherit).
permissionMode: bypassPermissions   # default | acceptEdits | dontAsk | bypassPermissions | plan
maxTurns: 20                        # Max agentic turns.
skills: [skill-a, skill-b]         # Preload full skill content into agent context.
mcpServers: [server-name]           # Available MCP servers (string refs or inline defs).
memory: project                     # Persistent memory scope: user, project, local.
background: true                    # Run in background.
isolation: worktree                 # Git worktree isolation.
color: blue                         # Visual distinction (orange, blue, magenta, green, red, purple, cyan, yellow, pink, indigo).
hooks: {}                           # Lifecycle hooks.
---
```

### Body structure

```markdown
You are a [role] with [expertise].

**Your job:** [one sentence deliverable]

**Skill and workflow:**
Skill: <skill-name>
Workflow: <path-to-workflow>

**References (load when needed):**
- `references/X.md` — for Y decisions

**Output format:**
1. [Deliverable 1]
2. [Deliverable 2]

**Rules:**
- [Constraint 1]
- [Constraint 2]

**Done means:**
- [Completion criteria]
```

## Creating Skills

Use the skill-creator: `/agent-kit:skill-creator` or describe what you need ("create a skill for X").

References:
- `skills/skill-creator/references/best-practices.md` — authoring patterns
- `skills/skill-creator/references/skill-template.md` — unified template
- `skills/skill-creator/references/verification-checklist.md` — 48-check validation

## Creating Agents

Use the agent-creator: describe what you need ("create an agent for X").

1. Define the role — what domain expertise does this agent have?
2. Choose skills — which skills should preload into agent context?
3. Set constraints — permission mode, allowed tools, max turns.
4. Write persona — imperative tone, explicit deliverables, completion criteria.
5. Place in `agents/` — filename = `agent-name.md`.

## References

- [best-practices.md](skills/skill-creator/references/best-practices.md) — skill authoring conventions
- [skill-template.md](skills/skill-creator/references/skill-template.md) — unified skill template
- [verification-checklist.md](skills/skill-creator/references/verification-checklist.md) — 48-check verification
