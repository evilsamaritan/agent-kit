# Workflow: Detect Stack

Heuristics for inferring a project's tech stack from filesystem signals. The result is a short string used to inform agent/team selection in `bootstrap.md`.

---

## Signal files

| File present | Implication |
|--------------|-------------|
| `package.json` | Node.js project. Read it for: dependencies (react, vue, svelte, next, nuxt, express, fastify, ...), scripts (test, lint, build), packageManager (npm/yarn/pnpm/bun) |
| `pnpm-workspace.yaml` / `lerna.json` / `nx.json` / `turbo.json` | Monorepo |
| `tsconfig.json` | TypeScript |
| `go.mod` | Go project. Read it for module path and Go version |
| `pyproject.toml` / `requirements.txt` / `Pipfile` / `setup.py` | Python project. Inspect for framework hints (django, fastapi, flask) |
| `Cargo.toml` | Rust project |
| `*.csproj` / `*.sln` | .NET project |
| `pom.xml` / `build.gradle*` | Java/Kotlin project |
| `Gemfile` | Ruby project |
| `composer.json` | PHP project |
| `mix.exs` | Elixir project |
| `Dockerfile` / `compose.yml` | Containerized |
| `.github/workflows/` / `.gitlab-ci.yml` | CI configured |
| `terraform/` / `*.tf` | Infrastructure-as-code |
| `kubernetes/` / `k8s/` / `helm/` | Kubernetes |

---

## Quick detection script

```bash
detect() {
  local stack=""

  # Languages
  [ -f package.json ]    && stack+="Node "
  [ -f tsconfig.json ]   && stack+="+ TypeScript "
  [ -f go.mod ]          && stack+="Go "
  [ -f pyproject.toml ] || [ -f requirements.txt ] && stack+="Python "
  [ -f Cargo.toml ]      && stack+="Rust "
  [ -f Gemfile ]         && stack+="Ruby "
  [ -f composer.json ]   && stack+="PHP "
  ls *.csproj 2>/dev/null && stack+=".NET "
  ls pom.xml build.gradle* 2>/dev/null && stack+="JVM "

  # Frameworks (Node)
  if [ -f package.json ]; then
    grep -q '"react"' package.json    && stack+="+ React "
    grep -q '"vue"' package.json      && stack+="+ Vue "
    grep -q '"svelte"' package.json   && stack+="+ Svelte "
    grep -q '"next"' package.json     && stack+="+ Next.js "
    grep -q '"nuxt"' package.json     && stack+="+ Nuxt "
    grep -q '"express"' package.json  && stack+="+ Express "
    grep -q '"fastify"' package.json  && stack+="+ Fastify "
    grep -q '"vite"' package.json     && stack+="+ Vite "
  fi

  # Infra
  [ -f Dockerfile ] || [ -f compose.yml ] || [ -f docker-compose.yml ] && stack+="+ Docker "
  ls k8s/ kubernetes/ helm/ 2>/dev/null && stack+="+ K8s "
  ls terraform/ *.tf 2>/dev/null && stack+="+ Terraform "

  # Monorepo
  [ -f pnpm-workspace.yaml ] || [ -f lerna.json ] || [ -f nx.json ] || [ -f turbo.json ] && stack+="(monorepo) "

  # CI
  [ -d .github/workflows ] && stack+="(GH Actions) "
  [ -f .gitlab-ci.yml ]    && stack+="(GitLab CI) "

  echo "${stack:-unknown}"
}
```

---

## Confidence levels

| Confidence | Meaning | Action |
|-----------|---------|--------|
| **High** | Single language + clear framework signals | Show detected stack, ask user to confirm or correct |
| **Medium** | Mixed signals (multiple lockfiles, polyglot repo) | Show all detected, ask user which is primary |
| **Low/none** | No signal files found | Skip detection, ask user directly in Step 2 |

---

## Mapping stack → recommended agents (default)

| Detected | Default role agents to suggest |
|----------|------------------------------|
| Node + React/Vue + Vite | frontend, testing |
| Node + Express/Fastify | backend, testing, security |
| Go + Docker | backend, devops, testing, security |
| Python + FastAPI/Django | backend, testing, security |
| Rust | backend, testing |
| Monorepo (anything) | architect, frontend, backend, testing |
| Has Dockerfile | + devops |
| Has K8s | + devops + sre |
| Has CI workflows | + devops |
| Library (no app entry point) | architect, testing, docs |

These are **suggestions, not mandates** — the dispatch matrix in `references/dispatch-matrix.md` combines them with the user's answers about primary tasks and team size.

---

## When to ask vs assume

- **Always ask** if confidence is low/medium
- **Always ask** if multiple primary stacks could fit (full-stack monorepo with Node + Python services)
- **Show then confirm** if confidence is high — never silently proceed with a guess
- **Never** infer team-size or quality-gate preferences from stack — those are user-preference questions
