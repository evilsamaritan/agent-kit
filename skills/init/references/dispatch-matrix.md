# Project Profile Dispatch Matrix

## Contents

- [Selection order](#selection-order)
- [Stack mapping](#stack-mapping)
- [Responsibility mapping](#responsibility-mapping)
- [Sizing rules](#sizing-rules)

## Selection order

1. Identify recurring responsibilities from the repository and user request.
2. Choose one profession profile per distinct responsibility.
3. Select the exact knowledge skills for the detected stack.
4. Add a second variant of the same profile only when distinct stacks coexist.
5. Keep task-specific team size out of project configuration; `agent-orchestrator` chooses instances per task.

## Stack mapping

| Signal | Profile | Suggested exact skills |
|--------|---------|------------------------|
| React frontend | frontend | frontend, react, web, html, css, accessibility |
| Vue frontend | frontend | frontend, vue, web, html, css, accessibility |
| Node backend | backend | backend, api-design, database, javascript, web |
| Rust backend | backend | backend, api-design, database, rust |
| Go backend | backend | backend, api-design, database, go |
| Containers / CI | devops | docker, ci-cd, release-engineering |
| Kubernetes platform | devops | docker, kubernetes, ci-cd, release-engineering |
| Production reliability | sre | reliability, observability, performance |
| General test ownership | tester | testing plus the primary language/framework skill when routinely needed |
| Security-sensitive service | security | security, auth, compliance only when regulatory concerns are routine |
| Documentation-heavy library | writer | documentation plus the primary language skill when routinely needed |

## Responsibility mapping

| Recurring responsibility | Add profile when |
|--------------------------|------------------|
| architect | Cross-package contracts, major design decisions, or ADR work recur |
| frontend | The project owns browser UI |
| backend | The project owns services, APIs, jobs, or data access |
| tester | Test authoring/auditing is a recurring independent responsibility |
| security | Security review recurs; do not add only because every project needs secure code |
| devops | Deployment, CI, containers, or infrastructure live in this repository |
| sre | SLOs, incidents, operational readiness, or reliability reviews recur |
| designer | UX journeys and code-level design-system work recur |
| reviewer | General independent code review is routinely delegated |
| writer | Human-facing technical documentation is a recurring deliverable |

## Sizing rules

- Configure durable responsibilities, not the maximum simultaneous team.
- Small single-stack applications usually need two or three project agents.
- Full-stack or polyglot monorepos may need specialized variants.
- Do not configure several identical agents for concurrency; the orchestrator can spawn multiple instances of one native agent.
- Do not preload a skill merely because it might become relevant once. Runtime discovery handles occasional knowledge.
