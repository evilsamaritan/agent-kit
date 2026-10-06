# GitLab CI/CD

GitLab CI/CD reference for pipelines, components, DAG, environments, security scanning, and secrets.
Version-specific features are noted as such; check the documentation for your GitLab version. Vendor-neutral concepts (caching, OIDC, secrets, supply chain) are in [pipeline-patterns.md](pipeline-patterns.md); monorepo strategy in [monorepo-ci.md](monorepo-ci.md).

## Contents

- [Pipeline Basics](#pipeline-basics)
- [Stages vs DAG](#stages-vs-dag)
- [Rules Syntax](#rules-syntax)
- [Reusability](#reusability)
- [CI/CD Components and Catalog](#cicd-components-and-catalog)
- [Parent-Child Pipelines](#parent-child-pipelines)
- [Multi-Project Pipelines](#multi-project-pipelines)
- [Caching and Artifacts](#caching-and-artifacts)
- [Environments and Deployment](#environments-and-deployment)
- [Security Scanning](#security-scanning)
- [Variables and Secrets](#variables-and-secrets)
- [Runners](#runners)
- [Anti-Patterns](#anti-patterns)

---

## Pipeline Basics

### .gitlab-ci.yml structure

```yaml
# Define execution stages (order matters for sequential execution)
stages:
  - validate
  - test
  - build
  - scan
  - deploy

# Default settings applied to all jobs unless overridden
default:
  image: node:24-alpine   # example: use a supported release, pin a digest in production
  before_script:
    - npm ci --cache .npm

# Global variables available to all jobs
variables:
  NODE_ENV: test
  FF_USE_FASTZIP: "true"  # GitLab runner feature flag

# A job definition
lint:
  stage: validate
  script:
    - npm run lint
  cache:
    key:
      files: [package-lock.json]
    paths: [.npm/]
    policy: pull
```

### Job keywords reference

| Keyword | Purpose |
|---------|---------|
| `stage` | Assign job to a stage |
| `script` | Commands to execute |
| `image` | Docker image for the job |
| `services` | Sidecar containers (e.g., databases) |
| `variables` | Job-scoped environment variables |
| `rules` | Conditional execution logic (replaces `only`/`except`) |
| `needs` | DAG dependencies, enables out-of-stage execution |
| `cache` | Persist files between jobs for speed |
| `artifacts` | Pass files between jobs, store build output |
| `environment` | Link job to a deployment environment |
| `trigger` | Start a downstream (child or multi-project) pipeline |
| `extends` | Inherit configuration from another job |
| `parallel` | Run multiple instances of the same job |
| `timeout` | Override default job timeout |
| `allow_failure` | Job failure does not block pipeline |
| `interruptible` | Cancel job when newer pipeline starts |

---

## Stages vs DAG

```
Pipeline execution model?
├── Simple, sequential flow → stages (default)
├── Complex dependencies, maximize parallelism → DAG (needs:)
└── Mixed → stages for broad ordering + needs for specific cross-stage deps
```

Stages run in order; every job in a stage finishes before the next stage starts. `needs:` lets a job start as soon as its listed jobs finish, skipping stage barriers, which shortens pipelines with independent branches.

```yaml
test-backend:
  stage: test
  needs: [build-backend]          # starts when build-backend finishes, not when the whole build stage does
  script: make test-backend

test-fast:
  stage: test
  needs:
    - job: build-backend
      artifacts: false            # ordering only, skip the artifact download
  script: make smoke
```

`needs: []` starts a job immediately. By default `needs:` downloads the listed jobs' artifacts.

---

## Rules Syntax

`rules:` replaces the deprecated `only:` / `except:` keywords. Rules are evaluated top-down; the first match wins.

### Condition keywords

| Keyword | Matches when |
|---------|-------------|
| `rules:if` | CI/CD variable expression is true |
| `rules:changes` | Listed files changed compared to previous commit |
| `rules:exists` | Listed files exist in the repository |
| `rules:when` | Controls job scheduling: `on_success`, `manual`, `delayed`, `always`, `never` |

### Common predefined variables

| Variable | Value |
|----------|-------|
| `$CI_PIPELINE_SOURCE` | `push`, `merge_request_event`, `schedule`, `api`, `trigger` |
| `$CI_COMMIT_BRANCH` | Branch name (not set on tag pipelines) |
| `$CI_MERGE_REQUEST_IID` | MR number (only set in MR pipelines) |
| `$CI_COMMIT_TAG` | Tag name (only set on tag pipelines) |
| `$CI_DEFAULT_BRANCH` | The project's default branch (usually `main`) |

### Rules examples

```yaml
# MR pipelines and default-branch pushes only (avoids duplicate branch + MR pipelines)
build:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Path filter (include shared packages and the lockfile)
frontend-build:
  rules:
    - changes: [frontend/**/*, package-lock.json]

# Manual gate on the default branch
deploy-production:
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
      allow_failure: false

# Skip on schedules
build-nightly-skip:
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
      when: never
    - when: on_success
```

### rules:changes on new branches

With no previous commit to compare, `rules:changes` evaluates true on a first push to a new branch outside MR pipelines. Combine it with `rules:if` on `merge_request_event`, where it compares against the target branch.

---

## Reusability

### include

Load external YAML configurations into the pipeline.

```yaml
include:
  # Same repository
  - local: .gitlab/ci/build.yml

  # Another GitLab project (versioned)
  - project: my-group/shared-ci
    ref: v2.1.0
    file: templates/node-build.yml

  # Remote URL
  - remote: https://example.com/shared-pipeline.yml

  # GitLab built-in templates
  - template: Security/SAST.gitlab-ci.yml

  # CI/CD Catalog component
  - component: gitlab.com/my-group/my-component/build@v1.0.0
    inputs:
      node_version: "24"
```

### extends

Inherit and override job configuration within the same file. Uses deep merge: arrays are replaced, hashes are merged.

```yaml
.base-test:
  image: node:24-alpine
  cache:
    key:
      files: [package-lock.json]
    paths: [.npm/]
  before_script:
    - npm ci --cache .npm

unit-test:
  extends: .base-test
  script: npm test

integration-test:
  extends: .base-test
  script: npm run test:integration
  services:
    - postgres:16-alpine
```

Jobs prefixed with `.` are hidden (not executed directly) and serve as templates.

### !reference

`!reference [.job, section]` reuses one section of another job without inheriting the rest (for example `before_script: [!reference [.setup-node, before_script]]`).

---

## CI/CD Components and Catalog

CI/CD components are reusable, versioned pipeline configuration units published to the CI/CD Catalog. They replace copy-pasted template snippets with discoverable, versioned imports.

### Component definition with spec:inputs

```yaml
# templates/build.yml in the component project
spec:
  inputs:
    node_version:
      default: "24"
    test_command:
      default: "npm test"

---

test-node:
  image: node:$[[ inputs.node_version ]]-alpine
  script:
    - $[[ inputs.test_command ]]
```

### Consuming a catalog component

```yaml
include:
  - component: gitlab.com/my-org/node-pipeline/build@v2.3.1
    inputs:
      node_version: "24"
      test_command: "npm run test:ci"
```

**Key points:**
- Components are versioned by git tags; pin a specific version in production and review upgrades.
- `$[[ inputs.name ]]` is the interpolation syntax, distinct from `$VARIABLE`.

---

## Parent-Child Pipelines

Parent-child pipelines split a large `.gitlab-ci.yml` into smaller, service-specific configs. The parent pipeline triggers child pipelines using the `trigger:` keyword.

```
Parent pipeline
├── trigger: apps/frontend/ci.yml   (only when frontend/* changes)
├── trigger: apps/backend/ci.yml    (only when backend/* changes)
└── trigger: infra/ci.yml           (only when infra/* changes)
```

### Parent pipeline (.gitlab-ci.yml)

```yaml
stages:
  - trigger-children

frontend-pipeline:
  stage: trigger-children
  trigger:
    include: apps/frontend/.gitlab-ci.yml
    strategy: depend      # parent waits for child to complete
  rules:
    - changes:
        - apps/frontend/**/*
        - package-lock.json

backend-pipeline:
  stage: trigger-children
  trigger:
    include: apps/backend/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes:
        - apps/backend/**/*
```

The child file is an ordinary pipeline definition. `strategy: depend` mirrors the child's status onto the trigger job; without it the trigger job succeeds as soon as the child starts. Use parent-child for monorepos with independent services, configs that outgrow one file, and isolated failure domains.

---

## Multi-Project Pipelines

```yaml
trigger-deploy:
  stage: deploy
  trigger:
    project: my-group/deployment-repo
    branch: main
    strategy: depend
  variables:
    IMAGE_DIGEST: $IMAGE_DIGEST
```

The user who created the upstream pipeline needs at least Developer access to the downstream project. Pass only the variables the downstream pipeline needs.

---

## Caching and Artifacts

### Cache vs artifacts decision

| | Cache | Artifacts |
|--|-------|-----------|
| **Purpose** | Speed up jobs by reusing downloaded dependencies | Pass files between jobs in the same pipeline |
| **Guarantee** | Best-effort, not guaranteed | Guaranteed within the pipeline |
| **Storage** | Runner local, S3/GCS if configured | GitLab artifact storage |
| **Scope** | Across pipelines | Within a pipeline (and downloadable) |
| **Expire** | Controlled by `cache:` TTL | Controlled by `artifacts:expire_in` |

### Cache configuration

```yaml
build:
  cache:
    # Key based on lockfile hash — invalidates when deps change
    key:
      files:
        - package-lock.json
    paths:
      - .npm/
    # policy: pull-push (default) — download at start, upload at end
    # policy: pull — only download (read-only, faster for test jobs)
    # policy: push — only upload (for jobs that populate cache)
    policy: pull-push
```

**Key by lockfile.** The default is a lockfile-derived key, so branches share one cache. Add a branch prefix only when branches diverge in dependencies often enough that sharing causes churn. The prefix gives one cache per branch and lockfile, with no automatic fallback, so a new branch starts cold unless you add `fallback_keys` (literal keys, for example the default branch's):

```yaml
cache:
  key:
    files: [package-lock.json]
    prefix: $CI_COMMIT_REF_SLUG
  fallback_keys: [main-cache]   # literal key; a default-branch job must write it
  paths: [.npm/]    # cache the package manager's download cache, not node_modules
```

Omit the prefix to share one lockfile-keyed cache across branches.

### Artifacts

```yaml
build:
  script: npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 7 days      # always set an expiry to prevent storage bloat
    when: on_success        # on_success (default) | on_failure | always

test:
  needs: [build]           # downloads build artifacts automatically
  script: npm test
  artifacts:
    reports:
      junit: test-results.xml   # parsed by GitLab for MR test summary
    when: always
    expire_in: 30 days
```

### Distributed cache

Self-hosted runner fleets need an S3-compatible cache backend (`[runners.cache]` in the runner `config.toml`) so runners share one cache pool.

---

## Monorepo Patterns

Use `rules:changes` (include shared packages and the lockfile in the paths) for per-service jobs, or the parent-child pattern above for large monorepos, with `strategy: depend`. `rules:changes` does not follow the dependency graph; a graph-aware tool does ([monorepo-ci.md](monorepo-ci.md)). For fan-out over services use `parallel:matrix`:

```yaml
build:
  parallel:
    matrix:
      - SERVICE: [frontend, backend, worker]
  script: make build SERVICE=$SERVICE
  artifacts:
    paths: [dist/$SERVICE/]
```

---

## Environments and Deployment

### Environment configuration

```yaml
deploy-staging:
  environment:
    name: staging
    url: https://staging.example.com
    on_stop: stop-staging       # job to run when environment is stopped
    auto_stop_in: 1 week        # auto-stop idle environments
  script:
    - ./scripts/deploy.sh staging

stop-staging:
  environment:
    name: staging
    action: stop
  when: manual
  script:
    - ./scripts/teardown.sh staging
```

### Approval gate

```yaml
deploy-production:
  stage: deploy
  environment: production
  when: manual
  allow_failure: false   # blocks the pipeline until triggered
  script: ./deploy.sh production "$IMAGE_DIGEST"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Protected environments restrict who can trigger deployment jobs (Settings > CI/CD > Protected environments). Deployment strategy (canary, blue-green, rollback) belongs to `release-engineering`; the pipeline only triggers it.

---

## Review Apps

A job with `environment: name: review/$CI_COMMIT_REF_SLUG`, a `url`, `on_stop`, and `auto_stop_in` gives each merge request a temporary environment that is stopped automatically; run it only on `merge_request_event` pipelines. Auto DevOps is a convention-based pipeline for standard web apps on Kubernetes; write a custom pipeline for other targets, monorepos, or fine-grained control.

---

## Security Scanning

GitLab provides built-in security scanners via includeable CI templates. Available scanners and tiers change between versions; check the documentation for your version and plan. Reports show in the MR security widget and, on higher tiers, the Security Dashboard. Treat scanners as one layer: see `security` for SAST/DAST guidance.

### Available scanners

| Scanner | Template | What it scans | When to run |
|---------|----------|---------------|-------------|
| SAST | `Security/SAST.gitlab-ci.yml` | Source code for logic flaws | Every push |
| Advanced SAST | `Security/Advanced-SAST.gitlab-ci.yml` | Cross-file, deeper analysis (Ultimate) | Every push |
| DAST | `Security/DAST.gitlab-ci.yml` | Running application endpoints | Against deployed review/staging app |
| Container Scanning | `Security/Container-Scanning.gitlab-ci.yml` | Image OS packages and libraries | After image build |
| Dependency Scanning | `Jobs/Dependency-Scanning.v2.gitlab-ci.yml` (SBOM-based; the legacy `Security/` template is superseded) | Known CVEs in project dependencies; license data via SBOM-based scanning | Every push |
| Secret Detection | `Security/Secret-Detection.gitlab-ci.yml` | Leaked credentials in code history | Every push |
| Infrastructure IaC Scanning | `Security/SAST-IaC.gitlab-ci.yml` | Terraform, Kubernetes, CloudFormation | Every push |

### Including security templates

```yaml
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Jobs/Dependency-Scanning.v2.gitlab-ci.yml
  - template: Security/Secret-Detection.gitlab-ci.yml
  - template: Security/Container-Scanning.gitlab-ci.yml

# Override scanner variables
variables:
  SAST_EXCLUDED_PATHS: "spec,test,docs"
  DS_EXCLUDED_PATHS: "node_modules,vendor"
  CS_IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  SECURE_LOG_LEVEL: info
```

### Scan execution policies

GitLab Ultimate supports scan execution policies (defined in a separate policy project) that enforce security scans across groups, regardless of what individual project pipelines define. This prevents teams from skipping mandatory scans.

### Artifact reports

Security scanner jobs emit GitLab report artifacts that feed the MR widget:

```yaml
sast:
  artifacts:
    reports:
      sast: gl-sast-report.json   # standard output file for SAST template
```

Custom scanners must output in [GitLab's security report schema](https://docs.gitlab.com/development/integrations/secure/) to integrate with the Security Dashboard.

---

## Variables and Secrets

### Variable scopes

| Scope | Where defined | Accessible in |
|-------|--------------|---------------|
| Instance | Admin > CI/CD > Variables | All projects |
| Group | Group > Settings > CI/CD > Variables | All projects in group |
| Project | Project > Settings > CI/CD > Variables | That project |
| Job | `.gitlab-ci.yml` `variables:` block | That job only |

### Variable options

- **Protected**: only available to jobs running on protected branches/tags
- **Masked**: value hidden in job logs (must be a single-line string)
- **Expanded**: controls whether `$VAR` references inside values are expanded
- **Environment-scoped**: available only in jobs targeting a specific environment name

### Defining variables in .gitlab-ci.yml

```yaml
variables:
  # Pipeline-wide (not secret — version control visible)
  NODE_ENV: production
  DOCKER_BUILDKIT: "1"

deploy:
  variables:
    # Job-scoped override
    DEPLOY_TIMEOUT: "120"
  script: ./deploy.sh
```

Never put secrets in `.gitlab-ci.yml`. Use project/group CI/CD variables or an external secrets manager.

### External secrets: HashiCorp Vault

```yaml
job:
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.example.com
  secrets:
    DATABASE_PASSWORD:
      vault: production/db/password@secret    # path@mount
      token: $VAULT_ID_TOKEN
  script:
    - ./deploy.sh  # DATABASE_PASSWORD available as env var
```

GitLab authenticates to Vault using a short-lived JWT (OIDC). No long-lived Vault tokens stored in GitLab.

### External secrets: AWS Secrets Manager

```yaml
job:
  id_tokens:
    AWS_ID_TOKEN:                 # default token name for aws_secrets_manager
      aud: https://gitlab.example.com
  variables:
    AWS_ROLE_ARN: arn:aws:iam::123456789012:role/gitlab-secrets-reader
    AWS_REGION: us-east-1
  secrets:
    DB_PASSWORD:
      aws_secrets_manager:
        secret_id: production/db/password
  script:
    - ./deploy.sh
```

AWS OIDC authentication requires an IAM OIDC identity provider and role configured for the GitLab project's token claims. `aws_secrets_manager` is generally available since GitLab 18.3; older versions need another route (for example OIDC role assumption plus the AWS CLI).

### External secrets: Google Cloud Secret Manager

```yaml
job:
  id_tokens:
    GCP_ID_TOKEN:
      aud: https://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
  secrets:
    API_KEY:
      gcp_secret_manager:
        name: my-api-key
        version: 3       # pin a version; omitting it uses the latest
      token: $GCP_ID_TOKEN
```

---

## Runners

| Type | Use |
|------|-----|
| Shared (instance) | General workloads |
| Group | Team-specific tooling or credentials |
| Project | Specialized hardware, isolated secrets |

Executors: `docker` (clean environment per job; the default choice), `kubernetes` (scalable pools), `shell` (no isolation; runs as the runner user), autoscaling executors for cloud VMs. Select runners with `tags:`; a job runs only on a runner that has all its tags. Set `timeout:` per job and `interruptible: true` on jobs that newer pipelines may cancel.

---

## Anti-Patterns

| Anti-pattern | Why it's harmful | Recommended approach |
|-------------|-----------------|---------------------|
| Using `only:` / `except:` | Deprecated, limited expressiveness, confusing merge behavior | Migrate to `rules:` |
| No `rules:` (runs on every event) | Wasted compute, slow feedback | Add `rules:if` or `rules:changes` filters |
| Cache key without lockfile hash | Stale dependencies silently used | `key.files: [lockfile]` |
| `policy: pull-push` on read-only jobs | Unnecessary cache upload on every test job | `policy: pull` on test/lint jobs |
| No `artifacts:expire_in` | Storage quota consumed by old artifacts | Set `expire_in: 7 days` or appropriate retention |
| Hardcoded secrets in `.gitlab-ci.yml` | Credentials committed to version control | Use CI/CD project variables or external secrets |
| Sequential stages for independent jobs | Longer wall-clock time | Use `needs:` for DAG execution |
| `strategy: depend` omitted on critical triggers | Parent pipeline passes even if child fails | Add `strategy: depend` when child failure should block parent |
| No `when: manual` + protected environments | Any developer can trigger production deploy | Protected environments with required approvals |
| No `timeout:` on jobs | Hung jobs hold runners indefinitely | Set per-job timeout |
| `latest` image tag in jobs | Non-reproducible | Pin image tags, and digests for release jobs |
| Downloading all artifacts in DAG | Slow job startup when only some artifacts needed | Specify `artifacts: false` in `needs:` when files not required |
| Storing secrets as masked variables for multi-line values | GitLab masking only works on single-line values | Use external secrets manager for multi-line secrets |
| Skipping security templates to save time | Vulnerabilities reach production undetected | Run SAST and Secret Detection on every push (they are fast) |

---

## Related

- [pipeline-patterns.md](pipeline-patterns.md) — universal stages, caching, OIDC, supply chain
- `release-engineering` — deployment strategies and rollback
- GitLab CI YAML reference: https://docs.gitlab.com/ci/yaml/
- CI/CD components: https://docs.gitlab.com/ci/components/
- External secrets: https://docs.gitlab.com/ci/secrets/
