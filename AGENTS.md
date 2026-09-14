# agent-kit v3.1.1

## Purpose

Reusable profession profiles, skills, and helpers — domain expertise packaged as context, not a custom agent runtime.

## Concept

Profession **profiles** are the stable base entity. A project agent is assembled from a profile plus an exact set of skills, then materialized into the current harness's native format.

- **Role-templates** — behavioral primitives ("how to think, how to structure work"). Live in `skills/agent-creator/templates/*.md`. NOT runtime skills — `agent-creator` writes profile bodies from them, adapting each to the profession. Templates: `architect`, `implementer`, `reviewer`, `operator`, `writer`.
- **Knowledge skills** — domain expertise. Vendor-neutral (`database`, `caching`) or technology-specific (`react`, `rust`). Discovered by compatible runtimes or preloaded into Claude Code agents via `skills:` frontmatter.

**Meta skills** — create and manage the rest (`agent-creator`, `agent-orchestrator`, `skill-creator`, hooks, project init).

**Base profession profiles:** `architect`, `frontend`, `backend`, `devops`, `sre`, `security`, `tester`, `designer`, `reviewer`, `writer`.

## Rules

- Edit shared skills in `skills/`; the repository does not ship project-local `.claude/` or `.agents/` configuration
- Edit reusable professions in `profiles/<name>/`, NEVER in `.claude/agents/`, `.codex/agents/`, or `.claude-plugin/agents/` — those are native generated targets
- Regenerate package targets with `scripts/generate-profiles.mjs` after touching a profile; `--check` fails the build when they drift
- In consuming projects, edit `.agent-kit/agents.json` and run `skills/agent-creator/scripts/materialize-agents.mjs`; never copy profile or skill sources
- One skill = one domain. Do not merge unrelated domains into a single skill.
- Every skill MUST have `name` and `description` in YAML frontmatter.
- Skill `name` must match its directory name exactly (lowercase, hyphens only).
- Description is the portable trigger — front-load WHAT + WHEN and phrases users actually say. Runtime-specific routing fields are optional extensions.
- Do not duplicate content between SKILL.md and sub-files. SKILL.md routes; sub-files contain depth.
- SKILL.md: soft target 500 lines, ceiling ~550 (applies uniformly to all skill classes). References have no hard limit — split by topic.
- Do NOT add `Co-Authored-By` to commit messages.
- **Teach patterns, not products** — SKILL.md teaches the pattern (what and when). Reference files may use specific tools as *examples*, but SKILL.md must not assume a particular tool or vendor.
- **Framework refs = extensions** — Framework-specific content (Next.js, Nuxt, Node.js) belongs in a separate reference file with an explicit name. SKILL.md covers the core technology only.
- **Decision trees before vendor tables** — Every skill that compares tools/vendors must lead with a decision tree, not a feature comparison table.
- **Version on every meaningful commit** — bump version in the canonical `AGENTS.md` header (exposed to Claude Code through the `CLAUDE.md` symlink), `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `.codex-plugin/plugin.json`. Use semver: patch for fixes, minor for new features/skills/agents, major for breaking changes.
- **One shared skill source** — Claude Code and Codex manifests both expose the canonical `skills/` directory. Never copy runtime-specific variants of a skill.
- **Keep packaging runtime-specific** — Claude metadata and the shared repository marketplace live in `.claude-plugin/`; Codex plugin metadata lives in `.codex-plugin/`. Project-local `.claude/` and `.agents/` directories are not package sources.

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `profiles/<name>/` | Profession canon — `PROFILE.md` (core + body), `claude.yaml`, `codex.yaml` |
| `.claude-plugin/agents/` | Generated Claude Code agents (listed in `plugin.json`) |
| `skills/agent-creator/scripts/materialize-agents.mjs` | Project composition → native Claude/Codex agents |
| `skills/agent-orchestrator/` | Chooses and runs agents through host-native delegation |
| `skills/` | **Flat** — knowledge skills + meta skills, no subcategories, no `category:` field |
| `skills/agent-creator/templates/` | Role-templates (architect, implementer, reviewer, operator, writer) |
| `.claude-plugin/` | Claude manifest plus the repository marketplace catalog used by Claude and as Codex's legacy-compatible source |
| `.codex-plugin/` | Codex plugin manifest |
| `scripts/` | Repository-wide compatibility and maintenance utilities |

## Skills are flat

No `category:` field, no subdirectories. Meta skills are identified by function (names ending in `-creator`, `agent-orchestrator`, or `init`). Everything else is knowledge.

## Skill Standard

- **SKILL.md** — soft target 500 lines, ceiling ~550. Compact core guide with decision trees, patterns, anti-patterns, context adaptation, quick references. For multi-procedure skills, also acts as entry point/router to workflows.
- **references/** — Split by topic, loaded on demand. No size limit per file — depth matters. Split when a single reference exceeds ~500 lines or covers clearly distinct subtopics.
- **workflows/** — Step-by-step procedures (review protocols, creation flows). Optional — not every skill needs workflows.
- User-facing skills are invocable by default; add `user-invocable: false` only for model-only background knowledge.
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

Meta sub-types: **Producer** (writes files — `skill-creator`, `agent-creator`, `update-config`, `hook-creator`) includes Validation. **Router / dispatcher** (delegates — `init`, `agent-orchestrator`) may skip Validation.

## Role-template standard (special asset — NOT a skill)

Role-templates live in `skills/agent-creator/templates/*.md`. They are plain markdown files (no YAML frontmatter, no directory) — editorial guidance `agent-creator` writes new profile bodies from. They are not a build input: bodies are rewritten in profession terms, the generator never expands a template, and editing one changes nothing about existing profiles. Core `role:` names the templates a body was written from, and the generator checks that each has one exact `## Role — <role>` section.

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
- Are **composable** — a profile may declare 1–3 roles without conflict, one body section each.

## Context Engineering Principles

Context window is a shared resource. Every token competes with the user's actual work.

1. **Context is finite** — tool output and repeated instructions often dominate long agent runs. Budget and compress them deliberately.
2. **Progressive disclosure (3 levels):**
   - Level 1: YAML frontmatter → always in system prompt (description = trigger)
   - Level 2: SKILL.md body → loaded when skill is relevant
   - Level 3: Linked files (workflows/, references/) → loaded on demand
3. **Description is the portable trigger** — front-load WHAT + WHEN and phrases users actually say. Claude Code may extend routing with `when_to_use` and `paths`; keep `description` sufficient on its own for Codex and other Agent Skills runtimes.
4. **Lost-in-Middle effect** — models have U-shaped attention. Place critical info at start and end of documents.
5. **Four-Bucket strategy** — Write (store externally), Select (retrieve relevant), Compress (summarize), Isolate (split across sub-agents).
6. **Code over language** — scripts are deterministic; natural language interpretation is not. Use `scripts/` for validation.
7. **Composability** — skills load simultaneously. Each skill must work alongside others without conflicts.
8. **Size budgets** — SKILL.md soft target 500 lines, ceiling ~550. References have no hard limit but split by topic. Runtimes budget the initial skill list, so front-load descriptions and avoid repeated routing prose.
9. **Tool consolidation** — favor comprehensive tools over fragmented ones. If a human can't decide which tool to use, an agent won't either.
10. **Evaluate behavior** — use observed failures and representative requests to compare prompt or model changes. Persist evaluation cases only when an executable regression harness consumes them; otherwise they become unmaintained context noise.

## Skill Anatomy

### Frontmatter (Level 1 — always loaded)

```yaml
---
name: skill-name                    # Required. Lowercase + hyphens, max 64 chars, matches directory.
description: Verb phrase. Use when trigger phrases.  # Required. Single line; soft target 80-500 chars, hard cap 1024.
when_to_use: Extra Claude routing examples.          # Optional Claude Code extension; description stays portable.
allowed-tools: Read, Bash(script *) # Optional one-turn permission grant, NOT a tool restriction. Keep narrow.
disallowed-tools: Write, Edit       # Optional one-turn restriction in Claude Code.
user-invocable: false               # Optional; hide from direct invocation (default: true).
context: fork                       # Isolated sub-agent execution.
agent: general-purpose              # Agent type when context: fork.
model: model-id                     # Override model.
effort: high                        # Optional model effort override.
argument-hint: "[issue-number]"     # Autocomplete hint for arguments.
arguments: issue-number format      # Optional named positional arguments.
disable-model-invocation: false     # Prevent auto-loading.
background: false                   # With context: fork, wait for the result instead of backgrounding.
paths: "src/**/*.ts"                # Optional Claude path-scoped activation.
shell: bash                         # Shell for dynamic context blocks.
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

