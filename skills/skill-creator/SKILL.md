---
name: skill-creator
description: Create, verify, or improve reusable skills (skills/**/SKILL.md). Use when creating a new knowledge or meta skill, scaffolding skill structure, writing SKILL.md, verifying description triggers, or improving skill effectiveness. Do NOT use for profession profiles or project agents (use agent-creator), running agent workflows (use agent-orchestrator), configuring hooks (use hook-creator), or initial project setup (use init).
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
---

# Skill Creator

## Purpose

Create new skills with proper structure, verify existing skills against quality standards, or improve skills based on feedback.

## Critical Rules

1. **Always edit skills in `skills/`.** The plugin manifests expose this canonical directory directly; do not create a project-local `.claude/skills/` mirror or symlink in this repository.
2. **One skill = one domain.** Do not merge unrelated domains into a single skill.
3. **Classify before creating.** Skills are either **knowledge** (domain expertise — runtime-discoverable and preloadable into agents) or **meta** (create / manage profiles, project agents, skills, hooks, orchestration, or project init). Knowledge skills have a scope (broad / specialized / language / framework / platform-tech / regulatory) that determines the structure template and agnosticity rules.
4. **SKILL.md size: soft target 500 lines, ceiling ~550.** Over 550 — extract depth to references/ and procedures to workflows/. Applies uniformly to all skill classes.
5. **Teach patterns, not products.** Broad knowledge skills must be vendor-agnostic in SKILL.md. Framework-specific content goes in `references/<framework>.md`.
6. **Roles live separately.** Behavioral role content does not belong in knowledge skills. Role-templates live at `skills/agent-creator/templates/*.md` and are managed by `agent-creator`, not here.
7. **Keep prompts outcome-focused.** State the goal, hard constraints, approval boundaries, required evidence, and success criteria once. Newer models infer routine steps; duplicate rules and mandatory confirmations reduce autonomy and waste context.
8. **Treat `allowed-tools` as permission.** In Claude Code it grants listed tools without prompting for the invoking turn; it does not restrict the tool pool. Declare it only as an intentional pre-approval and review broad grants according to the skill's trust model. Use `disallowed-tools` for temporary restrictions.

## Flow Selection

Determine which flow to run:

1. **User said "create" / "new" / "scaffold"** → Flow 1: Create
2. **User said "verify" / "review" / "check"** → Flow 2: Verify
3. **User said "improve" / "fix" / "refactor" / "audit" / "doesn't work well"** → Flow 3: Improve
4. **Ambiguous and not inferable from context** → Use `AskUserQuestion`:
   - Option A: "Create a new skill"
   - Option B: "Verify an existing skill"
   - Option C: "Improve an existing skill"

## Quick Reference

| Task | Flow | Steps | Details |
|------|------|-------|---------|
| Create a skill | Flow 1 | Classify → Gather → Plan → Name → Description → Generate → Verify | [create.md](workflows/create.md) |
| Verify a skill | Flow 2 | Identify → Load checklist → Parse → Run checks → Report → Fix | [verify.md](workflows/verify.md) |
| Improve a skill | Flow 3 | Identify → Gather feedback → Analyze → Propose → Apply → Verify | [improve.md](workflows/improve.md) |

## Taxonomy Quick Reference

Classify the skill before writing anything:

| Type | Purpose | Structure template |
|------|---------|-------------------|
| **knowledge** | Domain expertise loaded on demand | Depends on scope (see below) |
| **meta** | Skills that create/manage profiles, agents, skills, hooks, orchestration, or init | `Purpose` → `Critical rules` → `Flow selection` → `Quick reference` → `Validation` |

> Behavioral role content (how an agent thinks / structures work) is NOT a skill — it lives at `skills/agent-creator/templates/*.md` and is managed by `agent-creator`.

Knowledge skill scopes:

| Scope | Agnostic rule | Structure template |
|-------|---------------|-------------------|
| **broad** | Must be vendor-agnostic in SKILL.md | `Scope and boundaries` → `Decision tree` → `Core rules` → `Context Adaptation` |
| **specialized** | May be specific by design | `Core concepts` → `Decision points` → `Hard rules` → `Anti-Patterns` |
| **language** | Specific by design | Same as specialized |
| **framework** | Specific by design | Same as specialized |
| **platform-tech** | Specific by design | Same as specialized |
| **regulatory** | Evergreen in core, volatile in references/ | Same as broad, plus volatile data in references/ |

## Frontmatter Fields

| Field | Required | Rules |
|-------|----------|-------|
| `name` | Yes | Lowercase + hyphens only, max 64 chars, matches directory. No consecutive hyphens. Must not start/end with hyphen. |
| `description` | Yes | Single line, soft target 80-500 chars, hard cap 1024. Verb + trigger phrases. Include "Do NOT use for..." if overlap with sibling skill. |
| `when_to_use` | No | Claude Code routing extension. Extra trigger examples; `description` must remain sufficient for portable discovery. |
| `allowed-tools` | No | Portable pre-approval field. In Claude Code it grants listed tools for the active skill turn without restricting unlisted tools. Accepts a string or YAML list. |
| `disallowed-tools` | No | One-turn Claude Code restriction. Accepts a string or YAML list. |
| `user-invocable` | No | Boolean, default `true` |
| `context` | No | `fork` for isolated sub-agent |
| `agent` | No | Agent type when `context: fork` |
| `model` | No | Override model |
| `effort` | No | Model effort override (`low`, `medium`, `high`, `xhigh`, `max`; model-dependent) |
| `background` | No | With `context: fork`, set `false` to wait for the fork result; default `true` in current Claude Code |
| `argument-hint` | No | Autocomplete hint (e.g., `[issue-number]`) |
| `arguments` | No | Named positional arguments for `$name` substitution; string or YAML list |
| `disable-model-invocation` | No | Prevent auto-loading |
| `paths` | No | Claude Code path-scoped activation globs |
| `shell` | No | Shell for dynamic context blocks (`bash` or `powershell`) |
| `hooks` | No | Lifecycle hooks (PreToolUse, PostToolUse, Stop) |
| `license` | No | Open-source license for distribution |
| `compatibility` | No | Environment requirements, 1-500 chars |
| `metadata` | No | Portable custom key-value map (for example `type: meta` for external tooling) |

## Validation

After creating or editing a skill, verify:

1. **Canonical source exists**: `test -f skills/<skill-name>/SKILL.md`
2. **Quality**: chain to Flow 2 (Verify) for full quality validation
3. **Repository checks**: `./scripts/validate-repository.sh`

## References

- [create.md](workflows/create.md) — Flow 1: Create Skill
- [verify.md](workflows/verify.md) — Flow 2: Verify Skill
- [improve.md](workflows/improve.md) — Flow 3: Improve Skill
- [best-practices.md](references/best-practices.md) — Skill authoring patterns and guidelines
- [verification-checklist.md](references/verification-checklist.md) — All verification checks
- [skill-template.md](references/skill-template.md) — Unified skill template with class-specific sections
