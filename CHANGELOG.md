# Changelog

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

`--dry-run` shows `development` added to `developer` and `reviewer` agents; no `agents.json` edit is needed. Developer agents that listed `architecture` only for code practice can drop it.

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
- Replaced the `frontend` and `backend` profiles with `developer`; `migrate-project.mjs` converts project entries.
- Renamed the `visualization` skill to `playground`; `migrate-project.mjs` rewrites explicit skill lists.
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
