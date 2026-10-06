# Configure Project Agents

## Step 1: Inspect the project

1. Detect the stack, project boundaries, and existing Agent Kit config.
2. Read `.agent-kit/agents.json` when present.
3. Inspect existing `.claude/agents/` and `.codex/agents/` files. Distinguish Agent Kit generated files from user-owned files by the generated marker.
4. Resolve the materializer from this skill's installed directory.

## Step 2: Select profiles and skills

For each requested project agent:

1. Pick one bundled profession profile from `../../agent-orchestrator/references/profile-catalog.md`.
2. Start from its default skills; the profile's required skills are added automatically.
3. Replace the list with the smallest exact set matching the project stack and the agent's routine responsibilities.
4. Keep profile default effort and access. Leave models inherited unless the request or project constraints need a specific alias or ID; preserve a model the project already pinned.
5. Use a profession name or meaningful responsibility such as `frontend-developer`. Add a subsystem prefix only for an actual split; do not derive names from the list of skills. Preserve existing names. Read `../references/project-agent-recipes.md` for starting recipes.

If a required knowledge skill does not exist, invoke `skill-creator` first. If no profession profile fits, use [maintain-profile.md](maintain-profile.md) only when working in the Agent Kit source repository; otherwise explain that the library needs a new profile rather than inventing a project-only profession body.

## Step 3: Update the project source

Create or update `.agent-kit/agents.json` using [../references/project-config.md](../references/project-config.md).

- **Create:** append a unique agent entry.
- **Update:** change the matching entry without rewriting unrelated entries.
- **Delete:** remove the matching entry; do not delete native files by hand.
- **Sync:** leave the config unchanged.

Omitted `runtimes` means `claude` and `codex`. Add `kimi` when the project uses Kimi Code (a `.kimi-code/` directory or the user's request); Kimi targets are opt-in so upgrades do not add a third agent directory.

## Step 4: Materialize native agents

Run the installed `scripts/materialize-agents.mjs` with `--project-root` pointing at the consuming project. For a sync after an Agent Kit upgrade, run `--dry-run` first and report its semantic diff: changed profile behavior, settings, skills, and skill sources. Routine authorized refreshes proceed; a diff that widens tools/sandbox or pins a costlier model is a material change to confirm. Use `--prune` after deletion or a runtime list change so obsolete generated targets are removed safely.

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
4. Confirm Codex TOML contains `name`, `description`, `developer_instructions` naming the selected skills, `model_reasoning_effort`, and `sandbox_mode`, and no `[[skills.config]]`.
5. Confirm user-owned native agent files remain unchanged.
6. If `.claude/agents/` did not exist before this run, tell the user the new Claude agents become selectable after the session restarts; a running session does not watch a newly created agents directory.

Report the project composition, generated targets, overrides, the sync diff, and validation evidence.

## Migrate from an older Agent Kit

No script is needed; edit the project files directly:

1. List the generated agents: files in `.claude/agents/`, `.codex/agents/`, and `.kimi-code/agents/` that carry the Agent Kit generated marker. Leave every other file alone.
2. Rewrite `.agent-kit/agents.json` against the current profiles and skills:
   - `frontend` and `backend` profiles become `developer`; keep the agent name and description, and give it the zone skills its work needs (`frontend`, `backend`, `mobile`, `gamedev`, plus the language). `development` comes with the profile.
   - Renamed skills: `visualization` → `playground`.
   - Keep explicit model, effort, access, and tool choices the project made; drop entries that only restated old library defaults.
   - Projects without `agents.json` (3.x used plugin agents): create one from the recipes.
3. Show the user the old and new `agents.json` side by side before writing it.
4. Run the materializer with `--dry-run`, then without it, then `--prune` to delete generated targets that are no longer configured, then `--check`.
