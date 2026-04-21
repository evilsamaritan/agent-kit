# Skill Authoring Best Practices

Consolidated knowledge for writing high-quality skills. The context window is a shared resource — every token loaded into it competes with the user's actual work. Write skills that load minimal context while maximizing agent effectiveness.

## Table of Contents

- [Context Engineering](#context-engineering)
- [Progressive Disclosure](#progressive-disclosure)
- [Standard Directory Structure](#standard-directory-structure)
- [Content Organization](#content-organization)
- [Instruction Tone](#instruction-tone)
- [Writing Patterns](#writing-patterns)
- [Description Writing Guide](#description-writing-guide)
- [Skill Patterns](#skill-patterns)
- [Frontmatter Reference](#frontmatter-reference)
- [Advanced Techniques](#advanced-techniques)
- [What NOT to Include](#what-not-to-include)
- [Skills Distribution](#skills-distribution)
- [Testing Checklist](#testing-checklist)

---

## Context Engineering

The context window is a shared, finite resource. Design skills with this in mind.

- **Context is finite** — tool outputs consume ~84% of tokens in agent workflows. Every line in a skill competes with the user's actual work.
- **Lost-in-Middle effect** — models have U-shaped attention across long contexts. Place critical instructions at the start and end, not in the middle.
- **Four-Bucket strategy** for context management:
  - Write: store information externally (files, databases)
  - Select: retrieve only what's relevant (targeted reads, not bulk loads)
  - Compress: summarize verbose outputs before returning
  - Isolate: split work across sub-agents to parallelize context usage
- **Compaction threshold** — at 70-80% context utilization, earlier messages get compressed. Front-load critical information.
- **Description budget** — all skill descriptions combined should fit within ~2% of the context window. Soft target 80-500 chars per description, hard cap 1024 — spend the budget on trigger phrases and negative triggers, not prose.

---

## Progressive Disclosure

The organizing principle for all skills. Load information only when needed. SKILL.md is the entry point — sub-files contain depth.

**Decision tree for content placement:**

```
Is this content needed for EVERY invocation?
├── Yes → Keep in SKILL.md
└── No (conditional) → Extract
    What type of content?
    ├── Step-by-step procedure → workflows/
    ├── Documentation/knowledge → references/
    ├── Executable code → scripts/
    └── Output files (templates, images) → assets/
```

**Additional extraction signals:**
- Can it be read and followed independently? → extract
- Is it only needed in specific scenarios (one flow of many)? → extract
- Would loading it unnecessarily waste context? → extract

**Rules:**
- SKILL.md: maximum 500 lines (ceiling, not target)
- Load sub-files with: `Read workflows/<file>.md from the skill base directory`
- Never duplicate content between SKILL.md and sub-files

**When a skill has 2+ independent procedures** (different user intents, different entry points):
- SKILL.md acts as entry point/router — overview, quick reference table, links to workflows
- Each procedure lives in `workflows/` as a separate file
- Shared knowledge goes to `references/`
- SKILL.md stays concise (under 200 lines ideal for multi-procedure skills)

---

## Standard Directory Structure

```
skill-name/
├── SKILL.md              # Required — entry point and overview
├── workflows/            # Step-by-step procedures (loaded on demand)
│   └── create.md         # Named by action: create, verify, migrate, etc.
├── scripts/              # Executable code (token efficient, deterministic)
│   └── validate.sh       # Shell scripts, code generators
├── references/           # Documentation, knowledge (loaded on demand)
│   └── patterns.md       # API docs, decision trees, checklists
└── assets/               # Files for output — NOT loaded into context
    └── template.md       # Templates, images, starter files
```

**Directory purposes:**

| Directory | Purpose | Loaded into context? |
|-----------|---------|---------------------|
| `workflows/` | Procedures the agent follows step-by-step | On demand (via Read) |
| `scripts/` | Code the agent executes (shell, python) | On demand (via Bash) |
| `references/` | Knowledge the agent consults | On demand (via Read) |
| `assets/` | Files copied/used as output | Never (copied via Bash) |

**Naming conventions:**
- Use kebab-case for all filenames
- Workflows: name by action verb (e.g., `create.md`, `verify.md`, `migrate.md`)
- References: name by topic (e.g., `patterns.md`, `api-reference.md`, `checklist.md`)
- Scripts: name by action (e.g., `validate.sh`, `generate.sh`)

---

## Content Organization

Skills contain different types of content. Organize by content type, not by labels.

### Procedures (step-by-step)

Sequential steps the agent follows. Numbered, imperative, with decision points.

**Signals:** numbered steps, checklists, "Step 1: ...", sequential process, action verbs
**Placement:** SKILL.md if short (< 60 lines), otherwise `workflows/`
**Tone:** Imperative — "Do X. Then do Y. Verify Z."

### Reference Material (knowledge)

Decision guidance, tables, patterns, anti-patterns, templates.

**Signals:** decision tables, comparison matrices, "when X, prefer Y", pattern catalogs
**Placement:** SKILL.md if short (inline tables), otherwise `references/`
**Tone:** Advisory — "When X, consider Y. Prefer Z because [reason]."

### Commands

Specific commands with flags, inputs/outputs, error handling.

**Signals:** `## Commands` section, bash blocks, error tables
**Placement:** SKILL.md (usually short enough)
**Tone:** Direct — "Run X. If error, run Y."

### Mixed Content

Many skills combine procedures + knowledge. This is normal — organize by type:
- Procedures → `workflows/` (if > 60 lines)
- Knowledge → `references/` (if > 60 lines)
- SKILL.md routes between them

Having `references/` alongside a procedure does NOT make the skill special — it just means knowledge supports the procedure.

---

## Instruction Tone

How you write instructions affects how the agent executes them. Match tone to content type.

| Content type | Tone | Example |
|-------------|------|---------|
| Procedures | Imperative (low freedom) | "Step 1: Read the config. Step 2: If X, do Y." |
| Reference material | Advisory (high freedom) | "When X, consider Y. Prefer Z because [reason]." |
| Mixed (structured + flexible) | Structured with adaptation | "Do X. Adapt Y based on [context]. Verify Z." |

**How tone affects agent behavior:**
- **Imperative**: Agent follows steps exactly, minimal deviation. Ask user when uncertain.
- **Advisory**: Agent uses as reference material. Decides what to apply based on situation.
- **Structured with adaptation**: Agent follows the structure and sequence, but adapts content to the specific context.

**Common mistakes:**
- Procedures written in advisory tone → agent skips steps, improvises
- Reference material written in imperative tone → agent applies everything rigidly
- Fix: match tone to content type within each section

---

## Writing Patterns

### 1. Conciseness

Every line must earn its place. Wasted tokens reduce the agent's effectiveness on the user's actual task.

**Rules:**
- One concept per line
- No filler phrases ("It's important to note that...", "Please make sure to...")
- No restating what's obvious from context
- Intro text after `# Heading` and `## Purpose` must not repeat `description`. If they don't expand on it — delete them. Description is always loaded; duplicating it wastes tokens.
- Prefer tables over paragraphs for structured data
- Prefer code examples over prose explanations
- Use imperative/infinitive form: "Create X" not "Creating X" or "You should create X"

**Before:**
```markdown
When you are creating a new skill, it's important to make sure that the name
follows the kebab-case naming convention. This means that all characters should
be lowercase and words should be separated by hyphens.
```

**After:**
```markdown
Name: lowercase, hyphens only (`my-skill-name`).
```

### 2. User Interaction

Skills should interact with the user at decision points, not dump information.

**Rules:**
- Use `AskUserQuestion` for choices between approaches
- Present options with clear trade-offs
- Confirm destructive or irreversible actions
- Show generated content for approval before writing files

**When to interact:**
- Naming decisions (skill name, file names)
- Architecture choices (which template, which approach)
- Before writing files (show preview, get confirmation)
- When requirements are ambiguous

**When NOT to interact:**
- Validation steps (just report results)
- File reading and analysis (do silently)
- Obvious next steps in a defined workflow

### 3. Decision Points: Ask, Don't Prescribe

At decision points with multiple valid approaches, use `Ask:` blocks to gather user constraints before recommending. This is the agnostic alternative to hardcoded defaults — the skill helps the user choose, it doesn't choose for them.

**Pattern:**
```markdown
Ask: What framework is the project using?
- Next.js → Turbopack (locked to framework)
- Nuxt/SvelteKit/Astro → Vite (framework default)
- Custom → present options with trade-offs
```

**Rules:**
- Place `Ask:` before decision trees and comparison tables
- Frame questions around constraints (framework, scale, team size, existing tooling)
- Present 2-4 options with clear trade-offs, not exhaustive lists
- Use `AskUserQuestion` tool at runtime for interactive decisions
- Default recommendations are OK as tiebreakers, but present alternatives

**When to use:**
- Tool/framework selection (bundler, ORM, PM, test framework)
- Architecture choices (monolith vs micro, SSR vs SPA)
- Trade-off decisions (speed vs ecosystem, simplicity vs flexibility)

**When NOT to use:**
- Hard rules with one correct answer (use `strict: true` in TypeScript)
- Security requirements (non-negotiable, no "Ask:")
- Project conventions already established (detect and follow)

### 4. Code Pattern Notation

When a skill teaches naming conventions or code patterns, use **rule + examples** format, not abstract placeholder templates.

**Why:** LLMs learn patterns more effectively from concrete examples than from abstract templates with `<Placeholder>` syntax.

**Rule + examples (correct):**
```markdown
Name epic as: `on` + trigger + action + target + `Epic`
(e.g., `onSelectLoadDetailsEpic`, `onSubmitCloseModalEpic`, `onConnectLoadChatsEpic`).
```

**Placeholder template (avoid):**
```markdown
on<Trigger>Load<Entity>Epic
```

**Additional guidelines:**
- Use backticks for fixed parts (e.g., `` `on` + trigger + `Epic` ``)
- Use plain text for variable parts (e.g., "trigger", "action", "target")
- Avoid `<AngleBrackets>` — conflicts with JSX/generics
- Avoid `{CurlyBraces}` — conflicts with template literals
- When multiple code examples share a naming convention, extract to a `## Naming` section

### 5. Error Recovery

Skills should anticipate common failures and provide recovery paths.

**Rules:**
- Include error handling table for skills with `## Commands` section
- Provide "if this fails, try..." guidance
- Never leave the agent in a broken state — always have a next step
- Validate prerequisites before starting work

---

## Description Writing Guide

The description is the **sole trigger mechanism** — the agent uses it to decide when to apply the skill.

### Formula

```
WHAT (imperative verb + object) + WHEN (trigger phrases) + KEY CAPABILITIES (if space allows)
```

### Four questions a description must answer

1. **What** does this skill do?
2. **When** should it be used?
3. **What inputs** does it need?
4. **What does it return/produce?**

### Rules

1. **Single line** — no multi-line YAML (`>`, `|`)
2. **Hard cap 1024 chars, soft target 80-500** — under 80 is too vague; over 500 usually means the description is duplicating SKILL.md prose. Spend the budget on trigger phrases and negative triggers, not explanations.
3. **Start with a verb** in imperative/infinitive form — Create, Run, Add, Write, Configure
4. **Include trigger phrases** — exact words users would say
5. **Be specific** — mention technologies, patterns, file types
6. **Cover the "when"** — "Use when creating X, adding Y, or fixing Z"
7. **Negative triggers** — add "Do NOT use for..." if skill could be confused with another

### Good Examples

```yaml
description: Create and maintain AGENTS.md files for packages, services, and libraries. Use when creating AGENTS.md, adding package agents, or setting up service agents files.
description: Run JavaScript/TypeScript code quality checks (lint, types, dependencies, stylelint). Use when checking types, running linter, checking eslint/stylelint, or fixing lint/type errors.
description: Write E2E tests with Playwright for an AdminUI service. Use when creating page objects, domain components, and test specs.
```

### Anti-patterns

Too vague ("Helps with code quality"), too narrow ("Run ESLint on TypeScript files"), no trigger phrases ("Database migration management tool"), or duplicate info ("Create a new skill. This skill creates new skills for the skills system").

---

## Skill Patterns

Choose an approach based on the use case:

- **Problem-first**: user describes an outcome ("set up a project workspace") → skill orchestrates the right tools
- **Tool-first**: user has a tool connected ("I have Notion MCP") → skill teaches optimal workflows for that tool

| Pattern | When to use | Key technique |
|---------|------------|---------------|
| Sequential Workflow | Multi-step process in specific order | Explicit step ordering, validation gates |
| Multi-MCP Coordination | Workflow spans multiple services | Phase separation, data passing between MCPs |
| Iterative Refinement | Output quality improves with iteration | Quality check → fix → re-validate loop |
| Context-Aware Tool Selection | Same outcome, different tools by context | Decision tree based on runtime context |
| Domain-Specific Intelligence | Skill adds specialized knowledge | Embedded expertise shapes decisions |

---

## Frontmatter Reference

### Required Fields

| Field | Rules |
|-------|-------|
| `name` | Lowercase + hyphens only. Max 64 chars. Must match directory name. |
| `description` | Single line. Soft target 80-500 chars, hard cap 1024. Include trigger phrases + negative triggers. Start with verb in imperative form. |

### Optional Fields

| Field | Default | Rules |
|-------|---------|-------|
| `allowed-tools` | all | Comma-separated (NOT YAML list). Valid: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `Task`, `WebSearch`, `WebFetch`, `AskUserQuestion`, `Skill`, `EnterPlanMode`. |
| `user-invocable` | `true` | Boolean. Set `false` to hide from `/slash` menu while keeping auto-discovery. |
| `context` | — | Set to `fork` for isolated sub-agent execution. |
| `agent` | `general-purpose` | Only with `context: fork`. Options: `Explore`, `Plan`, `general-purpose`. |
| `model` | conversation model | Override model for this skill. Agent-specific model IDs. |
| `hooks` | — | Lifecycle hooks: `PreToolUse`, `PostToolUse`, `Stop`. See AGENTS.md for format. |
| `argument-hint` | — | Autocomplete hint for arguments (e.g., `[issue-number]`, `[filename]`). |
| `disable-model-invocation` | `false` | Prevent agent from auto-loading this skill. |
| `license` | — | Open-source license (e.g., `MIT`, `Apache-2.0`). For distribution. |
| `compatibility` | — | Environment requirements, 1-500 chars (intended product, system packages, network access). |
| `metadata` | — | Custom key-value pairs: `author`, `version`, `mcp-server`, `category`, `tags`. |

**String substitution:** `$ARGUMENTS` (or `$1`, `$2`, `$ARGUMENTS[0]`) substitutes user input. `${CLAUDE_SESSION_ID}` provides session-specific paths.

**Dynamic context injection:** `` `!command` `` in skill body injects live command output at load time.

**Scoped tool access:** `allowed-tools` supports scoped syntax: `"Bash(python:*) Bash(npm:*) WebFetch"` restricts Bash to specific commands.

### Validation Rules

`name` must match directory name. `name` must not start or end with a hyphen, and must not contain consecutive hyphens (`--`). `description` must not use YAML multi-line (`>`, `|`). `allowed-tools` must be comma-separated string, not YAML list. `context: fork` requires `agent`. No unknown fields (silently ignored).

---

## Advanced Techniques

### Scripts for deterministic validation
Replace natural language validation instructions with executable scripts in `scripts/`. A script either passes or fails — no interpretation ambiguity.

### Tool restriction with `allowed-tools`
Read-only skills: `Read, Grep, Glob`. File modification: `Edit, Write`. Only grant `Bash` when the skill runs commands.

### Fork context for isolation
`context: fork` runs the skill as a sub-agent with its own context window. Use for skills that consume significant context to avoid polluting the main conversation.

### Skills preloading in agents
The `skills:` frontmatter field in agents injects full skill content into the sub-agent's context at startup. Use when the agent always needs the skill.

### Model laziness mitigation
For skills where thoroughness matters, add a `## Performance Notes` section with: "Take your time to do this thoroughly. Quality is more important than speed. Do not skip validation steps."

---

## What NOT to Include

Skills are NOT packages. Do not add:

- `README.md` — SKILL.md IS the readme
- `CHANGELOG.md` — use git history
- `LICENSE` — inherited from repo
- `package.json` / `pyproject.toml` — skills are not code packages
- `.gitignore` — nothing to ignore
- Test files — skills are verified by the verify flow, not unit tests
- CI configuration — skills are installed, not built

---

## Skills Distribution

Skills live in `skills/<name>/`, agents in `agents/<name>.md`. IDE directories (`.claude/skills/`, `.claude/agents/`, `.cursor/skills/`, etc.) are directory-level symlinks — `.claude/skills → ../skills/` and `.claude/agents → ../agents/`. No installation or sync step is required.

| Aspect | Details |
|--------|---------|
| Skills source | `skills/<name>/` |
| Agents source | `agents/<name>.md` |
| Access | `.claude/skills → ../skills/`, `.claude/agents → ../agents/` |
| External skills | `npx skills add <package>` (agents auto-resolved via symlinks) |
| Discovery | `npx skills find <query>` |

Always edit in `skills/` or `agents/`, never in `.claude/` directories.

---

## Testing Checklist

After creating a skill: (1) frontmatter parses (`name` + `description` present), (2) accessible via symlink (`ls .claude/skills/<name>/SKILL.md`), (3) trigger works (describe task naturally, agent picks up skill), (4) slash command works (`/<skill-name>`), (5) sub-files load on demand, (6) workflow completes end-to-end, (7) output is correct.
