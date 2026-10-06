# agent-kit v4.0.0-rc.5

## Purpose

Reusable profession profiles, skills, and helpers — domain expertise packaged as context, not a custom agent runtime.

## Concept

Profession **profiles** are the stable base entity. A project agent is assembled from a profile plus an exact set of skills, then materialized into the current harness's native format.

- **Role-templates** — behavioral primitives ("how to think, how to structure work"). Live in `skills/agent-creator/templates/*.md`. NOT runtime skills — `agent-creator` writes profile bodies from them, adapting each to the profession. Templates: `architect`, `implementer`, `reviewer`, `operator`, `writer`.
- **Knowledge skills** — domain expertise. Vendor-neutral (`database`, `caching`) or technology-specific (`react`, `rust`). Discovered by compatible runtimes or preloaded into Claude Code agents via `skills:` frontmatter.
- **Code practice** — `development` owns how code is written in any stack: SOLID and the other principles, ownership, variant families, dependencies, async lifetime, errors, refactoring. `architecture` owns boundaries between modules and systems. Zone skills (`frontend`, `backend`, `mobile`, `gamedev`, …) own their environment and point to `development` instead of restating it; language skills show how a language expresses it.

**Meta skills** — create and manage the rest: `agent-creator`, `agent-orchestrator`, `skill-creator`, `init`.

**Base profession profiles:** `architect`, `developer`, `devops`, `sre`, `tester`, `designer`, `reviewer`, `writer`. A security review is the `reviewer` profile composed with the `security` skill.

## Rules

- Edit shared skills in `skills/`; the repository does not ship project-local `.claude/` or `.agents/` configuration
- Edit reusable professions in `profiles/<name>/`, NEVER in `.claude/agents/`, `.codex/agents/`, `.kimi-code/agents/` — those are native generated targets
- Regenerate package targets with `scripts/generate-profiles.mjs` after touching a profile; `--check` fails the build when they drift
- In consuming projects, edit `.agent-kit/agents.json` and run `skills/agent-creator/scripts/materialize-agents.mjs`; never copy profile or skill sources
- One skill = one domain. Do not merge unrelated domains into a single skill.
- One owner per piece of knowledge across skills. Code practice lives in `development`; the validator rejects principle vocabulary (SOLID, DRY, YAGNI, …) in other skills and profiles.
- Every skill MUST have `name` and `description` in YAML frontmatter.
- Skill `name` must match its directory name exactly (lowercase, hyphens only).
- Description is the portable trigger — front-load WHAT + WHEN and phrases users actually say. Runtime-specific routing fields are optional extensions.
- Do not duplicate content between SKILL.md and sub-files. SKILL.md routes; sub-files contain depth.
- SKILL.md: soft target 500 lines, ceiling ~550 (applies uniformly to all skill classes). References have no hard limit — split by topic.
- Do NOT add `Co-Authored-By` to commit messages.
- **Teach patterns, not products** — SKILL.md teaches the pattern (what and when). Reference files may use specific tools as *examples*, but SKILL.md must not assume a particular tool or vendor.
- **Framework refs = extensions** — Framework-specific content (Next.js, Nuxt, Node.js) belongs in a separate reference file with an explicit name. SKILL.md covers the core technology only.
- **Decision trees before vendor tables** — Every skill that compares tools/vendors must lead with a decision tree, not a feature comparison table.
- **Version on every meaningful commit** — `node scripts/bump-version.mjs <semver>` updates the canonical `AGENTS.md` header (exposed to Claude Code through the `CLAUDE.md` symlink), `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, and `.kimi-plugin/plugin.json`. Use semver: patch for fixes, minor for new features/skills/agents, major for breaking changes.
- **One shared skill source** — Claude Code, Codex, and Kimi Code manifests all expose the canonical `skills/` directory. Never copy runtime-specific variants of a skill.
- **Keep packaging runtime-specific** — Claude metadata and the shared repository marketplace live in `.claude-plugin/`; Codex plugin metadata lives in `.codex-plugin/`; Kimi plugin metadata lives in `.kimi-plugin/`. Project-local `.claude/` and `.agents/` directories are not package sources.
- **No instruction-file names inside the package** — never name a skill, reference, or profile file `CLAUDE.md` or `AGENTS.md` (any case); hosts load those as directory instructions.

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `profiles/<name>/` | Profession canon — `PROFILE.md` (core + body) and optional `claude.yaml`, `codex.yaml`, `kimi.yaml` overlays |
| `skills/agent-orchestrator/references/profiles/` | Generated profession references; no bundled runtime agents |
| `skills/agent-creator/scripts/materialize-agents.mjs` | Project composition → native Claude/Codex agents |
| `skills/agent-orchestrator/` | Chooses and runs agents through host-native delegation |
| `skills/` | **Flat** — knowledge skills + meta skills, no subcategories, no `category:` field |
| `skills/agent-creator/templates/` | Role-templates (architect, implementer, reviewer, operator, writer) |
| `.claude-plugin/` | Claude manifest plus the repository marketplace catalog used by Claude and as Codex's legacy-compatible source |
| `.codex-plugin/` | Codex plugin manifest |
| `.kimi-plugin/` | Kimi Code plugin manifest (skills only) |
| `scripts/profile-runtimes/` | One format module per runtime: fields, resolution, target path, render, parse |
| `scripts/` | Repository-wide compatibility and maintenance utilities |

## Skills are flat

No `category:` field, no subdirectories. The meta skills are `agent-creator`, `agent-orchestrator`, `skill-creator`, and `init`: they create or manage profiles, project agents, skills, orchestration, or project setup. Everything else is knowledge.

## Skill Standard

- **SKILL.md** — soft target 500 lines, ceiling ~550. Compact core guide with decision trees, patterns, anti-patterns, context adaptation, quick references. For multi-procedure skills, also acts as entry point/router to workflows.
- **references/** — Split by topic, loaded on demand. No size limit per file — depth matters. Split when a single reference exceeds ~500 lines or covers clearly distinct subtopics.
- **workflows/** — Step-by-step procedures (review protocols, creation flows). Optional — not every skill needs workflows.
- User-facing skills are invocable by default; add `user-invocable: false` only for model-only background knowledge.
- Framework-specific content belongs in a separate reference file with an explicit name. SKILL.md covers the core technology only.
- Agents can preload any combination of skills via `skills:` field.
- Volatile content (dates, prices, enforcement trends) belongs in references/, not core SKILL.md.

### Classes and structure

`skill-creator` holds the one detailed copy of the classes (broad, specialized, regulatory, meta) and their section skeletons: the Classes table in its SKILL.md and `references/skill-template.md`. Every knowledge skill states its scope near the top and ends with Anti-patterns → Related Knowledge → References; regulatory skills keep dates, fines, and enforcement in references. Meta producers (`skill-creator`, `agent-creator`) include Validation; routers (`init`, `agent-orchestrator`) may skip it.

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
- Are **short** — under about 100 lines. Longer means domain crept in.
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

Every host reads `name` and `description`; the other fields are host extensions (mostly Claude Code). Codex and Kimi Code ignore what they do not support, so a skill must work from `name`, `description`, and its body alone. Per-host details: `skills/skill-creator/references/best-practices.md`.

```yaml
---
name: skill-name                    # Required, every host. Lowercase + hyphens, max 64 chars, matches directory.
description: Verb phrase. Use when trigger phrases.  # Required, every host. Single line; soft target 80-500 chars, hard cap 1024.
# Host extensions below (Claude Code unless noted):
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

