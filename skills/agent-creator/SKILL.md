---
name: agent-creator
description: Create, update, delete, sync, or verify project agents assembled from reusable Agent Kit profession profiles and knowledge skills. Use when setting up backend/frontend/tester or other agents for a project, changing their skill combinations, generating native Claude and Codex agent files, or maintaining the bundled profile library. Do NOT use to run agents or assemble a task workflow (use agent-orchestrator) or to create knowledge skills (use skill-creator).
compatibility: Full Agent Kit plugin installation is required for bundled profiles and materializer dependencies.
user-invocable: true
argument-hint: "[create|update|delete|sync|verify] [agent or profile]"
---

# Agent Creator

## Critical rules

- A **profile** is the reusable profession stored by Agent Kit. A **project agent** is a configured instance of a profile rendered into a host runtime's native format.
- In a consuming project, edit only `.agent-kit/agents.json`, then run the materializer. Never hand-copy or hand-edit generated `.claude/agents/*.md` or `.codex/agents/*.toml` files.
- In the Agent Kit repository, edit profile sources only under `profiles/<name>/`, then run `scripts/generate-profiles.mjs`. Never edit `.claude-plugin/agents/` or generated orchestrator profile references.
- Skills are the agent's exact project knowledge composition when `skills` is present in `.agent-kit/agents.json`. If omitted, the profile defaults apply.
- Use native runtime targets: Claude Markdown custom agents and Codex TOML custom agents. Do not create a shared pseudo-runtime, wrapper agent, or proprietary execution protocol.
- Preserve non-generated runtime files. The materializer refuses to overwrite them and prunes only files carrying the Agent Kit generated marker.
- Default to both Claude and Codex project targets so the project can switch runtimes. Narrow `runtimes` only when the user explicitly wants one host.
- Ask before expanding access, selecting a materially more expensive model, or deleting a non-generated file. Routine profile/skill selection and regeneration are part of the requested operation.

## Model

```text
Agent Kit library                  Project source                    Native targets
profiles/backend/                 .agent-kit/agents.json            .claude/agents/backend-rust.md
skills/backend/          +        backend + rust + database   →     .codex/agents/backend-rust.toml
role templates                                                     host-native subagent/workflow
```

Agent Kit remains the source of profession behavior and reusable skills. The project stores only its composition and optional overrides. Runtime files are derived artifacts.

## Flow selection

| Request | Workflow |
|---------|----------|
| Create, update, or delete project agents | [workflows/configure-project.md](workflows/configure-project.md) |
| Sync project runtime files after an Agent Kit update | [workflows/configure-project.md](workflows/configure-project.md), materialize existing config |
| Create or improve a reusable profession profile in this repository | [workflows/maintain-profile.md](workflows/maintain-profile.md) |
| Verify project agents or the profile library | [workflows/verify.md](workflows/verify.md) |

Route “choose a team”, “run agents”, or “make a workflow for this task” to `agent-orchestrator`. Route “create a skill for X” to `skill-creator`.

## Composition

### Profession profile

A profile supplies:

- persona and domain-adapted role behavior;
- default knowledge skills;
- default effort and access intent;
- Claude and Codex model defaults.

Read [references/profile-catalog.md](../agent-orchestrator/references/profile-catalog.md) to discover bundled profiles, then load only the selected `profiles/<name>.md` reference when project configuration needs its detail.

### Project skills

Choose the smallest exact set the project agent routinely needs. Start from profile defaults, then replace them when the stack calls for a different composition.

```text
backend-rust → profile backend + [backend, api-design, database, rust]
backend-node → profile backend + [backend, api-design, database, javascript, web]
frontend-react → profile frontend + [frontend, react, web, html, css, accessibility]
```

Do not preload every possibly related skill. Other installed skills remain discoverable on demand.

### Access

| access | Claude default tools | Codex sandbox default |
|--------|----------------------|-----------------------|
| `read-only` | read/search/web/skills | `read-only` |
| `edits` | read + file edits | `workspace-write` |
| `full` | read + edits + shell | `workspace-write` |

The current runtime session can impose stricter policy or override a child default. `access` is the intended default, not a way to bypass the host.

## Materializer

The deterministic script lives at [scripts/materialize-agents.mjs](scripts/materialize-agents.mjs). Resolve it from this skill's directory and run it with the project root:

```bash
node skills/agent-creator/scripts/materialize-agents.mjs --project-root /path/to/project
node skills/agent-creator/scripts/materialize-agents.mjs --project-root /path/to/project --check
node skills/agent-creator/scripts/materialize-agents.mjs --project-root /path/to/project --prune
```

When Agent Kit is installed as a plugin, use the script's installed absolute path rather than assuming the consuming project contains `skills/agent-creator/`.

## Validation

For a project:

1. Validate `.agent-kit/agents.json` against [references/project-config.md](references/project-config.md).
2. Run the materializer.
3. Run it again with `--check`; any drift is a failure.
4. Parse generated Codex files as TOML and inspect generated Claude frontmatter.
5. Confirm non-generated native agents were preserved.

For the Agent Kit profile library:

1. Run `node scripts/generate-profiles.mjs`.
2. Run `node scripts/generate-profiles.mjs --check`.
3. Run `bash scripts/validate-repository.sh`.
4. Apply [references/verification-checklist.md](references/verification-checklist.md).

## References

- [references/project-config.md](references/project-config.md) — project composition schema
- [references/profile-template.md](references/profile-template.md) — reusable profile source format
- [references/verification-checklist.md](references/verification-checklist.md) — project and library checks
- [templates/](templates/) — role behavior used when authoring profiles
