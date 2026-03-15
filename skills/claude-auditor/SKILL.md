---
name: claude-auditor
description: Audit Claude Code configurations for quality, security, efficiency, and correctness — CLAUDE.md, agents, skills, MCP servers, hooks, context budgets. Use when reviewing Claude Code setup, diagnosing configuration problems, validating best practices, or hardening agent harness. Do NOT use for application code review (use security, qa, cto).
allowed-tools: Read, Grep, Glob, Bash, Write
user-invocable: true
argument-hint: "[path-or-scope]"
---

# Claude Configuration Auditor

You SCAN, ANALYZE, and REPORT problems in Claude Code configurations. You audit the harness — not the application code it produces. You cover all dimensions: quality, security, efficiency, correctness, and best practices.

---

## What This Skill Audits

- `CLAUDE.md` / project instructions — clarity, structure, context engineering, injection risks
- Agent definitions (`agents/*.md`) — permissions, tools, model selection, skill composition
- Skill definitions (`skills/*/SKILL.md`) — frontmatter validity, triggers, size budgets, taxonomy
- MCP server configurations — setup, authentication, tool scope, context cost
- Hooks (`hooks.json`, scripts) — correctness, safety, performance
- Settings (`settings.json`) — permission policies, model overrides, experimental flags
- Context budget — total loaded context, redundancy, lost-in-middle risks

## What This Skill Does NOT Audit

- Application source code → `/security`, `/qa`, `/cto`
- Infrastructure and deployment → `/devops`, `/sre`
- Skill/agent content authoring → `/skill-creator`, `/agent-creator`

---

## Audit Dimensions

### 1. Quality

Is the configuration well-structured, clear, and maintainable?

| Check | What to look for |
|-------|-----------------|
| CLAUDE.md structure | Clear sections, logical flow, not a wall of text |
| CLAUDE.md size | Under 500 lines? Critical rules at START and END (U-shaped attention) |
| Agent descriptions | Verb phrase, WHAT + WHEN + trigger phrases, negative triggers |
| Skill frontmatter | All required fields present (name, description), name matches directory |
| Skill descriptions | Under 1024 chars, includes "Do NOT use for..." when needed |
| Naming consistency | Lowercase-hyphen, matches directory, no mismatches |
| Redundancy | Same information duplicated across CLAUDE.md and skills? |
| Instruction clarity | Ambiguous rules that could be misinterpreted? |
| Workflow completeness | Referenced workflows/references exist? Links not broken? |

### 2. Security

Is the configuration safe from injection, escalation, and data leaks?

| Check | What to look for |
|-------|-----------------|
| Permission modes | `bypassPermissions` or `dontAsk` without justification |
| Tool access | Agents with Bash + elevated permissions |
| Secrets exposure | API keys, tokens, passwords in config files |
| Injection vectors | Dynamic content (`` `!cmd` ``), untrusted data in instructions |
| MCP authentication | Remote servers without auth tokens |
| Hook safety | Command injection, network requests, config modification |
| Safety overrides | Instructions to "ignore", "bypass", "skip verification" |

→ Detailed threat model: `references/threat-model.md`

### 3. Efficiency

Is the context window budget used wisely?

| Check | What to look for |
|-------|-----------------|
| CLAUDE.md bloat | > 500 lines — every line competes with the user's actual work |
| Skill preloading | Agents preloading skills they don't use |
| MCP server count | > 10 enabled servers consume significant context for tool definitions |
| Redundant instructions | Same rule stated in CLAUDE.md AND skill AND agent |
| Reference sizing | Individual reference files > 500 lines — should be split |
| Description length | Skill descriptions close to 1024 char limit without good reason |
| Unused configurations | MCP servers, hooks, or agents defined but never used |

### 4. Correctness

Does the configuration match its intent and follow conventions?

| Check | What to look for |
|-------|-----------------|
| Frontmatter validity | Required fields present, correct types, valid values |
| Name-directory match | Skill `name` field matches its directory name exactly |
| Trigger testing | Description would trigger on relevant queries (WHAT + WHEN)? |
| Negative triggers | Description prevents over-triggering on unrelated queries? |
| Tool alignment | `allowed-tools` matches what the skill actually needs |
| Model appropriateness | `model` matches task complexity (haiku for simple, opus for critical) |
| Permission appropriateness | `permissionMode` matches agent's role (read-only agents don't need bypass) |
| Cross-reference validity | All referenced files (workflows/, references/) exist |
| Taxonomy compliance | Skill type matches template (role/knowledge/meta) |

### 5. Best Practices

Does the configuration follow proven patterns?

| Check | What to look for |
|-------|-----------------|
| Progressive disclosure | 3 levels: frontmatter → SKILL.md → references? |
| Decision trees before tables | Skills comparing tools lead with trees, not feature matrices? |
| Vendor agnosticism | Broad/role skills are framework-agnostic in SKILL.md? |
| Context adaptation | Cross-domain skills include per-role adaptation? |
| Anti-patterns section | Skills include what NOT to do? |
| Related knowledge | Skills link to complementary skills? |
| Done criteria | Role skills define completion criteria? |
| Builder-validator separation | Implementation agents separated from review agents? |

---

## Decision Trees

### What to audit first

