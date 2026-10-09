# Changelog

## 4.0.0-rc.7

Closes the gaps a project with hand-written, workflow-driven agents hit when migrating to `agents.json`.

### Added

- `researcher` profile: measurements, prototypes, and investigations that write only to a scratch directory, never the repository. Evidence discipline is in the body: every number with its command and verbatim output, at least three runs with their spread, negative results reported. Roles implementer and writer; default skills `performance` and `development` (`performance` required); effort high, access full. The language skill comes from the project.
- `instructions` on an `agents.json` entry: project-specific rules (gates, forbidden paths, report language and structure, documents to read first, a review stance) rendered after the profession body as `## Project instructions` in every runtime target and in `--brief`. A string or an array of strings. Part of the composition fingerprint; `--dry-run` reports `project instructions changed`. Project skills remain the home for shared or long knowledge; `project-config.md` says which text goes where.
- `delegation_hint` (top level and per agent): `false` keeps the description exactly as written and omits Kimi's default `whenToUse`, for projects that route delegation through their own workflow or hooks. Omitted means the rc.6 behavior.

### Changed

- `reviewer` profile states its stance, severity scale, and verdict words once as defaults a project assignment or `instructions` may replace; an adversarial stance or a blocker / high / medium / low scale no longer contradicts the persona. The default stance and scale are unchanged; `--dry-run` reports the body change.
- Claude `tools` and `disallowedTools` entries must be tool names or `mcp__<server>` patterns. A specifier such as `Bash(git commit:*)` or `Edit(docs/**)` is now a validation error: Claude Code documents that a `disallowedTools` specifier still removes the whole tool, and earlier materializer versions silently dropped `Bash` from `tools` while writing the pattern. Command and path rules belong in `permissions` of the project's Claude settings.
- Fingerprints of agents without the new fields are unchanged, so an upgrade rewrites a target only when its description, body, or composition changed.

### Not validated on purpose

- `effort` is not checked against the model: the levels a model supports are host knowledge that changes with releases, and Claude Code falls back to the highest level the active model supports at or below the one set. `haiku` with `xhigh` passes validation and runs at what the host allows.

### Upgrade

- Any `claude.disallowedTools` or `claude.tools` entry with a parenthesized specifier fails validation; replace it with the tool name and move the rule to Claude settings `permissions`.
- Reviewer agents regenerate with the reworded body. Run `materialize-agents.mjs --dry-run`, then regenerate.

## 4.0.0-rc.6

### Changed

- Generated agents compete with the host's generic subagents out of the box. Claude Code and Codex descriptions end with when to prefer the project agent (its profession and selected skills) over a generic subagent, including for a narrower task inside its area; Kimi Code agents get a default `whenToUse` that says to use them instead of the built-in `coder` or `explore`. A project `kimi.whenToUse` still wins. Regenerate targets; `--dry-run` reports the description change.

## 4.0.0-rc.5

### Changed

- Kimi Code agents start from Kimi's own `${base_prompt}` (operating and safety rules, AGENTS.md as reference data, the skill index, the working directory), then the profession body, the selected skills, and the handoff. Raw `${agents_md}` and `${skills}` sections are gone, so delegated Kimi agents keep the host's rules and the AGENTS.md framing. Regenerate Kimi targets; `--dry-run` reports a format-only change.
- `agent-orchestrator`: a project agent's description is its default responsibility, and an assignment narrows it (owned files, forbidden areas, the settled design to implement). Prefer configured agents with narrowed assignments over bare generic subagents, which carry none of the composed profession and skills; propose a new agent when a different split recurs.

## 4.0.0-rc.4

A full review of every skill, verified finding by finding, and the fixes it called for. Per-skill notes stay in the skills; this entry summarizes.

### Added

- `python` skill: version-first workflow, typing and data models, asyncio with structured concurrency, packaging decisions, variant families in Python.
- `grill-me` skill: a round-based interview that settles a plan's decisions with the user before work starts (idea from grill-me by Matt Pocock, MIT; written for Agent Kit).
- Missing depth as references inside existing skills: `auth` authorization and credential storage, `accessibility` native platforms, `reliability` recovery (RPO, RTO, restore drills), `file-storage` serving untrusted files, `payments` store billing and regulatory rails, `api-design` RPC patterns, `security` OWASP Top 10, `react` Next.js, `i18n` library and runtime references, `javascript` build tooling, `zig` build system and version notes, `go` version notes.

### Changed

