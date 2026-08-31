# Configure Project Agents

## Step 1: Inspect the project

1. Detect the stack, project boundaries, and existing Agent Kit config.
2. Read `.agent-kit/agents.json` when present.
3. Inspect existing `.claude/agents/` and `.codex/agents/` files. Distinguish Agent Kit generated files from user-owned files by the generated marker.
4. Resolve the materializer from this skill's installed directory.

## Step 2: Select profiles and skills

For each requested project agent:

1. Pick one bundled profession profile from `../../agent-orchestrator/references/profile-catalog.md`.
2. Start from its default skills.
3. Replace the list with the smallest exact set matching the project stack and the agent's routine responsibilities.
4. Keep profile default effort, access, and runtime models unless the request or project constraints justify an override.
5. Use a profession-shaped name. Add a specialization suffix only when multiple variants coexist, such as `backend-rust` and `backend-node`.

If a required knowledge skill does not exist, invoke `skill-creator` first. If no profession profile fits, use [maintain-profile.md](maintain-profile.md) only when working in the Agent Kit source repository; otherwise explain that the library needs a new profile rather than inventing a project-only profession body.

## Step 3: Update the project source

Create or update `.agent-kit/agents.json` using [../references/project-config.md](../references/project-config.md).

- **Create:** append a unique agent entry.
- **Update:** change the matching entry without rewriting unrelated entries.
- **Delete:** remove the matching entry; do not delete native files by hand.
- **Sync:** leave the config unchanged.

Default `runtimes` to both `claude` and `codex`.

## Step 4: Materialize native agents

Run the installed `scripts/materialize-agents.mjs` with `--project-root` pointing at the consuming project. Use `--prune` after deletion or a runtime list change so obsolete generated targets are removed safely.

The expected outputs are:

```text
.claude/agents/<name>.md
.codex/agents/<name>.toml
```

Do not manually patch an output to fix generation. Change `.agent-kit/agents.json`, the reusable profile, or the materializer.

## Step 5: Verify

1. Run the materializer with `--check`.
2. Parse every generated Codex file as TOML.
3. Confirm Claude frontmatter contains the intended name, description, skills, model, effort, and tools.
4. Confirm Codex TOML contains `name`, `description`, `developer_instructions`, `model_reasoning_effort`, `sandbox_mode`, and the selected skill paths.
5. Confirm user-owned native agent files remain unchanged.

Report the project composition, generated targets, overrides, and validation evidence.
