# Agent Kit

Agent Kit is a reusable library of software-engineering skills, profession profiles, and helpers for Claude Code and Codex. It packages context and configuration; it does not replace either runtime's native agents, subagents, teammates, workflows, or thread controls.

## Mental model

```text
Agent Kit library                  Project source                    Native runtime
skills/                            .agent-kit/agents.json            .claude/agents/*.md
profiles/                 +        selected profiles + skills  →     .codex/agents/*.toml
role templates                                                     Claude/Codex orchestration
```

- A **profile** is a reusable profession such as backend, frontend, tester, or reviewer.
- A **skill** is reusable domain knowledge such as Rust, React, databases, testing, or accessibility.
- A **project agent** is a profile configured with the exact skills needed by one project.
- `agent-orchestrator` chooses the professions, instances, effort, and task split for a concrete task, then uses the host runtime's native delegation.

The same project composition can generate both Claude and Codex agents, so switching runtimes does not require copying prompts or rebuilding the team by hand.

## Repository layout

```text
profiles/<name>/
├── PROFILE.md                    # portable profession behavior
├── claude.yaml                   # Claude defaults
└── codex.yaml                    # Codex defaults

skills/<name>/                    # shared knowledge and meta skills
skills/agent-creator/             # project materialization + profile maintenance
skills/agent-orchestrator/        # native task-time composition

.claude-plugin/agents/            # generated bundled Claude agents
.claude-plugin/marketplace.json   # shared repository marketplace catalog
.codex-plugin/plugin.json         # Codex plugin manifest
scripts/generate-profiles.mjs     # profile canon → package artifacts
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

## Configure agents for a project

Ask naturally:

```text
Create agents for this project for both Claude and Codex.
Use a Rust backend profile with database and API skills, plus a tester.
```

`agent-creator` writes the portable project source:

```json
{
  "schema_version": 1,
  "agents": [
    {
      "name": "backend-rust",
      "profile": "backend",
      "skills": ["backend", "api-design", "database", "rust"],
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
.claude/agents/backend-rust.md
.claude/agents/tester.md
.codex/agents/backend-rust.toml
.codex/agents/tester.toml
```

Generated targets can be rebuilt after an Agent Kit update. Profiles and skills remain in the installed library rather than being copied into every project.

## Run a task team

Ask `agent-orchestrator` for the outcome rather than spelling out runtime mechanics:

```text
Implement OAuth login. Choose the team, split the work, and use the native workflow for this runtime.
```

The orchestrator discovers the project's materialized agents, chooses the minimum useful composition, assigns non-overlapping work, and delegates through Claude or Codex directly. If a Codex client cannot apply named custom-agent config yet, it passes the same profile and skill composition to a generic native subagent as a capability-gated fallback. It does not create a proprietary `team.json` or agent runtime.

## Create and share skills

Use `skill-creator` or ask “create a skill for X”. Skills live once under `skills/<name>/` and are exposed by both plugin manifests.

Individual skills can also be installed with:

```bash
npx skills add agent-kit/<skill-name>
```

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

The validator checks plugin manifests, skill metadata, profile canon, generated package drift, and a temporary project materialization for native Claude and Codex targets.

## License

MIT