A reusable profile is a directory under `profiles/`, split into a runtime-neutral core and one overlay per runtime. `scripts/generate-profiles.mjs` generates the profile catalog and orchestrator references; it never registers runtime agents. In consuming projects, `.agent-kit/agents.json` selects a profile plus skills and the materializer writes native `.claude/agents/*.md`, `.codex/agents/*.toml`, and (opt-in) `.kimi-code/agents/*.md` files.

```
profiles/<name>/
├── PROFILE.md      # core frontmatter + body (role-template adaptation + persona)
├── claude.yaml     # optional Claude Code overlay
├── codex.yaml      # optional Codex overlay
└── kimi.yaml       # optional Kimi Code overlay
```

A field belongs to the core when every runtime reads it the same way, and to an overlay when the vocabularies diverge or only one runtime has the concept. Create an overlay file only when it sets something; a missing overlay means runtime defaults.

### Core frontmatter — `PROFILE.md`

```yaml
---
name: profile-name                  # Required. One word, profession-style. Matches the directory.
description: What + when.           # Required. Portable trigger, single line.
role: [implementer]                 # Required. Role-templates the body was written from.
skills: [skill-a, skill-b]          # Default knowledge skills; a project composition may replace them.
requires: [skill-a]                 # Optional. Defining skills always added to every composition; each is also a default.
effort: high                        # Required. low | medium | high | xhigh | max — applied where the runtime supports it.
access: edits                       # Required. read-only | edits | full.
---
```

`access` picks the default Claude tool set (`read-only` withholds Edit/Write/Bash, `edits` adds Edit/Write, `full` adds Bash) and Codex `sandbox_mode`. `role` is validated, never expanded — profile bodies are profession adaptations of the templates.

Settings resolve once, in this order: profile core → profile runtime overlay → portable project overrides (`effort`, `access`) → explicit project runtime overrides. A project `access: read-only` therefore replaces a library tool list; a project `claude.tools` stays final. The parent session's policy still bounds the result.

Overlay files use flat `key: value` lines and inline arrays; YAML overlays and JSON project overrides normalize to the same types. Each runtime's fields, resolution, target path, and rendering live in one module under `scripts/profile-runtimes/`; adding a harness means adding a module to its registry.

