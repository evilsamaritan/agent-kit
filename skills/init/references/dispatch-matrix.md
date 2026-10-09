# Project Profile Dispatch Matrix

Compositions (profile plus exact skills) and agent names live in one place: [project-agent-recipes.md](../../agent-creator/references/project-agent-recipes.md). This file maps repository evidence to the skills a composition needs and says when a responsibility earns its own agent.

## Contents

- [Selection order](#selection-order)
- [Stack signals](#stack-signals)
- [Responsibility mapping](#responsibility-mapping)
- [Sizing rules](#sizing-rules)

## Selection order

1. Identify recurring responsibilities from the repository and the user request.
2. Pick the matching composition from the recipes, one profile per distinct responsibility.
3. Add the skills the stack signals below call for; read the manifest behind each signal, not only its presence.
4. Add another instance only for a distinct recurring responsibility, with a description of its boundary.
5. Keep task-time team size out of project configuration; `agent-orchestrator` chooses instances per task.

## Stack signals

Only signals that change the selected skills are listed. A language with a skill adds it; a language without one gets `development` plus the zone skills for its work.

| Evidence | Adds |
|----------|------|
| `package.json`, `tsconfig.json` | `javascript`; dependencies decide `react` or `vue`, `react-native` → `mobile`, a game library with a game loop → `gamedev` |
| `pyproject.toml`, `requirements*.txt`, `Pipfile`, `setup.py`, `uv.lock`, `poetry.lock` | `python`; web, worker, or data dependencies decide the zone skills |
| `go.mod` | `go` |
| `Cargo.toml` | `rust` |
| Kotlin sources or `build.gradle.kts` | `kotlin`; Java-only JVM projects have no language skill |
| `build.zig`, `build.zig.zon` | `zig` |
| `*.csproj`, `*.sln`, `Package.swift`, `Gemfile`, `composer.json`, `mix.exs` | no language skill; `development` plus zone skills |
| `project.godot`, `*.uproject`, Unity `ProjectSettings/ProjectVersion.txt` | `gamedev` |
| `AndroidManifest.xml`, `*.xcodeproj`, `pubspec.yaml`, KMP `androidMain`/`iosMain` source sets | `mobile` |
| OpenAPI or protobuf contracts, `*.graphql` schemas | `api-design`; `graphql` for GraphQL |
| `Dockerfile`, `compose.yaml` | `docker` |
| `.github/workflows/`, `.gitlab-ci.yml`, other pipeline files | `ci-cd` |
| Kubernetes manifests, `Chart.yaml`, `kustomization.yaml` | `kubernetes` |
| Infrastructure-as-code files | no dedicated skill; a `devops` responsibility with `ci-cd` and `release-engineering` for the delivery side |
| Workspace markers (`pnpm-workspace.yaml`, `nx.json`, `turbo.json`, `go.work`, a Cargo or Gradle multi-project) | several responsibilities; consider `architect` |
| `.claude/`, `.codex/`, `.kimi-code/` | the matching runtime targets |

## Responsibility mapping

| Recurring responsibility | Add profile when |
|--------------------------|------------------|
| architect | Cross-package contracts, major design decisions, recurring problems with a shared cause, architecture reviews, or decision records recur |
| developer | Implementation owns UI, service, runtime, library, or other code; select knowledge for the responsibility |
| tester | Test authoring or auditing is a recurring independent responsibility |
| reviewer | Independent code review is routinely delegated. A recurring security review is a second reviewer instance with `security` (plus `auth` or `compliance` when in scope); do not add it only because every project needs secure code |
| devops | Deployment, CI, containers, or infrastructure live in this repository |
| sre | SLOs, incidents, operational readiness, or reliability reviews recur |
| researcher | Benchmarks, performance profiles, spikes, or feasibility checks recur and decide design choices; the work runs in scratch and must not touch the repository |
| designer | UX journeys and code-level design-system work recur |
| writer | Human-facing technical documentation is a recurring deliverable |

## Sizing rules

- Configure durable responsibilities, not the maximum simultaneous team.
- Small single-stack applications usually need one or two project agents (see the recipes' Project shapes); a small project can use the main session directly.
- Full-stack or polyglot monorepos may need one developer instance per real boundary.
- Do not configure several identical agents for concurrency; the orchestrator can spawn multiple instances of one native agent.
- Do not preload a skill merely because it might become relevant once. Runtime discovery handles occasional knowledge.
