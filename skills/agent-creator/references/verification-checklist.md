# Profile and Project-Agent Verification Checklist

## Contents

- [Profile source](#profile-source)
- [Project composition](#project-composition)
- [Claude target](#claude-target)
- [Codex target](#codex-target)
- [Safety and drift](#safety-and-drift)

## Profile source

- [ ] Directory name and `name` match and use lowercase kebab-case.
- [ ] `description`, `role`, `effort`, and `access` exist.
- [ ] Every declared role has one exact `## Role — <role>` section.
- [ ] Every default skill exists under `skills/`.
- [ ] Core contains no runtime-specific model or tool fields.
- [ ] Claude and Codex overlays contain only rendered, validated fields.
- [ ] Persona, output format, and done criteria are profession-specific.
- [ ] Role content is adapted rather than copied from the template.

## Project composition

- [ ] `.agent-kit/agents.json` parses and has `schema_version: 1`.
- [ ] Agent names are unique and profile names exist.
- [ ] `skills`, when present, are the intentional exact final set.
- [ ] Every selected skill resolves from the project or installed Agent Kit.
- [ ] Runtime list contains Claude, Codex, or both.
- [ ] Effort, access, and runtime overrides use supported values.

## Claude target

- [ ] File begins with valid YAML frontmatter.
- [ ] Name, description, effort, model, skills, and tools match the composition.
- [ ] Access-derived tools are honest unless explicitly overridden.
- [ ] Generated marker and complete profile body are present.
- [ ] The Claude plugin manifest lists every bundled profile target.

## Codex target

- [ ] TOML parses.
- [ ] `name`, `description`, and `developer_instructions` are present.
- [ ] Model and `model_reasoning_effort` match the composition.
- [ ] `sandbox_mode` matches access intent.
- [ ] Every selected skill has an enabled `skills.config` entry.
- [ ] Generated marker and complete profile behavior are present.

## Safety and drift

- [ ] Package generator `--check` passes.
- [ ] Project materializer `--check` passes.
- [ ] Non-generated native agent files are never overwritten or pruned.
- [ ] Removing a composition entry plus `--prune` removes only marked derived targets.
- [ ] Repository validation exercises a real temporary project for both runtimes.
