# Monorepo CI/CD Patterns

Monorepo-specific concerns. Generic caching, OIDC, and secrets: [pipeline-patterns.md](pipeline-patterns.md). Syntax details: [github-actions.md](github-actions.md), [gitlab-ci.md](gitlab-ci.md). Snippets use `<sha> # vX.Y.Z` pin placeholders and example runtime versions; see github-actions.md for the pinning procedure.

## Contents

- [Core Challenge](#core-challenge)
- [Affected Package Detection](#affected-package-detection)
- [Pipeline Caching](#pipeline-caching)
- [Affected-Only Builds](#affected-only-builds)
- [Per-Package Deployment](#per-package-deployment)
- [Docker Builds](#docker-builds)
- [Anti-Patterns](#anti-patterns)

---

## Core Challenge

Build and test only what a change can affect: the changed packages plus everything that depends on them, and reuse cached results for the rest. Two sub-problems:

1. **Detection**: which packages changed, including transitive dependents.
2. **Execution**: run tasks only for those, restore cached outputs for the rest.

---

## Affected Package Detection

```
Need transitive dependents of a change?
├── Yes → use the workspace tool's graph (Turborepo, Nx, Bazel, Pants, Gradle, Cargo)
└── No, packages are independent
    └── path filters (rules:changes, paths-filter, or git diff) are enough
```

| Approach | Graph aware | Notes |
|----------|-------------|-------|
| `turbo run <task> --affected` (or `--filter="...[origin/main]"`) | Yes | Changed packages plus dependents |
| `nx affected --target=<task>` | Yes | Project graph plus git diff |
| `dorny/paths-filter`, GitLab `rules:changes` | No | List shared packages and the lockfile in every dependent's paths |
| `git diff --name-only origin/main...HEAD` | No | No dependency; map directories to packages yourself |

Avoid changed-files actions that handle secrets or are not reviewed; one popular action was compromised in 2025. Plain `git diff` or `dorny/paths-filter` with a SHA pin are sufficient.

Shallow clones break git-diff-based detection: every package looks changed. Fetch full history (`fetch-depth: 0`), or a blobless clone (`filter: blob:none`) when full history is slow. On PRs, give the tool an explicit base (`TURBO_SCM_BASE`, `--base`) because detached HEADs confuse inference.

---

## Pipeline Caching

Two independent layers, cache both:

1. **Package manager store**, keyed by lockfile hash (`setup-node` with `cache: pnpm` handles this on GitHub).
2. **Task output cache**: content-addressed by task inputs, shared across runs through a remote cache.

```yaml
- run: npx turbo run build test lint --affected
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

Remote cache options: a managed service, or a self-hosted server that implements the tool's cache API on object storage. Pin the server image by digest and give it a scoped, rotating token; a poisoned remote cache poisons every build that reads it, so restrict write access to trusted branches' CI.

Environment variables and files that affect task output must be declared as task inputs (`env`, `globalEnv`, `inputs` in `turbo.json`; `inputs` in Nx). An undeclared variable causes false cache hits.

```json
{
  "tasks": {
    "build": { "outputs": ["dist/**"], "env": ["NODE_ENV"] },
    "test": { "outputs": ["coverage/**"] }
  }
}
```

For distributed execution across CI agents, use the build tool's own facility (Nx Cloud agents, Bazel remote execution) and check its current documentation.

---

## Affected-Only Builds

### GitHub Actions

Graph-aware (preferred when a build tool exists):

```yaml
- uses: actions/checkout@<sha>  # vX.Y.Z
  with: { fetch-depth: 0 }
- run: npx turbo run build test lint --affected
  env:
    TURBO_SCM_BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

Path-based fan-out (no build tool): a detect job and a matrix over changed packages, shown in [github-actions.md](github-actions.md#monorepo-patterns). It ignores dependents, so include shared packages in each consumer's filter.

### GitLab CI

```yaml
build:api:
  script: pnpm --filter @org/api build
  rules:
    - changes:
        - packages/api/**/*
        - packages/shared/**/*     # rebuild when a dependency changes
        - pnpm-lock.yaml
```

For large monorepos use per-service child pipelines with `strategy: depend` ([gitlab-ci.md](gitlab-ci.md#parent-child-pipelines)).

---

## Per-Package Deployment

- **Independent deploy** (services): each service has its own build and deploy trigger, fired only when it or a dependency changes. Deploy the immutable artifact the CI built, by digest.
- **Coordinated release** (libraries and interdependent packages): version the workspace together with a changeset-style tool and publish in one run. Workflow, trusted publishing, and versioning rules: `release-engineering`.

---

## Docker Builds

Monorepo Dockerfiles (root build context, `turbo prune`, selective manifest copy, per-image cache scopes) are in `docker`: [dockerfile-patterns.md](../../docker/references/dockerfile-patterns.md#monorepo-builds). Pipeline side: build each image only when its package is affected, and give each image its own cache scope or ref.

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Build all packages on every push | Wasted compute, slow feedback | Affected-only detection |
| No remote task cache | Rebuild from scratch each run | Remote cache with trusted-branch writes |
| Path filters without shared packages or lockfile | Dependents silently skipped | Include them, or use graph-aware detection |
| Shallow clone with diff-based detection | Everything looks changed | `fetch-depth: 0` or blobless clone |
| Undeclared env vars in task inputs | False cache hits | Declare every variable that affects output |
| One image containing all services | Any change rebuilds everything | One Dockerfile and image per deployable |
| Deploy all services on every merge | Blast radius, coupling | Per-service deploy triggered by change detection |
| Hard-coded package list in a matrix | Drift | Generate the matrix from changed paths |
| `fail-fast` on a package matrix | One failure hides the others | `fail-fast: false` |
