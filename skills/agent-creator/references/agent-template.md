# Agent Template

## Contents

- [Standalone Agent Template](#standalone-agent-template)
- [Skill Agent Template](#skill-agent-template)
- [Composite Agent Template](#composite-agent-template)
- [Frontmatter Reference](#frontmatter-reference)
- [Description Patterns](#description-patterns)
- [Color Guide](#color-guide)

---

## Standalone Agent Template

Full system prompt in body. Use when agent needs unique instructions not available as a skill.

```markdown
---
name: agent-name
description: |
  Role description and expertise area.

  When to use:
  - Trigger scenario 1
  - Trigger scenario 2

  Example prompts:
  - "Example user request 1"
  - "Example user request 2"
model: sonnet
color: blue
---

You are a [role] with deep expertise in [domain]. Your primary mission is [goal].

## Your Responsibilities

1. **Area 1**
   - What to do
   - How to do it

2. **Area 2**
   - What to do

## Workflow

1. Understand the task
2. Gather context
3. Execute
4. Verify

## Rules

- Rule 1 (specific, actionable)
- Rule 2

## Done Criteria

- Criteria 1
- Criteria 2
```

---

## Skill Agent Template

Thin wrapper that delegates to a preloaded skill. Use when a skill already covers the domain.

```markdown
---
name: agent-name
description: |
  Production [domain] sub-agent. Use when the task involves [triggers].
  Spawned as a sub-agent with full [skill-name] skill context preloaded.
model: sonnet
color: green
tools: Read, Edit, Write, Bash, Glob, Grep
maxTurns: 30
skills:
  - skill-name
---

You are a senior [role] with deep expertise in [domain].

**Your job:** Execute the task assigned to you using the preloaded [skill-name] skill as your knowledge base.

**Skill:** [skill-name] (preloaded — SKILL.md is already in your context)

Choose the workflow matching your assignment:
- Task type A → Read `workflows/a.md`
- Task type B → Read `workflows/b.md`

**Rules:**
- Rule 1
- Rule 2

**Done means:**
- Criteria 1
- Criteria 2
```

---

## Composite Agent Template

Combines a role skill with knowledge skills for domain-specific specialists. Use when the agent needs both workflow guidance and deep tech stack expertise.

```markdown
---
name: {role}-{stack}-specialist
description: |
  {Role description} specialized in {tech stack}.
  Use when {specific trigger conditions}.
model: sonnet
color: {color}
tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash, Skill
maxTurns: 30
skills:
  - {role-skill}      # Primary role — provides workflows
  - {knowledge-1}     # Tech stack depth
  - {knowledge-2}     # Domain depth
  - {knowledge-3}     # Optional additional domain
---

You are a senior {role} specialized in {tech stack}. You combine deep {language/framework} expertise with {domain} knowledge.

**Your job:** {one sentence deliverable}

**Skills loaded:** {role-skill} (primary workflow), {knowledge-1}, {knowledge-2}, {knowledge-3}

**Workflow:**
1. Scan the project to detect existing patterns and conventions
2. Follow the {role-skill} workflow for your task type
3. Apply {knowledge-1} patterns for language/framework decisions
4. Apply {knowledge-2} patterns for domain decisions

**Rules:**
- Follow the project's existing conventions
- {Role-specific constraints from the role skill}
- {Domain-specific constraints}

**Done means:**
- {Completion criteria from role skill}
- {Domain-specific quality gates}
```

---

## Frontmatter Reference

### Required Fields

| Field | Rules |
|-------|-------|
| `name` | Lowercase + hyphens only. Must match filename (without .md). |
| `description` | When Claude should delegate. Single-line or multiline `\|`. |

### Optional Fields

| Field | Default | Rules |
|-------|---------|-------|
| `model` | `inherit` | `sonnet`, `opus`, `haiku`, full model ID (e.g., `claude-opus-4-6`), `inherit` |
| `color` | none | UI background color for agent |
| `tools` | inherit all | Comma-separated string or array. Supports `Agent(type)` to restrict spawnable subagents |
| `disallowedTools` | none | Tools to explicitly deny |
| `permissionMode` | `default` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | unlimited | Safety limit on agentic turns |
| `skills` | none | Array of skill names — full content injected at startup |
| `mcpServers` | none | Array: string references (reuse configured) or inline definitions (scoped to agent) |
| `hooks` | none | `PreToolUse`, `PostToolUse`, `Stop` |
| `memory` | none | Persistent memory scope: `user`, `project`, or `local` |
| `background` | `false` | `true` to always run as background task |
| `isolation` | none | `worktree` for isolated git copy |

---

## Description Patterns

### Short (single line)

Best for focused, single-purpose agents:

```yaml
description: Expert code reviewer for Kotlin backend. Use when reviewing code quality, security, and patterns.
```

### Long (multiline |)

Best for agents with multiple triggers or complex routing:

```yaml
description: |
  Use this agent for architectural decisions, system design, and technology selection.
  Supports agent teams — can delegate to specialized agents.

  When to use:
  - Designing new features that span multiple services
  - Choosing between architectural approaches

  Example prompts:
  - "Design a real-time notification system"
```

### Rules

- Include specific trigger phrases — Claude matches these against user requests
- Mention technologies, patterns, file types relevant to the agent
- For agents that overlap with others, add disambiguation

---

## Color Guide

Choose color based on domain for visual consistency:

| Color | Suggested domain |
|-------|-----------------|
| `green` | Backend, Kotlin, server-side |
| `blue` | Code quality, review, enforcement |
| `orange` | Architecture, planning, design |
| `cyan` | Frontend, TypeScript, UI |
| `magenta` | DevOps, infrastructure, deployment |
| `yellow` | Testing, QA |
| `red` | Security, critical operations |
| `purple` | Data, analytics, reporting |
