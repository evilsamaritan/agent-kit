# Claude Code

## Contents

- [Discovery and selection](#discovery-and-selection)
- [Knowledge delivery](#knowledge-delivery)
- [Model, effort, and permissions](#model-effort-and-permissions)
- [Spawn, continue, isolate](#spawn-continue-isolate)
- [Workflows and teams](#workflows-and-teams)
- [Fallback](#fallback)

## Discovery and selection

- Project agents live in `.claude/agents/*.md`; select one by passing its `name` as the Agent tool's `subagent_type`. Agent Kit ships no plugin agents.
- Edits to existing agent files are picked up during a session. A `.claude/agents/` directory created during the session is not watched: its agents become selectable after a restart. After first materialization, tell the user instead of retrying.
- Before delegating to a generated agent, run `materialize-agents.mjs --check --agent NAME`; refresh or fall back to a brief when it is stale.

## Knowledge delivery

- `skills:` in an agent definition injects the full content of each listed skill into the subagent's context at startup; it controls preloading, not access, since the subagent can still discover and invoke other skills through the Skill tool. A skill that sets `disable-model-invocation: true` cannot be preloaded. An entry that is missing or disabled is skipped with only a debug-log warning.
- Generated targets preload library skills by qualified id (`agent-kit:<skill>`) so a same-named project, user, or other plugin skill is not picked by accident. Claude Code does not document how qualified and bare names in `skills:` resolve, so treat the qualified id as the intended match and confirm it with the preload check in the verify workflow. The body lists the same ids, plus project-relative paths for project skills outside `.claude/skills/`.
- On demand, the Skill tool loads plugin skills by qualified name: `agent-kit:<skill>`. If the agent reports a selected skill as missing, the plugin is not installed or enabled in this session.
- Agent teams do not apply a definition's `skills:` to teammates. Put the skill names or source paths in the teammate's assignment.

## Model, effort, and permissions

- The model resolves in order: the Agent call's `model`, the definition's `model` (`inherit` selects the session model), `CLAUDE_CODE_SUBAGENT_MODEL` when set, then the session model. A project may pin an alias (`opus`, `sonnet`, `haiku`, `fable`) or a full ID.
- Per call, the Agent tool can override the model and isolation; `effort`, `tools`, `disallowedTools`, and `skills` come from the definition.
- The definition's tool allowlist bounds the agent; the parent session's permission mode still applies.
- A generic `general-purpose` subagent has every tool. When a task must stay read-only and no configured agent fits, use a built-in read-only type (`Explore` for search, `Plan` for design) or keep the work in the main session.

## Spawn, continue, isolate

- Start independent agents in one turn so they run concurrently. Some clients run subagents in the background and notify on completion; wait only when the next stage depends on the result.
- Continue a finished or running agent with `SendMessage` to its ID or name; do not start a new one to append a detail.
- Parallel writers without disjoint files get `isolation: "worktree"` on the Agent call.
- Generated agents exclude the Agent tool, so the main session owns coordination.

## Workflows and teams

- Some clients expose a native `Workflow` tool that runs a deterministic multi-agent script (pipeline, parallel, phases); a run can be saved under `.claude/workflows/` (project) or `~/.claude/workflows/`. Call it only when the user explicitly opted in: they asked for a workflow or multi-agent orchestration in their own words, or invoked a command that calls for one. Authorization to use subagents is not authorization to run a Workflow, and an automatically loaded skill is not the user's opt-in. Respect the client's size guideline.
- Agent teams (peer messaging between teammates) are experimental and disabled by default; they need `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Use them only when executors must discuss intermediate decisions.
- While agent teams are enabled, an Agent call that passes a `name` starts a teammate, not a subagent, unless it is a fork or passes `isolation`; Claude may also name subagents on its own. A teammate skips the definition's `skills:` preload, so for generated agents omit `name`, pass `isolation`, or list the skill ids in the assignment.

## Fallback

For a configured agent that is stale or unselectable, pass the brief from `--brief NAME --runtime claude` to a generic subagent; with no configured agent, pass the selected profile reference plus the exact skill ids. Add the bounded assignment. State which controls the fallback cannot enforce.
