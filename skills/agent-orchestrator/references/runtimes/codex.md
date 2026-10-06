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

- A custom agent inherits the parent's skill catalog. A role file can only disable skills (Codex 0.157+ keeps `[[skills.config]]` entries with `enabled = false`), so generated targets write no `skills.config`.
- `developer_instructions` names each selected skill by catalog name: plugin skills are `agent-kit:<skill>`, `.agents/skills/` project skills keep their name, other project skills use a project-relative path. The child reads the `SKILL.md` from the location the catalog lists.

## Model, effort, and sandbox

- Omitted `model` and `model_reasoning_effort` inherit from the parent session. A spawn request or `[agents]` defaults may select a model; a model selected without an effort uses that model's default effort.
- When spawning a child, Codex reapplies the parent turn's live sandbox and approval overrides. Codex 0.157+ ignores `sandbox_mode` in a role file altogether (roles may not control it), so the generated value only documents intent; the parent session's sandbox applies.
- `agents.max_concurrent_threads_per_session` bounds parallel children.

## Spawn and coordinate

Use the client's subagent controls to spawn, steer, wait for, and collect children. Do not substitute separate user chats for children. Follow up an existing child instead of re-spawning it.

## Fallback

Spawn a generic child with the brief from `--brief NAME`, the concrete task, and explicit model and effort when the client permits overrides. The fallback inherits the parent sandbox and tools; do not claim it enforces the generated `sandbox_mode`.
