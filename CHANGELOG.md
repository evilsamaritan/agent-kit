# Changelog

## 4.0.0-rc.2

Generated agents are portable and correct to commit. Decision and host evidence: [docs/decisions/0001-portable-generated-agents.md](docs/decisions/0001-portable-generated-agents.md).

### Changed

- Targets name library skills by host identifier (`agent-kit:<skill>` for Claude and Codex, the bare name for Kimi) and project skills by catalog name or project-relative path. No target contains an absolute path, home directory, user name, or kit version; two machines render byte-identical files.
- Claude `skills:` preloads library skills by qualified id instead of a bare name another plugin could match.
- Codex targets no longer write `[[skills.config]]`; role files keep only disabling entries, so the old entries had no effect.
- `agent-kit-metadata` records a fingerprint of the resolved composition instead of the kit version and raw inputs; a kit upgrade rewrites a target only when its content changes.
- `--check` passes exactly when regeneration would write nothing and reports non-portable content. `--check --portable` is deprecated and has no effect.
- Docs state that committing or ignoring generated targets is the project's choice; Agent Kit writes no ignore entries.
- Kimi renderer also rejects the 0.29.0 template variables `skills_section`, `windows_notes`, `role_additional`, and `additional_dirs_section` in profile text.

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
