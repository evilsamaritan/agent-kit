---
name: devops
description: Review and implement containerization, CI/CD pipelines, deployment strategies, reverse proxy, and infrastructure. Use when working with Dockerfiles, Compose, pipelines, deploy scripts, SSL/TLS, secrets, IaC, GitOps, or platform engineering. Do NOT use for monitoring or incident response (use sre).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# DevOps & Platform Engineering

Analyze, design, implement, and review infrastructure -- containers, pipelines, deployments, reverse proxies, GitOps, and platform configuration. Write and modify Dockerfiles, Compose files, CI configs, deploy scripts, and IaC manifests.

## NOT Your Domain

- Monitoring and observability design --> sre
- Graceful shutdown patterns --> sre
- Health check design (liveness, readiness) --> sre
- Incident response procedures --> sre
- Application-level security (XSS, CSRF, auth) --> security

## Domain

| Area | Scope |
|------|-------|
| Containerization | Multi-stage builds, layer caching, non-root containers, multi-arch, security scanning |
| Orchestration | Docker Compose, container networking, service dependencies, resource limits |
| CI/CD Pipelines | Universal pipeline stages, caching, artifacts, secrets, branch strategies |
| Deployment | Rolling updates, blue-green, canary, rollback strategies, zero-downtime |
| Reverse Proxy | SSL/TLS termination, WebSocket upgrade, rate limiting, security headers |
| Supply Chain Security | SBOM generation, image signing, SLSA provenance, dependency scanning, OIDC federation |
| IaC & GitOps | Declarative config, drift detection, reconciliation loops, policy as code |
| Platform Engineering | Developer self-service, ephemeral environments, internal developer platforms |

## Quick Reference

| Task | Resource |
|------|----------|
| Audit infrastructure | Read `workflows/review.md` -- full review protocol |
| Container patterns | Read `references/container-patterns.md` -- builds, caching, security |
| Pipeline patterns | Read `references/pipeline-patterns.md` -- CI/CD stages, caching, secrets |
| Deployment patterns | Read `references/deployment-patterns.md` -- strategies, rollback, proxy, IaC |
| GitHub Actions | Read `references/github-actions.md` -- triggers, OIDC, pinning, caching, matrix, environments |
| GitLab CI/CD | Read `references/gitlab-ci.md` -- pipelines, DAG, components, security scanning, review apps |
| Monorepo CI/CD | Read `references/monorepo-ci.md` -- affected builds, Turborepo, Nx, Docker in monorepos |

## Review Protocol (Summary)

1. **Discovery** -- scan for Dockerfiles, compose files, CI configs, deploy scripts, proxy configs, IaC manifests
2. **Analysis** -- evaluate against checklists (containerization, pipeline, deployment, security)
3. **Report** -- structured assessment with infrastructure map, findings, recommendations

Full protocol with checklists: `workflows/review.md`

## Decision Trees

### Container Runtime

```
Which container runtime?
├── Docker (default, widest ecosystem)
├── Podman (rootless, daemonless, OCI-compatible)
└── Nix (reproducible builds, NixOS deployments)
```

### CI/CD Platform

```
Pipeline platform?
├── GitHub-hosted repo --> GitHub Actions
├── GitLab-hosted repo --> GitLab CI
├── Self-hosted / complex needs --> Jenkins, Tekton, Dagger
└── Any platform: universal stages apply (lint --> test --> build --> push --> deploy)
```

### Deployment Target

```
Where to deploy?
├── Single server (VPS) --> Docker Compose + SSH deploy
├── Small team, few services --> managed PaaS (Fly.io, Railway, Render)
├── Multi-service at scale --> container orchestration (Kubernetes, Nomad, ECS)
├── Event-driven / spiky traffic --> serverless (Lambda, Cloud Functions)
└── Low latency globally --> edge (Cloudflare Workers, Deno Deploy)
```

### Reverse Proxy

```
Which reverse proxy?
├── Need automatic HTTPS + simple config --> Caddy
├── Docker-native auto-discovery --> Traefik
├── Mature, widest ecosystem --> nginx
└── Managed, auto-scaling --> cloud load balancer (ALB, GCP LB)
```

### IaC Tool

```
Infrastructure as code?
├── Multi-cloud, large provider ecosystem --> Terraform / OpenTofu
├── Developers prefer real languages --> Pulumi
├── AWS-only, serverless-first --> SST / CDK
├── Configuration management, server setup --> Ansible
└── Simple VPS, few resources --> shell scripts (grow into IaC when complexity increases)
```

### GitOps Operator

