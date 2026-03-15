---
name: skill-creator
description: Create, verify, or improve skills. Use when creating a new skill, scaffolding skill structure, writing SKILL.md, verifying skill quality, reviewing an existing skill, or improving skill effectiveness. Do NOT use for agent creation (use agent-creator).
internal: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# Skill Creator

## Purpose

Create new skills with proper structure, verify existing skills against quality standards, or improve skills based on feedback.

## Critical Rules

1. **Always edit skills in `skills/`, NEVER in `.claude/skills/`.** `.claude/skills/` is a symlink to `../skills/`. No installation or sync needed.
2. **One skill = one domain.** Do not merge unrelated domains into a single skill.
3. **Classify before creating.** Every skill has a type (role / knowledge / meta) and knowledge skills have a scope (broad / specialized / language / framework / platform-tech / regulatory). Classification determines structure template, agnosticity rules, and sizing.
4. **SKILL.md maximum 500 lines** (ceiling, not target). Extract depth to references/ and procedures to workflows/.
5. **Teach patterns, not products.** Broad/role skills must be vendor-agnostic in SKILL.md. Framework-specific content goes in `references/<framework>.md`.

## Flow Selection

Determine which flow to run:

1. **User said "create" / "new" / "scaffold"** → Flow 1: Create
2. **User said "verify" / "review" / "check"** → Flow 2: Verify
3. **User said "improve" / "fix" / "refactor" / "audit" / "doesn't work well"** → Flow 3: Improve
4. **Ambiguous** → Use `AskUserQuestion`:
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
| **role** | Persona with workflows, owns a domain | `What this role owns` → `Operating modes` → `Workflow routing` → `Related Knowledge` |
| **knowledge** | Domain expertise loaded on demand | Depends on scope (see below) |
| **meta** | Skills that create/manage other skills or agents | `Purpose` → `Critical rules` → `Flow selection` → `Quick reference` → `Validation` |

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
| `description` | Yes | Single line, max 1024 chars, verb + trigger phrases. Include "Do NOT use for..." if overlap with sibling skill. |
| `allowed-tools` | No | Comma-separated string (not YAML list). Scoped: `"Bash(python:*)"` |
| `internal` | No | Boolean. `true` for locally created skills — only internal skills are verified/improved by default |
| `user-invocable` | No | Boolean, default `true` |
| `context` | No | `fork` for isolated sub-agent |
| `agent` | No | Agent type when `context: fork` |
| `model` | No | Override model |
| `argument-hint` | No | Autocomplete hint (e.g., `[issue-number]`) |
| `disable-model-invocation` | No | Prevent auto-loading |
| `hooks` | No | Lifecycle hooks (PreToolUse, PostToolUse, Stop) |
| `license` | No | Open-source license for distribution |
| `compatibility` | No | Environment requirements, 1-500 chars |
| `metadata` | No | Custom key-value pairs (author, version, mcp-server) |

## Validation

After creating or editing a skill, verify:

1. **Accessible via symlink**: `ls .claude/skills/<skill-name>/SKILL.md`
2. **Quality**: chain to Flow 2 (Verify) for full 48-check validation

## References

- [create.md](workflows/create.md) — Flow 1: Create Skill
- [verify.md](workflows/verify.md) — Flow 2: Verify Skill
- [improve.md](workflows/improve.md) — Flow 3: Improve Skill
- [best-practices.md](references/best-practices.md) — Skill authoring patterns and guidelines
- [verification-checklist.md](references/verification-checklist.md) — All verification checks
- [skill-template.md](references/skill-template.md) — Unified skill template with class-specific sections