## Profession Profile and Project Agent Anatomy

A reusable profile is a directory under `profiles/`, split into a runtime-neutral core and one overlay per runtime. `scripts/generate-profiles.mjs` compiles bundled Claude plugin agents and orchestrator references. In consuming projects, `.agent-kit/agents.json` selects a profile plus skills and the materializer writes native `.claude/agents/*.md` and `.codex/agents/*.toml` files.

```
profiles/<name>/
├── PROFILE.md      # core frontmatter + body (role-template adaptation + persona)
├── claude.yaml     # Claude Code overlay
└── codex.yaml      # Codex overlay
```

A field belongs to the core when both runtimes read it the same way, and to an overlay when the vocabularies diverge or only one runtime has the concept.

### Core frontmatter — `PROFILE.md`

```yaml
---
name: profile-name                  # Required. One word, profession-style. Matches the directory.
description: What + when.           # Required. Portable trigger, single line.
role: [implementer]                 # Required. Role-templates the body was written from.
skills: [skill-a, skill-b]          # Default knowledge skills; a project composition may replace them.
effort: high                        # Required. low | medium | high | xhigh | max — read by both runtimes.
access: edits                       # Required. read-only | edits | full.
---
```

`access` picks the default Claude tool set (`read-only` withholds Edit/Write/Bash, `edits` adds Edit/Write, `full` adds Bash) and Codex `sandbox_mode`. `role` is validated, never expanded — profile bodies are profession adaptations of the templates.

