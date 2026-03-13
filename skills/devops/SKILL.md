---
name: devops
description: Review and implement containerization, CI/CD pipelines, deployment strategies, reverse proxy, and infrastructure. Use when working with Dockerfiles, Compose, pipelines, deploy scripts, SSL/TLS, secrets, or IaC. Do NOT use for monitoring or incident response (use sre).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# DevOps & Platform Engineering

You ANALYZE, DESIGN, IMPLEMENT, and REVIEW infrastructure — containers, pipelines, deployments, reverse proxies, and platform configuration. You write and modify Dockerfiles, Compose files, CI configs, deploy scripts, and IaC manifests.

## Domain

| Area | Scope |
|------|-------|
| Containerization | Multi-stage builds, layer caching, non-root containers, multi-arch, security scanning |
| Orchestration | Docker Compose, container networking, service dependencies, resource limits |
| CI/CD Pipelines | Universal pipeline stages, caching, artifacts, secrets, branch strategies |
| Deployment | Rolling updates, blue-green, canary, rollback strategies, zero-downtime |
| Reverse Proxy | SSL/TLS termination, WebSocket upgrade, rate limiting, security headers |
| Security | Secrets management, supply chain security (SBOM, image signing), dependency scanning |
| IaC & GitOps | Infrastructure as code concepts, declarative config, drift detection |

## NOT Your Domain

- Monitoring and observability design --> sre
- Graceful shutdown patterns --> sre
- Health check design (liveness, readiness) --> sre
- Incident response procedures --> sre

## Quick Reference

| Task | Resource |
|------|----------|
| Audit infrastructure | Read `workflows/review.md` -- full review protocol |
| Container patterns | Read `references/container-patterns.md` -- builds, caching, security |
| Pipeline patterns | Read `references/pipeline-patterns.md` -- CI/CD stages, caching, secrets |
| Deployment patterns | Read `references/deployment-patterns.md` -- strategies, rollback, proxy |

## Review Protocol (Summary)

1. **Discovery** -- scan for Dockerfiles, compose files, CI configs, deploy scripts, proxy configs, IaC manifests
2. **Analysis** -- evaluate against checklists (containerization, pipeline, deployment, security)
3. **Report** -- structured assessment with infrastructure map, findings, recommendations

Full protocol with checklists: `workflows/review.md`

## Decision Trees

### Container Runtime

```
Which container runtime?
+-- Docker (default, widest ecosystem)
+-- Podman (rootless, daemonless, OCI-compatible)
+-- Nix (reproducible builds, NixOS deployments)
```

### CI/CD Platform

```
Pipeline platform?
+-- GitHub Actions (GitHub-hosted repos)
+-- GitLab CI (GitLab-hosted repos)
+-- Jenkins / Tekton / Dagger (self-hosted, complex needs)
+-- Any platform: universal stages apply (lint --> test --> build --> push --> deploy)
```

### Deployment Target

```
Where to deploy?
+-- Single server (VPS) --> Docker Compose + SSH deploy
+-- Container orchestration --> Kubernetes, Nomad, ECS
+-- Serverless --> Cloud Functions, Lambda, Fly.io, Railway
+-- Edge --> Cloudflare Workers, Deno Deploy
```

### Reverse Proxy

```
Which reverse proxy?
+-- nginx (mature, widely deployed, manual config)
+-- Caddy (automatic HTTPS, simple config, HTTP/3)
+-- Traefik (Docker-native, auto-discovery, dashboard)
+-- Cloud LB (AWS ALB, GCP LB -- managed, auto-scaling)
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

## New Project?

When setting up infrastructure from scratch:

| Decision | Options | Default recommendation |
|----------|---------|----------------------|
| **Containerization** | Docker, Podman, Nix | Docker (widest ecosystem) |
| **Orchestration (dev)** | Docker Compose, Tilt, Skaffold | Docker Compose |
| **Orchestration (prod)** | Kubernetes, Nomad, ECS, Fly.io, Railway | Docker Compose + VPS for small; K8s for scale |
| **CI/CD** | GitHub Actions, GitLab CI, Dagger | Match your repo host |
| **Reverse proxy** | Caddy, nginx, Traefik | Caddy (automatic HTTPS, simple config) |
| **IaC** | Terraform, Pulumi, SST, CloudFormation | Terraform for multi-cloud; SST for AWS serverless |

Start with Docker Compose + Caddy on a single VPS. Scale to orchestration when needed.
