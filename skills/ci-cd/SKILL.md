---
name: ci-cd
description: "Build or review delivery pipelines. Use for GitHub Actions, GitLab CI, build caches, matrix jobs, monorepos, artifacts, and CI secrets."
user-invocable: true
---

# CI/CD Pipelines

Patterns for designing and reviewing continuous integration and delivery pipelines. Focus on workflow shape, caching strategy, and correctness — not on vendor-specific lock-in.

## Scope and boundaries

**This skill covers:**
- Pipeline structure — stages, jobs, dependencies, parallelism
- Caching strategy — dependency caches, build caches, artifact caches
- Matrix builds — OS / version / runtime combinations
- Vendor specifics — GitHub Actions, GitLab CI, monorepo-aware CI
- PR-time vs merge-time vs release-time concerns
- CI security — secrets handling, token scope, third-party actions
- Build observability — timing, cache hit rate, flake rate

**This skill does not cover:**
- Release strategy (semver, canary, feature flags, rollback) → `release-engineering`; the pipeline only triggers it
- Dockerfile and image content → `docker`
- Kubernetes manifests and rollout mechanics → `kubernetes`
- Testing framework choice → `testing`
- Supply-chain controls and runtime secrets → `security`; the pipeline only wires them in

## Decision tree — pipeline shape

```
Single package, single test suite?
  linear pipeline: lint → test → build → publish (gated on main)

Monorepo with independent packages?
  selective pipeline: detect changed packages → fan out per package → merge results

Release artifacts (package, image, binary)?
  release workflow on tag or manual dispatch, reusing the artifact CI already built; never release from a PR
```

## Core pipeline structure

Stages, outermost first:

1. **Fast fail** — lint, format check, type check. Aim for about a minute.
2. **Unit tests** — per package or language, in parallel.
3. **Integration / e2e tests** — longer, sometimes flaky. Run on main and release, optional on PR.
4. **Build** — immutable artifacts (images, binaries, bundles), reproducible from the commit.
5. **Scan and publish** — SBOM and vulnerability gate, then push to the registry on main and tags only.
6. **Deploy** — consumes the published artifact by digest, as a gated stage or a separate workflow triggered by the artifact. CI never rebuilds for deploy; strategy and rollback belong to `release-engineering`.

**Rule:** fast-fail stages gate slower stages. Order cheap-to-expensive: lint, type-check, test, build. Install dependencies from the lockfile with the package manager's frozen mode (a changed lockfile fails the job instead of being rewritten); flags per manager are in [pipeline-patterns.md](references/pipeline-patterns.md#frozen-installs). Pipeline stages and a worked GitLab example are in the same file.

## Caching — what to cache

| cache | key |
|-------|-----|
| package manager download cache | lockfile hash |
| build and task outputs | content hash of task inputs per package |
| container layers | Dockerfile + COPY inputs |

**Rules:**
- Key by lockfile hash, not branch name, so branches share the cache.
- Include OS, architecture, and runtime version in the key; never share across them.
- Restore is best-effort: a miss means a slower build, never a broken one.
- Track hit rate and investigate drops.

## Matrix builds

Common axes: OS, runtime version (the supported range of the language), architecture.

- **Default:** test on the *minimum supported* version and the *latest* version. Middle versions optional.
- **Fail-fast off** for release-critical matrices — you want to see all failures, not just the first.
- **Quadratic explosion** — a 3×3×3 matrix is 27 jobs. Reserve large matrices for release pipelines.

## Monorepo CI

1. **Change detection** — graph-aware affected detection (the build tool's `affected` command), not bare path filters, when packages depend on each other. Share task outputs through a remote task cache.
2. **Selective runs** — affected packages plus their dependents.
3. **Shared steps** — setup, lint config, and cache restore in composite actions or includes.
4. **Parallelism budget** — control concurrency to fit runner capacity.

Details and per-platform examples: [monorepo-ci.md](references/monorepo-ci.md).

## PR vs main vs release

| trigger | runs |
|---------|------|
| PR opened/updated | fast-fail + unit tests + affected build, no publish |
| merge to main | PR checks + integration + build, scan, and publish the immutable artifact |
| tag / release workflow | promote the main artifact; publish packages; release notes |

Don't run the release pipeline on every push. Don't run e2e on every PR unless the runner budget allows.

## Security — must-haves

- **Prefer OIDC federation over stored cloud keys** and long-lived registry tokens.
- **Never interpolate untrusted event fields into shell** (PR title, branch name, issue body); pass them via environment variables. Avoid `pull_request_target` with a checkout of PR code.
- **Scope tokens minimally** — explicit per-job permissions; the default is too broad.
- **Pin third-party actions and images** by full SHA or digest, and keep pins current with an update bot.
- **Install with a frozen lockfile** so CI builds exactly what was reviewed.
- **Wire scanning as gates, policy stays in `security`**: SAST on every push, dependency and secret scanning on every push, DAST against a deployed review or staging environment; see [pipeline-patterns.md](references/pipeline-patterns.md#supply-chain-in-ci).
- **Never print secrets.** Mask at the runner level and scrub custom logging.
- **No secrets in fork PRs.** Do not override the default.
- **Lint pipelines** with a workflow linter and a workflow security scanner in CI.
- **Signed commits or tags** and signature verification in the release gate where release-critical.

## Observability — what to watch

- **Pipeline duration P50/P95** — regressions are a dev-experience tax.
- **Cache hit rate per cache** — drops need investigation.
- **Flake rate per test job** — fix flaky tests rather than retrying.
- **Queue time** — long waits mean scale up or slice smaller.

## Context adaptation

**Implementer:** start with the simplest linear pipeline; add caching and parallelism when wall-clock hurts.

**Reviewer:** check token scopes, unpinned actions, untrusted input in scripts, missing PR-vs-main distinction, cache keys.

**Operator:** pipeline breakage is on-call; set a duration and flake target and track it like a service.

## Anti-patterns

- **One giant job** — no parallelism, one failure = restart everything.
- **Retry on flake as a policy** — retries mask real flake causes; instead, identify and fix the flaky test.
- **Unpinned actions** — `uses: some/action@main` is a supply-chain vulnerability.
- **Secret scope creep** — one `CI_TOKEN` with god permissions used across all jobs.
- **PR = release pipeline** — running release steps on every PR; noisy + slow.
- **No PR-level timing budget** — PRs can take 30 min with no complaint, slowing every developer.

## Related Knowledge

- `release-engineering` — versioning, rollout strategy, rollback, trusted publishing
- `docker` — Dockerfiles, image builds, monorepo images
- `kubernetes` — deploy targets
- `security` — supply chain, SBOM, signing, secrets
- `testing` — what runs in which stage
- `reliability` — SLOs for the delivery path

## References

- [pipeline-patterns.md](references/pipeline-patterns.md) — vendor-neutral stages, caching, secrets, OIDC, supply chain in CI
- [github-actions.md](references/github-actions.md) — GitHub Actions specifics
- [gitlab-ci.md](references/gitlab-ci.md) — GitLab CI specifics
- [monorepo-ci.md](references/monorepo-ci.md) — change detection, remote task caches, per-package deploy
