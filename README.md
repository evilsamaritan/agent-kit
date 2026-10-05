# Agent Kit

Agent Kit is a reusable library of software-engineering skills, profession profiles, and helpers for Claude Code, Codex, and Kimi Code. It packages context and configuration; it does not replace any runtime's native agents, subagents, teammates, workflows, or thread controls.

## Mental model

```text
Agent Kit library                  Project source                    Native runtime
skills/                            .agent-kit/agents.json            .claude/agents/*.md
profiles/                 +        selected profiles + skills  →     .codex/agents/*.toml
role templates                                                     .kimi-code/agents/*.md
```

- A **profile** is a reusable profession such as developer, tester, or reviewer.
- A **skill** is reusable domain knowledge such as Rust, React, databases, testing, or accessibility.
- A **project agent** is a profile configured with the exact skills needed by one project.
- `agent-orchestrator` chooses the professions, instances, effort, and task split for a concrete task, then uses the host runtime's native delegation.

The same project composition generates Claude and Codex agents, and Kimi Code agents when selected, so switching runtimes does not require copying prompts or rebuilding the team by hand.

## Repository layout

```text
profiles/<name>/
├── PROFILE.md                    # portable profession behavior
├── claude.yaml                   # Claude defaults
├── codex.yaml                    # Codex defaults
└── kimi.yaml                     # optional Kimi defaults

skills/<name>/                    # shared knowledge and meta skills
skills/agent-creator/             # project materialization + profile maintenance
skills/agent-orchestrator/        # native task-time composition

.claude-plugin/marketplace.json   # shared repository marketplace catalog
.codex-plugin/plugin.json         # Codex plugin manifest
.kimi-plugin/plugin.json          # Kimi Code plugin manifest
scripts/profile-runtimes/         # one format module per runtime
scripts/generate-profiles.mjs     # profile canon → catalog and references
```

The repository itself does not ship project-local `.claude/` or `.agents/` configuration. Those namespaces belong to consuming projects or local harness setup. The repository marketplace stays under `.claude-plugin/marketplace.json`, which Claude uses natively and current Codex clients accept as a legacy-compatible marketplace source.

## Installation

### Claude Code

```bash
/plugin marketplace add evilsamaritan/agent-kit
/plugin install agent-kit@agent-kit
```

### Codex

```bash
codex plugin marketplace add evilsamaritan/agent-kit
codex plugin add agent-kit@agent-kit
```

Start a new Codex task after installation so the plugin skills enter the session.

### Kimi Code

```text
/plugins install https://github.com/evilsamaritan/agent-kit
/reload
```

Kimi runs a managed copy of the plugin; reinstall or reload after updating. Project agents for Kimi are opt-in: add `"kimi"` to an agent's `runtimes`. Kimi custom agents have no model or effort field, so those intents are not applied there.

Installing the plugin exposes skills and profile recipes. It does not register profession agents. Project agents are optional: the main session can use skills directly.

## Upgrading from 3.x

4.0 removes the bundled Claude agents, replaces the `frontend`/`backend` profiles with `developer`, renames the `visualization` skill to `playground`, and stops pinning models in profiles. Follow [docs/upgrading-to-4.0.md](docs/upgrading-to-4.0.md); `migrate-project.mjs` converts `.agent-kit/agents.json`, and `materialize-agents.mjs --dry-run` shows what each agent gains or loses. Changes per release: [CHANGELOG.md](CHANGELOG.md).

## Configure agents for a project

Ask naturally:

```text
Create agents for this project for both Claude and Codex.
Use a developer responsible for the backend, with Rust, database, and API knowledge, plus a tester.
```

`agent-creator` writes the portable project source:

```json
{
  "schema_version": 1,
  "agents": [
    {
      "name": "backend-developer",
      "profile": "developer",
      "skills": ["architecture", "backend", "api-design", "database", "rust"],
      "runtimes": ["claude", "codex"]
    },
    {
      "name": "tester",
      "profile": "tester",
      "skills": ["testing", "rust"],
      "runtimes": ["claude", "codex"]
    }
  ]
}
```

It then materializes:

```text
.claude/agents/backend-developer.md
.claude/agents/tester.md
.codex/agents/backend-developer.toml
.codex/agents/tester.toml
```

Profiles and skills remain in the installed library rather than being copied into every project. Agents inherit the host model unless the project pins `claude.model` or `codex.model`.

After an Agent Kit update, preview and apply the sync:

```bash
node <agent-kit>/skills/agent-creator/scripts/materialize-agents.mjs --project-root . --dry-run
node <agent-kit>/skills/agent-creator/scripts/materialize-agents.mjs --project-root .
```

The diff separates changed profile behavior, settings, and skills from path-only refreshes. Each target records the kit version and an input fingerprint, so `--check` (or `--check --agent NAME`) reports a stale agent with its cause.

## Run a task team

Ask `agent-orchestrator` for the outcome rather than spelling out runtime mechanics:

```text
Implement OAuth login. Choose the team, split the work, and use the native workflow for this runtime.
```

The orchestrator discovers the project's materialized agents, chooses the minimum useful composition, assigns non-overlapping work, and delegates through Claude or Codex directly. If a client cannot apply named custom-agent config, it passes the same profile and skill composition to a generic native subagent as a capability-gated fallback. It does not create a proprietary `team.json` or agent runtime.

## Create and share skills

Use `skill-creator` or ask “create a skill for X”. Skills live once under `skills/<name>/` and are exposed by both plugin manifests.

Individual skills can also be installed with:

```bash
npx skills add agent-kit/<skill-name>
```

Claude targets include authoritative local skill source paths. Native `skills` preloading is host-dependent; bare plugin names in a project agent have not been behaviorally verified here. Read the selected source when it was not preloaded. Refresh generated targets after an installation moves or updates. Creating the first native agent directory may require restarting the host session.

## Maintain the profile library

Profile authors edit only `profiles/<name>/`, then regenerate package artifacts:

```bash
node scripts/generate-profiles.mjs
node scripts/generate-profiles.mjs --check
```

Role templates under `skills/agent-creator/templates/` describe reusable behavior. Profile bodies adapt them to a profession; templates are not copied verbatim at runtime.

## Validation

```bash
bash scripts/validate-repository.sh
```

The validator checks plugin manifests, skill metadata, profile canon, generated package drift, unit tests for settings resolution and runtime formats, and a temporary project materialization for native Claude and Codex targets, including freshness cases.

## License

MIT

Version changes are synchronized with `node scripts/bump-version.mjs <semver>` before each meaningful commit.