### Model selection

Profiles pin no model. An omitted model inherits the host choice (Claude: parent session or `CLAUDE_CODE_SUBAGENT_MODEL`; Codex: parent thread). A project sets `claude.model` or `codex.model` when it needs a specific alias or ID. Model names are checked for syntax only — availability belongs to the host, so no closed list of IDs lives in the library.

### Claude overlay — `claude.yaml` (optional)

```yaml
color: cyan                         # red, blue, green, yellow, purple, orange, pink, cyan.
tools: [Read, Edit, Bash]           # Library narrowing of the access-derived set; omit when it equals that set.
maxTurns: 20                        # Max agentic turns.
```

Also accepted: `model` (alias, full ID, or `inherit`), `effort`, `disallowedTools`, `memory`, `background`, `isolation`. Add only fields rendered and validated for native project agents; project settings, hooks, MCP servers, and permission mode stay outside the profile overlay.

### Codex overlay — `codex.yaml` (optional)

```yaml
effort: ultra                       # Optional. Codex-only levels; `ultra` is rejected in the core.
```

Also accepted: `model` and `sandbox_mode`. The project materializer maps the profile body to `developer_instructions`, `effort` to `model_reasoning_effort`, `access` to `sandbox_mode`, and resolved skills to catalog names in `developer_instructions` (no `skills.config`: Codex role files may only disable skills). Live session policy remains authoritative over child defaults. `agent-orchestrator` capability-checks named custom-agent selection and falls back to a generic native subagent carrying the same persona and skill composition when a client cannot apply the named config.

### Kimi overlay — `kimi.yaml` (optional)

```yaml
whenToUse: Code reviews and PR checks   # Kimi routing hint.
```

Also accepted: `tools`, `disallowedTools`, `subagents`. Kimi custom agents have no model or effort fields; access maps to an explicit Kimi tool allowlist (`Read`, `Grep`, `Glob`, `ReadMediaFile`, `WebSearch`, `FetchURL`, `Skill`, plus `Edit`/`Write` and `Bash`/task tools). The body replaces the delegated agent's whole system prompt, so the renderer starts it with Kimi's `${base_prompt}` (its rules, AGENTS.md, skill index, working directory), then adds the profession body, the selected sources, and a handoff, and rejects profile text containing Kimi template variables. Kimi targets are opt-in per agent (`runtimes`).

### Generated targets and freshness

Generated targets name library skills by host identifier (`agent-kit:<skill>` for Claude and Codex, the bare name for Kimi) and project skills by catalog name or project-relative path, so they work wherever Agent Kit is installed. Each carries a marker plus `agent-kit-metadata` with a fingerprint of its resolved composition; an upgrade rewrites a target only when its content changes. `materialize-agents.mjs --dry-run` prints a semantic diff (behavior, settings, skills, sources); `--check` passes only when regeneration would write nothing; `--agent NAME` limits either to one agent. Whether a project commits generated targets is its own choice; Agent Kit does not touch ignore files.

### Body structure

The body lives in `PROFILE.md` below the frontmatter and is assembled by `agent-creator`:

1. **Persona** — "You are a [profession] who [specialization]" — domain focus specific to this agent.
2. **Adapted role-template(s)** — `skills/agent-creator/templates/{role}.md` rewritten for the domain, one `## Role — {role}` section per declared role.
3. **Skill pointers** — which preloaded skills serve which part of the work.
4. **Working with others** — scope, handoffs, exemplars, review.
5. **Output format + Done criteria** — concrete deliverables.

A body sets behavior and connects skills; it does not branch by domain. Zone-dependent rules — how to verify a UI change, a service, a game loop — live in the zone skill, so the composition selects them.

### Project composition

`.agent-kit/agents.json` is the portable project source. Each entry selects `name`, `profile`, exact `skills`, target `runtimes`, and optional effort/access/runtime overrides. The profile's `requires` skills are always added in front of the project's list. It is a build recipe, not an execution runtime.

## Creating Skills

Use `skill-creator`: describe what you need ("create a skill for X"). See `skills/skill-creator/`.

## Creating Project Agents and Profiles

Use `agent-creator`: describe what you need ("create agents for this project", "add a Rust backend agent", or "create a reusable profession profile"). See `skills/agent-creator/`.

1. Pick a profession profile — defines durable behavior.
2. Pick the exact project knowledge skills — defines the stack/domain composition.
3. Write `.agent-kit/agents.json`.
4. Materialize native Claude and Codex agents (and Kimi Code agents when selected).
5. Use `agent-orchestrator` to choose instances and task-specific workflows at execution time.

## References

- [skill-creator](skills/skill-creator/) — authoring knowledge and meta skills
- [agent-creator](skills/agent-creator/) — configuring project agents and maintaining profiles
- [agent-orchestrator](skills/agent-orchestrator/) — composing task teams through native runtime mechanisms
- [init](skills/init/) — project bootstrap router
