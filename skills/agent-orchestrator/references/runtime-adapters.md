# Native Runtime Adapters

## Contents

- [Claude Code](#claude-code)
- [Codex](#codex)
- [Other runtimes](#other-runtimes)
- [Portability boundary](#portability-boundary)

## Claude Code

Prefer a named custom agent from `.claude/agents/` or the Agent Kit plugin registry. Pass the concrete assignment; the native agent already carries its persona, skills, model, and tool configuration.

Use Claude's native subagents for bounded delegation, teammates for peer coordination when available, and native workflows for a persisted execution graph. Use native worktree isolation for parallel writers. Do not translate these mechanisms into Agent Kit configuration.

## Codex

Prefer a named custom agent from `.codex/agents/*.toml` when the current Codex client exposes a selector that applies that agent's configuration. The file carries `developer_instructions`, model, reasoning effort, sandbox defaults, and skill configuration. Use Codex subagent/thread controls to spawn, steer, wait, interrupt, and collect results.

Live parent-session sandbox and approval overrides can supersede custom-agent defaults. Treat the project TOML as a default contract, then honor the active session policy.

Capability-gate named selection. Some clients can discover or mention a custom-agent name while their generic spawn tool still creates an unconfigured child. If the tool schema or a smoke result does not prove that named config is applied, read `.agent-kit/agents.json` plus the selected profile reference and spawn a generic child with:

- the complete profile persona and concrete task;
- the project's exact skill names, which the child must read before acting;
- explicit model and reasoning effort when the host permits overrides.

The fallback inherits the parent sandbox and tools. Do not claim it enforces the profile's native `sandbox_mode` or skill configuration.

## Other runtimes

If the host has a named-agent registry, map the profession profile into that registry through a future runtime adapter. If it only accepts prompts, pass the profile persona plus the concrete assignment. If it has no delegation, execute the orchestration stages sequentially in the main thread.

## Portability boundary

Portable across runtimes:

- profession persona and role behavior;
- selected knowledge skills;
- intended effort and access level;
- assignment and evidence contract;
- pipeline or parallel dependency shape.

Runtime-owned:

- exact model identifier;
- tool and permission syntax;
- sandbox and approval precedence;
- thread, teammate, workflow, and worktree controls;
- persistence format for native agents or workflows.
