# Team Config Migrations

Schema changes per plugin version. When team.json version < current plugin version, apply changes sequentially.

## 1.2.0

(reserved for next release)

## 1.1.0

Initial team config schema.

### Required fields
- `version` (string) — plugin version at creation time
- `name` (string) — team name, matches directory name
- `agents` (string[]) — agent names (must exist as `agents/<name>.md`)
- `flow.type` (string) — one of: pipeline, pipeline-parallel, builder-validator, twin-review, swarm-review, devils-advocate, fan-out, diverge-converge, purple-team, custom
- `flow.stages` (object[]) — ordered stage definitions

### Optional fields
- `description` (string) — human-readable team description
- `created` (string) — ISO date
- `options.twin_review` (boolean, default: false)
- `options.twin_models` (string[], default: [])
- `options.context_compression` (boolean, default: true)
- `options.max_iterations` (number, default: 1)
- `options.quality_gate` (boolean, default: false)

### Stage object
- `agent` (string) — single agent name
- `agents` (string[]) — multiple agents (parallel stage)
- `role` (string) — human-readable role description
- `mode` (string) — "readonly" | "write" | "mixed"
- `parallel` (boolean) — run agents in this stage concurrently
- `requires_approval` (boolean) — pause for human approval before this stage
