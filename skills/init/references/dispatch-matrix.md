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
4. Add another instance only for a distinct recurring responsibility; describe its boundaries. Use the shared recipes in `../../agent-creator/references/project-agent-recipes.md`.
5. Keep task-specific team size out of project configuration; `agent-orchestrator` chooses instances per task.

## Stack mapping

| Signal | Profile | Suggested exact skills |
|--------|---------|------------------------|
| React frontend | developer | development, frontend, react, web, html, css, accessibility |
| Vue frontend | developer | development, frontend, vue, web, html, css, accessibility |
| Node backend | developer | development, backend, api-design, database, javascript, web |
| Rust backend | developer | development, backend, api-design, database, rust |
| Go backend | developer | development, backend, api-design, database, go |
| Game (engine project, or a canvas/WebGL game loop) | developer | development, gamedev, and the language; add frontend skills only for a substantial web UI |
| Mobile app (Android, iOS, React Native, Flutter, KMP) | developer | development, mobile, and the platform language, accessibility |
| Containers / CI | devops | docker, ci-cd, release-engineering |
| Kubernetes platform | devops | docker, kubernetes, ci-cd, release-engineering |
| Production reliability | sre | reliability, observability, performance |
| General test ownership | tester | testing plus the primary language/framework skill when routinely needed |
| Security-sensitive service | security | security, auth, compliance only when regulatory concerns are routine |
| Documentation-heavy library | writer | documentation and diagrams, plus the primary language skill when routinely needed |

## Responsibility mapping

| Recurring responsibility | Add profile when |
|--------------------------|------------------|
| architect | Cross-package contracts, major design decisions, recurring problems with a shared cause, architecture reviews, or decision records recur |
| developer | Implementation owns UI, service, runtime, library, or other code; select knowledge for the responsibility |
| tester | Test authoring/auditing is a recurring independent responsibility |
| security | Security review recurs; do not add only because every project needs secure code |
| devops | Deployment, CI, containers, or infrastructure live in this repository |
| sre | SLOs, incidents, operational readiness, or reliability reviews recur |
| designer | UX journeys and code-level design-system work recur |
| reviewer | General independent code review, including structural critique of changes, is routinely delegated |
| writer | Human-facing technical documentation is a recurring deliverable |

## Sizing rules

- Configure durable responsibilities, not the maximum simultaneous team.
- Small single-stack applications usually need two or three project agents.
- Full-stack or polyglot monorepos may need specialized variants.
- Do not configure several identical agents for concurrency; the orchestrator can spawn multiple instances of one native agent.
- Do not preload a skill merely because it might become relevant once. Runtime discovery handles occasional knowledge.