- Code and configuration examples updated for current stable releases, including Zig, TypeScript, Go tooling, Vite, Biome, ESLint, Vitest, Kotlin, Rust, Kubernetes, CI providers, payment provider APIs, and OpenTelemetry.
- Unsafe examples fixed: authorization in server code, WebSocket authentication, row-level security, presigned uploads, container users, pod security, security headers.
- Contradictions with `development` removed across skills: silent defaults, catch-all error handling, second writers, consumer-side branching on variant types.
- One owner per topic, with the others pointing to it: retry policy (`reliability`), idempotency (`message-queues`), webhooks and cursors (`api-design`), Cache-Control policy (`caching`), header mechanics (`web`), probes and shutdown (`backend` code, `reliability` policy), migrations (`database`), supply chain and SAST/DAST (`security`), fuzzing (`testing`), Core Web Vitals (`performance`), outbox, saga, and CQRS (`architecture`), changelog production (`release-engineering`).
- Volatile facts (versions, support tables, release status) moved from SKILL.md into references; language skills start by determining the project's version.
- `frontend` covers UI structure, state ownership, rendering strategy, and UI verification; build tooling moved to `javascript`.
- `council` is host-neutral; `seo`, `payments`, and `zig` were reworked; descriptions sharpened across the catalog; references that only repeated SKILL.md were cut.
- Project recipes live in one place (`agent-creator`); `init` points to them.
- AGENTS.md: explicit list of meta skills, classes and section skeletons kept once in `skill-creator`, portable frontmatter fields separated from host extensions, profile overlays optional.
- Codex manifest `defaultPrompt` is a list of prompts.
- `materialize-agents.mjs`: `--agent` and `--brief` resolve skills only for the selected agent; `--brief` takes `--runtime` so a fallback brief resolves project skills the way the receiving host does.
- `tester` loads `development` for all test code, not only shared test mechanisms.

### Removed

- `hook-creator` and `update-config` (Claude Code only; Claude Code ships its own settings skill).
- The `security` profile: use `reviewer` with the `security` skill.
- `testing/references/multi-pass-review.md`, the playground maintainer gallery and its D2 renderer, superseded `frontend`, `docker`, and `init` references, and empty Codex profile overlays.
- Validator checks that guarded retired names and mandatory empty overlays.

### Upgrade

