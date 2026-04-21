# Monorepo CI/CD Patterns

## Contents

- [Core Challenge](#core-challenge)
- [Affected Package Detection](#affected-package-detection)
- [Pipeline Caching](#pipeline-caching)
- [Affected-Only Builds](#affected-only-builds)
- [Per-Package Deployment](#per-package-deployment)
- [Docker Builds in Monorepo](#docker-builds-in-monorepo)
- [CI Performance Optimization](#ci-performance-optimization)
- [Anti-Patterns](#anti-patterns)

---

## Core Challenge

Monorepos contain many packages. Building everything on every change wastes compute and slows feedback. The goal: build and deploy only what changed, and only rebuild downstream packages affected by that change.

Two sub-problems:

1. **Detection** -- which packages changed, including transitive dependents
2. **Execution** -- run tasks only for affected packages, cache results for unchanged ones

---

## Affected Package Detection

### Git-based detection (no tool dependency)

```bash
# Files changed between feature branch and main
git diff --name-only origin/main...HEAD

# Map to packages by directory prefix
git diff --name-only origin/main...HEAD | cut -d/ -f1-2 | sort -u
```

Limitation: no awareness of the internal dependency graph. A change to `packages/shared` must be manually traced to all consumers.

### Tool-based detection

| Tool | How it detects | Graph awareness | CI dependency |
|------|----------------|-----------------|---------------|
| `turbo run --filter=...[origin/main]` | Workspace graph + file hashes | Yes (full graph) | Turborepo installed |
| `turbo run --affected` | Alias for `--filter=...[origin/main]` | Yes | Turborepo installed |
| `nx affected` | Project graph + git diff | Yes (full graph) | Nx installed |
| `dorny/paths-filter` | Path glob matching on changed files | No | GitHub Actions only |
| `tj-actions/changed-files` | File change detection | No | Any CI |

**Decision:**
- Use Turborepo or Nx if you already have them -- graph awareness catches transitive changes
- Use `dorny/paths-filter` or `tj-actions/changed-files` for simple path-based filtering without a build tool

### Ensuring full git history in CI

Shallow clones break git-diff based detection. All changed packages appear affected when history is missing.

```yaml
# GitHub Actions
- uses: actions/checkout@v4
  with:
    fetch-depth: 0           # full history; required for --filter=[origin/main]
```

For large repos where full history is slow:

```yaml
- uses: actions/checkout@v4
  with:
    filter: blob:none        # blobless clone: all commits, no file contents
    fetch-depth: 0
```

---

## Pipeline Caching

### Turborepo remote cache

Turborepo caches task outputs by a hash of task inputs (source files, env vars, dependencies). On a cache hit, the task is skipped entirely and outputs are restored from cache.

**Vercel Remote Cache (managed)**

```bash
# Authenticate once
npx turbo login
npx turbo link

# In CI: set environment variables
TURBO_TOKEN=<token>
TURBO_TEAM=<team-slug>
```

```yaml
# GitHub Actions
- name: Build with remote cache
  run: npx turbo run build test lint
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

**Self-hosted remote cache**

`ducktors/turborepo-remote-cache` is an open-source server compatible with the Turborepo cache API. Supports S3, GCS, Azure Blob, and local filesystem as storage backends.

```yaml
# GitHub Actions -- start self-hosted cache server as a service
services:
  turbo-cache:
    image: ducktors/turborepo-remote-cache:latest
    env:
      STORAGE_PROVIDER: s3
      S3_ACCESS_KEY: ${{ secrets.S3_ACCESS_KEY }}
      S3_SECRET_KEY: ${{ secrets.S3_SECRET_KEY }}
      S3_BUCKET: turbo-cache
```

Then point Turborepo at it:

```bash
TURBO_API=http://turbo-cache:3000
TURBO_TOKEN=<shared-secret>
TURBO_TEAM=team1
```

Key `turbo.json` fields that affect cache key:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "outputs": ["dist/**", ".next/**"],
      "env": ["NODE_ENV", "DATABASE_URL"]
    },
    "test": {
      "outputs": ["coverage/**"]
    }
  }
}
```

Environment variables listed under `"env"` are included in the cache key. Omitting a variable that affects build output causes false cache hits.

### Nx Cloud

Nx Cloud provides remote cache and Distributed Task Execution (DTE). DTE distributes tasks from a single `nx run-many` command across multiple CI agents.

```yaml
# GitHub Actions with Nx Cloud DTE
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js"
      - run: npx nx affected --target=build,test,lint --parallel=3
      - run: npx nx-cloud complete-ci-run
    env:
      NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
```

For self-managed distribution (no Nx Cloud):

```yaml
env:
  NX_CLOUD_DISTRIBUTED_EXECUTION: true
  NX_BRANCH: ${{ github.ref_name }}
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
```

### Package manager cache

Always cache the package manager store separately from task outputs. These are two independent cache layers.

```yaml
# pnpm
- uses: actions/setup-node@v4
  with:
    node-version: 22
- uses: pnpm/action-setup@v4
  with:
    version: 9
- uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: pnpm-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: pnpm-
- run: pnpm install --frozen-lockfile
```

```yaml
# Bun
- uses: oven-sh/setup-bun@v2
- uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: bun-${{ hashFiles('bun.lockb') }}
    restore-keys: bun-
- run: bun install --frozen-lockfile
```

---

## Affected-Only Builds

### GitHub Actions -- path filter to matrix

Detect which packages changed, then fan out to a matrix job per changed package.

```yaml
jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.filter.outputs.changes }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api: 'packages/api/**'
            web: 'packages/web/**'
            shared: 'packages/shared/**'
          # outputs a JSON array: e.g. ["api","shared"]

  build:
    needs: detect-changes
    if: needs.detect-changes.outputs.packages != '[]'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        package: ${{ fromJSON(needs.detect-changes.outputs.packages) }}
    steps:
      - uses: actions/checkout@v4
      - run: pnpm --filter @org/${{ matrix.package }} run build
```

Limitation: `dorny/paths-filter` has no graph awareness. A change to `packages/shared` will not automatically trigger `packages/api` even if `api` depends on `shared`. Use Turborepo or Nx `--filter` syntax instead if transitive detection is needed.

### GitHub Actions -- Turborepo affected filter

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- run: npx turbo run build test lint --filter=...[origin/main]
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

The `...[origin/main]` syntax means: packages changed since `origin/main`, plus all packages that depend on them (the `...` prefix walks dependents upstream).

For PRs, set `TURBO_SCM_BASE` and `TURBO_SCM_HEAD` explicitly to avoid detached HEAD issues:

```yaml
- run: npx turbo run build test --affected
  env:
    TURBO_SCM_BASE: origin/main
    TURBO_SCM_HEAD: ${{ github.sha }}
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

### GitHub Actions -- Nx affected

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- run: npx nx affected --target=build,test,lint --base=origin/main --head=HEAD --parallel=3
  env:
    NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
```

### GitLab CI -- rules:changes per package

```yaml
# .gitlab-ci.yml

build:api:
  script:
    - pnpm --filter @org/api build
  rules:
    - changes:
        - packages/api/**/*
        - packages/shared/**/*   # rebuild api if shared changes

build:web:
  script:
    - pnpm --filter @org/web build
  rules:
    - changes:
        - packages/web/**/*
        - packages/shared/**/*

build:shared:
  script:
    - pnpm --filter @org/shared build
  rules:
    - changes:
        - packages/shared/**/*
```

### GitLab CI -- child pipelines per package

For larger monorepos, use parent-child pipelines to keep each package's config isolated.

```yaml
# .gitlab-ci.yml (parent)
trigger:api:
  trigger:
    include: packages/api/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes:
        - packages/api/**/*
        - packages/shared/**/*

trigger:web:
  trigger:
    include: packages/web/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes:
        - packages/web/**/*
        - packages/shared/**/*
```

```yaml
# packages/api/.gitlab-ci.yml (child)
stages: [build, test, push]

build:
  stage: build
  script:
    - pnpm --filter @org/api build

test:
  stage: test
  script:
    - pnpm --filter @org/api test
```

Child pipelines inherit CI variables from the parent but run independently. `strategy: depend` makes the parent job fail if the child pipeline fails.

### GitLab CI -- Turborepo affected

```yaml
build:affected:
  script:
    - git fetch origin main
    - npx turbo run build test lint --affected
  variables:
    TURBO_SCM_BASE: origin/main
    TURBO_SCM_HEAD: $CI_COMMIT_SHA
    TURBO_TOKEN: $TURBO_TOKEN
    TURBO_TEAM: $TURBO_TEAM
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## Per-Package Deployment

### Independent deploy (recommended for microservices)

Each package has its own deploy pipeline, triggered only when that package (or its dependencies) changes. Packages version and deploy independently.

```yaml
# GitHub Actions
deploy:api:
  needs: [build]
  if: contains(needs.detect-changes.outputs.packages, 'api')
  runs-on: ubuntu-latest
  environment: production
  steps:
    - name: Deploy api
      run: ./scripts/deploy.sh api ${{ github.sha }}
```

### Coordinated release (libraries and interdependent packages)

All changed packages release together in a single pipeline run. Use Changesets for version bumping across the workspace.

```yaml
# Changesets release workflow (GitHub Actions)
release:
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: pnpm install --frozen-lockfile
    - uses: changesets/action@v1
      with:
        publish: pnpm changeset publish
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

See the `release-engineering` skill for full Changesets workflow.

---

## Docker Builds in Monorepo

### Problem

`COPY . .` in a monorepo Dockerfile copies the entire repository. This:
- Inflates build context (all packages, even unrelated ones)
- Invalidates layer cache on any file change anywhere in the repo
- Installs all workspace dependencies, not just the ones needed

### turbo prune -- minimal Docker context

`turbo prune` generates a pruned workspace containing only the packages and dependencies needed for a specific target. This produces a minimal, self-contained subdirectory safe to pass as Docker build context.

```bash
# Generate pruned workspace for @org/api
npx turbo prune @org/api --docker

# Output structure:
# out/
#   json/         -- package.json files only (for install layer)
#   full/         -- full source of only the needed packages
#   pnpm-lock.yaml
```

Multi-stage Dockerfile using `turbo prune`:

```dockerfile
FROM node:22-slim AS base
RUN npm install -g pnpm@9 turbo@2

# Stage 1: Prune workspace to only what api needs
FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @org/api --docker

# Stage 2: Install dependencies (cached layer -- only re-runs when lockfile changes)
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Stage 3: Build
FROM installer AS builder
WORKDIR /app
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@org/api

# Stage 4: Production image
FROM node:22-slim AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json .
RUN pnpm install --prod --frozen-lockfile
USER appuser
CMD ["node", "dist/index.js"]
```

### Selective COPY without turbo prune

For workspaces without Turborepo, copy only the required package.json files first (install layer), then copy source.

```dockerfile
FROM node:22-slim AS base
RUN npm install -g pnpm@9
WORKDIR /app

# Install layer -- only invalidated when package.json or lockfile changes
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
RUN pnpm install --frozen-lockfile

# Build layer
FROM deps AS builder
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/
RUN pnpm --filter @org/shared build
RUN pnpm --filter @org/api build

# Production image
FROM node:22-slim AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
COPY --from=builder /app/packages/api/dist ./dist
USER appuser
CMD ["node", "dist/index.js"]
```

### BuildKit cache mounts with pnpm store

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-slim AS deps
RUN npm install -g pnpm@9
WORKDIR /app
COPY pnpm-lock.yaml .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm fetch --frozen-lockfile
```

The `--mount=type=cache` persists the pnpm store across builds on the same runner, avoiding repeated downloads.

### GitHub Actions -- Docker build for a monorepo package

```yaml
build-image:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v3
    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - uses: docker/build-push-action@v6
      with:
        context: .
        file: packages/api/Dockerfile
        push: true
        tags: ghcr.io/${{ github.repository }}/api:${{ github.sha }}
        cache-from: type=gha,scope=api
        cache-to: type=gha,mode=max,scope=api
```

Use separate `scope` values per package so each package's layer cache does not collide with others.

---

## CI Performance Optimization

| Technique | Typical impact | Mechanism |
|-----------|----------------|-----------|
| Turborepo/Nx remote cache | 50-90% reduction in task time | Skip tasks with unchanged inputs |
| Affected-only builds | Skip N-M packages | `--filter`, `--affected`, `rules:changes` |
| Parallel matrix jobs | Linear speedup with job count | `strategy.matrix`, DTE |
| Package manager cache | Faster install step | PM store cached in CI cache |
| Docker layer cache (GHA cache) | Faster image builds | `cache-from: type=gha` |
| BuildKit cache mounts | Persistent pnpm/npm store in Dockerfile | `--mount=type=cache` |
| Blobless clone | Faster checkout with full history | `filter: blob:none, fetch-depth: 0` |

### Cache key design

Good cache keys restore on hit but never serve stale data:

```
# Package manager -- invalidate only when lockfile changes
key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
restore-keys: pnpm-${{ runner.os }}-

# Turborepo task cache -- managed by Turbo itself (content-addressed)
# No manual key needed; controlled via turbo.json outputs + env[]
```

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Build all packages on every push | Wasted compute, slow CI feedback | Affected-only detection via `--filter` or path rules |
| No remote cache | Rebuild from scratch on every run | Turborepo or Nx remote cache |
| `COPY . .` in monorepo Dockerfile | Huge context, cache invalidated by any change | `turbo prune` or selective package.json COPY |
| No graph awareness for change detection | Miss transitive dependents of changed packages | Use Turborepo `...filter` or Nx affected |
| Shallow clone for affected builds | All packages show as changed | `fetch-depth: 0` or blobless clone |
| One Docker image containing all services | Any package change rebuilds everything | One Dockerfile per deployable service |
| Omit env vars from turbo.json `env[]` | Cache hits despite changed config | Declare all environment variables that affect task output |
| Deploy all services on every merge | Unnecessary blast radius, coupling | Independent per-service deploy triggered by change detection |
| Hard-coded package paths in CI matrix | Maintenance burden, drift | Generate matrix dynamically from changed file paths |
| No `strategy.fail-fast: false` on matrix | One failed package cancels all others | Set `fail-fast: false` so other packages complete |
