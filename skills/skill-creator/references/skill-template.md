# Skill Template

Unified template with optional sections. Include only what applies to your skill.

## Contents

- [Full Template](#full-template)
- [Section Guide](#section-guide)
- [Frontmatter Quick Reference](#frontmatter-quick-reference)
- [Common allowed-tools Combinations](#common-allowed-tools-combinations)

---

## Full Template

```markdown
---
name: skill-name
description: Verb phrase describing what and when. Use when trigger phrases match user intent.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
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

Present choice to user for confirmation.

### Step 3: Generate Artifacts

1. Create directory structure
2. Write primary file
3. Show generated content to user before writing

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

Type: knowledge, scope: specialized | language | framework | platform-tech. May be specific by design. Language/framework: SKILL.md < 200 lines, 2-4 reference files, no workflows.

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

## Purpose
## Critical rules
## Flow selection
## Quick reference
## Validation
## References
```

---

## Frontmatter Quick Reference

```yaml
# Required
name: kebab-case-name           # Max 64 chars, must match directory
description: Verb phrase. Use when trigger phrases.  # Max 1024 chars, single line

# Optional — behavior
allowed-tools: Read, Bash, Edit              # Comma-separated, NOT YAML list. Scoped: "Bash(python:*)"
user-invocable: true                         # Show in /slash menu (default: true)
context: fork                                # Isolated sub-agent execution
agent: general-purpose                       # Agent type for context: fork
model: model-id                              # Override model (agent-specific)
argument-hint: "[issue-number]"              # Autocomplete hint for arguments
disable-model-invocation: false              # Prevent auto-loading
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

## Common allowed-tools Combinations

| Skill Focus | Tools |
|-------------|-------|
| Read-only research | `Read, Grep, Glob` |
| Code modification | `Read, Edit, Bash, Glob, Grep` |
| File creation | `Read, Write, Glob, Bash` |
| Full access | `Read, Grep, Glob, Bash, Edit, Write` |
| Interactive workflow | `Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion` |
