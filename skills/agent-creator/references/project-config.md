# Project Agent Configuration

## Contents

- [Purpose](#purpose)
- [Schema](#schema)
- [Field reference](#field-reference)
- [Composition rules](#composition-rules)
- [Project text: instructions and project skills](#project-text-instructions-and-project-skills)
- [Delegation hint](#delegation-hint)
- [Generated targets](#generated-targets)
- [Sync and freshness](#sync-and-freshness)
- [Examples](#examples)

## Purpose

`.agent-kit/agents.json` is a portable build recipe, not an agent runtime. It records which reusable profession profiles and knowledge skills a project wants. The materializer compiles it into native Claude, Codex, and (opt-in) Kimi Code files.

## Schema

```json
{
  "schema_version": 1,
  "delegation_hint": true,
  "agents": [
    {
      "name": "backend-developer",
      "profile": "developer",
      "skills": ["backend", "api-design", "database", "rust"],
      "runtimes": ["claude", "codex"],
      "instructions": [
        "Run `make check` before reporting; a failing gate is reported, never silenced.",
        "Never edit migrations/**; report the migration you need instead."
      ]
    }
  ]
}
```

## Field reference

| Field | Required | Meaning |
|-------|----------|---------|
| `schema_version` | yes | Must be `1` |
| `delegation_hint` (top level) | no | Project-wide default for the per-agent field below; omitted means `true` |
| `agents` | yes | Array of unique project-agent entries |
| `name` | yes | Native agent name, lowercase kebab-case |
| `profile` | yes | Bundled profession profile name |
| `skills` | no | Exact knowledge-skill set; omitted means profile defaults. The profile's required skills are always added |
| `runtimes` | no | Subset of `claude`, `codex`, `kimi`; omitted means `claude` and `codex` |
| `description` | no | Project-specific responsibility, one line. With the delegation hint on, generated targets append when the host should prefer this agent over its generic subagents (Kimi: a default `whenToUse`) |
| `instructions` | no | Project-specific rules rendered after the profession body as `## Project instructions`: a string, or an array of strings joined by newlines. See [Project text](#project-text-instructions-and-project-skills) |
| `delegation_hint` | no | `false` keeps the description exactly as written and omits Kimi's default `whenToUse`. See [Delegation hint](#delegation-hint) |
| `effort` | no | Portable effort override: low, medium, high, xhigh, max |
| `access` | no | Intended access override: read-only, edits, full |
| `claude` | no | Claude runtime overrides: `model`, `effort`, `color`, `tools`, `disallowedTools`, `maxTurns`, `memory`, `background`, `isolation`. `tools` and `disallowedTools` take tool names and `mcp__<server>` patterns only; see below |
| `codex` | no | Codex runtime overrides: `model`, `effort`, `sandbox_mode` |
| `kimi` | no | Kimi runtime overrides: `whenToUse`, `tools`, `disallowedTools`, `subagents` (no model or effort fields exist) |

## Composition rules

- `skills` replaces the profile's default list; it does not append implicitly. The exception is the profile's `requires`: those skills are always included, first, and a project cannot remove them (`developer` and `reviewer` always carry `development`).
- Every skill must resolve from project-local skills or the installed Agent Kit library.
- Runtime overlays override profile defaults without changing the reusable profile.
- `access` maps to Claude default tools and Codex sandbox defaults. Explicit project `access` replaces library tools; a project `claude.tools` array takes precedence over that choice.
- Resolution order: profile core → profile runtime overlay → portable `effort`/`access` → explicit runtime overrides.
- Models are inherited unless the project sets `claude.model` or `codex.model`. Any alias or ID the host accepts is allowed; Agent Kit checks syntax, not availability.
- `effort` is not checked against the model on purpose: which levels a model supports is host knowledge that changes with releases, and Claude Code falls back to the highest level the active model supports at or below the one set (its model documentation lists the levels per model). `haiku` with `xhigh` therefore passes validation and runs at what the host allows.
- Claude `tools` and `disallowedTools` entries are tool names (`Read`, `Bash`, `Skill`) or MCP server patterns (`mcp__github`, `mcp__db__*`, `mcp__*` in `disallowedTools`). A specifier such as `Bash(git commit *)` or `Edit(docs/**)` is rejected: Claude Code documents that a `disallowedTools` entry with a specifier still removes the whole tool, and `tools` documents no path or command specifiers. To keep Bash and block some commands, put a deny rule such as `Bash(git commit *)` in `permissions.deny` of the project's Claude settings; it applies to subagents.
- Live host policy remains authoritative over generated defaults.

## Project text: instructions and project skills

The generated body is the profession persona plus the selected skills; nothing in a profile knows the project. Project-specific text has two homes, chosen by how it is used:

| Put it in | When | Where it ends up |
|-----------|------|------------------|
| `instructions` on the agent | Short rules that must hold on every run of this agent: gates to run before reporting, forbidden paths, report language and structure, documents to read first, a review stance and severity vocabulary that replace the profile defaults | Rendered verbatim after the persona as `## Project instructions`, in every runtime target and in `--brief`; part of the composition fingerprint and reported by `--dry-run` as `project instructions changed` |
| A project skill listed in `skills` | Knowledge several agents share, long procedures, anything the host should load on demand rather than carry in every prompt | Preloaded or listed by name or path like any other skill; the materializer fails when the skill does not resolve in the project or the library |

Keep `instructions` to rules, not knowledge: a few lines to a short list. Put a rule in one place; a rule stated in `instructions` and again in a project skill drifts. Profiles state the parts a project commonly replaces as defaults (the reviewer's stance, severity scale, and verdict words), so project instructions override them without contradiction. Instructions may be in any language. Do not write machine paths or a kit version into them; a target must stay portable. The headings `## Project instructions` and `## Selected knowledge sources` are reserved.

## Delegation hint

By default a generated description ends with when the host should prefer this agent over its generic subagents (Kimi: a default `whenToUse`), so a host that picks subagents by description routes the project's work to the composed agent. Set `delegation_hint: false` when that routing is unwanted:

- the project runs every delegation through its own runner (a Workflow script or a hook that names agent types), so the host's own picking would bypass it;
- many agents share one area and the hints would make the host pick among near-duplicates;
- the description list itself is a context cost the project wants to keep minimal.

The top-level field sets the project default; a per-agent value overrides it. With the hint off, the description is written exactly as given and Kimi gets `whenToUse` only when `kimi.whenToUse` sets one. Turning the hint off or on is a description change, so `--dry-run` reports it and `--check` fails until targets are regenerated.

Hand-written Claude agents are outside the materializer: quote a hand-written `description` that contains `#` (YAML reads an unquoted ` #` as a comment and truncates the value); generated descriptions are always quoted.

## Generated targets

| Runtime | Target | Key mapping |
|---------|--------|-------------|
| Claude Code | `.claude/agents/<name>.md` | body → prompt, skills → `skills` (skill ids) and the selected-sources list, effort/model/tools → frontmatter |
| Codex | `.codex/agents/<name>.toml` | body and selected skills → `developer_instructions`, effort → `model_reasoning_effort`, access → `sandbox_mode` (no `skills.config`) |
| Kimi Code | `.kimi-code/agents/<name>.md` | full system prompt: Kimi's `${base_prompt}` (its rules, AGENTS.md, skill index, working directory), then the body, selected skill names, and a handoff; access → explicit `tools`; effort and model are not applied |

Every selected skill is written in a form the host resolves inside each user's own installation:

| Skill | Claude Code | Codex | Kimi Code |
|-------|-------------|-------|-----------|
| Agent Kit library | `agent-kit:<skill>` | `agent-kit:<skill>` | `<skill>` |
| Project skill the host discovers | `<skill>` in `.claude/skills/` | `<skill>` in `.agents/skills/` | `<skill>` in `.kimi-code/skills/` or `.agents/skills/` |
| Other project skill | project-relative path | project-relative path | — |

Targets refer to skills by host identifier or project-relative path, so they work wherever Agent Kit is installed. A host without Agent Kit skips the library skills (Claude logs a debug warning, Codex and Kimi omit them from the skill list).

Generated files carry an Agent Kit marker and `agent-kit-metadata` with a fingerprint of the resolved composition. It changes only when the agent does, so a kit upgrade leaves an unchanged agent's file untouched. The materializer may overwrite or prune only marked files.

## Sync and freshness

| Command | Use |
|---------|-----|
| `--dry-run` | Preview the semantic diff: profile behavior, settings, skills, skill sources, metadata |
| (no flag) | Write changed targets and print the same diff |
| `--check` | Fail on missing, changed, or orphaned targets; passes exactly when regeneration would write nothing |
| `--check --agent NAME` | Freshness of one selected agent before delegating to it |
| `--prune` | Delete generated targets no longer configured |
| `--brief NAME --runtime HOST` | Print a generic-subagent brief for one configured agent, with project skills resolved the way HOST discovers them; writes nothing |

`--agent` and `--brief` resolve skills only for the selected agent, so another agent's broken composition does not block them; a full run still validates every agent.

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
      "skills": ["development", "frontend", "javascript", "web", "html", "css", "accessibility"]
    },
    {
      "name": "backend-developer",
      "profile": "developer",
      "description": "Own service operations, persistence boundaries, and external API behavior.",
      "skills": ["development", "backend", "api-design", "database", "rust"],
      "codex": { "effort": "high" }
    }
  ]
}
```

Descriptions are required and distinct when a profile has several project instances. They identify responsibilities; technology does not determine identity.

### Agents driven only by a project workflow

```json
{
  "schema_version": 1,
  "delegation_hint": false,
  "agents": [
    {
      "name": "ox-reviewer",
      "profile": "reviewer",
      "description": "Adversarial review of the uncommitted diff against the normative docs; read-only.",
      "skills": ["development", "rust", "ox-review-protocol"],
      "runtimes": ["claude"],
      "claude": { "tools": ["Read", "Grep", "Glob", "Bash", "Skill"] },
      "instructions": [
        "Stance: try to refute the diff. Severity: blocker / high / medium / low. Verdict: approve or changes-requested.",
        "Read docs/*.md first; they are the contract the code follows.",
        "Report in Russian: verdict, findings with file:line, gates run, what was not checked."
      ]
    },
    {
      "name": "ox-researcher",
      "profile": "researcher",
      "skills": ["performance", "development", "rust"],
      "runtimes": ["claude"],
      "instructions": "Write only under the scratch directory the caller names; the repository is read-only."
    }
  ]
}
```

The workflow selects agents by name, so the descriptions carry no delegation hint. The reviewer's stance and vocabulary come from `instructions`; the profile states its own as replaceable defaults. The project's `Bash(git commit *)` ban belongs in the Claude settings `permissions.deny`, not in `disallowedTools`.

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
