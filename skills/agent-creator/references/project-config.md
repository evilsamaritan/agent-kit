# Project Agent Configuration

## Contents

- [Purpose](#purpose)
- [Schema](#schema)
- [Field reference](#field-reference)
- [Composition rules](#composition-rules)
- [Generated targets](#generated-targets)
- [Examples](#examples)

## Purpose

`.agent-kit/agents.json` is a portable build recipe, not an agent runtime. It records which reusable profession profiles and knowledge skills a project wants. The materializer compiles it into native Claude and Codex files.

## Schema

```json
{
  "schema_version": 1,
  "agents": [
    {
      "name": "backend-developer",
      "profile": "developer",
      "skills": ["backend", "api-design", "database", "rust"],
      "runtimes": ["claude", "codex"]
    }
  ]
}
```

## Field reference

| Field | Required | Meaning |
|-------|----------|---------|
| `schema_version` | yes | Must be `1` |
| `agents` | yes | Array of unique project-agent entries |
| `name` | yes | Native agent name, lowercase kebab-case |
| `profile` | yes | Bundled profession profile name |
| `skills` | no | Exact final knowledge-skill set; omitted means profile defaults |
| `runtimes` | no | `claude`, `codex`, or both; omitted means both |
| `description` | no | Project-specific routing description |
| `effort` | no | Portable effort override: low, medium, high, xhigh, max |
| `access` | no | Intended access override: read-only, edits, full |
| `claude` | no | Claude runtime overrides: `model`, `effort`, `color`, `tools`, `disallowedTools`, `maxTurns`, `memory`, `background`, `isolation` |
| `codex` | no | Codex runtime overrides: `model`, `effort`, `sandbox_mode` |

## Composition rules

- `skills` replaces the profile's default list; it does not append implicitly.
- Every skill must resolve from project-local skills or the installed Agent Kit library.
- Runtime overlays override profile defaults without changing the reusable profile.
- `access` maps to Claude default tools and Codex sandbox defaults. Explicit project `access` replaces library tools; a project `claude.tools` array takes precedence over that choice.
- Resolution order: profile core → profile runtime overlay → portable `effort`/`access` → explicit runtime overrides.
- Models are inherited unless the project sets `claude.model` or `codex.model`. Any alias or ID the host accepts is allowed; Agent Kit checks syntax, not availability.
- Live host policy remains authoritative over generated defaults.

## Generated targets

| Runtime | Target | Key mapping |
|---------|--------|-------------|
| Claude Code | `.claude/agents/<name>.md` | body → prompt, skills → `skills`, effort/model/tools → frontmatter |
| Codex | `.codex/agents/<name>.toml` | body → `developer_instructions`, effort → `model_reasoning_effort`, access → `sandbox_mode`, skills → `skills.config` |

Generated files carry an Agent Kit marker and `agent-kit-metadata` (kit version and an input fingerprint). The materializer may overwrite or prune only marked files.

Library skill paths are absolute, so native targets are local materializations. Commit them only if every collaborator refreshes after installing; otherwise keep `.agent-kit/agents.json` as the shared source and regenerate per machine.

## Sync and freshness

| Command | Use |
|---------|-----|
| `--dry-run` | Preview the semantic diff: profile behavior, settings, skills, local source paths, kit version |
| (no flag) | Write changed targets and print the same diff |
| `--check` | Fail on missing, changed, or orphaned targets |
| `--check --portable` | Same, but accept path-only refreshes (another machine or install root) |
| `--check --agent NAME` | Freshness of one selected agent before delegating to it |
| `--prune` | Delete generated targets no longer configured |

A target generated before 4.0 has no metadata; its baseline is reported as unknown and compared by its parsed settings and body.

## Examples

### Two development responsibilities

```json
{
  "schema_version": 1,
  "agents": [
    {
      "name": "frontend-developer",
      "profile": "developer",
      "description": "Own the customer UI, client state, and accessible interactions.",
      "skills": ["architecture", "frontend", "javascript", "web", "html", "css", "accessibility"]
    },
    {
      "name": "backend-developer",
      "profile": "developer",
      "description": "Own service operations, persistence boundaries, and external API behavior.",
      "skills": ["architecture", "backend", "api-design", "database", "rust"],
      "codex": { "effort": "high" }
    }
  ]
}
```

Descriptions are required and distinct when a profile has several project instances. They identify responsibilities; technology does not determine identity.

### Read-only review agent for Codex only

```json
{
  "schema_version": 1,
  "agents": [
    {
      "name": "reviewer",
      "profile": "reviewer",
      "runtimes": ["codex"],
      "access": "read-only"
    }
  ]
}
```