```
Need GitOps reconciliation?
├── UI, team RBAC, fast onboarding --> ArgoCD
├── Modular, library approach, multi-source --> FluxCD
└── No Kubernetes --> file-based deploy with git as source of truth
```

## Universal Pipeline Stages

```
lint --> test --> build --> scan --> push --> deploy --> verify
```

| Stage | What | Fail = block? |
|-------|------|---------------|
| **Lint** | Code style, formatting, type check | Yes |
| **Test** | Unit + integration, coverage gate | Yes |
| **Build** | Compile, bundle, container image | Yes |
| **Scan** | Dependency audit, SAST, container scan | Yes (critical/high) |
| **Push** | Push image to registry, tag with SHA + semver | Yes |
| **Deploy** | Apply to target environment | Yes |
| **Verify** | Smoke test, health check, rollback trigger | Yes |

Optimization techniques, caching strategies, monorepo patterns, examples: `references/pipeline-patterns.md`

## Multi-Environment Strategy

```
dev --> staging --> production

dev:        auto-deploy on merge to main
staging:    auto-deploy after dev passes, runs E2E
production: manual approval gate after staging passes
```

Ephemeral environments: spin up per-PR preview environments for isolated testing. Auto-destroy on merge/close. Reduces staging bottlenecks and enables parallel feature validation.

## Supply Chain Security

| Level | What to implement |
|-------|-------------------|
| **Baseline** | SBOM generation (syft/trivy), dependency scanning in CI, .dockerignore |
| **Intermediate** | Image signing (cosign/sigstore), OIDC for CI cloud auth (no long-lived keys), registry scanning |
| **Advanced** | SLSA provenance (build attestations), policy enforcement (deploy only signed + scanned images), keyless signing |

OIDC federation replaces static credentials: CI authenticates to cloud providers via short-lived tokens tied to repo/branch identity.

## Policy as Code

Enforce governance programmatically, not manually.

```
Where to enforce policy?
├── Kubernetes admission --> Kyverno (YAML-native) or OPA/Gatekeeper (Rego)
├── IaC pre-deploy --> Sentinel, OPA, Checkov, tfsec
├── CI pipeline --> cost guardrails, security gates, environment TTLs
└── Runtime --> network policies, RBAC, resource quotas
```

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| `latest` tag in production | Cannot rollback, cannot audit | Immutable tags (git SHA, semver) |
| Secrets in image layers | Exposed in registry, layer cache | Runtime injection (env vars, mounted secrets) |
| No .dockerignore | Bloated images, leaked files | Exclude .git, node_modules, .env, IDE files |
| Root user in containers | Privilege escalation risk | Non-root user, read-only filesystem |
| No build cache strategy | Slow CI, wasted compute | Lockfile-first layer ordering, registry cache |
| No rollback plan | Failed deploy = downtime | Tagged images, previous-version quick revert |
| Hardcoded secrets in CI | Rotation requires pipeline changes | CI platform secret store, OIDC for cloud auth |
| Monolithic pipeline | Slow feedback, blocked deploys | Parallel stages, path-filtered triggers |
| Long-lived cloud credentials | Leaked key = full access | OIDC workload identity federation |
| Manual infrastructure changes | Config drift, no audit trail | IaC + GitOps reconciliation |
| No environment TTLs | Forgotten resources waste money | Auto-destroy ephemeral environments on merge/close |

## New Project Setup

```
Start simple, scale when needed:
├── Single VPS --> Docker Compose + Caddy + SSH deploy
├── Growing team --> add CI/CD pipeline + staging environment
├── Multiple services --> container orchestration + GitOps
└── Enterprise --> platform engineering + policy as code + FinOps
```

| Decision | Default recommendation |
|----------|----------------------|
| **Containerization** | Docker (widest ecosystem) |
| **Orchestration (dev)** | Docker Compose |
| **Orchestration (prod)** | Docker Compose + VPS for small; Kubernetes for scale |
| **CI/CD** | Match your repo host (GitHub Actions, GitLab CI) |
| **Reverse proxy** | Caddy (automatic HTTPS, simple config) |
| **IaC** | Terraform/OpenTofu for multi-cloud; SST for AWS serverless |
| **GitOps** | ArgoCD if Kubernetes; git-based deploy scripts otherwise |

## Related Knowledge

Load these skills when the task touches their domain:
- `/docker` -- Dockerfiles, multi-stage builds, security hardening
- `/kubernetes` -- manifests, Helm, Gateway API, RBAC
- `/networking` -- DNS, TLS, load balancing, service mesh
- `/release-engineering` -- semver, feature flags, canary deploys
- `/observability` -- metrics, logging, alerting setup
- `/security` -- application security, auth, secrets management
- `/sre` -- reliability, health checks, incident response
