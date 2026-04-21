---
name: ci-cd
description: CI/CD pipeline design — workflow structure, caching, matrix builds, GitHub Actions, GitLab CI, monorepo pipelines, artifact handling, secrets management in CI. Use when writing or reviewing pipelines, optimizing build times, setting up monorepo CI, handling PR checks, or auditing CI security. Do NOT use for release strategy (use release-engineering), container image building (use docker), or deployment orchestration (use kubernetes).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
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
- Release strategy (semver, canary, feature flags) → `release-engineering`
- Docker image building → `docker`
- Kubernetes deployment → `kubernetes`
- Testing framework choice → `testing`
- Secrets at runtime → `security`

## Decision tree — pipeline shape

```
Single package, single test suite?
  linear pipeline: lint → test → build → publish (gated on main)

Monorepo with independent packages?
  selective pipeline: detect changed packages → fan out per package → merge results

Release-triggered artifacts (npm / docker image / binary)?
  separate release pipeline on tag/workflow_dispatch; never auto-release from PR
```

## Core pipeline structure

Stages, outermost first:

1. **Fast fail** — lint, format check, type check. Runs in under a minute.
2. **Unit tests** — per package or per language. Parallelizable.
3. **Integration / e2e tests** — longer, sometimes flaky. Run on main + release, optional on PR.
4. **Build** — artifacts (container images, binaries, bundles). Reproducible.
5. **Publish** — push to registry / artifact store. Gated on branch.
6. **Deploy** — separate pipeline, not CI. See `release-engineering`.

**Rule:** fast-fail stages gate slower stages. No point running e2e tests if lint is broken.

## Caching — what to cache

| cache | hit rate target | key |
|-------|-----------------|-----|
| package manager cache (npm/pnpm/cargo/go) | > 90% | lockfile hash |
| build output (compiled artifacts) | > 70% | source hash per package |
| test cache (if supported by runner) | > 50% | source + test hash |
| container layer cache | varies | Dockerfile + COPY targets |

**Rules:**
- Key cache by lockfile hash, not branch name — shared across branches.
- Never cache build outputs across different OS / arch / runtime versions.
- Cache restore is best-effort; never require it. A cache miss = slower build, not broken build.

## Matrix builds

Common axes: OS (linux/macos/windows), runtime version (node 20/22, python 3.11/3.12), arch (x64/arm64).

- **Default:** test on the *minimum supported* version and the *latest* version. Middle versions optional.
- **Fail-fast off** for release-critical matrices — you want to see all failures, not just the first.
- **Quadratic explosion** — a 3×3×3 matrix is 27 jobs. Reserve large matrices for release pipelines.

## Monorepo CI

Four axes:

1. **Change detection** — which packages are affected by the diff? `turbo run --filter=[HEAD^]` / `nx affected` / custom.
2. **Selective runs** — only run checks for affected packages + their reverse dependencies.
3. **Shared steps** — lint config, setup, cache restore — factored into composite actions / includes.
4. **Parallelism budget** — don't run 30 jobs on a 5-minute-timeout runner cluster; control concurrency.

## PR vs main vs release

| trigger | runs |
|---------|------|
| PR opened/updated | fast-fail + unit tests + changed-package build |
| merge to main | everything above + integration + container build (no publish) |
| tag / release workflow | everything above + publish + release notes |

Don't run the release pipeline on every push. Don't run e2e on every PR unless the team has the runner budget.

## Security — must-haves

- **Scope tokens minimally.** `GITHUB_TOKEN` → `permissions:` block per job. Default is too broad.
- **Pin third-party actions by SHA**, not by version tag (`@v3`). Tags can be moved.
- **Never print secrets.** Mask at the runner level; also scrub in custom logging.
- **No secrets in fork PRs.** PRs from forks don't get access to secrets by default; don't override this casually.
- **Signed commits / tags if release-critical.** Require signature verification in the release gate.

## Observability — what to watch

- **Pipeline duration P50/P95** — regressions are a dev-experience tax.
- **Cache hit rate per cache.** Dropping = investigate.
- **Flake rate per test job.** Flaky test > flaky build.
- **Queue time** — if jobs wait > 5 min for a runner, scale up or slice smaller.

## Context adaptation

**As implementer:** start with the simplest linear pipeline; add caching and parallelism when wall-clock hurts. Don't pre-optimize.

**As reviewer:** check for over-broad token scopes, unpinned third-party actions, missing PR-vs-main distinction, missing cache key specificity.

**As operator:** pipeline breakage is your on-call problem. SLO the pipeline (e.g. "< 10 min p95, < 5% flake rate") and manage it like any service.

**As architect:** pipeline shape mirrors architecture. Microservice per package → fan-out CI. Shared lib with reverse deps → topological CI.

## Anti-patterns

- **One giant job** — no parallelism, one failure = restart everything.
- **Retry on flake as a policy** — retries mask real flake causes; instead, identify and fix the flaky test.
- **Unpinned actions** — `uses: some/action@main` is a supply-chain vulnerability.
- **Secret scope creep** — one `CI_TOKEN` with god permissions used across all jobs.
- **PR = release pipeline** — running release steps on every PR; noisy + slow.
- **No PR-level timing budget** — PRs can take 30 min with no complaint, slowing every developer.

## Related Knowledge

- `release-engineering` — semver, feature flags, rollout strategy
- `docker` — image building and caching
- `kubernetes` — deploy targets
- `security` — supply chain, SBOM, signing
- `testing` — what runs in which stage

## References

- [pipeline-patterns.md](references/pipeline-patterns.md) — structural patterns for pipelines
- [github-actions.md](references/github-actions.md) — GitHub Actions specifics
- [gitlab-ci.md](references/gitlab-ci.md) — GitLab CI specifics
- [monorepo-ci.md](references/monorepo-ci.md) — change detection, selective runs, shared steps
