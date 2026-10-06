# Kimi Code CLI

Sourced from the Kimi Code CLI documentation (plugins, agents, skills, tools, and command-reference pages), checked October 2026 against Kimi Code 2.1.x. Re-check field names against the installed version before relying on a detail.

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
- Kimi documents `name`, `description`, `type`, `whenToUse` (aliases `when-to-use` and `when_to_use`), `disableModelInvocation`, and `arguments`, and ignores other fields, Claude-only ones included. Dynamic shell context (`` !`cmd` ``) is not documented; do not rely on it. `$ARGUMENTS`, `$0`/`$1` positional arguments, and `$<name>` named arguments are substituted. The `Skill` tool calls only skills of `type = "inline"`.
- A custom sub-agent has no preload field. Kimi documents plugin skills as registered under the plugin namespace (for example `/skill:<plugin>:<skill>`) and ranks them below project and user skills; how the `Skill` tool resolves a bare name for a namespaced plugin skill is not documented. Generated bodies start with `${base_prompt}`, Kimi's own system prompt, which carries the skill index (loadable names and install locations at run time) and the project's AGENTS.md as reference data, then list each selected skill by bare name to load with `Skill`. When a bare name does not resolve, use the name the skill index shows, or install the library through `extra_skill_dirs`.

## Custom agents

- Generated targets live in `.kimi-code/agents/<name>.md`, which outranks user, extra, and plugin agents. Agent Kit does not also write `.agents/agents/`.
- The Markdown body replaces the whole system prompt of a delegated agent. That is why generated bodies start from `${base_prompt}`, which Kimi also renders for agents loaded from files, and require a self-contained final message.
- Kimi substitutes a fixed set of `${...}` template variables in agent bodies (the renderer keeps the list in `KIMI_TEMPLATE_VARIABLES`, `scripts/profile-runtimes/kimi.mjs`); other `${...}` text stays verbatim. The renderer refuses profile text that would be substituted.
- Kimi lists every agent to the parent with its `description` and `whenToUse`, next to the built-in `coder` and `explore`. Generated agents carry a default `whenToUse` that says to use them instead of those built-ins for their work, including narrower tasks; a project `kimi.whenToUse` replaces it.
- Frontmatter has `name`, `description`, `whenToUse`, `tools`, `disallowedTools`, `subagents`, and `override`. There is no model or effort field: the composition's effort is not applied, and a model is chosen per `Agent` call only when a subagent model pool is configured.
- `tools` is always an explicit allowlist derived from access; omitting it (or a lone `*`) grants every tool, and `tools: []` disables all. `tools` and `disallowedTools` shape the tools shown to the model and are checked again before execution, but they are not a filesystem sandbox; sub-agents inherit the main agent's permission rules.
- The built-in agents `coder`, `explore`, and `plan` cannot be replaced without `override: true`, which Agent Kit never writes; the materializer rejects those names for Kimi targets.
- `--agent` and `--agent-file` choose which agent drives a new session; they apply only when starting a session (not with `--session` or `--continue`) and are mutually exclusive. Delegation through `Agent` is separate; if the client's `Agent` cannot select project agents, use the fallback.

## Delegation tools

- `Agent`: `prompt`, `description`, `subagent_type` (default `coder`; a project agent's `name` selects it), `resume` (an agent ID; exclusive with `subagent_type`), `run_in_background`, and `model` when a model pool exists. Tasks time out after two hours unless `[subagent] timeout_ms` changes it.
- `AgentSwarm`: one `prompt_template` over at least two `items` with one `subagent_type`; it returns an aggregated report. Concurrency ramps up without an upper bound unless `KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY` is set, so keep batches small and split large sets rather than relying on the default. The parent still resolves contradictions and owns the final judgment. Do not split one coupled transaction across items.
- Swarm is not peer discussion. Generated agents exclude `Agent` and `AgentSwarm`, so the main agent coordinates; enable nested delegation only with an explicit `subagents` list when the task needs it.

## Fallback

Prefer a configured project agent with a narrowed assignment over `coder`: a bare `coder` carries none of the composed profession and skills. When a project agent is missing or stale, call `Agent` with `subagent_type: coder` (or `explore` for read-only research) plus the bounded assignment and either the brief from `materialize-agents.mjs --brief NAME --runtime kimi` (configured agents only) or the selected profile reference with the exact skill names. Of the built-in types, `explore` is documented as read-only.
