# Skill Template

Unified template with optional sections. Include only what applies to your skill.

## Contents

- [Full Template](#full-template)
- [Section Guide](#section-guide)
- [Frontmatter Quick Reference](#frontmatter-quick-reference)
- [Permission Fields](#permission-fields)

---

## Full Template

```markdown
---
name: skill-name
description: Verb phrase describing what and when. Use when trigger phrases match user intent.
---

# Skill Name

## Purpose

One sentence: what this skill accomplishes or enables.

## Prerequisites

- Required tool/file/state

## Commands

<!-- Include if skill runs specific commands -->

Primary command:

` ``bash
command --flags
` ``

## Workflow

<!-- Include if skill has step-by-step procedures -->
<!-- If multiple independent procedures → each in workflows/, SKILL.md routes -->

### Step 1: Gather Requirements

- Ask: What is the target? (use AskUserQuestion if ambiguous)
- Check: Does prerequisite X exist?

### Step 2: Make Decisions

- **If A** → use approach X (simpler, fits most cases)
- **If B** → use approach Y (more complex, needed when...)

Ask only when the choice materially changes the result and cannot be inferred from the request or repository.

### Step 3: Generate Artifacts

1. Create directory structure
2. Write primary file
3. Write the requested in-scope artifact; preview first only when a material choice remains unresolved

### Step 4: Validate

` ``bash
validation-command
` ``

Check:
- [ ] Artifact exists at expected path
- [ ] Build/install succeeds

## Decision Tree

<!-- Include if skill provides decision guidance -->

` ``
Need to do X?
├── Scenario A → Use Pattern 1 (reason)
├── Scenario B → Use Pattern 2 (reason)
└── Scenario C → Ask: (use AskUserQuestion)
` ``

## Quick Reference

<!-- Include if skill has multiple flows or patterns -->

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| A        | Pattern 1   | Short reason |
| B        | Pattern 2   | Short reason |

## Patterns

<!-- Include if skill teaches patterns -->

### Pattern 1: Name

When to use: ...

` ``language
// code example
` ``

## Anti-Patterns

<!-- Include if skill has common mistakes to avoid -->

| Don't | Why | Instead |
|-------|-----|---------|
| Bad practice 1 | Reason | Good practice |

## Error Handling

<!-- Include if skill has commands that can fail -->

| Error | Cause | Solution |
|-------|-------|----------|
| `error message` | Root cause | `fix command` |

## Validation

Verify everything works:

` ``bash
validation-command && echo "Success"
` ``

## References

- [detailed-workflow.md](workflows/detailed-workflow.md) — Extended procedure
- [patterns.md](references/patterns.md) — Full reference docs
```

---

## Section Guide

Not every skill needs every section. Use this table to decide what to include.

| Section | Include when | Tone |
|---------|-------------|------|
| **Purpose** | Expands on description (not a repeat) | — |
| **Prerequisites** | Skill needs specific state or tools | Imperative |
| **Commands** | Skill runs specific commands | Direct |
| **Workflow** | Skill has step-by-step procedures | Imperative |
| **Decision Tree** | Skill provides decision guidance | Advisory |
| **Quick Reference** | Skill has multiple flows or pattern options | — |
| **Patterns** | Skill teaches code patterns | Advisory |
| **Anti-Patterns** | Common mistakes exist | Advisory |
| **Error Handling** | Commands section exists | Direct |
| **Validation** | Output can be verified | Imperative |
| **References** | Sub-files exist in workflows/ or references/ | — |

**Delete sections that don't apply.** An empty section is worse than no section.

**Progressive disclosure:** If a section exceeds 60 lines, extract to a sub-file:
- Procedures → `workflows/`
- Knowledge/docs → `references/`

**Router pattern:** If skill has 2+ independent procedures (different user intents), keep SKILL.md as a router:
```markdown
## Quick Reference

| Task | Procedure | Details |
|------|-----------|---------|
| Create X | [create.md](workflows/create.md) | For new X |
| Migrate Y | [migrate.md](workflows/migrate.md) | For existing Y |
```

---

## Structure Templates by Class

Choose the template that matches your skill's taxonomy class (see CLAUDE.md "Skill Taxonomy").

> **Note on roles.** Behavioral role content (how an agent thinks / structures work) is not a skill in v2. Role-templates live at `skills/agent-creator/templates/*.md` and are managed by `agent-creator`. This file covers **knowledge** and **meta** skill templates only.

### Broad Knowledge Skill Template

Type: knowledge, scope: broad. Must be vendor/framework agnostic in SKILL.md. Framework refs go in `references/<framework>.md`.

```markdown
# Domain Name

Expert-level [domain] knowledge.

## Scope and boundaries
## Decision tree
## Core rules / patterns
## Context Adaptation
## Anti-Patterns
## Related Knowledge
## References
```

### Specialized / Language / Framework Skill Template

Type: knowledge, scope: specialized | language | framework | platform-tech. May be specific by design. Follow the universal line budget (soft 500, ceiling ~550). Language/framework skills typically stay compact (~200-300 lines) because the detail belongs in references; workflows are usually unnecessary but not forbidden.

```markdown
# Technology Name

Expert-level [technology] knowledge.

## Core concepts / Mental model
## Decision points
## Hard rules
## Anti-Patterns
## Related Knowledge / Sibling boundaries
## References
```

### Regulatory Skill Template

Type: knowledge, scope: regulatory. Evergreen principles in SKILL.md, volatile data (dates, enforcement trends, prices) in references/.

```markdown
# Domain Name

## Scope and boundaries
## Decision tree
## Core rules / patterns
## Context Adaptation
## Anti-Patterns
## Related Knowledge
## References
```

### Meta Skill Template

Type: meta. Skills that create/manage other skills or agents.

```markdown
# Skill Name

## Purpose                # Optional — only if it adds context beyond description
## Critical rules
## Flow selection
## Quick reference
## Validation             # Optional — for producer meta-skills (those that write files/configs)
## References
```

**Meta sub-types:**
- **Producer** — writes files or configs (`skill-creator`, `agent-creator`, `update-config`, `hook-creator`). Should include `## Validation` describing how to verify output.
- **Router / dispatcher** — delegates to other skills (`init`, `agent-orchestrator`). `## Validation` is optional; delegatees own their verification.

---

## Frontmatter Quick Reference

```yaml
# Required
name: kebab-case-name           # Max 64 chars, must match directory
description: Verb phrase. Use when trigger phrases.  # Max 1024 chars, single line

# Optional — routing and behavior
when_to_use: Extra Claude trigger examples   # Claude Code extension; keep description portable
allowed-tools: Bash(script *)                # One-turn permission grant, not a tool restriction
disallowed-tools: Write, Edit                # One-turn Claude Code restriction
user-invocable: false                        # Hide from direct invocation (default: true)
context: fork                                # Isolated sub-agent execution
agent: general-purpose                       # Agent type for context: fork
model: model-id                              # Override model (agent-specific)
effort: high                                 # Model-dependent effort override
background: false                            # With fork, wait for the result
argument-hint: "[issue-number]"              # Autocomplete hint for arguments
arguments: issue-number format               # Named positional arguments
disable-model-invocation: false              # Prevent auto-loading
paths: "src/**/*.ts"                         # Path-scoped activation
shell: bash                                  # Dynamic-context shell
hooks: {}                                    # Lifecycle hooks (PreToolUse, PostToolUse, Stop)

# Optional — distribution
license: MIT                                 # Open-source license
compatibility: "Requires Node.js 18+"        # Environment requirements, 1-500 chars
metadata:                                    # Custom key-value pairs
  author: Your Name
  version: 1.0.0
  mcp-server: server-name
```

---

## Permission Fields

`allowed-tools` is a portable pre-approval field. In Claude Code it does not restrict which tools exist, and values such as bare `Bash`, `Write`, or `Edit` bypass prompts while the skill is active. Declare the grant intentionally; prefer command-scoped forms when the workflow needs only deterministic commands.

`disallowed-tools` temporarily removes tools while the skill is active. Use it when a workflow must be read-only or must never ask a user in the background. For durable policy, configure runtime permissions instead of skill frontmatter.
