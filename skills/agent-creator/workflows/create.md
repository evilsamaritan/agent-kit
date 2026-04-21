# Flow 1: Create Agent

## Step 1: Gather requirements

Ask the user (or extract from context):

- **What profession should this agent be?** — one word, e.g. `frontend`, `backend`, `sre`.
- **What's the specialization?** — e.g. React SPA, Go backend, Kubernetes ops.
- **Any constraints?** — model preference, permission mode, preload scope.

If the user's description is clear, skip asking and proceed.

## Step 2: Pick agent form

Three forms — in practice the first one covers 90%+ of cases.

| Form | When to pick |
|------|--------------|
| **Template agent** (default) | Any base profession. Combines role-template(s) + knowledge skills. |
| **Standalone agent** | Behavior is unique, not reusable, doesn't fit any template. |
| **Skill-wrapper agent** | A single meta / knowledge skill covers the whole behavior (thin body, preloaded skill). |

Use `AskUserQuestion` only when ambiguous.

## Step 3: Pick role-template(s)

Available templates (each lives at `skills/agent-creator/templates/{name}.md`):

| template | what the agent does |
|----------|---------------------|
| `architect` | designs before building — decisions, ADRs, options memos |
| `implementer` | produces artifacts — code, tests, configs |
| `reviewer` | judges artifacts — diff review or codebase audit |
| `operator` | runs live systems — deploy, rollback, incidents |
| `writer` | writes human-facing text — docs, ADRs, READMEs |

Pick one or combine two to three when the profession spans modes. Examples:

- `frontend` → `implementer`
- `devops` → `implementer` + `operator`
- `sre` → `operator` + `reviewer`
- `designer` → `architect` + `implementer`
- `security` → `reviewer` (with security knowledge skill preloaded)

Order in the body: architect → implementer → reviewer → operator → writer (skip those that don't apply).

## Step 4: Pick knowledge skills

Preload the smallest useful set. A preloaded skill costs context; add only skills the agent routinely needs. Skills not preloaded are still auto-triggered by Claude Code when relevant.

Check what's available:

```bash
ls skills/
```

Examples:

```
frontend   → skills: [frontend, web, html, css, accessibility]
backend    → skills: [backend, api-design, database, auth, caching]
devops     → skills: [docker, kubernetes, ci-cd, release-engineering]
sre        → skills: [reliability, observability, performance]
security   → skills: [security, auth, compliance]
tester     → skills: [testing]
designer   → skills: [design, html, css, accessibility]
architect  → skills: [architecture]
reviewer   → skills: []   (generic — picks up domain by context)
writer     → skills: [documentation]
```

**Coherence check** — every preloaded skill must make sense alongside the others. `frontend + kotlin` is a smell (mixed stack); `backend + go + database + api-design` is coherent.

## Step 5: Choose a name

One word, lowercase, profession-shaped. Must match filename (without `.md`).

Good: `frontend`, `devops`, `sre`, `tester`, `mobile`, `data`.
Bad: `frontend-dev`, `senior-backend-agent`, `ux_designer`.

If a base agent with that name already exists, specialize the name: `mobile-ios`, `backend-rust`, `data-pipelines`.

## Step 6: Draft description

Short is preferred. Include:
- **WHAT** — role + specialization
- **WHEN** — concrete triggers
- **NOT** — negative triggers when overlap with other agents exists

```yaml
description: Senior {profession} focused on {specialization}. Use when {triggers}. Do NOT use for {boundary cases}.
```

Multiline `|` is allowed for complex routing; keep it structured.

## Step 7: Configure frontmatter

| Field | Guidance |
|-------|----------|
| `model` | `opus` for design-heavy roles (architect, reviewer, security), `sonnet` for implementation/operations, `haiku` if quick turnaround matters more than depth |
| `color` | Domain-based — see [agent-template.md](../references/agent-template.md#color-guide) |
| `tools` | Scope when restricting behavior is useful; default is inherit-all |
| `permissionMode` | `default` for most; `bypassPermissions` only for trusted automation |
| `maxTurns` | Limit only if you've seen runaway loops |
| `skills` | Knowledge skills to preload (from Step 4) |
| `memory` | `project` for teams that learn over time |
| `background` | `true` only for long-running tasks |
| `isolation` | `worktree` when the agent writes large or risky changes |

Present the configuration summary to the user for approval before writing.

## Step 8: Assemble the body

The body is constructed by the agent-creator:

1. **Persona line** — one sentence. "You are a senior {profession} focused on {specialization}. {One-sentence value statement}."
2. **Inlined role-template(s)** — read each selected template from `skills/agent-creator/templates/{name}.md` and copy the relevant sections (Mental model, Operating modes, Hard rules, Anti-patterns) into the body. Condense only where verbatim copy would be unreadable — preserve the rule content and the voice, drop repetition. Contract with `agent-creator/SKILL.md`: one voice, not stitched-together checklists.
3. **Domain section** (optional) — project-specific conventions, framework preferences, specialization notes.
4. **Output format** — concrete deliverable shapes.
5. **Done means** — concrete completion criteria.

See [agent-template.md](../references/agent-template.md#template-agent) for the canonical layout.

## Step 9: Write the file

Write to `agents/<agent-name>.md`. Never to `.claude/agents/` (symlink).

## Step 10: Verify

```bash
ls agents/<agent-name>.md
ls .claude/agents/<agent-name>.md
```

After creation, offer:
> "Agent created. Run verification to check quality?"

If yes → chain to Flow 2 with the just-created agent.
