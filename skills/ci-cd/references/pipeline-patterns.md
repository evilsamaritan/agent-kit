# CI/CD Pipeline Patterns

Vendor-neutral home for pipeline stages, caching, secrets, OIDC, and supply chain in CI. Platform syntax: [github-actions.md](github-actions.md), [gitlab-ci.md](gitlab-ci.md). Monorepos: [monorepo-ci.md](monorepo-ci.md).

## Contents

- [Universal Pipeline Stages](#universal-pipeline-stages)
- [Frozen Installs](#frozen-installs)
- [Caching Strategies](#caching-strategies)
- [Secrets Management in CI](#secrets-management-in-ci)
- [OIDC Workload Identity](#oidc-workload-identity)
- [Branch and Trigger Strategy](#branch-and-trigger-strategy)
- [Artifacts and Registry Workflow](#artifacts-and-registry-workflow)
- [GitLab CI Example](#gitlab-ci-example)
- [Supply Chain in CI](#supply-chain-in-ci)
- [Pipeline Anti-Patterns](#pipeline-anti-patterns)

---

## Universal Pipeline Stages

```
trigger (PR / push / tag)
  → 1. Validate   lint, format, type-check
  → 2. Test       unit, then integration
  → 3. Build      compile, bundle, container image
  → 4. Scan       dependency audit, image scan, SBOM
  → 5. Publish    push immutable artifact to registry (main and tags only)
  → 6. Deploy     gated stage or separate workflow triggered by the artifact
  → 7. Verify     smoke test and health check; rollback on failure
```

Stages 1 and 2 can run in parallel; build needs both; scan and publish can overlap.

**Stance.** CI builds, tests, scans, and publishes immutable, uniquely tagged artifacts on main. Deployment consumes that artifact (never rebuilds from source) as a gated stage of the pipeline or as a separate workflow triggered by the artifact. Strategy (rolling, canary, blue-green), rollback, and feature flags belong to `release-engineering`; the pipeline only triggers them and reports the result.

---

## Frozen Installs

Install from the lockfile and fail when it is out of date, so the job never resolves new versions.

| Manager | Command |
|---------|---------|
| npm | `npm ci` |
| pnpm | `pnpm install --frozen-lockfile` |
| yarn (Berry) | `yarn install --immutable` |
| yarn (Classic) | `yarn install --frozen-lockfile` |
| bun | `bun install --frozen-lockfile` |
| pip | `pip install --require-hashes -r requirements.txt` (hash-pinned file) |
| uv | `uv sync --locked` |
| cargo | `cargo build --locked` |
| go | `go build -mod=readonly` (default) |

Order the validate stage cheap to expensive (lint, type-check, then tests, then build) and run the install once per job, restoring the download cache.

---

## Caching Strategies

### Dependency cache

Cache the package manager's download cache (not `node_modules` or virtualenvs), keyed by the lockfile hash, with a prefix fallback.

| Package manager | Cache path | Key input |
|-----------------|-----------|-----------|
| npm | `~/.npm` | `package-lock.json` |
| yarn | `~/.yarn/cache` | `yarn.lock` |
| pnpm | store path from `pnpm store path` | `pnpm-lock.yaml` |
| bun | `~/.bun/install/cache` | `bun.lock` |
| pip | `~/.cache/pip` | requirements or lock file |
| cargo | `~/.cargo/registry` | `Cargo.lock` |
| go | `~/go/pkg/mod` | `go.sum` |

### Container layer cache

```
--cache-from=type=registry,ref=registry.example.com/myapp:buildcache
--cache-to=type=registry,ref=registry.example.com/myapp:buildcache,mode=max
```

CI-backed caches (`type=gha`) are simpler but ephemeral and size-limited; registry caches persist across runners. `mode=max` includes intermediate stages. Dockerfile layer ordering: `docker`.

### Rules

- Key by lockfile hash, not branch name, so branches share caches; add a branch prefix only as a fallback tier.
- Never share caches across OS, architecture, or runtime versions: put them in the key.
- A restore is best-effort: a miss costs time, never correctness.
- Never cache credentials. Restrict cache writes from untrusted (fork) builds.
- Measure hit rate and investigate drops; do not set a fixed target.

---

## Secrets Management in CI

| Rule | Implementation |
|------|---------------|
| Use the platform secret store | Platform secrets or variables, masked; protected where supported |
| Prefer federation over stored keys | [OIDC](#oidc-workload-identity) for cloud and registry access |
| Scope per environment | Production secrets only reach production deploy jobs |
| Scope tokens per job | Least-privilege permissions on the job token |
| Audit | Review who can read or change CI secrets and who can edit workflows |

Never hardcode secrets in pipeline files, echo them, pass them as build args (visible in image history), or expose them to fork PRs. Runtime secret handling: `security`.

---

## OIDC Workload Identity

Replace long-lived credentials with short-lived tokens bound to repository, ref, and environment.

```
CI job requests OIDC token → CI platform issues a signed JWT (repo, ref, environment, workflow)
  → job presents the JWT to the cloud provider or registry
  → provider validates the issuer, audience, and subject claims, returns short-lived credentials
```

The trust policy decides the security: restrict the subject claim to the repository and the ref or environment allowed to deploy; a wildcard subject lets any workflow in the organisation assume the role. The audience must match what the provider expects.

| Platform | How the job gets a token |
|----------|--------------------------|
| GitHub Actions | `permissions: id-token: write`; provider actions request the token |
| GitLab CI | `id_tokens:` keyword with an `aud`; the old `CI_JOB_JWT` variables are removed |

Package registries with trusted publishing (npm, PyPI, crates.io) use the same mechanism: see `release-engineering`.

---

## Branch and Trigger Strategy

| Event | Pipeline | Publish / deploy |
|-------|----------|------------------|
| Pull request | Validate, test, build (no push) | None, or a preview environment |
| Push to main | Full pipeline plus integration tests | Publish artifact; deploy to staging |
| Tag (semver) or release workflow | Same artifact, promoted | Production through a gate |
| Manual | Configurable | Any environment, with approval |

Cancel superseded CI runs on the same ref. Serialize deploys per environment and never cancel one mid-flight.

---

## Artifacts and Registry Workflow

| Tag | Purpose |
|-----|---------|
| Git SHA | Trace an artifact to its commit; the immutable reference |
| Semver | Release versions |
| Branch name | Development builds only |
| `latest` | Convenience only; never deployed |

Deploy by digest. Registry choice follows the platform you deploy on; the pipeline needs a registry with immutable-tag or digest support, access control, and vulnerability scanning on push.

---

## GitLab CI Example

Universal stages in GitLab syntax: `rules:` instead of `only:`, pinned images, a lockfile-keyed cache of the download directory only, and OIDC through `id_tokens`.

```yaml
stages: [validate, test, build]

variables:
  npm_config_cache: "$CI_PROJECT_DIR/.npm"

default:
  image: node:24-alpine           # example: current supported release, digest-pinned in production
  cache:
    key:
      files: [package-lock.json]
    paths: [.npm/]

validate:
  stage: validate
  script: [npm ci, npm run lint, npm run check-types]

test:
  stage: test
  script: [npm ci, npm test]

build:
  stage: build
  image: docker:<version>
  services:
    - docker:<version>-dind
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  id_tokens:
    CLOUD_ID_TOKEN:
      aud: https://cloud.example.com   # audience the provider expects
  script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login -u "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"
    - docker build -t "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA" .
    - docker push "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
    # a deploy job's cloud CLI exchanges $CLOUD_ID_TOKEN for short-lived credentials; no stored key
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

For GitHub Actions the equivalent pipeline is in [github-actions.md](github-actions.md).

---

## Supply Chain in CI

Controls and policy are owned by `security`; image details by `docker`. The pipeline wires them in:

- **SBOM and scan**: generate an SBOM for each build artifact (`syft`, `trivy`, or `docker buildx --sbom`) and scan it (`grype`, `trivy`) as a gate.
- **Signing**: sign by digest, keyless where the platform supports OIDC (`cosign sign`); verify before deploy with the expected workflow identity and issuer.
- **Provenance**: attach build provenance (GitHub artifact attestations, `--provenance=mode=max`).
- **Scanning gates**: run SAST, dependency scanning, and secret scanning on every push, and DAST against a deployed review or staging environment; the pipeline fails on the severity threshold that `security` sets, and `security` owns triage and exceptions.
- **Pinning**: pin actions, images, and tool versions; keep pins current with an update bot.

SLSA v1.0 build track, in short: **L1** provenance exists; **L2** built on a hosted build platform with signed provenance; **L3** the build runs on a hardened platform where runs are isolated and the provenance cannot be forged by the build's own steps (on GitHub, a reusable-workflow build that callers cannot alter). Start at L2; claim a level only after verifying the provenance and the isolation.

---

## Pipeline Anti-Patterns

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No caching | Slow builds | Cache dependencies and layers |
| `latest` tag only | Cannot trace image to commit | SHA or semver tags; deploy by digest |
| Secrets in YAML | Visible to anyone with repo access | Platform secret store or federation |
| Long-lived cloud keys | A leaked key is lasting access | OIDC federation |
| No concurrency control | Parallel deploys conflict | Cancel superseded CI runs; queue deploys |
| Monolithic pipeline | Slow feedback, all-or-nothing | Parallel jobs, path or graph filters |
| Rebuilding at deploy time | The deployed artifact was never tested | Deploy the CI-built digest |
| No verify step after deploy | Broken release stays live | Smoke test and automatic rollback trigger |
| Skipping validation on PRs | Errors caught late | Validate every PR |
| No SBOM or signing | Cannot verify what was deployed | Generate, sign, verify |
