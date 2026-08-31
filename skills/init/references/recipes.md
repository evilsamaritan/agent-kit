# Bootstrap Recipes

## Contents

- [small-react-app](#small-react-app)
- [go-microservice](#go-microservice)
- [monorepo-fullstack](#monorepo-fullstack)
- [library](#library)
- [data-pipeline](#data-pipeline)

Recipes are starting compositions. Inspect the repository and remove irrelevant skills before writing `.agent-kit/agents.json`.

## small-react-app

- `frontend-react`: profile `frontend`; skills `frontend`, `react`, `web`, `html`, `css`, `accessibility`.
- `tester`: profile `tester`; skills `testing`, `react`.

## go-microservice

- `backend-go`: profile `backend`; skills `backend`, `api-design`, `database`, `go`.
- `tester`: profile `tester`; skills `testing`, `go`.
- `security`: profile `security`; skills `security`, `auth`.
- `devops`: profile `devops`; skills `docker`, `ci-cd`, `release-engineering`.

Drop security or devops when those responsibilities do not live in the repository.

## monorepo-fullstack

- `architect`: profile `architect`; skills `architecture`.
- `frontend`: profile `frontend`; replace framework skill from detected dependencies.
- `backend`: profile `backend`; replace language and data skills from detected services.
- `tester`: profile `tester`; skills `testing` plus routinely used framework/language knowledge.

Create multiple backend variants only for genuinely separate stacks.

## library

- `architect`: profile `architect`; skills `architecture`, `api-design` when the public API is central.
- `tester`: profile `tester`; skills `testing` plus the library language.
- `writer`: profile `writer`; skills `documentation` plus the library language when examples require it.

## data-pipeline

- `backend`: profile `backend`; skills `backend`, `database`, `background-jobs`, `message-queues` as actually used.
- `tester`: profile `tester`; skills `testing`, `database`.
- `sre`: profile `sre`; skills `reliability`, `observability`, `performance`.

Add language-specific knowledge from repository signals. Do not encode a scheduler or cloud vendor merely because it is common in this project class.
