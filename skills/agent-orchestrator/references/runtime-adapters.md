# Native Runtime Adapters

The orchestration policy is portable; delegation mechanics are not. Identify the host from the tools actually available in this session, not from the model brand (a Kimi model inside Claude Code uses Claude Code mechanisms). Then read only the matching file:

| Host | Reference |
|------|-----------|
| Claude Code (CLI, desktop, IDE, web) | [runtimes/claude-code.md](runtimes/claude-code.md) |
| Codex | [runtimes/codex.md](runtimes/codex.md) |
| Kimi Code CLI | [runtimes/kimi-code.md](runtimes/kimi-code.md) |
| Anything else | [Other runtimes](#other-runtimes) |

## Map the shape onto the host

| Shape | Claude Code | Codex | Kimi Code |
|-------|-------------|-------|-----------|
| Bounded assignment | named project agent, else generic subagent with a brief | named custom agent when the selector applies it, else generic child | `Agent` with the project agent type, else `coder` with a brief |
| Pipeline | main session runs dependent stages | same | same |
| Independent reviews | several subagents, then synthesis | several children, then synthesis | several `Agent` calls, or `AgentSwarm` for one procedure over many items |
| Peer discussion | agent teams, when enabled | messaging between agents, when the client offers it | not equivalent to swarm; use the main session |
| Continue an agent | message the same agent | follow up the same child | `resume` with the agent ID |
| No delegation | run the stages in the main session | same | same |

Effort is reasoning depth where the host applies it. Never simulate an unsupported effort with more agents, and never report a recommended setting as applied.

## Brief for a generic subagent

When a named agent is missing, unselectable, or stale, generate the brief with the installed agent-creator materializer: `materialize-agents.mjs --project-root <project> --brief NAME`. It carries the profile behavior and the selected skill sources. A brief conveys knowledge, not tool, sandbox, model, effort, or preload controls the spawn API lacks; say so when those controls matter.

## Other runtimes

If the host has a named-agent registry, a new runtime module in `scripts/profile-runtimes/` can target it. If it only accepts prompts, pass the brief plus the concrete assignment. If it has no delegation, execute the stages in the main thread.

## Portability boundary

Portable: profession behavior, selected knowledge, intended effort and access, the assignment and evidence contract, and the dependency shape.

Runtime-owned: model identifiers, tool and permission syntax, sandbox and approval precedence, thread/teammate/workflow/worktree controls, and native persistence formats.
