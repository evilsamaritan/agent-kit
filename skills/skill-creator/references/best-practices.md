# Skill Authoring Best Practices

Consolidated knowledge for writing high-quality skills. The context window is a shared resource — every token loaded into it competes with the user's actual work. Write skills that load minimal context while maximizing agent effectiveness.

## Table of Contents

- [Progressive Disclosure](#progressive-disclosure)
- [Standard Directory Structure](#standard-directory-structure)
- [Content Organization](#content-organization)
- [Instruction Tone](#instruction-tone)
- [Writing Patterns](#writing-patterns)
- [Description Writing Guide](#description-writing-guide)
- [Frontmatter Reference](#frontmatter-reference)
- [What NOT to Include](#what-not-to-include)
- [Skills Distribution](#skills-distribution)
- [Testing Checklist](#testing-checklist)

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
- SKILL.md: Overview, quick reference, decision logic (< 500 lines)
- Load sub-files with: `Read workflows/<file>.md from the skill base directory`
- Never duplicate content between SKILL.md and sub-files

**When a skill has 2+ independent procedures** (different user intents, different entry points):
- SKILL.md acts as a router — overview, quick reference table, links to workflows
- Each procedure lives in `workflows/` as a separate file
- Shared knowledge goes to `references/`
- SKILL.md stays concise (< 200 lines ideal for router skills)

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

### 3. Code Pattern Notation

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

### 4. Error Recovery

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
<Verb in imperative form> <what it does>. Use when <trigger phrases>.
```

### Rules

1. **Single line** — no multi-line YAML (`>`, `|`)
2. **Max 1024 characters** — aim for 100-200
3. **Start with a verb** in imperative/infinitive form — Create, Run, Add, Write, Configure
4. **Include trigger phrases** — exact words users would say
5. **Be specific** — mention technologies, patterns, file types
6. **Cover the "when"** — "Use when creating X, adding Y, or fixing Z"

### Good Examples

```yaml
description: Create and maintain AGENTS.md files for packages, services, and libraries. Use when creating AGENTS.md, adding package agents, or setting up service agents files.
description: Run JavaScript/TypeScript code quality checks (lint, types, dependencies, stylelint). Use when checking types, running linter, checking eslint/stylelint, or fixing lint/type errors.
description: Write E2E tests with Playwright for an AdminUI service. Use when creating page objects, domain components, and test specs.
```

### Anti-patterns

```yaml
# Too vague — won't trigger on specific requests
description: Helps with code quality.

# Too narrow — misses legitimate triggers
description: Run ESLint on TypeScript files.

# No trigger phrases — agent can't match user intent
description: Database migration management tool.

# Duplicate info — wastes characters
description: Create a new skill. This skill creates new skills for the skills system.
```

---

## Frontmatter Reference

### Required Fields

| Field | Rules |
|-------|-------|
| `name` | Lowercase + hyphens only. Max 64 chars. Must match directory name. |
| `description` | Single line. Max 1024 chars. Include trigger phrases. Start with verb in imperative form. |

### Optional Fields

| Field | Default | Rules |
|-------|---------|-------|
| `allowed-tools` | all | Comma-separated (NOT YAML list). Valid: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `Task`, `WebSearch`, `WebFetch`, `AskUserQuestion`, `Skill`, `EnterPlanMode`. |
| `internal` | `false` | Boolean. Set `true` for locally created skills. Only internal skills are verified/improved by default. |
| `user-invocable` | `true` | Boolean. Set `false` to hide from `/slash` menu while keeping auto-discovery. |
| `context` | — | Set to `fork` for isolated sub-agent execution. |
| `agent` | `general-purpose` | Only with `context: fork`. Options: `Explore`, `Plan`, `general-purpose`. |
| `model` | conversation model | Override model for this skill. Agent-specific model IDs. |
| `hooks` | — | Lifecycle hooks: `PreToolUse`, `PostToolUse`, `Stop`. See AGENTS.md for format. |

### Validation Rules

- `name` must match directory name exactly
- `description` must not use YAML multi-line (`>`, `|`)
- `allowed-tools` must be comma-separated string, not YAML list
- `context: fork` requires `agent` to be set
- No unknown fields — the agent ignores them silently

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

Skills live in `skills/<name>/`. Agent directories (`.claude/skills/`, `.cursor/skills/`, `.windsurf/skills/`, `.junie/skills/`, `.agents/skills/`) are symlinks to `../skills/`. No installation or sync step is required.

| Aspect | Details |
|--------|---------|
| Source location | `skills/<name>/` |
| Access | Symlinks from IDE directories → `../skills/` |
| External skills | `npx skills add <package>` (agents auto-resolved via symlinks) |
| Discovery | `npx skills find <query>` |

Always edit in `skills/`, never in `.claude/skills/` or other IDE directories.

---

## Testing Checklist

After creating a skill:

1. **Frontmatter parses** — `name` and `description` present, valid
2. **Accessible via symlink** — `ls .claude/skills/<name>/SKILL.md`
3. **Trigger works** — describe the task naturally, the agent picks up the skill
4. **Slash command works** — `/<skill-name>` invokes correctly
5. **Sub-files load** — if workflows/references exist, verify they load on demand
6. **Workflow completes** — run through the full workflow once
7. **Output is correct** — generated files, commands, validations all work
