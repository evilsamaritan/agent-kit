# Changelog

## 4.0.0-rc.1

Release candidate. Upgrade notes: [docs/upgrading-to-4.0.md](docs/upgrading-to-4.0.md).

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

## 3.4.1

Earlier history is in the git log.
