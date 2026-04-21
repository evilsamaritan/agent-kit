# GitLab CI/CD

GitLab CI/CD reference for pipelines, components, DAG, environments, security scanning, and secrets.
Covers features available in GitLab 17.x and 18.x.

## Contents

- [Pipeline Basics](#pipeline-basics)
- [Stages vs DAG](#stages-vs-dag)
- [Rules Syntax](#rules-syntax)
- [Reusability](#reusability)
- [CI/CD Components and Catalog](#cicd-components-and-catalog)
- [Parent-Child Pipelines](#parent-child-pipelines)
- [Multi-Project Pipelines](#multi-project-pipelines)
- [Caching and Artifacts](#caching-and-artifacts)
- [Monorepo Patterns](#monorepo-patterns)
- [Environments and Deployment](#environments-and-deployment)
- [Review Apps](#review-apps)
- [Auto DevOps](#auto-devops)
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
  image: node:22-alpine
  before_script:
    - npm ci --cache .npm
  after_script:
    - echo "Job complete"

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

### Stages (sequential)

Stages run in order. All jobs in a stage must complete before the next stage begins.
Use stages when the order matters and jobs in the same stage have no dependencies between them.

```yaml
stages:
  - build
  - test
  - deploy

build-backend:
  stage: build

build-frontend:
  stage: build       # runs in parallel with build-backend

test-unit:
  stage: test        # waits for ALL build jobs to complete
```

### DAG with needs (parallel by dependency)

`needs:` allows a job to start as soon as its listed dependencies complete, skipping stage barriers.
This can reduce pipeline wall-clock time by 50-80% for complex pipelines.

```yaml
stages:
  - build
  - test
  - deploy

build-backend:
  stage: build
  script: make build-backend
  artifacts:
    paths: [dist/backend/]

build-frontend:
  stage: build
  script: make build-frontend
  artifacts:
    paths: [dist/frontend/]

test-backend:
  stage: test
  needs: [build-backend]          # starts immediately when build-backend finishes
  script: make test-backend

test-frontend:
  stage: test
  needs: [build-frontend]         # does not wait for build-backend
  script: make test-frontend

deploy:
  stage: deploy
  needs: [test-backend, test-frontend]
  script: make deploy
```

**Key rules for needs:**
- `needs: []` means the job has no dependencies and starts immediately when the pipeline begins.
- Jobs referenced in `needs:` must exist in a prior or same stage.
- By default, `needs:` downloads artifacts from listed jobs. Add `artifacts: false` when only ordering is required.

```yaml
test-fast:
  stage: test
  needs:
    - job: build-backend
      artifacts: false   # only wait for completion, skip artifact download
```

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
# Run on MR and default branch pushes only
deploy-staging:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Run only when specific files changed (monorepo path filter)
frontend-build:
  rules:
    - changes:
        - frontend/**/*
        - package-lock.json

# Manual gate on production deploy (only on main)
deploy-production:
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
      allow_failure: false   # blocks pipeline until approved

# Combine if + changes: run on MR only when backend changed
test-backend:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - backend/**/*
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Skip on schedules, run everywhere else
build:
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
      when: never
    - when: on_success

# Delayed job (wait before running)
canary-promote:
  rules:
    - when: delayed
      start_in: "30 minutes"
```

### rules:changes behavior on new branches

On new branches where there is no previous commit to diff against, `rules:changes` evaluates to true (all files are considered changed). Use `rules:changes` combined with `rules:if` to avoid unintended runs on first-push branches.

```yaml
frontend-test:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - frontend/**/*
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

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

  # CI/CD Catalog component (GitLab 17.0+)
  - component: gitlab.com/my-group/my-component/build@v1.0.0
    inputs:
      node_version: "22"
```

### extends

Inherit and override job configuration within the same file. Uses deep merge: arrays are replaced, hashes are merged.

```yaml
.base-test:
  image: node:22-alpine
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

Reference specific sections from other jobs, avoiding full inheritance.

```yaml
.setup-node:
  before_script:
    - npm ci --cache .npm

.setup-docker:
  services:
    - docker:dind

build:
  before_script:
    - !reference [.setup-node, before_script]
  services:
    - !reference [.setup-docker, services]
  script:
    - npm run build
    - docker build .
```

---

## CI/CD Components and Catalog

CI/CD components (GA in GitLab 17.0) are reusable, versioned pipeline configuration units published to the CI/CD Catalog. They replace copy-pasted template snippets with discoverable, versioned imports.

### Component project structure

```
my-ci-component/
├── .gitlab-ci.yml          # pipeline that publishes the component
└── templates/
    └── build.yml           # the component definition
```

### Component definition with spec:inputs

```yaml
# templates/build.yml
spec:
  inputs:
    node_version:
      default: "22"
      description: "Node.js version to use"
    run_tests:
      type: boolean
      default: true
    test_command:
      default: "npm test"
      description: "Command to run tests"

---

build-node:
  image: node:$[[ inputs.node_version ]]-alpine
  script:
    - npm ci
    - npm run build

test-node:
  image: node:$[[ inputs.node_version ]]-alpine
  script:
    - $[[ inputs.test_command ]]
  rules:
    - if: $[[ inputs.run_tests ]]
```

### Consuming a catalog component

```yaml
include:
  - component: gitlab.com/my-org/node-pipeline/build@v2.3.1
    inputs:
      node_version: "22"
      test_command: "npm run test:ci"
```

**Key points:**
- Components are versioned by git tags. Pin to a specific version in production.
- `$[[ inputs.name ]]` is the interpolation syntax (distinct from `$VARIABLE`).
- The CI/CD Catalog is browsable at `gitlab.com/explore/catalog` and your self-hosted GitLab's `/explore/catalog`.
- GitLab 18.0 provides a project template for creating new component projects.

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

### Child pipeline (apps/frontend/.gitlab-ci.yml)

```yaml
stages:
  - build
  - test
  - deploy

build:
  stage: build
  script: npm run build

test:
  stage: test
  script: npm test
```

**strategy: depend** mirrors the downstream pipeline status back to the parent trigger job. Without it, the trigger job succeeds immediately after launching the child pipeline.

**When to use parent-child:**
- Monorepos with independent services
- Configs that exceed `.gitlab-ci.yml` complexity limits
- Isolating failure domains between services

---

## Multi-Project Pipelines

Multi-project pipelines trigger downstream pipelines in a different GitLab project (cross-repo).

```yaml
# In project A: trigger deploy pipeline in project B
trigger-deploy:
  stage: deploy
  trigger:
    project: my-group/deployment-repo
    branch: main
    strategy: depend
  variables:
    IMAGE_TAG: $CI_COMMIT_SHA
    DEPLOY_ENV: staging
```

**Passing variables downstream:**
```yaml
trigger-deploy:
  trigger:
    project: my-group/deployment-repo
  variables:
    UPSTREAM_PROJECT: $CI_PROJECT_NAME
    UPSTREAM_SHA: $CI_COMMIT_SHA
    # Forward all variables from current pipeline
  inherit:
    variables: true
```

**Access requirement:** The user who created the upstream pipeline must have at least Developer access to the downstream project.

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

**Per-branch cache key** (avoids cross-branch contamination):

```yaml
cache:
  key: "$CI_COMMIT_REF_SLUG"
  paths:
    - node_modules/
```

**Fallback key** (use branch cache if available, else use default):

```yaml
cache:
  key:
    files: [package-lock.json]
    prefix: $CI_COMMIT_REF_SLUG
  paths: [.npm/]
```

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

### Distributed cache (self-hosted runners)

For teams with multiple self-hosted runners, configure an S3-compatible backend so all runners share the same cache pool:

```toml
# /etc/gitlab-runner/config.toml
[[runners]]
  [runners.cache]
    Type = "s3"
    [runners.cache.s3]
      BucketName = "gitlab-runner-cache"
      BucketLocation = "us-east-1"
```

---

## Monorepo Patterns

### Path-filtered jobs with rules:changes

```yaml
frontend-lint:
  rules:
    - changes:
        - apps/frontend/**/*
        - packages/ui/**/*
        - package-lock.json
  script: npm run lint --workspace=apps/frontend

backend-test:
  rules:
    - changes:
        - apps/backend/**/*
        - packages/shared/**/*
  script: go test ./apps/backend/...
```

### Per-service child pipelines (recommended for large monorepos)

```yaml
# Root .gitlab-ci.yml
stages: [triggers]

.trigger-template:
  stage: triggers

frontend:
  extends: .trigger-template
  trigger:
    include: apps/frontend/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes: [apps/frontend/**/*]

backend:
  extends: .trigger-template
  trigger:
    include: apps/backend/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes: [apps/backend/**/*]
```

### Parallel matrix builds

```yaml
build:
  parallel:
    matrix:
      - SERVICE: [frontend, backend, worker]
  script:
    - make build SERVICE=$SERVICE
  artifacts:
    paths:
      - dist/$SERVICE/
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

### Environment tiers

GitLab recognizes environment tier names for grouping in the UI: `production`, `staging`, `testing`, `development`, `other`.

```yaml
deploy-production:
  environment:
    name: production
    tier: production
    deployment_tier: production
```

### Deployment strategies in GitLab CI

**Manual approval gate:**
```yaml
deploy-production:
  stage: deploy
  environment: production
  when: manual
  allow_failure: false   # blocks the pipeline until manually triggered
  script: ./deploy.sh production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

**Canary deployment:**
```yaml
deploy-canary:
  stage: deploy
  environment:
    name: production/canary
  script: ./deploy.sh --canary 10   # route 10% of traffic
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual

deploy-stable:
  stage: deploy
  environment:
    name: production
  needs: [deploy-canary]
  script: ./deploy.sh --full
  when: manual
```

**Protected environments** restrict who can trigger deployment jobs. Configure in Settings > CI/CD > Protected environments. Combined with `when: manual`, only allowed roles can deploy to production.

---

## Review Apps

Review apps create a temporary, live environment for each merge request, letting reviewers test changes against a running application before merging.

```yaml
deploy-review:
  stage: deploy
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.review.example.com
    on_stop: stop-review
    auto_stop_in: 5 days
  script:
    - ./scripts/deploy-review.sh $CI_COMMIT_REF_SLUG
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

stop-review:
  stage: deploy
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    action: stop
  script:
    - ./scripts/destroy-review.sh $CI_COMMIT_REF_SLUG
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: manual
```

**Review app URL** appears in the MR widget when `environment:url` is set. The URL must be accessible to reviewers.

**auto_stop_in** prevents forgotten review environments from accumulating costs. GitLab stops the environment after the configured idle period. The environment can be manually restarted.

---

## Auto DevOps

Auto DevOps provides a convention-based CI/CD pipeline requiring minimal configuration. GitLab detects the project language and applies appropriate templates for build, test, security scanning, code quality, and deployment.

**Enable via:** Settings > CI/CD > Auto DevOps > Default to Auto DevOps pipeline.

**Stages Auto DevOps provides:**
- Build: Heroku buildpacks or Dockerfile
- Test: language-detected test runners
- Code Quality: Code Climate analysis
- SAST, Dependency Scanning, Container Scanning, DAST, Secret Detection
- Deploy to Kubernetes (requires configured cluster and base domain)
- Review Apps (Kubernetes only)
- Performance testing

**When Auto DevOps works well:**
- Standard web apps deployable to Kubernetes
- Teams wanting full DevSecOps with zero pipeline config
- Projects following Heroku-style conventions

**When to write a custom pipeline instead:**
- Non-Kubernetes deployment targets
- Monorepos with multiple services
- Custom build systems or non-standard project layouts
- Fine-grained control over stages and caching

---

## Security Scanning

GitLab provides built-in security scanners via includeable CI templates. Most scanners produce reports viewable in the MR security widget and the project's Security Dashboard (GitLab Ultimate).

### Available scanners

| Scanner | Template | What it scans | When to run |
|---------|----------|---------------|-------------|
| SAST | `Security/SAST.gitlab-ci.yml` | Source code for logic flaws | Every push |
| Advanced SAST | `Security/Advanced-SAST.gitlab-ci.yml` | Cross-file, deeper analysis (Ultimate) | Every push |
| DAST | `Security/DAST.gitlab-ci.yml` | Running application endpoints | Against deployed review/staging app |
| Container Scanning | `Security/Container-Scanning.gitlab-ci.yml` | Image OS packages and libraries | After image build |
| Dependency Scanning | `Security/Dependency-Scanning.gitlab-ci.yml` | Known CVEs in project dependencies | Every push |
| Secret Detection | `Security/Secret-Detection.gitlab-ci.yml` | Leaked credentials in code history | Every push |
| License Compliance | `Security/License-Scanning.gitlab-ci.yml` | License compatibility | Every push or scheduled |
| Infrastructure IaC Scanning | `Security/SAST-IaC.gitlab-ci.yml` | Terraform, Kubernetes, CloudFormation | Every push |

### Including security templates

```yaml
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
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

### External secrets: AWS Secrets Manager (GA in GitLab 18.3)

```yaml
job:
  id_tokens:
    AWS_OIDC_TOKEN:
      aud: https://gitlab.example.com
  secrets:
    DB_PASSWORD:
      aws_secrets_manager:
        name: production/db/password
        region: us-east-1
  script:
    - ./deploy.sh
```

AWS OIDC authentication requires an IAM OIDC identity provider and role configured for the GitLab project's token claims.

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
        version: latest
```

---

## Runners

### Runner types

| Type | Scope | Use case |
|------|-------|---------|
| Shared | All projects on the instance | General workloads (GitLab.com hosted) |
| Group | All projects in a group | Team-specific tooling, credentials |
| Project-specific | One project | Specialized hardware, isolated secrets |

### Runner executors

| Executor | When to use |
|----------|------------|
| `docker` | Most CI workloads; clean environment per job |
| `kubernetes` | Scalable, cloud-native runner pools |
| `shell` | Simple, no Docker; runs as the runner OS user |
| `docker+machine` | Auto-scaling with cloud VMs (deprecated in favor of Fleeting) |
| `fleeting` | Auto-scaling with cloud VMs (GitLab's modern approach) |

### Runner selection with tags

```yaml
build-gpu:
  tags:
    - gpu
    - linux
  script: python train.py

build-arm:
  tags:
    - arm64
    - docker
  script: make build
```

A job runs on a runner that has all the specified tags. Untagged jobs run on any runner that accepts untagged jobs.

### Runner configuration tips

```yaml
# Set explicit timeout to prevent stuck jobs consuming runner capacity
test:
  timeout: 15 minutes

# Mark a job as interruptible so newer pipelines can cancel it
build:
  interruptible: true
```

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
| `latest` image tag in jobs | Non-reproducible, cache-busted every time | Pin image tags (`node:22.11.0-alpine3.20`) |
| Downloading all artifacts in DAG | Slow job startup when only some artifacts needed | Specify `artifacts: false` in `needs:` when files not required |
| Storing secrets as masked variables for multi-line values | GitLab masking only works on single-line values | Use external secrets manager for multi-line secrets |
| Skipping security templates to save time | Vulnerabilities reach production undetected | Run SAST and Secret Detection on every push (they are fast) |

---

## Related

- `references/pipeline-patterns.md` -- universal pipeline stages, GitHub Actions comparison, OIDC federation
- `references/deployment-patterns.md` -- deployment strategies, rollback, blue-green, canary
- GitLab CI YAML reference: https://docs.gitlab.com/ci/yaml/
- CI/CD components docs: https://docs.gitlab.com/ci/components/
- Rules syntax docs: https://docs.gitlab.com/ci/jobs/job_rules/
- Downstream pipelines docs: https://docs.gitlab.com/ci/pipelines/downstream_pipelines/
- External secrets docs: https://docs.gitlab.com/ci/secrets/
