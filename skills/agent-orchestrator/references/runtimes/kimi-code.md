# Kimi Code CLI

Sourced from the Kimi Code CLI documentation (plugins, agents, skills, tools pages) and the CLI 0.29.0 help, October 2026. Re-check field names against the installed version before relying on a detail.

## Contents

- [Install and discovery](#install-and-discovery)
- [Knowledge delivery](#knowledge-delivery)
- [Custom agents](#custom-agents)
- [Delegation tools](#delegation-tools)
- [Fallback](#fallback)

## Install and discovery

- Install the plugin with `/plugins install https://github.com/evilsamaritan/agent-kit`. Kimi runs a managed copy under `$KIMI_CODE_HOME/plugins/managed/<id>/`; changes apply after `/reload` or in a new session.
- `.kimi-plugin/plugin.json` exposes the shared `skills/` only: no plugin agents, no `sessionStart` skill, no global system prompt.
- Without the plugin, add the library through `extra_skill_dirs` in `config.toml`. `--skills-dir <agent-kit>/skills` also works for one run, but it replaces the auto-discovered user and project skill directories.

## Knowledge delivery

- Skills are found in the plugin, in project `.kimi-code/skills/` and `.agents/skills/`, in user directories, and in `extra_skill_dirs`; project skills take priority over user ones. Users invoke one with `/skill:<name>`; the model loads one by its `description` and `whenToUse`.
- Kimi reads `name`, `description`, `when_to_use`, `disable-model-invocation`, and `arguments`, and ignores Claude-only fields. Dynamic shell context (`` !`cmd` ``) is not supported. `$ARGUMENTS` and `$N` are substituted.
- A custom sub-agent has no preload field. Generated bodies list each selected skill's source path, include `${skills}` for the skill index, and include `${agents_md}` for project instructions.

## Custom agents

- Generated targets live in `.kimi-code/agents/<name>.md`, which outranks user, extra, and plugin agents. Agent Kit does not also write `.agents/agents/`.
- The Markdown body replaces the whole system prompt of a delegated agent. That is why generated bodies restore project context and require a self-contained final message.
- Kimi substitutes `${base_prompt}`, `${skills}`, `${agents_md}`, `${cwd}`, `${cwd_listing}`, `${os}`, `${shell}`, `${now}`, `${plugin_sections}`, and `${additional_dirs_info}` in agent bodies; other `${...}` text stays verbatim. The renderer refuses profile text that would be substituted.
- Frontmatter has `name`, `description`, `whenToUse`, `tools`, `disallowedTools`, `subagents`, and `override`. There is no model or effort field: the composition's effort is not applied, and a model is chosen per `Agent` call only when a subagent model pool is configured.
- `tools` is always an explicit allowlist derived from access; omitting it would grant every tool. An allowlist is not a filesystem sandbox, and sub-agents inherit the main agent's permission rules.
- The built-in agents `coder`, `explore`, and `plan` cannot be replaced without `override: true`, which Agent Kit never writes; the materializer rejects those names for Kimi targets.
- CLI 0.29.0 marks `--agent` and `--agent-file` as v2-engine only. If custom agents are not available in the user's engine, use the fallback.

## Delegation tools

- `Agent`: `prompt`, `description`, `subagent_type` (default `coder`; a project agent's `name` selects it), `resume` (an agent ID; exclusive with `subagent_type`), `run_in_background`, and `model` when a model pool exists. Tasks time out after two hours unless `[subagent] timeout_ms` changes it.
- `AgentSwarm`: one `prompt_template` over at least two `items` with one `subagent_type`; it returns an aggregated report. Concurrency ramps up without an upper bound unless `KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY` is set, so keep batches small and split large sets rather than relying on the default. The parent still resolves contradictions and owns the final judgment. Do not split one coupled transaction across items.
- Swarm is not peer discussion. Generated agents exclude `Agent` and `AgentSwarm`, so the main agent coordinates; enable nested delegation only with an explicit `subagents` list when the task needs it.

## Fallback

When a project agent is missing or stale, call `Agent` with `subagent_type: coder` (or `explore` for read-only research) and the brief from `materialize-agents.mjs --brief NAME` plus the bounded assignment. Of the built-in types, `explore` is documented as read-only.
