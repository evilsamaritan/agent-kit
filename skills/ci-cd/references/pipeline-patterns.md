# CI/CD Pipeline Patterns

## Contents

- [Universal Pipeline Stages](#universal-pipeline-stages)
- [Caching Strategies](#caching-strategies)
- [Secrets Management in CI](#secrets-management-in-ci)
- [Branch and Trigger Strategy](#branch-and-trigger-strategy)
- [Monorepo Pipelines](#monorepo-pipelines)
- [Container Registry Workflow](#container-registry-workflow)
- [GitHub Actions Example](#github-actions-example)
- [GitLab CI Example](#gitlab-ci-example)
- [OIDC Workload Identity](#oidc-workload-identity)
- [Supply Chain Security in CI](#supply-chain-security-in-ci)
- [Pipeline Anti-Patterns](#pipeline-anti-patterns)

---

## Universal Pipeline Stages

These stages apply regardless of CI platform. Adapt syntax to your tool.

```
trigger (PR / push / tag)
  |
  v
+------------------+
| 1. Validate      |  lint, format check, type-check
+------------------+
  |
  v
+------------------+
| 2. Test          |  unit tests, integration tests
+------------------+
  |
  v
+------------------+
| 3. Build         |  compile, bundle, container image build
+------------------+
  |
  v
+------------------+
| 4. Scan          |  dependency audit, image vulnerability scan, SBOM
+------------------+
  |
  v
+------------------+
| 5. Push          |  push image to registry, upload artifacts
+------------------+
  |
  v
+------------------+
| 6. Deploy        |  deploy to target environment
+------------------+
  |
  v
+------------------+
| 7. Verify        |  health check, smoke test, rollback if failed
+------------------+
```

**Parallelization:** Stages 1 and 2 can run in parallel. Stage 3 depends on both passing. Stages 4 and 5 can overlap.

---

## Caching Strategies

### Dependency Cache

Cache the package manager's install cache directory, keyed by lockfile hash.

| Package Manager | Cache Path | Cache Key |
|----------------|-----------|-----------|
| npm | `~/.npm` | `hash(package-lock.json)` |
| yarn | `~/.yarn/cache` | `hash(yarn.lock)` |
| bun | `~/.bun/install/cache` | `hash(bun.lock)` |
| pnpm | `~/.pnpm-store` | `hash(pnpm-lock.yaml)` |
| pip | `~/.cache/pip` | `hash(requirements.txt)` |
| cargo | `~/.cargo/registry` | `hash(Cargo.lock)` |
| go | `~/go/pkg/mod` | `hash(go.sum)` |

### Container Layer Cache

Use registry-backed or CI-backed layer caching:

```
# BuildKit cache modes
--cache-from=type=registry,ref=registry.example.com/myapp:cache
--cache-to=type=registry,ref=registry.example.com/myapp:cache,mode=max

# GitHub Actions specific
--cache-from=type=gha
--cache-to=type=gha,mode=max
```

`mode=max` caches all layers (including intermediate build stages), not just the final image.

### Cache Invalidation

- **Dependency cache**: invalidated when lockfile changes. Falls back to restore key with OS prefix.
- **Layer cache**: invalidated when any layer input changes. Order Dockerfile layers for maximum cache hits.

---

## Secrets Management in CI

| Rule | Implementation |
|------|---------------|
| Store secrets in CI platform's secret store | GitHub Secrets, GitLab CI Variables (masked), Jenkins Credentials |
| Mask secrets in logs | Use CI platform's masking feature |
| Use OIDC for cloud auth | Avoid long-lived credentials; use workload identity federation |
| Rotate secrets regularly | Automate rotation, use short-lived tokens |
| Scope secrets to environments | Production secrets only available in production deploy jobs |
| Audit secret access | Review who can read/modify CI secrets |

Never:
- Hardcode secrets in pipeline YAML
- Echo or print secrets in CI logs
- Pass secrets as build args (visible in image history)
- Commit secrets to git (even encrypted, unless using sealed-secrets or sops)

---

## Branch and Trigger Strategy

| Event | Pipeline | Deploy Target |
|-------|----------|---------------|
| Pull request | Validate + Test + Build (no push) | None (or preview environment) |
| Push to main | Full pipeline | Staging |
| Tag (semver) | Full pipeline | Production |
| Manual trigger | Configurable | Any environment |

**Concurrency:** Cancel in-progress runs when new commits push to the same branch. Serialize deploy jobs to prevent race conditions.

---

## Monorepo Pipelines

### Path-Based Triggers

Only run pipeline steps for services with changed files:

```
# Trigger on changes to specific paths
paths:
  - apps/api/**
  - packages/shared/**
  - package-lock.json
```

### Workspace-Aware Commands

Run commands scoped to affected workspaces:

```bash
# npm workspaces
npm run --workspace=apps/api test

# bun workspaces
bun run --filter='apps/api' test
```

### Shared Pipeline Steps

Extract reusable pipeline logic (build container, push to registry) into shared actions/templates. Each service invokes the shared step with service-specific parameters.

---

## Container Registry Workflow

### Tagging Strategy

| Tag | Purpose | Example |
|-----|---------|---------|
| Git SHA (short) | Trace image to exact commit | `myapp:abc1234` |
| Semver | Release versions | `myapp:1.2.3` |
| Branch name | Development builds | `myapp:feature-x` |
| `latest` | Development convenience only | Never in production |

### Registry Options

| Registry | Best For |
|----------|----------|
| GitHub Container Registry (GHCR) | GitHub-hosted projects |
| Docker Hub | Open-source, public images |
| AWS ECR | AWS deployments |
| GCP Artifact Registry | GCP deployments |
| Self-hosted (Harbor) | Air-gapped environments, full control |

---

## GitHub Actions Example

Representative example using universal stages. Adapt to your platform.

```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run check-types

  test:
    runs-on: ubuntu-latest
    needs: []  # runs in parallel with validate
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test

  build-push:
    runs-on: ubuntu-latest
    needs: [validate, test]
    if: github.ref == 'refs/heads/main'
    permissions:
      packages: write
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
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## GitLab CI Example

Same universal stages, GitLab syntax:

```yaml
stages:
  - validate
  - test
  - build
  - deploy

variables:
  npm_config_cache: "$CI_PROJECT_DIR/.npm"

cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - .npm/
    - node_modules/

validate:
  stage: validate
  script:
    - npm ci
    - npm run lint
    - npm run check-types

test:
  stage: test
  script:
    - npm ci
    - npm test

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  only:
    - main
```

---

## OIDC Workload Identity

Replace long-lived credentials with short-lived tokens tied to repo/branch identity.

```
CI job starts
  |
  v (request OIDC token)
CI platform issues JWT (contains repo, branch, workflow info)
  |
  v (present JWT)
Cloud provider validates JWT, issues short-lived credentials
  |
  v (use credentials)
CI job accesses cloud resources (registry, deploy target, secrets)
```

| CI Platform | Cloud Provider | How |
|-------------|---------------|-----|
| GitHub Actions | AWS | `aws-actions/configure-aws-credentials` with OIDC |
| GitHub Actions | GCP | `google-github-actions/auth` with workload identity |
| GitHub Actions | Azure | `azure/login` with OIDC |
| GitLab CI | AWS/GCP/Azure | CI/CD OIDC token via `CI_JOB_JWT_V2` |

Benefits: no stored secrets to rotate, credentials scoped to specific repo/branch/workflow, audit trail of all access.

---

## Supply Chain Security in CI

### SBOM Generation

Generate Software Bill of Materials for every build:

```bash
# Generate SBOM from container image
syft myimage:tag -o spdx-json > sbom.json

# Generate SBOM from source
trivy fs --format spdx-json -o sbom.json .

# Scan SBOM for known vulnerabilities
grype sbom:sbom.json
```

### Image Signing

Sign artifacts to verify provenance and integrity:

```bash
# Keyless signing with Sigstore (uses OIDC identity)
cosign sign --yes ghcr.io/org/app:v1.0.0

# Verify signature before deploy
cosign verify ghcr.io/org/app:v1.0.0 \
  --certificate-identity=https://github.com/org/app/.github/workflows/ci.yml@refs/heads/main \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com
```

### SLSA Provenance Levels

| Level | Requirements | Effort |
|-------|-------------|--------|
| **SLSA 1** | Build process documented, provenance exists | Low (enable GitHub artifact attestations) |
| **SLSA 2** | Hosted build, signed provenance | Medium (use OIDC + cosign) |
| **SLSA 3** | Isolated build, non-falsifiable provenance | High (hermetic builds) |

Start with Level 1-2 -- achievable in weeks with modern CI platforms.

---

## Pipeline Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| No caching | Slow builds, wasted compute | Cache dependencies and layers |
| `latest` tag only | Cannot trace image to commit | Use git SHA or semver tags |
| Secrets in YAML | Visible to anyone with repo access | Use CI secret store |
| Long-lived cloud credentials | Leaked key = full access | OIDC workload identity federation |
| No concurrency control | Parallel deploys cause conflicts | Cancel or queue concurrent runs |
| Monolithic pipeline | Slow feedback, all-or-nothing | Parallel stages, path filters |
| No deploy gate | Broken code reaches production | Health check verification post-deploy |
| Skipping lint/types on PR | Errors caught late | Run validation on every PR |
| No SBOM or signing | Cannot verify what was deployed | SBOM generation + image signing in CI |
