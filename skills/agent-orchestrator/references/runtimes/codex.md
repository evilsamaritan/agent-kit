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

- A custom agent inherits the parent's skill catalog. A role file can only disable skills (`[[skills.config]]` entries with `enabled = false`), so generated targets write no `skills.config`.
- `developer_instructions` names each selected skill by catalog name: plugin skills are `agent-kit:<skill>`, `.agents/skills/` project skills keep their name, other project skills use a project-relative path. The child reads the `SKILL.md` from the location the catalog lists.

## Model, effort, and sandbox

- Omitted `model` and `model_reasoning_effort` inherit from the parent session. A spawn request or `[agents]` defaults may select a model; a model selected without an effort uses that model's default effort.
- When spawning a child, Codex reapplies the parent turn's live sandbox and approval overrides. Codex's source strips `sandbox_mode` (and `approval_policy`, `mcp_servers`, `model_provider`, and a few other keys) from a role file's projected layer, so the generated value only documents intent and the parent session's sandbox applies. The public subagent docs still list `sandbox_mode` among the keys a custom agent file may carry; the source is authoritative here (`codex-rs/core/src/agent/role_tests.rs`, test `apply_role_cannot_expand_parent_authority`: "role must not control {key}", checked at tag `rust-v0.159.2`; the same file shows `skills.config` with `enabled` flags is honored).
- `agents.max_concurrent_threads_per_session` bounds parallel children (`agents.max_threads` is its legacy alias). Built-in agents are `default`, `worker`, and `explorer`.

## Spawn and coordinate

Use the client's subagent controls to spawn, steer, wait for, and collect children. Do not substitute separate user chats for children. Follow up an existing child instead of re-spawning it.

## Fallback

Spawn a generic child with the brief from `--brief NAME --runtime codex` (configured agents only; otherwise the selected profile reference plus the exact skill ids), the concrete task, and explicit model and effort when the client permits overrides. The fallback inherits the parent sandbox and tools; do not claim it enforces the generated `sandbox_mode`.