### Claude overlay — `claude.yaml`

```yaml
model: sonnet                       # sonnet | opus | haiku | fable | inherit.
color: cyan                         # red, blue, green, yellow, purple, orange, pink, cyan.
tools: [Read, Edit, Bash]           # Explicit allowlist; overrides the set derived from access.
maxTurns: 20                        # Max agentic turns.
```

Bundled Claude plugin agents may also use `disallowedTools`, `memory`, `background`, and `isolation`. Add only fields rendered and accepted by strict plugin validation; project settings, hooks, MCP servers, and permission mode stay outside the profile overlay.

### Codex overlay — `codex.yaml`

```yaml
model: gpt-5.6-terra                # gpt-5.6 | gpt-5.6-sol | gpt-5.6-terra | gpt-5.6-luna | gpt-5.5 | gpt-5.4 | gpt-5.4-mini.
effort: ultra                       # Optional. Codex-only levels; `ultra` is rejected in the core.
```

The project materializer maps the profile body to `developer_instructions`, `effort` to `model_reasoning_effort`, `access` to `sandbox_mode`, and resolved skills to `skills.config`. Live session policy remains authoritative over child defaults. `agent-orchestrator` capability-checks named custom-agent selection and falls back to a generic native subagent carrying the same persona and skill composition when a client cannot apply the named config.

### Body structure

The body lives in `PROFILE.md` below the frontmatter and is assembled by `agent-creator`:

1. **Adapted role-template(s)** — `skills/agent-creator/templates/{role}.md` rewritten for the domain, one `## Role — {role}` section per declared role.
2. **Persona** — "You are a [profession] who [specialization]" — domain focus specific to this agent.
3. **Skill pointers** — references to preloaded knowledge skills for reasoning about domain.
4. **Output format + Done criteria** — concrete deliverables.

### Project composition

`.agent-kit/agents.json` is the portable project source. Each entry selects `name`, `profile`, exact `skills`, target `runtimes`, and optional effort/access/runtime overrides. It is a build recipe, not an execution runtime.

## Creating Skills

Use `skill-creator`: describe what you need ("create a skill for X"). See `skills/skill-creator/`.

## Creating Project Agents and Profiles

Use `agent-creator`: describe what you need ("create agents for this project", "add a Rust backend agent", or "create a reusable profession profile"). See `skills/agent-creator/`.

1. Pick a profession profile — defines durable behavior.
2. Pick the exact project knowledge skills — defines the stack/domain composition.
3. Write `.agent-kit/agents.json`.
4. Materialize native Claude and Codex agents.
5. Use `agent-orchestrator` to choose instances and task-specific workflows at execution time.

## References

- [skill-creator](skills/skill-creator/) — authoring knowledge and meta skills
- [agent-creator](skills/agent-creator/) — configuring project agents and maintaining profiles
- [agent-orchestrator](skills/agent-orchestrator/) — composing task teams through native runtime mechanisms
- [hook-creator](skills/hook-creator/) — lifecycle hooks
- [init](skills/init/) — project bootstrap router