```
What's the concern?
├── "Something feels wrong" → Full audit (all dimensions)
├── "Agent behaves unexpectedly" → Correctness first, then Quality
├── "Is this setup safe?" → Security dimension
├── "Context window fills too fast" → Efficiency dimension
├── "New project setup review" → Best Practices first, then Correctness
└── "Before sharing/publishing config" → All dimensions, strict mode
```

### CLAUDE.md quality

```
CLAUDE.md assessment →
├── Does it exist? No → CRITICAL — agent has no project context
├── > 500 lines? → WARNING — context budget pressure
├── Critical rules at start AND end? No → WARNING — lost-in-middle risk
├── Has clear section structure? No → WARNING — hard to maintain
├── Contradictory rules? → ERROR — agent behavior unpredictable
└── Duplicates skill/agent content? → WARNING — redundancy wastes context
```

### Agent permission assessment

```
Agent permission mode? →
├── bypassPermissions → CRITICAL unless: minimal tools + worktree isolation
├── dontAsk → HIGH unless: no Bash/Write tools
├── acceptEdits → MEDIUM — appropriate for trusted agents
├── default → LOW — safest, user approves everything
└── plan → SAFE — read-only planning mode
```

---

## Scoring

Each dimension scores 0-100. Overall grade is weighted average.

| Dimension | Weight | Why |
|-----------|--------|-----|
| Security | 30% | Highest impact — compromise affects everything |
| Correctness | 25% | Incorrect configs cause unexpected behavior |
| Quality | 20% | Poor quality compounds over time |
| Efficiency | 15% | Context waste reduces agent effectiveness |
| Best Practices | 10% | Guidelines, not hard requirements |

### Deduction Rules

| Severity | Points | Examples |
|----------|--------|----------|
| CRITICAL | -20 | bypassPermissions+Bash, secrets in config, broken required fields |
| HIGH | -10 | Missing descriptions, dontAsk+Write, remote MCP without auth |
| MEDIUM | -5 | CLAUDE.md > 500 lines, unused MCP servers, missing anti-patterns |
| LOW | -2 | Minor naming issues, verbose descriptions, missing cross-references |

### Grades

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90-100 | Excellent — well-configured, safe, efficient |
| B | 75-89 | Good — minor issues, no critical problems |
| C | 60-74 | Needs work — several issues across dimensions |
| D | 40-59 | Poor — critical problems need immediate attention |
| F | 0-39 | Failing — significant rework required |

---

## Report Template

```markdown
# Claude Code Configuration Audit

**Scope:** [what was scanned]
**Grade:** [A-F] ([score]/100)
**Date:** [date]

## Dimension Scores
| Dimension | Score | Key issues |
|-----------|-------|------------|
| Security | /100 | |
| Correctness | /100 | |
| Quality | /100 | |
| Efficiency | /100 | |
| Best Practices | /100 | |

## Critical Findings
[Fix immediately]

## High-Priority Findings
[Fix before production use]

## Recommendations
[Ordered by impact]
```

---

## Quick Reference

| Task | Procedure | When |
|------|-----------|------|
| Full audit | [audit.md](workflows/audit.md) | Comprehensive review of all configs |
| Security-focused audit | [audit.md](workflows/audit.md) Phase 5 | Check for injection, escalation, leaks |
| Quality check | [audit.md](workflows/audit.md) Phase 1-2 | Review CLAUDE.md and agent/skill structure |
| Efficiency review | [audit.md](workflows/audit.md) Phase 4 | Context budget analysis |

**References (load when needed):**
- [threat-model.md](references/threat-model.md) — Security threat categories, attack examples, mitigation strategies

---

## Anti-Patterns

| Anti-pattern | Why it fails | Correct approach |
|-------------|-------------|-----------------|
| Monolithic CLAUDE.md | Lost-in-middle effect, context budget waste | Split into skills, keep CLAUDE.md as router |
| Copy-paste between CLAUDE.md and skills | Redundancy, drift, context waste | Single source of truth per topic |
| `bypassPermissions` for convenience | Eliminates all safety guardrails | `acceptEdits` + minimal tools |
| Same permission level for all agents | Blast radius of any misconfiguration | Least privilege per role |
| Secrets in config files | Visible to all tools, version-controlled | Environment variables |
| No `maxTurns` on autonomous agents | Infinite loops, cost explosion | Set 10-30 depending on task |
| 10+ MCP servers enabled | Context bloat, slow startup | Keep under 10, disable unused |
| Vague skill descriptions | Triggers on wrong queries, misses right ones | WHAT + WHEN + "Do NOT use for..." |
| No negative triggers in description | Over-triggering on related but wrong queries | Add "Do NOT use for X (use Y)" |
| Trusting MCP outputs blindly | Injection via tool responses | Validate and sanitize |

---

## Related Knowledge

- `/skill-creator` — creating and improving skills (this skill audits them)
- `/agent-creator` — creating and improving agents (this skill audits them)
- `/security` — application security, when audit finds code-level issues
- `/agent-engineering` — agent architecture patterns, when audit reveals design issues
- `/mcp` — MCP server implementation, when audit finds MCP problems
- `/cto` — holistic technical health, when audit is part of broader review

---

## Done Criteria

An audit is complete when:
1. All config files scanned across all dimensions
2. Every finding has dimension, severity, location, and remediation
3. Dimension scores calculated
4. Overall grade produced
5. No CRITICAL findings left without remediation plan
6. Report produced per template above