Agents built from the `security` profile fail validation: switch them to `profile: reviewer` with `security` in `skills` (agent-creator's migration instruction does this). Agents listing `hook-creator` or `update-config` must drop them. Run `materialize-agents.mjs --dry-run`, then regenerate.

## 4.0.0-rc.3

Code practice has one owner, and profiles carry the skills they cannot work without.

### Added

- `development` skill: how code is written in any stack — core rules for variant families, single writers, explicit dependencies, async lifetime, and errors; open versus closed families; placement versus mechanism; change integration; extension trace and structural checks. SOLID, DRY, KISS/YAGNI, composition, code-level patterns, and the diff critique moved here from `architecture`.
- Profile field `requires`: skills always added to every project composition. `developer` and `reviewer` require `development`, `architect` requires `architecture`, `tester` requires `testing`.
- Repository validation rejects principle vocabulary outside `development`.

### Changed

- `architecture` covers systems and modules: boundaries, data ownership, contracts between modules, styles, integration patterns (repository, saga, outbox), ADRs, and views. `/agent-kit:architecture critique` routes to the `development` critique workflow.
- `frontend`, `backend`, `mobile`, and `gamedev` keep their zones and point to `development` for code practice; `frontend` and `backend` gained a section on verifying a change in their environment. `gamedev` is engine- and language-neutral.
- Language skills show both shapes of a variant family: closed sets with exhaustive dispatch, open families with per-member behavior. The Rust architecture reference became `design-idioms.md`.
- `developer` and `reviewer` profiles are shorter: behavior, skills, collaboration. A violated core rule of `development` in added or modified code is a review blocker; pre-existing violations are notes.
- Role templates carry behavior only; craft rules come from the knowledge skills.
- `agent-orchestrator`: one reviewed exemplar before several writers extend the same family; assignments point to skills and the exemplar; verification by an agent other than the author, stated as facts.

### Removed

- The portability layer from rc.2: the `--portable` flag, leak checks and "not portable" reports, two-machine tests, and commit-or-ignore guidance. Targets still name skills by host identifier; whether a project commits them is its own choice.
- Migration scripts (`migrate-project.mjs`, `project-migrations.mjs`, legacy defaults). Migration is an `agent-creator` instruction: rewrite `agents.json`, regenerate, prune.
- Unused maintenance scripts `link-claude-md.sh` and `validate-codex-agent.mjs`.

### Upgrade

`--dry-run` shows `development` added to `developer` and `reviewer` agents; no `agents.json` edit is needed. Developer agents that listed `architecture` only for code practice can drop it. Scripts that still pass `--portable` must drop it: the flag is now rejected.

## 4.0.0-rc.2

Generated agents are portable and correct to commit.

### Changed

- Targets name library skills by host identifier (`agent-kit:<skill>` for Claude and Codex, the bare name for Kimi) and project skills by catalog name or project-relative path. No target contains an absolute path, home directory, user name, or kit version; two machines render byte-identical files.
- Claude `skills:` preloads library skills by qualified id instead of a bare name another plugin could match.
- Codex targets no longer write `[[skills.config]]`; role files keep only disabling entries, so the old entries had no effect.
- `agent-kit-metadata` records a fingerprint of the resolved composition instead of the kit version and raw inputs; a kit upgrade rewrites a target only when its content changes.
- `--check` passes exactly when regeneration would write nothing and reports non-portable content. `--check --portable` is deprecated and has no effect.
- Docs state that committing or ignoring generated targets is the project's choice; Agent Kit writes no ignore entries.
- Kimi renderer also rejects the 0.29.0 template variables `skills_section`, `windows_notes`, `role_additional`, and `additional_dirs_section` in profile text.

## 4.0.0-rc.1

Release candidate. Upgrade notes: [Upgrading to 4.0](#upgrading-to-40).

### Breaking

- Removed the bundled Claude plugin agents; project agents are generated from `.agent-kit/agents.json`.
- Replaced the `frontend` and `backend` profiles with `developer`; `migrate-project.mjs` converts project entries (removed in rc.3; ask agent-creator to migrate).
- Renamed the `visualization` skill to `playground`; `migrate-project.mjs` rewrites explicit skill lists (removed in rc.3; ask agent-creator to migrate).
- Profiles no longer pin models; generated agents inherit the host model unless the project pins one.

### Added

- Kimi Code support: `.kimi-plugin/plugin.json` and opt-in `.kimi-code/agents` targets.
- `developer` profile and responsibility-based recipes, including game and mobile.
- `diagrams`, `gamedev`, and `mobile` knowledge skills.
- `playground` forms and templates, a standalone page composition, host theme bridge, compiled-SVG figures, and a reproducible D2 gallery.
- Runtime format modules, provenance metadata in generated targets, `--dry-run` semantic diff, `--check --portable`, `--check --agent`, and `--brief`.
- Repository validation for unit tests, Kimi and manifest packaging, D2 examples, gallery drift, relative links, and instruction-file names.

### Changed

- Settings resolve in one order; a project's `access: read-only` now replaces write-capable library tools.
- Profession profiles separate durable duties from domain recipes; reviewers block only on evidence.
- Orchestrator runtime guidance split per host, including Workflow opt-in and Kimi swarm limits.
- Skill descriptions shortened to fit host listing budgets.

## Upgrading to 4.0

Agent Kit 4.0 ships profiles and skills, not a ready-made team. Project agents are generated from `.agent-kit/agents.json` for the runtimes a project uses: Claude Code, Codex, and Kimi Code.

| Change | What breaks | What to do |
|---|---|---|
| Bundled Claude agents removed | `agent-kit:architect`, `agent-kit:reviewer`, and the other plugin agents no longer exist | Create project agents with `agent-creator` or `init`; until then the orchestrator uses a generic subagent with the profile brief |
| `frontend` and `backend` profiles replaced by `developer` | `agents.json` entries with those profiles fail validation | Ask `agent-creator` to migrate the project, or set `profile: developer` and add the zone skills by hand |
| `visualization` skill renamed to `playground` | explicit skill lists naming `visualization` fail validation | Rename it in `agents.json`; invoke `/agent-kit:playground` |
| Profiles pin no model | agents that relied on library defaults now inherit the host model | Review the `--dry-run` diff; pin `claude.model` or `codex.model` where a specific model matters |
| Portable generated targets (rc.2) | rc.1 targets with absolute plugin-cache paths fail `--check` | Regenerate once |
| `security` profile removed (rc.4) | agents with `profile: security` fail validation | Use `profile: reviewer` with the `security` skill |
| `hook-creator`, `update-config` removed (rc.4) | explicit skill lists naming them fail validation | Drop them; Claude Code's built-in settings skill covers hooks and settings |
| Code practice moved to `development` (rc.3) | links into `architecture` references for principles, variation, patterns, or critique | Use `development`; profiles that need it carry it through `requires` |

From the project root, with `<agent-kit>` the installed library (Claude Code `~/.claude/plugins/cache/agent-kit/agent-kit/<version>/`, Codex `~/.codex/plugins/cache/agent-kit/agent-kit/<version>/`, Kimi Code `$KIMI_CODE_HOME/plugins/managed/<id>/`):

Ask `agent-creator` to migrate the project (its configure-project workflow: rewrite `.agent-kit/agents.json`, then regenerate), or edit the file by hand, then:

```bash
node <agent-kit>/skills/agent-creator/scripts/materialize-agents.mjs --project-root . --dry-run
node <agent-kit>/skills/agent-creator/scripts/materialize-agents.mjs --project-root . --prune
node <agent-kit>/skills/agent-creator/scripts/materialize-agents.mjs --project-root . --check
```

`--dry-run` lists per agent and runtime what changes: behavior, settings, skills, skill sources. User-owned agent files are never overwritten. Claude Code picks up a `.claude/agents/` directory created during a session after a restart. Whether generated targets are committed is the project's choice.

Known limitations, documented rather than verified in a live session: Claude skill-id resolution was read from the 2.1.288 build; Kimi custom agents load only on the v2 engine in 0.29.0 and have no model or effort fields; whether a Codex client applies a named custom agent's configuration depends on the client; engine and OS specifics in `gamedev` and `mobile` references are marked for verification; Mermaid, PlantUML, and Graphviz examples are syntax-reviewed only.

## 3.4.1

Earlier history is in the git log.
