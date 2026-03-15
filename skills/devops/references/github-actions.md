# GitHub Actions

## Contents

- [Workflow Basics](#workflow-basics)
- [Reusable Workflows](#reusable-workflows)
- [Composite Actions](#composite-actions)
- [Reusable vs Composite Decision](#reusable-vs-composite-decision)
- [Security](#security)
- [OIDC Workload Identity](#oidc-workload-identity)
- [Action Pinning](#action-pinning)
- [Caching](#caching)
- [Docker Layer Caching](#docker-layer-caching)
- [Monorepo Patterns](#monorepo-patterns)
- [Environments and Deployment](#environments-and-deployment)
- [Concurrency Control](#concurrency-control)
- [Matrix Strategies](#matrix-strategies)
- [Runners](#runners)
- [Artifacts and Outputs](#artifacts-and-outputs)
- [Supply Chain Security](#supply-chain-security)
- [Security Scanning](#security-scanning)
- [Anti-Patterns](#anti-patterns)

---

## Workflow Basics

### Trigger events (`on:`)

```yaml
on:
  push:
    branches: [main]
    paths: ["src/**", "package.json"]          # only trigger when these paths change
  pull_request:
    branches: [main]
    paths-ignore: ["docs/**", "*.md"]
  workflow_dispatch:                            # manual trigger with optional inputs
    inputs:
      environment:
        description: "Target environment"
        required: true
        default: staging
        type: choice
        options: [staging, production]
  schedule:
    - cron: "0 2 * * 1"                        # every Monday at 02:00 UTC
  workflow_call:                                # callable from other workflows
    inputs:
      image-tag:
        required: true
        type: string
```

**Path filters at the workflow level** (`paths:`, `paths-ignore:`) apply to the entire workflow trigger. They do not filter individual jobs. Use dorny/paths-filter (see [Monorepo Patterns](#monorepo-patterns)) for job-level path filtering.

### Job structure

```yaml
jobs:
  build:
    runs-on: ubuntu-24.04
    timeout-minutes: 30                         # always set; prevents hung jobs burning runner minutes
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - name: Build
        run: make build
    outputs:
      image-tag: ${{ steps.tag.outputs.tag }}   # pass data to downstream jobs

  deploy:
    needs: build                                # explicit dependency
    runs-on: ubuntu-24.04
    steps:
      - name: Deploy
        run: echo "Deploying ${{ needs.build.outputs.image-tag }}"
```

### Job dependencies

```
jobs:
  lint ──────────────┐
  test ──────────────┼──> build ──> scan ──> deploy
  type-check ────────┘
```

Use `needs: [lint, test, type-check]` to fan in, `needs: build` to sequence. Without `needs:`, jobs run in parallel.

---

## Reusable Workflows

A reusable workflow is a complete `.github/workflows/*.yml` file callable from other workflows via `workflow_call`. It runs as a separate job in the caller's workflow graph.

**Use when:** sharing an entire CI sequence (lint + test + build) across multiple repositories.

### Callee (reusable workflow)

```yaml
# .github/workflows/reusable-ci.yml
on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: "22"
      working-directory:
        required: false
        type: string
        default: "."
    secrets:
      NPM_TOKEN:
        required: false
    outputs:
      image-digest:
        description: "Built image digest"
        value: ${{ jobs.build.outputs.digest }}

jobs:
  build:
    runs-on: ubuntu-24.04
    defaults:
      run:
        working-directory: ${{ inputs.working-directory }}
    outputs:
      digest: ${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-node@cdca7365b2dadb8aad0a33bc7601856ffabcc48e  # v4.3.0
        with:
          node-version: ${{ inputs.node-version }}
          cache: npm
      - run: npm ci
      - run: npm test
      - id: push
        run: echo "digest=sha256:abc123" >> "$GITHUB_OUTPUT"
```

### Caller

```yaml
# .github/workflows/ci.yml
jobs:
  ci:
    uses: org/shared-workflows/.github/workflows/reusable-ci.yml@main
    with:
      node-version: "22"
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    # or pass all secrets: secrets: inherit
```

**Key constraints:**
- Reusable workflows count as one job toward the 256-job limit per workflow.
- Secrets cannot be read from `env:` context in a reusable workflow — they must be declared in `secrets:` or passed via `secrets: inherit`.
- A reusable workflow can call other reusable workflows (nesting up to 4 levels).

---

## Composite Actions

A composite action bundles multiple steps into a single `action.yml` file. It runs inline within the caller's job (not as a separate job).

**Use when:** sharing a set of steps (e.g., setup, authentication, notifications) within or across workflows, where you want the steps to share the job's runner environment.

```yaml
# .github/actions/setup-node-deps/action.yml
name: Setup Node and install dependencies
description: Checks out repo, sets up Node, and installs npm dependencies
inputs:
  node-version:
    description: Node.js version
    required: false
    default: "22"
  working-directory:
    description: Working directory
    required: false
    default: "."
outputs:
  cache-hit:
    description: Whether the npm cache was hit
    value: ${{ steps.setup.outputs.cache-hit }}

runs:
  using: composite
  steps:
    - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
    - id: setup
      uses: actions/setup-node@cdca7365b2dadb8aad0a33bc7601856ffabcc48e  # v4.3.0
      with:
        node-version: ${{ inputs.node-version }}
        cache: npm
    - run: npm ci
      shell: bash
      working-directory: ${{ inputs.working-directory }}
```

**Calling a composite action:**

```yaml
steps:
  - uses: ./.github/actions/setup-node-deps
    with:
      node-version: "22"
```

**Key constraints:**
- Composite actions cannot access secrets directly — the caller must pass them as inputs.
- Composite actions can be nested up to 10 levels.
- Each `run` step in a composite action must declare `shell:`.

---

## Reusable vs Composite Decision

```
Sharing CI logic?
├── Entire workflow with multiple jobs, shared across repos
│   └── Reusable workflow (workflow_call)
├── Set of steps, share runner environment, composable
│   └── Composite action (action.yml)
├── Complex logic requiring tests, language-specific tooling
│   └── JavaScript/TypeScript action or Docker action
└── Simple one-liner used in a single repo
    └── Inline step or YAML anchors (not supported natively — use reusable workflow)
```

| Dimension | Reusable workflow | Composite action |
|-----------|-------------------|------------------|
| Scope | Full workflow | Steps only |
| Execution | Separate job | Inline in caller's job |
| Secrets | Supported via `secrets:` | Must pass as inputs |
| Runner | Own runner | Caller's runner |
| Nesting | 4 levels | 10 levels |
| Cross-repo | Yes | Yes (if action is in separate repo) |
| Job graph | Visible in UI as separate job | Hidden inside caller's job |

---

## Security

### Set `permissions:` explicitly

Always declare permissions at the workflow or job level. The default grants write access to most scopes for repositories — this is excessive.

```yaml
# Workflow-level default: restrict everything
permissions:
  contents: read

jobs:
  build:
    permissions:
      contents: read
      packages: write          # needed to push to GHCR

  pr-comment:
    permissions:
      pull-requests: write     # needed to post a comment
      contents: read
```

**Common permission scopes:**

| Scope | When needed |
|-------|-------------|
| `contents: read` | Checkout code |
| `contents: write` | Create releases, tags |
| `packages: write` | Push to GHCR |
| `pull-requests: write` | Post comments on PRs |
| `id-token: write` | Obtain OIDC token for cloud auth |
| `attestations: write` | Create artifact attestations |
| `security-events: write` | Upload SARIF scan results |

### Fork pull requests

Workflows triggered by `pull_request` from forks run with limited permissions (no secrets, read-only GITHUB_TOKEN). This is a security boundary — do not work around it with `pull_request_target` unless you fully understand the injection risk.

### Prevent script injection

Never interpolate untrusted input directly into `run:` steps. Attacker-controlled values (PR title, branch name, issue body) can inject shell commands.

```yaml
# UNSAFE — PR title injected into shell
- run: echo "PR title: ${{ github.event.pull_request.title }}"

# SAFE — pass via environment variable
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "PR title: $PR_TITLE"
```

---

## OIDC Workload Identity

OIDC workload identity federation replaces long-lived static credentials (AWS access keys, GCP service account keys, Azure client secrets). GitHub Actions issues a short-lived JWT per workflow run; the cloud provider validates it and issues a short-lived access token.

**Why:** no secrets to rotate, no leaked credentials, tokens are scoped to repo + branch + workflow.

**Required permission:** `id-token: write` must be set on the job or workflow.

### AWS

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502  # v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
      aws-region: us-east-1
      # role-session-name defaults to GitHubActions

  - run: aws sts get-caller-identity
```

**AWS trust policy** (restrict to specific repo and branch):

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:org/repo:ref:refs/heads/main"
    }
  }
}
```

### GCP

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: google-github-actions/auth@71fee32a0bb7e97b4d33d548e7d957010649d8fa  # v3
    with:
      workload_identity_provider: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
      service_account: github-actions@PROJECT_ID.iam.gserviceaccount.com

  - uses: google-github-actions/setup-gcloud@6189d56e4096ee891640bb02ac264be376592d6a  # v2
```

### Azure

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: azure/login@a457da9ea143d694b1b9c7c869ebb04ebe844b6f  # v2
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      # No client-secret needed when using federated credentials
```

**Note:** `client-id`, `tenant-id`, and `subscription-id` are not secrets — they are identifiers. Store them as variables, not secrets, to make it clear they are not sensitive.

---

## Action Pinning

Tags are mutable. A compromised maintainer account or a supply chain attack can push malicious code under an existing tag. Every workflow using that tag will pull the new code without notice.

**Always pin to the full commit SHA.** Add the tag as a comment for human readability.

```yaml
# UNSAFE — tag is mutable
- uses: actions/checkout@v4

# SAFE — pinned to SHA, tag shown in comment
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

**Automate SHA updates with Dependabot:**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    groups:
      actions:
        patterns: ["*"]
```

Dependabot will open PRs updating pinned SHAs when new action versions are released, preserving security while keeping dependencies current.

**Organization-level enforcement (August 2025):** GitHub Actions policy settings now support requiring all action references to be pinned to full-length commit SHAs at the enterprise, organization, or repository level.

**Reference SHAs for common actions (verify before use):**

| Action | Version | SHA |
|--------|---------|-----|
| actions/checkout | v4.2.2 | `11bd71901bbe5b1630ceea73d27597364c9af683` |
| actions/setup-node | v4.3.0 | `cdca7365b2dadb8aad0a33bc7601856ffabcc48e` |
| actions/cache | v4 | check [releases](https://github.com/actions/cache/releases) |
| actions/upload-artifact | v4 | check [releases](https://github.com/actions/upload-artifact/releases) |
| actions/download-artifact | v4 | check [releases](https://github.com/actions/download-artifact/releases) |
| docker/build-push-action | v6 | check [releases](https://github.com/docker/build-push-action/releases) |
| docker/login-action | v3 | check [releases](https://github.com/docker/login-action/releases) |

Always verify SHAs against the official release tags on GitHub before use.

---

## Caching

### actions/cache v4

The cache backend was rewritten in February 2025 (cache service v2), reducing upload times by up to 80% on GitHub-hosted runners. Pin to v4 or later.

```yaml
- uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684  # v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
```

**Key strategy:** include OS + lockfile hash. The `restore-keys` prefix enables partial cache hits when the lockfile changes.

### Built-in cache in setup actions

Prefer the `cache:` input on setup actions when available — it handles key derivation automatically.

```yaml
# Node.js — caches ~/.npm using package-lock.json hash
- uses: actions/setup-node@cdca7365b2dadb8aad0a33bc7601856ffabcc48e  # v4.3.0
  with:
    node-version: "22"
    cache: npm                    # or: yarn, pnpm

# Python — caches pip using requirements hash
- uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065  # v5
  with:
    python-version: "3.12"
    cache: pip

# Go — caches module download cache
- uses: actions/setup-go@d60b41a563a30594ed7f4be95e5c1b9ee7a90f22  # v5
  with:
    go-version: "1.23"
    cache: true
```

### Separate restore and save (advanced)

Use `actions/cache/restore` and `actions/cache/save` independently when you need to save cache after tests regardless of whether they passed.

```yaml
steps:
  - uses: actions/cache/restore@5a3ec84eff668545956fd18022155c47e93e2684  # v4
    id: cache
    with:
      path: node_modules
      key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

  - run: npm ci
    if: steps.cache.outputs.cache-hit != 'true'

  - run: npm test                 # run regardless

  - uses: actions/cache/save@5a3ec84eff668545956fd18022155c47e93e2684  # v4
    if: steps.cache.outputs.cache-hit != 'true'
    with:
      path: node_modules
      key: ${{ steps.cache.outputs.cache-primary-key }}
```

---

## Docker Layer Caching

### GHA cache backend (ephemeral, no registry required)

```yaml
- uses: docker/setup-buildx-action@b5730f4d1e9a0e4e527a0d0c82d36049843ba85e  # v3
- uses: docker/build-push-action@14487ce63c7a62a4a324b0bfb37086795e31c6c1  # v6
  with:
    context: .
    push: true
    tags: ghcr.io/org/app:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Registry cache backend (persistent, survives runner eviction)

```yaml
- uses: docker/build-push-action@14487ce63c7a62a4a324b0bfb37086795e31c6c1  # v6
  with:
    context: .
    push: true
    tags: ghcr.io/org/app:${{ github.sha }}
    cache-from: type=registry,ref=ghcr.io/org/app:buildcache
    cache-to: type=registry,ref=ghcr.io/org/app:buildcache,mode=max
```

**mode=max** caches all intermediate layers (including multi-stage build layers that are not in the final image). Use `mode=min` to cache only the final layer — smaller cache, less effective.

---

## Monorepo Patterns

### Path filtering with dorny/paths-filter

GitHub's built-in `paths:` trigger filter applies to the entire workflow. To conditionally run individual jobs based on changed files, use dorny/paths-filter.

```yaml
jobs:
  changes:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      pull-requests: read
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
      infra: ${{ steps.filter.outputs.infra }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36  # v3.0.2
        id: filter
        with:
          filters: |
            api:
              - "services/api/**"
              - "packages/shared/**"
            web:
              - "services/web/**"
              - "packages/shared/**"
            infra:
              - "infra/**"
              - ".github/workflows/**"

  build-api:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    uses: ./.github/workflows/build-service.yml
    with:
      service: api

  build-web:
    needs: changes
    if: needs.changes.outputs.web == 'true'
    uses: ./.github/workflows/build-service.yml
    with:
      service: web
```

**Note on tj-actions/changed-files:** This action was compromised in March 2025 (supply chain attack — malicious code leaked CI secrets from 200+ repositories). Verify the current SHA and review before using. dorny/paths-filter is an alternative with similar functionality.

### Dynamic matrix from changed packages

```yaml
jobs:
  detect:
    runs-on: ubuntu-24.04
    outputs:
      packages: ${{ steps.detect.outputs.packages }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
        with:
          fetch-depth: 2
      - id: detect
        run: |
          # Detect changed packages, output JSON array
          CHANGED=$(git diff --name-only HEAD~1 HEAD | grep "^packages/" | cut -d/ -f2 | sort -u | jq -Rc '[.,inputs]')
          echo "packages=$CHANGED" >> "$GITHUB_OUTPUT"

  build:
    needs: detect
    if: needs.detect.outputs.packages != '[]'
    strategy:
      matrix:
        package: ${{ fromJSON(needs.detect.outputs.packages) }}
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - run: cd packages/${{ matrix.package }} && npm ci && npm test
```

---

## Environments and Deployment

### Configuring environments

Environments provide deployment targets with protection rules and scoped secrets/variables.

```yaml
jobs:
  deploy-staging:
    environment: staging           # no protection rules — auto-deploys
    runs-on: ubuntu-24.04
    steps:
      - run: ./deploy.sh staging

  deploy-production:
    needs: deploy-staging
    environment:
      name: production
      url: https://example.com     # shown as deployment URL in GitHub UI
    runs-on: ubuntu-24.04
    steps:
      - run: ./deploy.sh production
```

### Environment protection rules

Configure in repository Settings > Environments:

| Rule | Effect |
|------|--------|
| Required reviewers (up to 6) | Job pauses; reviewer must approve before secrets are released |
| Prevent self-review | Deployer cannot be their own approver |
| Wait timer (0-43,200 min) | Mandatory delay before job proceeds |
| Deployment branches | Only specific branches can deploy to this environment |
| Custom protection rules | Third-party gates (ticketing systems, change management) |

**Plan availability:** Required reviewers for private repositories require GitHub Team or Enterprise. Public repositories: all plans.

### Deployment strategy decision

```
Deploy strategy?
├── Single step, simple service
│   └── push to main triggers deploy job
├── Multi-stage with quality gates
│   └── dev (auto) --> staging (auto after dev) --> production (manual approval)
├── Per-PR preview environments
│   └── workflow_run or pull_request trigger + environment per PR number
└── Manual on-demand
    └── workflow_dispatch with environment selection input
```

---

## Concurrency Control

```yaml
# Cancel previous runs on the same branch (good for PRs and feature branches)
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Never cancel production deploys in progress
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

**Group expressions:**

| Use case | Group key |
|----------|-----------|
| One run per branch | `${{ github.workflow }}-${{ github.ref }}` |
| One run per PR | `${{ github.workflow }}-${{ github.event.pull_request.number }}` |
| Serialized production deploys | `deploy-production` |
| Per-environment | `deploy-${{ inputs.environment }}` |

**cancel-in-progress:**
- `true` — cancel the previous run in the group when a new one starts. Use for CI, linting, PR checks. Saves runner minutes, gives fast feedback on latest commit.
- `false` — queue the new run; wait for the in-progress run to finish. Use for deployments where interrupting mid-deploy would leave infrastructure in a broken state.

**Matrix + concurrency:** concurrency groups apply per matrix item when defined at job level. Each matrix combination has its own concurrency slot.

---

## Matrix Strategies

```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-24.04, macos-15]
        node: ["20", "22"]
        include:
          # Add extra variable for a specific combination
          - os: ubuntu-24.04
            node: "22"
            experimental: true
        exclude:
          # Skip a combination
          - os: macos-15
            node: "20"
      fail-fast: false             # don't cancel remaining jobs when one fails
      max-parallel: 4              # limit concurrent jobs (default: unlimited)
    runs-on: ${{ matrix.os }}
    continue-on-error: ${{ matrix.experimental || false }}
    steps:
      - uses: actions/setup-node@cdca7365b2dadb8aad0a33bc7601856ffabcc48e  # v4.3.0
        with:
          node-version: ${{ matrix.node }}
      - run: npm test
```

**Dynamic matrix from a prior job:**

```yaml
jobs:
  setup:
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - id: set-matrix
        run: echo 'matrix={"service":["api","worker","scheduler"]}' >> "$GITHUB_OUTPUT"

  build:
    needs: setup
    strategy:
      matrix: ${{ fromJSON(needs.setup.outputs.matrix) }}
    runs-on: ubuntu-24.04
    steps:
      - run: echo "Building ${{ matrix.service }}"
```

---

## Runners

### Standard GitHub-hosted runners

| Label | OS | vCPU | RAM | Notes |
|-------|----|------|-----|-------|
| `ubuntu-24.04` | Ubuntu 24.04 | 4 | 16 GB | Recommended default (not `ubuntu-latest` — pin explicitly) |
| `ubuntu-22.04` | Ubuntu 22.04 | 4 | 16 GB | |
| `windows-2025` | Windows Server 2025 | 4 | 16 GB | |
| `macos-15` | macOS 15 | 3 | 14 GB | M1 |
| `macos-15-xlarge` | macOS 15 | 6 | 14 GB | M1, Team/Enterprise only |

**Recommendation:** Pin to an explicit runner label (e.g., `ubuntu-24.04`) rather than `ubuntu-latest`. The `latest` alias changes when GitHub upgrades the default, which can break workflows unexpectedly.

### Larger runners (Team and Enterprise)

Available on GitHub Team and Enterprise Cloud plans. Require configuration under Settings > Actions > Runners.

| Size | vCPU | RAM | SSD | Use case |
|------|------|-----|-----|---------|
| `ubuntu-latest-4-cores` | 4 | 16 GB | 150 GiB | Default |
| `ubuntu-latest-8-cores` | 8 | 32 GB | 300 GiB | Parallel test suites |
| `ubuntu-latest-16-cores` | 16 | 64 GB | 600 GiB | Heavy builds |
| `ubuntu-latest-32-cores` | 32 | 128 GB | 1200 GiB | Large monorepos |
| `ubuntu-latest-64-cores` | 64 | 256 GB | 1900 GiB | |
| `ubuntu-latest-96-cores` | 96 | 384 GB | 2040 GiB | GA since April 2025 |

**M2 macOS runners (July 2025, public preview):** 5-core CPU, 8-core GPU, 14 GB RAM. GPU hardware acceleration enabled by default. Up to 15% faster than M1 runners for Xcode builds.

### GPU runners

Generally available for Windows and Linux (T4 GPU, Azure-managed images). For ML model inference, CUDA-dependent test suites, and GPU-accelerated build steps.

```yaml
runs-on: ubuntu-latest-gpu-t4-small    # label varies; check your org's runner configuration
```

### Self-hosted runners

```yaml
runs-on: [self-hosted, linux, x64, production]
```

**Security:** self-hosted runners should not be used with public repositories — any user can fork and open a PR that triggers workflow runs on your infrastructure.

---

## Artifacts and Outputs

### Upload and download artifacts

```yaml
jobs:
  build:
    steps:
      - run: npm run build -- --outdir dist
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
          retention-days: 7        # default 90; reduce for build artifacts
          if-no-files-found: error

  deploy:
    needs: build
    steps:
      - uses: actions/download-artifact@95815c38cf2ff2164869cbab79da8d1f422bc89e  # v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
```

### Job outputs (passing data between jobs)

```yaml
jobs:
  build:
    outputs:
      image-tag: ${{ steps.tag.outputs.value }}
      image-digest: ${{ steps.push.outputs.digest }}
    steps:
      - id: tag
        run: echo "value=${{ github.sha }}" >> "$GITHUB_OUTPUT"
      - id: push
        run: echo "digest=sha256:..." >> "$GITHUB_OUTPUT"

  deploy:
    needs: build
    steps:
      - run: |
          echo "Tag: ${{ needs.build.outputs.image-tag }}"
          echo "Digest: ${{ needs.build.outputs.image-digest }}"
```

**Step outputs vs environment files:**

| Method | Use when |
|--------|---------|
| `echo "key=value" >> "$GITHUB_OUTPUT"` | Passing values to later steps or job outputs |
| `echo "VAR=value" >> "$GITHUB_ENV"` | Setting environment variables for subsequent steps |
| `echo "::add-mask::$VALUE"` | Masking a value from logs |
| `actions/upload-artifact` | Passing files between jobs |

---

## Supply Chain Security

### Artifact attestations (SLSA Build Level 2)

`actions/attest-build-provenance` generates a signed SLSA provenance attestation linking an artifact to its build instructions. As of v4, it is a wrapper around `actions/attest`.

```yaml
permissions:
  contents: read
  id-token: write
  attestations: write

steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

  - name: Build artifact
    run: make dist

  - uses: actions/attest-build-provenance@c074443f1aee8d4aeeae555aebba3282517141b2  # v2
    with:
      subject-path: dist/app-linux-amd64

  # For container images, use subject-name + subject-digest
  - uses: actions/attest-build-provenance@c074443f1aee8d4aeeae555aebba3282517141b2  # v2
    with:
      subject-name: ghcr.io/org/app
      subject-digest: ${{ steps.push.outputs.digest }}
      push-to-registry: true
```

**Verification:**
```bash
gh attestation verify dist/app-linux-amd64 --repo org/repo
gh attestation verify oci://ghcr.io/org/app@sha256:... --repo org/repo
```

**Availability:** Public repositories on all plans. Private/internal repositories require GitHub Enterprise Cloud.

**Signing:** Uses short-lived Sigstore certificates. Public repos use the Sigstore public-good instance; private repos use GitHub's private Sigstore instance.

---

## Security Scanning

### CodeQL for Actions workflows (GA April 2025)

GitHub's CodeQL now analyzes Actions workflow files themselves (`.github/workflows/*.yml`) for security vulnerabilities, including:
- Script injection via untrusted inputs
- Missing `permissions:` declarations
- Dangerous use of `pull_request_target`
- Secrets referenced in log output

Enable via repository Settings > Code security > Code scanning, or with the default setup.

### Dependabot for Actions

Configure Dependabot to keep action SHAs current:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    groups:
      production-actions:
        patterns: ["actions/*", "docker/*"]
      cloud-actions:
        patterns: ["aws-actions/*", "google-github-actions/*", "azure/*"]
```

### Secret scanning

GitHub Secret Protection (formerly part of GitHub Advanced Security) scans all commits for known secret patterns. As of March 2025, available to GitHub Team plan customers on a per-active-committer basis.

**Push protection:** blocks pushes containing detected secrets before they reach the repository.

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| `uses: actions/checkout@v4` | Tag is mutable; supply chain attack vector | Pin to full SHA: `uses: actions/checkout@<sha>  # v4.2.2` |
| `permissions: write-all` | Excessive access on every job | Declare explicit minimal permissions per job |
| No `timeout-minutes:` | Hung job burns runner minutes until workflow timeout (6 hours) | Set `timeout-minutes:` on every job |
| Long-lived cloud credentials in secrets | Rotation burden; leaked key grants long-term access | OIDC workload identity (no static credentials) |
| No `concurrency:` on PR workflows | Duplicate runs on every push waste compute and confuse reviewers | `concurrency: group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true` |
| Interpolating untrusted input in `run:` | Script injection via PR title, branch name, issue body | Pass untrusted values through `env:` variables |
| Building everything in a monorepo on every push | Wastes compute; slow feedback | dorny/paths-filter + conditional jobs |
| `ubuntu-latest` as runner label | Silently upgrades to new OS version, breaking workflows | Explicit label: `ubuntu-24.04` |
| `secrets: inherit` in reusable workflows | Passes all secrets, including unrelated ones | Declare only the secrets the workflow needs |
| Uploading large artifacts with default retention | Consumes storage quota | Set `retention-days:` appropriate to use case |
| `pull_request_target` with checkout of fork code | Remote code execution on your runners | Avoid unless you fully understand the security model; never use with `actions/checkout` of the PR ref |
| No `fail-fast: false` on matrix builds | First failure cancels all other matrix jobs, hiding additional failures | Set `fail-fast: false` for test matrices |
| Polling external services in a workflow step | Burns runner minutes waiting | Use `workflow_run` trigger or external webhooks |

---

## Quick Reference: Common Action SHAs

SHAs change with each release. Always verify against the official GitHub release tags before committing.

```yaml
# Checkout and setup
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683          # v4.2.2
- uses: actions/setup-node@cdca7365b2dadb8aad0a33bc7601856ffabcc48e         # v4.3.0
- uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065       # v5
- uses: actions/setup-go@d60b41a563a30594ed7f4be95e5c1b9ee7a90f22           # v5

# Caching and artifacts
- uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684               # v4
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02    # v4
- uses: actions/download-artifact@95815c38cf2ff2164869cbab79da8d1f422bc89e  # v4

# Docker
- uses: docker/setup-buildx-action@b5730f4d1e9a0e4e527a0d0c82d36049843ba85e  # v3
- uses: docker/login-action@74a5d142397b4f367a81961eba4e8cd7edddf772         # v3
- uses: docker/build-push-action@14487ce63c7a62a4a324b0bfb37086795e31c6c1    # v6

# Cloud authentication (OIDC)
- uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502  # v4
- uses: google-github-actions/auth@71fee32a0bb7e97b4d33d548e7d957010649d8fa            # v3
- uses: azure/login@a457da9ea143d694b1b9c7c869ebb04ebe844b6f                          # v2

# Attestation
- uses: actions/attest-build-provenance@c074443f1aee8d4aeeae555aebba3282517141b2       # v2

# Monorepo path filtering
- uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36                   # v3.0.2
```
