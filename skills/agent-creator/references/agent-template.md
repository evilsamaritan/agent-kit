# Agent Template

## Contents

- [Template Agent](#template-agent) — default: inlines role-template(s) + preloaded knowledge skills
- [Standalone Agent](#standalone-agent) — fully custom body, no role-template
- [Skill-Wrapper Agent](#skill-wrapper-agent) — thin body + single skill preload
- [Frontmatter Reference](#frontmatter-reference)
- [Description Patterns](#description-patterns)
- [Color Guide](#color-guide)

---

## Template Agent

**Default form.** The agent body is assembled by inlining role-template(s) from `skills/agent-creator/templates/` and referencing preloaded knowledge skills.

```markdown
---
name: {profession}              # one word, lowercase
description: Senior {profession}. Use when {concrete triggers}. Do NOT use for {boundary cases}.
model: sonnet                   # opus for design-heavy; sonnet for execution
color: {color}
skills: [{knowledge-skill-1}, {knowledge-skill-2}, ...]
tools: [Read, Grep, Glob, Edit, Write, Bash, Skill]
---

You are a senior {profession} focused on {specialization}. {One-sentence value statement.}

## Role — {template-name}                     # inlined from templates/{template-name}.md

{Condensed body of the template: mental model, operating modes, hard rules, anti-patterns.}

## {Additional domain context}                # optional, brief

{Project-specific conventions, framework preferences, tech-stack specifics.}

## Output format

1. {Deliverable 1 with structure}
2. {Deliverable 2}
3. {Deliverable 3}

## Done means

- {Concrete completion criterion 1}
- {Concrete completion criterion 2}
- {Concrete completion criterion 3}
```

**Composition variants:**
- **Single template** — most agents (frontend, backend, writer).
- **Two templates** — agents that span modes. Examples: `sre` = operator + reviewer, `tester` = implementer + reviewer, `devops` = implementer + operator, `designer` = architect + implementer.
- **Three templates** — rare; reserved for cross-mode agents like `security` that need reviewer + auditor-scoped scanning + architectural threat modeling.

When inlining multiple templates, order by workflow sequence (architect → implementer → reviewer → operator → writer), skipping what doesn't apply. Label sections clearly.

---

## Standalone Agent

Fully custom body — no role-template inlining. Use when the behavior is unique and not reusable.

```markdown
---
name: {agent-name}
description: {What + when}.
model: sonnet
color: {color}
tools: [Read, Edit, Write, Bash, Glob, Grep]
---

You are a {role} with deep expertise in {domain}. Your primary mission is {goal}.

## Your Responsibilities

1. **{Area 1}** — {what to do, how}
2. **{Area 2}** — {what to do, how}

## Workflow

1. Understand the task
2. Gather context
3. Execute
4. Verify

## Rules

- {Rule 1 — specific, actionable}
- {Rule 2}

## Done Criteria

- {Criterion 1}
- {Criterion 2}
```

---

## Skill-Wrapper Agent

Thin wrapper that delegates to a preloaded meta or knowledge skill. Use when the skill covers the whole behavior.

```markdown
---
name: {agent-name}
description: {Production domain} sub-agent. Use when the task involves {triggers}. Runs with full {skill-name} skill context preloaded.
model: sonnet
color: {color}
tools: [Read, Edit, Write, Bash, Glob, Grep]
skills: [{skill-name}]
---

You are a senior {role} with deep expertise in {domain}.

**Your job:** Execute the task using the preloaded `{skill-name}` skill as your knowledge base.

Choose the workflow matching your assignment:
- Task type A → follow `workflows/a.md` in the skill
- Task type B → follow `workflows/b.md` in the skill

**Rules:**
- {Rule 1}
- {Rule 2}

**Done means:**
- {Criterion 1}
- {Criterion 2}
```

---

## Frontmatter Reference

### Required Fields

| Field | Rules |
|-------|-------|
| `name` | Lowercase, single word for base agents (profession). Must match filename. |
| `description` | When Claude should delegate. Single-line or multiline `\|`. Includes WHAT + WHEN + negative triggers. |

### Optional Fields

| Field | Default | Rules |
|-------|---------|-------|
| `model` | `inherit` | `sonnet`, `opus`, `haiku`, full model ID, or `inherit` |
| `color` | none | UI background color for the agent |
| `tools` | inherit all | Comma-separated string or array. Supports `Agent(type)` to restrict spawnable subagents |
| `disallowedTools` | none | Tools to explicitly deny |
| `permissionMode` | `default` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | unlimited | Safety limit on agentic turns |
| `skills` | none | Array of knowledge-skill names — full content injected at startup |
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
description: Senior frontend developer. Use when implementing UI components, pages, or styling. Do NOT use for UX design (use designer) or deep HTML/CSS (use html/css skill).
```

### Long (multiline `|`)

Best for agents with multiple triggers or nuanced routing:

```yaml
description: |
  Senior SRE / reliability engineer. Use when defining SLOs, designing health probes,
  reviewing graceful shutdown, writing runbooks, running an incident, or reducing toil.

  Do NOT use for:
  - CI/CD pipelines → use devops
  - Observability instrumentation → use observability knowledge skill
  - Performance profiling → use performance
```

### Rules

- Include specific trigger phrases — Claude matches these against user requests.
- Always include negative triggers ("Do NOT use for…") when the agent overlaps with another.
- Mention technologies, patterns, or file types relevant to the agent.

---

## Color Guide

Choose color based on domain for visual consistency:

| Color | Suggested domain |
|-------|------------------|
| `purple` | Architecture, planning, design decisions |
| `green` | Backend, server-side |
| `cyan` | Frontend, UI |
| `magenta` | DevOps, infrastructure, deployment |
| `red` | Security, SRE, incident work |
| `yellow` | Testing, QA |
| `blue` | Code review, general quality |
| `pink` | Design, UX |
| `indigo` | Writing, documentation |
| `orange` | Miscellaneous / flag |
