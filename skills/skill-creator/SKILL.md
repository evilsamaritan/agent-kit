---
name: skill-creator
description: "Create, improve, or verify reusable skills. Use for SKILL.md, descriptions/triggers, workflows, references, and knowledge boundaries; agents use agent-creator."
user-invocable: true
---

# Skill Creator

## Critical Rules

1. **Know the mode before writing.**
   - **Kit authoring** (inside the Agent Kit repository): the skill lives in `skills/<name>/`, which the Claude, Codex, and Kimi plugin manifests all expose; never add a project-local mirror. Validate with `scripts/validate-repository.sh` plus the checklist.
   - **Project skill** (any other repository): write to the host's project skill directory — `.claude/skills/<name>/` for Claude Code, `.agents/skills/<name>/` for Codex (Kimi also reads it), `.kimi-code/skills/<name>/` for Kimi only. Validate with the checklist; kit-only checks do not apply.
2. **One skill = one domain.** Do not merge unrelated domains into a single skill.
3. **Classify before creating.** A skill is **knowledge** (domain expertise, discoverable and preloadable into agents) or **meta** (creates or manages profiles, project agents, skills, orchestration, or project init). The class picks the structure template.
4. **SKILL.md size: soft target 500 lines, ceiling ~550.** Over 550, extract depth to `references/` and procedures to `workflows/`.
5. **Teach patterns, not products.** Broad knowledge skills stay vendor-neutral in SKILL.md; framework-specific content goes in `references/<framework>.md`; volatile facts (versions, dates, support tables) go in references.
6. **Roles live separately.** Behavioral role content is not a skill. Role-templates live at `skills/agent-creator/templates/*.md` and belong to `agent-creator`.
7. **Keep prompts outcome-focused.** State the goal, hard constraints, approval boundaries, required evidence, and success criteria once. Duplicate rules and mandatory confirmations reduce autonomy and waste context.
8. **Treat `allowed-tools` as permission.** In Claude Code it grants listed tools without prompting for the invoking turn; it does not restrict the tool pool. Declare it only as an intentional pre-approval. Use `disallowed-tools` for temporary restrictions.

## Flow Selection

1. **"create" / "new" / "scaffold"** → Flow 1: Create
2. **"verify" / "review" / "check"** → Flow 2: Verify
3. **"improve" / "fix" / "refactor" / "audit" / "doesn't work well"** → Flow 3: Improve
4. **Ambiguous and not inferable from context** → ask the user one question (Claude Code: `AskUserQuestion`; otherwise a plain chat question) with the three flows as options.

## Quick Reference

| Task | Flow | Steps | Details |
|------|------|-------|---------|
| Create a skill | Flow 1 | Classify → Gather → Plan → Name → Description → Generate → Verify | [create.md](workflows/create.md) |
| Verify a skill | Flow 2 | Identify → Load checklist → Parse → Run checks → Report → Fix | [verify.md](workflows/verify.md) |
| Improve a skill | Flow 3 | Identify → Gather feedback → Analyze → Propose → Apply → Verify | [improve.md](workflows/improve.md) |

## Classes

| Class | Covers | Agnostic rule |
|-------|--------|---------------|
| **broad** knowledge | A domain spanning several technologies or vendors | Vendor-neutral in SKILL.md |
| **specialized** knowledge | A narrow sub-domain, a language, a framework, or a platform technology | Specific by design |
| **regulatory** knowledge | Law, standards, compliance | Evergreen core; dates, fines, and enforcement in references |
| **meta** | Producers that write files, and routers that delegate | Host-neutral unless a field is a marked host extension |

The section skeleton for each class is in [skill-template.md](references/skill-template.md#structure-templates-by-class). Frontmatter fields and host portability are in [best-practices.md](references/best-practices.md#frontmatter-reference); `name` and `description` are the only fields every host reads.

## Validation

After creating or editing a skill:

1. **Source exists**: `test -f <skill-dir>/SKILL.md` in the directory chosen by the mode.
2. **Quality**: run Flow 2 checks for the changed scope; full audits are explicit operations.
3. **Kit authoring only**: `./scripts/validate-repository.sh`.

## References

- [create.md](workflows/create.md) — Flow 1: Create Skill
- [verify.md](workflows/verify.md) — Flow 2: Verify Skill
- [improve.md](workflows/improve.md) — Flow 3: Improve Skill
- [best-practices.md](references/best-practices.md) — authoring patterns, description rules, frontmatter fields
- [verification-checklist.md](references/verification-checklist.md) — verification checks
- [skill-template.md](references/skill-template.md) — skill template and per-class structure templates
