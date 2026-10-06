# GitHub Actions

GitHub-specific syntax and controls. Vendor-neutral concepts (stages, caching, OIDC flow, secrets, SLSA) live in [pipeline-patterns.md](pipeline-patterns.md); monorepo concepts in [monorepo-ci.md](monorepo-ci.md).

Snippets use `<sha> # vX.Y.Z` placeholders for action pins and a fixed runner label (`ubuntu-24.04`, replace with the current image your org standardises on). Resolve real pins as described in [Action Pinning](#action-pinning). Runtime versions (`node-version: 24`) are examples: use a currently supported release.

## Contents

- [Workflow Basics](#workflow-basics)
- [Reusable Workflows and Composite Actions](#reusable-workflows-and-composite-actions)
- [Security](#security)
- [OIDC to Cloud Providers](#oidc-to-cloud-providers)
- [Action Pinning](#action-pinning)
- [Caching](#caching)
- [Docker Builds](#docker-builds)
- [Monorepo Patterns](#monorepo-patterns)
- [Environments](#environments)
- [Concurrency Control](#concurrency-control)
- [Matrix Strategies](#matrix-strategies)
- [Runners](#runners)
- [Artifacts and Outputs](#artifacts-and-outputs)
- [Attestations](#attestations)
- [Security Scanning](#security-scanning)
- [Anti-Patterns](#anti-patterns)

---

## Workflow Basics

### Trigger events (`on:`)

```yaml
on:
  push:
    branches: [main]
    paths: ["src/**", "package.json"]
  pull_request:
    branches: [main]
    paths-ignore: ["docs/**", "*.md"]
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
        default: staging
  schedule:
    - cron: "0 2 * * 1"          # Mondays 02:00 UTC
  workflow_call:                 # callable from other workflows
    inputs:
      image-tag:
        required: true
        type: string
```

`paths:` and `paths-ignore:` filter the whole workflow trigger, not individual jobs. Job-level filtering: [Monorepo Patterns](#monorepo-patterns). A required status check from a workflow that is skipped by path filters stays pending; use a final "all checks" job as the required check.

### Job structure

```yaml
permissions:
  contents: read                 # workflow default; widen per job

jobs:
  build:
    runs-on: ubuntu-24.04
    timeout-minutes: 30          # always set
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@<sha>  # vX.Y.Z
        with:
          persist-credentials: false
      - run: make build
    outputs:
      image-tag: ${{ steps.tag.outputs.tag }}

  deploy:
    needs: build                 # explicit dependency; no `needs` = parallel
    runs-on: ubuntu-24.04
    steps:
      - run: echo "Deploying $IMAGE_TAG"
        env:
          IMAGE_TAG: ${{ needs.build.outputs.image-tag }}
```

---

## Reusable Workflows and Composite Actions

```
Sharing CI logic?
├── Whole workflow with several jobs, shared across repos → reusable workflow (workflow_call)
├── A set of steps that must share the caller's job and runner → composite action (action.yml)
└── Complex logic needing tests or typed inputs → JavaScript or container action
```

| Dimension | Reusable workflow | Composite action |
|-----------|-------------------|------------------|
| Scope | Full workflow, own jobs and runners | Steps only, inline in the caller's job |
| Secrets | Declared in `secrets:` or `secrets: inherit` | Passed as inputs |
| Nesting | Limited depth (check current limits) | Limited depth (check current limits) |
| UI | Separate jobs in the graph | Hidden in the caller's job |

```yaml
# Caller: pin shared workflows by SHA or an immutable tag, not @main
jobs:
  ci:
    uses: org/shared-workflows/.github/workflows/reusable-ci.yml@<sha>  # vX.Y.Z
    with:
      node-version: "24"
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}     # pass only what is needed; avoid `secrets: inherit`
```

```yaml
# Composite action: .github/actions/setup/action.yml
name: Setup and install
inputs:
  node-version: { default: "24" }
runs:
  using: composite
  steps:
    - uses: actions/setup-node@<sha>  # vX.Y.Z
      with:
        node-version: ${{ inputs.node-version }}
        cache: npm
    - run: npm ci
      shell: bash                              # required for every run step
```

---

## Security

### Set `permissions:` explicitly

Declare `permissions: contents: read` at workflow level and widen per job.

| Scope | When needed |
|-------|-------------|
| `contents: read` | Checkout |
| `contents: write` | Create releases or tags |
| `packages: write` | Push to GHCR |
| `pull-requests: write` | Comment on PRs |
| `id-token: write` | OIDC token for cloud auth or trusted publishing |
| `attestations: write` | Artifact attestations |
| `security-events: write` | Upload SARIF |

### Fork pull requests and `pull_request_target`

`pull_request` from forks gets no secrets and a read-only token: a security boundary. `pull_request_target` runs with the base repository's secrets; never check out and run the PR's code under it (no build, no install scripts, no tests).

### Prevent script injection

Untrusted event fields (PR title, branch name, issue body, commit message) must never be interpolated into `run:` scripts.

```yaml
# UNSAFE
- run: echo "PR title: ${{ github.event.pull_request.title }}"

# SAFE: pass through the environment
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "PR title: $PR_TITLE"
```

Also set `persist-credentials: false` on checkout when later steps do not push, and keep secrets out of `run:` command lines.

---

## OIDC to Cloud Providers

The flow and rationale are in [pipeline-patterns.md](pipeline-patterns.md#oidc-workload-identity). GitHub specifics: the job needs `id-token: write`, and the cloud trust policy must restrict the token's `sub` claim to the repository and the ref or environment that may deploy.

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@<sha>  # vX.Y.Z
    with:
      role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
      aws-region: us-east-1
```

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:org/repo:environment:production"
    }
  }
}
```

GCP uses `google-github-actions/auth` with `workload_identity_provider` and `service_account`; Azure uses `azure/login` with `client-id`, `tenant-id`, `subscription-id` (identifiers, not secrets, so store them as variables). The same pattern applies to package registries that support trusted publishing: see `release-engineering`.

---

## Action Pinning

Tags are mutable: a compromised maintainer account can repoint a tag at malicious code. Pin every third-party action to a full commit SHA and keep the version as a comment.

```yaml
- uses: actions/checkout@<sha>  # vX.Y.Z
```

Procedure, instead of pasting SHAs from documentation:

1. Resolve at authoring time: `gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq .object.sha`. For an annotated tag, resolve the tag object to its commit (`git ls-remote` with `^{}`), or use a pinning tool that does this.
2. Keep pins current with Dependabot (it updates SHA and comment together):

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
    groups:
      actions: { patterns: ["*"] }
```

3. Enforce with the organisation or repository policy that requires full-length SHA pins, and review each Dependabot PR's diff for actions you do not control. Prefer actions from verified maintainers, and replace a trivial third-party action with a few lines of shell.

Runtime note: JavaScript actions run on Node 24 on GitHub-hosted runners (default since 2026-06-16; Node 20 removal was scheduled for 2026-09-23), so upgrade actions whose latest release still declares `node20`.

A known compromise (the `tj-actions/changed-files` action leaked secrets from many repositories in March 2025, CVE-2025-30066) is the reason to pin: prefer `dorny/paths-filter` or plain `git diff` for change detection, and review any action that touches secrets.

---

## Caching

Prefer the `cache:` input of setup actions; it derives the key from the lockfile.

```yaml
- uses: actions/setup-node@<sha>  # vX.Y.Z
  with:
    node-version: "24"
    cache: npm                  # or pnpm, yarn
- uses: actions/setup-go@<sha>  # vX.Y.Z
  with: { go-version-file: go.mod, cache: true }
```

For anything else, use `actions/cache` with a key of OS plus lockfile hash and a prefix `restore-keys` fallback:

```yaml
- uses: actions/cache@<sha>  # vX.Y.Z
  with:
    path: ~/.cache/tool
    key: ${{ runner.os }}-tool-${{ hashFiles('**/lockfile') }}
    restore-keys: ${{ runner.os }}-tool-
```

Use `actions/cache/restore` and `actions/cache/save` separately when the cache must be saved even if later steps fail, or saved only on the default branch. Caches are best-effort and scoped by branch: PR runs restore from the base branch's caches but cannot write to it. Never cache secrets or credentials directories.

---

## Docker Builds

Dockerfile content: `docker`. The workflow side:

```yaml
- uses: docker/setup-buildx-action@<sha>  # vX.Y.Z
- uses: docker/login-action@<sha>  # vX.Y.Z
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
- uses: docker/build-push-action@<sha>  # vX.Y.Z
  id: push
  with:
    context: .
    push: true
    tags: ghcr.io/org/app:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`type=gha` is ephemeral and size-limited; `type=registry,ref=...:buildcache` persists and works across runners. `mode=max` caches intermediate stages. Use a separate `scope` per image in monorepos.

---

## Monorepo Patterns

### Job-level path filtering

```yaml
jobs:
  changes:
    runs-on: ubuntu-24.04
    permissions: { contents: read, pull-requests: read }
    outputs:
      api: ${{ steps.filter.outputs.api }}
    steps:
      - uses: actions/checkout@<sha>  # vX.Y.Z
      - uses: dorny/paths-filter@<sha>  # vX.Y.Z
        id: filter
        with:
          filters: |
            api:
              - "services/api/**"
              - "packages/shared/**"

  build-api:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    uses: ./.github/workflows/build-service.yml
    with: { service: api }
```

### Dynamic matrix from changed packages

```yaml
jobs:
  detect:
    runs-on: ubuntu-24.04
    outputs:
      packages: ${{ steps.detect.outputs.packages }}
    steps:
      - uses: actions/checkout@<sha>  # vX.Y.Z
        with: { fetch-depth: 0 }
      - id: detect
        env:
          BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
        run: |
          CHANGED=$(git diff --name-only "$BASE" HEAD | { grep '^packages/' || true; } | cut -d/ -f2 | sort -u | jq -Rsc 'split("\n") | map(select(length>0))')
          echo "packages=$CHANGED" >> "$GITHUB_OUTPUT"

  test:
    needs: detect
    if: needs.detect.outputs.packages != '[]'
    strategy:
      fail-fast: false
      matrix:
        package: ${{ fromJSON(needs.detect.outputs.packages) }}
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@<sha>  # vX.Y.Z
      - env:
          PKG: ${{ matrix.package }}   # via env, never interpolated into the script
        run: npm ci && npm test --workspace="packages/$PKG"
```

This sketch ignores dependents of changed packages; use the build tool's graph-aware detection where one exists ([monorepo-ci.md](monorepo-ci.md)).

---

## Environments

Environments scope secrets and variables and add protection rules: required reviewers (with prevention of self-review), wait timers, deployment-branch restrictions, and custom gates. Availability of each rule depends on the plan and repository visibility; check the current documentation.

```yaml
jobs:
  deploy-production:
    needs: deploy-staging
    environment:
      name: production
      url: https://example.com
    runs-on: ubuntu-24.04
    steps:
      - run: ./deploy.sh production "$IMAGE_DIGEST"
```

Secrets of an environment are released only after its protection rules pass, so put credentials there rather than in repository secrets. What the deploy step does (strategy, rollback): `release-engineering`.

---

## Concurrency Control

```yaml
# CI: newest commit wins
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Deploys: queue, never cancel mid-deploy
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

Use a group per environment for deploys (`deploy-${{ inputs.environment }}`). Only one run waits in a group; newer pending runs replace older pending ones.

---

## Matrix Strategies

```yaml
strategy:
  fail-fast: false
  max-parallel: 4
  matrix:
    os: [ubuntu-24.04, macos-15]
    node: ["22", "24"]
    include:
      - { os: ubuntu-24.04, node: "24", experimental: true }
    exclude:
      - { os: macos-15, node: "22" }
runs-on: ${{ matrix.os }}
continue-on-error: ${{ matrix.experimental || false }}
```

Generate the matrix from a prior job with `matrix: ${{ fromJSON(needs.setup.outputs.matrix) }}`. Matrix size and nesting limits change; check current limits when designing large fan-outs.

---

## Runners

- Pin an explicit runner label rather than `ubuntu-latest`; the alias moves when the default image changes and breaks workflows without a diff.
- Check the current runner images and sizes in the documentation; larger, GPU, and ARM runners exist and depend on the plan.
- Self-hosted runners: use ephemeral runners, never attach them to public repositories (any fork PR can run code on them), and isolate them from production networks.
- Always set `timeout-minutes`.

---

## Artifacts and Outputs

```yaml
- uses: actions/upload-artifact@<sha>  # vX.Y.Z
  with:
    name: dist-${{ github.sha }}
    path: dist/
    retention-days: 7
    if-no-files-found: error
```

Artifacts pass files between jobs; with the same upload, `actions/download-artifact` retrieves them. Job outputs carry small values.

| Mechanism | Use |
|-----------|-----|
| `echo "k=v" >> "$GITHUB_OUTPUT"` | Step and job outputs |
| `echo "K=v" >> "$GITHUB_ENV"` | Env for later steps (never from untrusted input) |
| `echo "::add-mask::$VALUE"` | Mask a derived value in logs |
| upload/download artifact | Files between jobs |

Artifacts and outputs from untrusted workflow runs (for example a `workflow_run` consuming a fork PR's artifacts) are untrusted input.

---

## Attestations

`actions/attest` creates signed attestations (build provenance, SBOM, or a custom predicate) linking an artifact to the workflow that built it; `actions/attest-build-provenance` (v4 and later) is a thin wrapper over it, so use `actions/attest` in new workflows. It needs `id-token: write` and `attestations: write`; the action's README also lists `artifact-metadata: write`, and `packages: write` when pushing the attestation to a registry (`push-to-registry`).

```yaml
- uses: actions/attest@<sha>  # vX.Y.Z
  with:
    subject-name: ghcr.io/org/app
    subject-digest: ${{ steps.push.outputs.digest }}
    push-to-registry: true
```

```bash
gh attestation verify oci://ghcr.io/org/app@sha256:<digest> --repo org/repo
```

Availability for private repositories depends on the plan. Levels and what they mean: [pipeline-patterns.md](pipeline-patterns.md#supply-chain-in-ci).

---

## Security Scanning

- **CodeQL for Actions** analyses workflow files for script injection, missing permissions, and dangerous `pull_request_target` use. Enable it via code scanning.
- **A workflow linter** (`actionlint`) and a workflow security scanner (`zizmor`) catch syntax errors and unsafe patterns before merge.
- **Dependabot** keeps pins current (see [Action Pinning](#action-pinning)).
- **Secret scanning with push protection** blocks known secret patterns before they reach the repository.

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| `uses: actions/checkout@v4` or `@main` | Mutable ref; supply chain vector | Full SHA with a version comment |
| `permissions: write-all` or no `permissions:` | Excessive token scope | `contents: read` default, widen per job |
| No `timeout-minutes` | Hung job burns minutes until the platform limit | Set it on every job |
| Long-lived cloud keys in secrets | Rotation burden, leak = lasting access | OIDC federation |
| `${{ github.event... }}` inside `run:` | Script injection | Pass through `env:` |
| `pull_request_target` plus checkout of PR code | Runs untrusted code with secrets | Avoid; split into an unprivileged build and a privileged follow-up that reads only data |
| `ubuntu-latest` | Silent image upgrades | Explicit label |
| `secrets: inherit` | Passes unrelated secrets to the callee | Pass the named secrets |
| Default 90-day artifact retention for build output | Storage cost | Set `retention-days` |
| `fail-fast` left on for test matrices | First failure hides others | `fail-fast: false` |
| Polling external services in a step | Burns runner minutes | Event triggers or webhooks |
