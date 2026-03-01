---
name: skill-creator
description: Create, verify, or improve skills. Use when creating a new skill, scaffolding skill structure, writing SKILL.md, verifying skill quality, reviewing an existing skill, or improving skill effectiveness.
meta: true
internal: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# Skill Creator

## Purpose

Create new skills with proper structure, verify existing skills against quality standards, or improve skills based on feedback.

## Critical Rule

**Always edit skills in `skills/`, NEVER in `.claude/skills/`.**

`.claude/skills/` is a symlink to `../skills/`. No installation or sync needed — create a file in `skills/` and it is immediately accessible to all agents.

## Flow Selection

Determine which flow to run:

1. **User said "create" / "new" / "scaffold"** → Flow 1: Create
2. **User said "verify" / "review" / "check"** → Flow 2: Verify
3. **User said "improve" / "fix" / "refactor" / "doesn't work well"** → Flow 3: Improve
4. **Ambiguous** → Use `AskUserQuestion`:
   - Option A: "Create a new skill"
   - Option B: "Verify an existing skill"
   - Option C: "Improve an existing skill"

## Quick Reference

| Task | Flow | Steps | Details |
|------|------|-------|---------|
| Create a skill | Flow 1 | Gather → Plan content → Name → Description → Generate → Verify Access | [create.md](workflows/create.md) |
| Verify a skill | Flow 2 | Identify → Load checklist → Parse → Run checks → Report → Fix | [verify.md](workflows/verify.md) |
| Improve a skill | Flow 3 | Identify → Gather feedback → Analyze → Propose → Apply → Verify | [improve.md](workflows/improve.md) |

## Frontmatter Fields

| Field | Required | Rules |
|-------|----------|-------|
| `name` | Yes | Lowercase + hyphens, max 64 chars, matches directory |
| `description` | Yes | Single line, max 1024 chars, verb + trigger phrases |
| `allowed-tools` | No | Comma-separated string (not YAML list) |
| `internal` | No | Boolean. `true` for locally created skills — only internal skills are verified/improved by default |
| `user-invocable` | No | Boolean, default `true` |
| `context` | No | `fork` for isolated sub-agent |
| `agent` | No | Agent type when `context: fork` |
| `model` | No | Override model |
| `hooks` | No | Lifecycle hooks |

## Validation

After creating or editing a skill, verify:

1. **Accessible via symlink**: `ls .claude/skills/<skill-name>/SKILL.md`
2. **Quality**: chain to Flow 2 (Verify) for full 43-check validation

## References

- [create.md](workflows/create.md) — Flow 1: Create Skill (8 steps)
- [verify.md](workflows/verify.md) — Flow 2: Verify Skill (7 steps)
- [improve.md](workflows/improve.md) — Flow 3: Improve Skill (6 steps)
- [best-practices.md](references/best-practices.md) — Skill authoring patterns and guidelines
- [verification-checklist.md](references/verification-checklist.md) — All verification checks
- [skill-template.md](references/skill-template.md) — Unified skill template
