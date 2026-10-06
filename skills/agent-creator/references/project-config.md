# Project Agent Configuration

## Contents

- [Purpose](#purpose)
- [Schema](#schema)
- [Field reference](#field-reference)
- [Composition rules](#composition-rules)
- [Generated targets](#generated-targets)
- [Commit or ignore](#commit-or-ignore)
- [Sync and freshness](#sync-and-freshness)
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
| `runtimes` | no | Subset of `claude`, `codex`, `kimi`; omitted means `claude` and `codex` |
| `description` | no | Project-specific routing description |
| `effort` | no | Portable effort override: low, medium, high, xhigh, max |
| `access` | no | Intended access override: read-only, edits, full |
| `claude` | no | Claude runtime overrides: `model`, `effort`, `color`, `tools`, `disallowedTools`, `maxTurns`, `memory`, `background`, `isolation` |
| `codex` | no | Codex runtime overrides: `model`, `effort`, `sandbox_mode` |
| `kimi` | no | Kimi runtime overrides: `whenToUse`, `tools`, `disallowedTools`, `subagents` (no model or effort fields exist) |

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
| Claude Code | `.claude/agents/<name>.md` | body → prompt, skills → `skills` (skill ids) and the selected-sources list, effort/model/tools → frontmatter |
| Codex | `.codex/agents/<name>.toml` | body and selected skills → `developer_instructions`, effort → `model_reasoning_effort`, access → `sandbox_mode` (no `skills.config`) |
| Kimi Code | `.kimi-code/agents/<name>.md` | body → full system prompt plus `${agents_md}`, `${skills}`, selected skill names, and a handoff; access → explicit `tools`; effort and model are not applied |

Every selected skill is written in a form the host resolves inside each user's own installation:

| Skill | Claude Code | Codex | Kimi Code |
|-------|-------------|-------|-----------|
| Agent Kit library | `agent-kit:<skill>` | `agent-kit:<skill>` | `<skill>` |
| Project skill the host discovers | `<skill>` in `.claude/skills/` | `<skill>` in `.agents/skills/` | `<skill>` in `.kimi-code/skills/` or `.agents/skills/` |
| Other project skill | project-relative path | project-relative path | — |

No target contains an absolute path, home directory, user name, or kit version. The same recipe and kit version render byte-identical files on every machine. Each collaborator needs Agent Kit installed and enabled in the host they use; a host without it skips the library skills (Claude logs a debug warning, Codex and Kimi omit them from the skill list).

Generated files carry an Agent Kit marker and `agent-kit-metadata` with a fingerprint of the resolved composition. It changes only when the agent does, so a kit upgrade leaves an unchanged agent's file untouched. The materializer may overwrite or prune only marked files.

## Commit or ignore

Whether generated targets live in git is the project user's decision. Agent Kit does not add them, or `.agent-kit/`, to `.gitignore`, `.git/info/exclude`, or any other ignore list, and agents must not do so on the user's behalf.

- **Commit** (the default outcome): teammates and CI get the same agents without running the materializer. Pin one Agent Kit version for the project; CI can run `materialize-agents.mjs --check` with that version.
- **Keep local**: the project user adds the generated directories to their own ignore file, and each collaborator materializes from the committed `.agent-kit/agents.json`.

Optional for Claude Code teams: committing `enabledPlugins` and `extraKnownMarketplaces` in `.claude/settings.json` prompts collaborators to install the plugin. That is also the project's choice; Agent Kit does not write it.

## Sync and freshness

| Command | Use |
|---------|-----|
| `--dry-run` | Preview the semantic diff: profile behavior, settings, skills, skill sources, metadata |
| (no flag) | Write changed targets and print the same diff |
| `--check` | Fail on missing, changed, orphaned, or non-portable targets; passes exactly when regeneration would write nothing |
| `--check --agent NAME` | Freshness of one selected agent before delegating to it |
| `--prune` | Delete generated targets no longer configured |

`--portable` is deprecated and has no effect. A target generated before 4.0 has no metadata; its baseline is reported as unknown and compared by its parsed settings and body. A 4.0.0-rc.1 target reports each absolute source as not portable, its new locator, and that the kit version is no longer recorded; regenerate it once.

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
