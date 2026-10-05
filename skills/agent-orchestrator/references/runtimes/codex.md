# Codex

## Contents

- [Discovery and selection](#discovery-and-selection)
- [Knowledge delivery](#knowledge-delivery)
- [Model, effort, and sandbox](#model-effort-and-sandbox)
- [Spawn and coordinate](#spawn-and-coordinate)
- [Fallback](#fallback)

## Discovery and selection

- Custom agents live in `.codex/agents/*.toml` (project) and `~/.codex/agents/` (personal). The `name` field is the identity Codex matches when spawning; the file name is convention.
- Prefer a named custom agent only when the current client's spawn mechanism applies that agent's configuration. Some clients can mention a custom-agent name while their generic spawn still creates an unconfigured child. Without schema or observed evidence that the config applies, use the fallback.
- Before delegating to a generated agent, run `materialize-agents.mjs --check --agent NAME`.

## Knowledge delivery

- `[[skills.config]]` entries name each selected skill's `SKILL.md` path. Library paths are absolute, so the TOML is a local materialization; refresh it after Agent Kit is upgraded or moved.
- `developer_instructions` also lists the selected sources, so a child that did not load a skill can read it.

## Model, effort, and sandbox

- Omitted `model` and `model_reasoning_effort` inherit from the parent session. A spawn request or `[agents]` defaults may select a model; a model selected without an effort uses that model's default effort.
- When spawning a child, Codex reapplies the parent turn's live sandbox and approval overrides. Treat `sandbox_mode` in the TOML as a default, not a guarantee.
- `agents.max_concurrent_threads_per_session` bounds parallel children.

## Spawn and coordinate

Use the client's subagent controls to spawn, steer, wait for, and collect children. Do not substitute separate user chats for children. Follow up an existing child instead of re-spawning it.

## Fallback

Spawn a generic child with the brief from `--brief NAME`, the concrete task, and explicit model and effort when the client permits overrides. The fallback inherits the parent sandbox and tools; do not claim it enforces the generated `sandbox_mode` or `skills.config`.
