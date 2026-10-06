# Profile and Project-Agent Verification Checklist

## Contents

- [Profile source](#profile-source)
- [Project composition](#project-composition)
- [Claude target](#claude-target)
- [Codex target](#codex-target)
- [Kimi target](#kimi-target)
- [Safety and drift](#safety-and-drift)

## Profile source

- [ ] Directory name and `name` match and use lowercase kebab-case.
- [ ] `description`, `role`, `effort`, and `access` exist.
- [ ] Every declared role has one exact `## Role — <role>` section.
- [ ] Every default skill exists under `skills/`.
- [ ] Core contains no runtime-specific model or tool fields.
- [ ] Claude and Codex overlays contain only rendered, validated fields and pin no model.
- [ ] Persona, output format, and done criteria are profession-specific.
- [ ] Role content is adapted rather than copied from the template.

## Project composition

- [ ] `.agent-kit/agents.json` parses and has `schema_version: 1`.
- [ ] Agent names are unique and profile names exist.
- [ ] `skills`, when present, are the intentional exact final set.
- [ ] Every selected skill resolves from the project or installed Agent Kit.
- [ ] Runtime list is a non-empty subset of `claude`, `codex`, `kimi`; omitted means Claude and Codex.
- [ ] Effort, access, and runtime overrides use supported values.

## Claude target

- [ ] File begins with valid YAML frontmatter.
- [ ] Name, description, effort, skills, and tools match the composition; `model` appears only when the project pinned one.
- [ ] `skills:` lists library skills as `agent-kit:<skill>` and `.claude/skills/` project skills by name; other project skills appear only as project-relative paths in the body.
- [ ] Access-derived tools are honest unless explicitly overridden.
- [ ] Generated marker and complete profile body are present.
- [ ] The package ships no Claude agent registry; project targets are materialized only when configured.

## Codex target

- [ ] TOML parses.
- [ ] `name`, `description`, and `developer_instructions` are present.
- [ ] `model` appears only when the project pinned one; `model_reasoning_effort` matches the composition.
- [ ] `sandbox_mode` matches access intent.
- [ ] No `[[skills.config]]` entries; `developer_instructions` names every selected skill (`agent-kit:<skill>`, a `.agents/skills/` name, or a project-relative path).
- [ ] Generated marker and complete profile behavior are present.

## Kimi target

- [ ] Frontmatter has `name`, `description`, and an explicit `tools` allowlist derived from access.
- [ ] Body starts with `${base_prompt}` and keeps the selected skill names (bare, loaded with the Skill tool) and the handoff section; profile text contains no Kimi template variable.
- [ ] The agent name is not `coder`, `explore`, or `plan`.

## Safety and drift

- [ ] Package generator `--check` passes.
- [ ] Project materializer `--check` passes; `--dry-run` reports no unexpected behavior or permission change.
- [ ] Generated targets carry `agent-kit-metadata` with a composition fingerprint and no kit version.
- [ ] Library skills are named by host identifier, project skills by name or project-relative path.
- [ ] Ignore files and host plugin settings were left untouched.
- [ ] Non-generated native agent files are never overwritten or pruned.
- [ ] Removing a composition entry plus `--prune` removes only marked derived targets.
- [ ] Repository validation exercises a temporary project for all three runtimes.
