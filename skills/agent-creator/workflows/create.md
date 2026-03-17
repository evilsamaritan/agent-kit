# Flow 1: Create Agent

## Step 1: Gather Requirements

Ask the user (or extract from context):

- **What should the agent do?** — specific capability or domain
- **Standalone or skill agent?**
  - Standalone: full system prompt in body, self-contained
  - Skill agent: thin body + `skills: [skill-name]` preloads existing skill context

If the user gave a clear description, skip asking and proceed.

## Step 2: Determine Agent Type

Check if a skill already exists for this domain:

```bash
ls skills/
```

Use `AskUserQuestion` to confirm agent type:

| Option | Label | When to choose |
|--------|-------|----------------|
| 1 | **Skill agent** — thin wrapper + preloaded skill | A skill already exists that covers the domain |
| 2 | **Standalone agent** — full system prompt in body | No existing skill, or agent needs unique instructions |
| 3 | **Create skill first, then skill agent** | Domain deserves reusable skill + agent wrapper |

Decision tree:

```
Does a skill already exist that covers this domain?
├── YES → Option 1: Skill agent (thin body, skills: [skill-name])
│   Benefits: reusable skill, agent just adds model/tools/permissions config
├── NO, but domain is reusable → Option 3: Create skill first
│   Benefits: skill reusable by other agents and directly, agent is thin
└── NO, unique to this agent → Option 2: Standalone agent
    Benefits: self-contained, no dependency on skill files
```

If skill agent: verify the skill exists in `skills/` directory.
If "create skill first": chain to `skill-creator` skill, then return here for agent creation.

## Step 3: Load Best Practices

Read `references/agent-template.md` from skill base directory.

## Step 4: Choose Name

Generate 3 name candidates ranked best to worst.

Naming rules:
- Lowercase, hyphens only
- Must match filename (without `.md`)
- Domain-led when possible (e.g., `kotlin-backend`, `typescript-ui`)
- Match existing patterns in `agents/`

Present via `AskUserQuestion` with 3 options. The user can also enter their own name.

## Step 5: Write Description

Draft the description. Unlike skills, agent descriptions CAN use YAML `|` for multiline.

**Short description (single line):**
```yaml
description: Expert code reviewer for Kotlin backend. Use when reviewing code quality, security, and patterns.
```

**Long description (multiline `|`):**
```yaml
description: |
  Use this agent for architectural decisions, system design, and technology selection.

  When to use:
  - Designing new features that span multiple services
  - Choosing between architectural approaches
  - Planning data flows between systems

  Example prompts:
  - "Design a real-time notification system"
  - "How should we implement cross-service transactions?"
```

Rules:
- Short: start with a role/expertise statement, include "Use when" triggers
- Long: use `|` block scalar, include "When to use:" bullets and "Example prompts:"
- Be specific about when Claude should delegate to this agent

Present to user for approval.

## Step 6: Choose Configuration

Determine optional frontmatter fields:

1. **Model**: `sonnet` (fast, cheaper), `opus` (strongest), `haiku` (fastest), full model ID (e.g., `claude-opus-4-6`), `inherit` (same as parent)
2. **Color**: visual distinction in UI
3. **Tools**: scope to needed tools (default: inherit all). Use `Agent(type)` to restrict spawnable subagents
4. **Permission mode**: `default` for most, `bypassPermissions` for trusted automation
5. **Max turns**: limit for safety (default: unlimited)
6. **Skills**: list of skills to preload (for skill/composite agents)
7. **Memory**: persistent memory scope (`user`, `project`, `local`) for cross-session learning
8. **Background**: `true` to always run as background task
9. **Isolation**: `worktree` for isolated git worktree

### Composite Agent Skills Selection

When creating a composite agent:
1. **Pick one role skill** — this provides workflows and primary persona
2. **Add all knowledge skills the task requires** — no artificial limit, but each must be relevant to the request
3. **Order matters** — role skill first, then knowledge skills by importance
4. **Verify coherence** — every skill must make sense together (e.g., `frontend + kotlin` is wrong; `backend + kotlin + database + message-queues` is right)

Example for "Rust backend with PostgreSQL and API design":
```yaml
skills:
  - backend    # Role: provides service patterns, review workflow
  - rust       # Language: ownership, error handling, crate selection
  - database   # Domain: schema, migrations, query optimization
  - api-design # Domain: REST/gRPC conventions, error contracts
```

Present configuration summary to user for approval.

## Step 7: Generate Agent File

### For standalone agents:

```markdown
---
name: agent-name
description: |
  Description here.

  When to use:
  - Trigger 1
  - Trigger 2
model: sonnet
color: blue
---

You are a [role] with expertise in [domain].

## Your Responsibilities

1. **Area 1**
   - Detail

2. **Area 2**
   - Detail

## Workflow

1. Step 1
2. Step 2

## Rules

- Rule 1
- Rule 2
```

### For skill agents:

```markdown
---
name: agent-name
description: |
  Description here.
model: sonnet
color: green
skills:
  - skill-name
---

You are a [role] with deep expertise in [domain].

**Your job:** Execute the task assigned to you using the preloaded skill-name skill as your knowledge base.

**Skill:** skill-name (preloaded — SKILL.md is already in your context)

**Rules:**
- Rule 1
- Rule 2

**Done means:**
- Criteria 1
- Criteria 2
```

Write file to `agents/<agent-name>.md` (source of truth in root `agents/`, symlinked from `.claude/agents/`).

## Step 8: Verify

Verify the agent file is valid:

```bash
ls agents/<agent-name>.md
```

After creation, offer:
> "Agent created. Want me to run verification to check quality?"

If yes → chain to Flow 2 with the just-created agent.
