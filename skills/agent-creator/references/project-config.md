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
      "name": "backend-rust",
      "profile": "backend",
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
| `claude` | no | Claude overlay object; currently `model`, `tools`, and supported profile overlay fields |
| `codex` | no | Codex overlay object; currently `model` and `effort` |

## Composition rules

- `skills` replaces the profile's default list; it does not append implicitly.
- Every skill must resolve from project-local skills or the installed Agent Kit library.
- Runtime overlays override profile defaults without changing the reusable profile.
- `access` maps to Claude default tools and Codex sandbox defaults. An explicit Claude `tools` array takes precedence.
- Live host policy remains authoritative over generated defaults.

## Generated targets

| Runtime | Target | Key mapping |
|---------|--------|-------------|
| Claude Code | `.claude/agents/<name>.md` | body → prompt, skills → `skills`, effort/model/tools → frontmatter |
| Codex | `.codex/agents/<name>.toml` | body → `developer_instructions`, effort → `model_reasoning_effort`, access → `sandbox_mode`, skills → `skills.config` |

Generated files carry an Agent Kit marker. The materializer may overwrite or prune only marked files.

## Examples

### Two backend variants

```json
{
  "schema_version": 1,
  "agents": [
    {
      "name": "backend-node",
      "profile": "backend",
      "skills": ["backend", "api-design", "database", "javascript", "web"]
    },
    {
      "name": "backend-rust",
      "profile": "backend",
      "skills": ["backend", "api-design", "database", "rust"],
      "codex": { "effort": "high" }
    }
  ]
}
```

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
