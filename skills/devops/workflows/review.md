# DevOps Review Protocol

Step-by-step infrastructure audit procedure. Follow all three phases in order.

## Phase 1: Discovery

Scan the codebase for DevOps artifacts:

1. Dockerfiles (per service, shared, or missing)
2. Container orchestration files (docker-compose.yml, Kubernetes manifests, Nomad jobs)
3. .dockerignore files
4. CI config (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/`)
5. Deploy scripts (`scripts/`, `Makefile`, shell scripts)
6. Reverse proxy config (nginx, Caddy, Traefik)
7. SSL/TLS certificates or ACME config
8. IaC manifests (Terraform, Pulumi, Ansible, CloudFormation)
9. GitOps config (ArgoCD applications, Flux kustomizations)
10. Policy definitions (OPA, Kyverno, Sentinel, Checkov)
11. `.env.example` completeness
12. Build scripts in package manager config (build, start commands)
13. Infrastructure documentation

## Phase 2: Analysis

### Containerization Checklist

- [ ] Each deployable service has a Dockerfile (or equivalent build definition)
- [ ] Builds are multi-stage (build --> runtime)
- [ ] Base image is minimal (alpine, distroless, or slim variants)
- [ ] Layer order optimized (lockfile --> install --> copy source)
- [ ] Non-root user in runtime stage
- [ ] .dockerignore exists and excludes bloat (.git, node_modules, .env, IDE files)
- [ ] Health check defined (Dockerfile HEALTHCHECK or orchestrator-level)
- [ ] No secrets baked into image (no .env, no API keys in build args)
- [ ] Monorepo workspace packages resolved correctly in build context
- [ ] Lockfile copied for reproducible installs
- [ ] Multi-arch builds configured if targeting multiple platforms (amd64/arm64)
- [ ] Image scanning configured (Trivy, Grype, Snyk)

### Container Orchestration Checklist

- [ ] All services (app + infra) defined in orchestration config
- [ ] Health checks on all services with dependencies
- [ ] Dependency ordering with health conditions (not just startup order)
- [ ] Resource limits set (memory, CPU)
- [ ] Restart policy appropriate (unless-stopped, on-failure, or equivalent)
- [ ] Networks defined (not just default bridge)
- [ ] Volumes for persistent data, not for code (in production)
- [ ] Environment variables from config files or secrets store, not hardcoded
- [ ] Log driver configured with rotation

### CI/CD Pipeline Checklist

- [ ] Pipeline exists and runs on PR + push to main branch
- [ ] Lint step
- [ ] Type-check step (if applicable)
- [ ] Test step (when tests exist)
- [ ] Build step (container image build per service)
- [ ] Push step (to container registry)
- [ ] Deploy step (automated or gated)
- [ ] Caching: dependency install cache, container layer cache
- [ ] Secrets not exposed in logs (masked in output)
- [ ] Branch protection: required status checks
- [ ] Concurrency control on deploy jobs
- [ ] SBOM generation (if supply chain security required)
- [ ] Image signing (if supply chain security required)
- [ ] OIDC workload identity (no long-lived cloud credentials)

### GitOps / IaC Checklist

- [ ] Infrastructure defined in version-controlled files (not manual)
- [ ] Changes go through pull requests (audit trail)
- [ ] Drift detection enabled (GitOps operator or scheduled plan)
- [ ] Environment promotion strategy defined (dev --> staging --> prod)
- [ ] Policy as code enforced (admission control, IaC validation)
- [ ] Ephemeral environments configured for PR-based testing (if applicable)

### Deployment Checklist

- [ ] Deploy script/process exists and is idempotent
- [ ] Immutable image tags (not `latest` in production)
- [ ] Health check gate before marking deploy as success
- [ ] Rollback procedure documented and tested
- [ ] Database migration runs before new service version
- [ ] Disk cleanup: prune strategy for old images/containers
- [ ] Log rotation configured
- [ ] Auto-restart on host reboot (systemd, orchestrator, or equivalent)
- [ ] Zero-downtime strategy (rolling update, blue-green, or canary)

### Reverse Proxy Checklist

- [ ] Reverse proxy configured for all public services
- [ ] SSL/TLS with auto-renewal (ACME/Let's Encrypt or equivalent)
- [ ] WebSocket upgrade headers for applicable endpoints
- [ ] Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, CSP)
- [ ] Rate limiting on sensitive endpoints
- [ ] Custom error pages (502/503 during deploy)
- [ ] Access logs with request timing
- [ ] Upstream health checks or failover

### Security Checklist

- [ ] No secrets in container images or git
- [ ] `.env.example` documents all vars without real values
- [ ] CI secrets in platform secret store, not hardcoded
- [ ] Dependency vulnerability scanning in pipeline
- [ ] Container image scanning in pipeline
- [ ] Non-root containers in production
- [ ] Network segmentation (internal services not exposed)
- [ ] SSH hardened (key-only auth, non-root user, fail2ban or equivalent)
- [ ] Firewall rules: minimal port exposure
- [ ] API keys have minimal permissions (principle of least privilege)

## Phase 3: Report

Use this format for the assessment:

```
## DevOps Assessment

### Summary
[1-3 sentences on overall infrastructure and deployment readiness]

### Infrastructure Map (ASCII)
[Current topology: host --> proxy --> containers --> services --> infra]

### Build Pipeline Status
| Service | Build Config | Build Works | Image Size | Registry |
|---------|-------------|-------------|------------|----------|

### CI/CD Pipeline
| Stage | Implemented? | Platform/Tool | Notes |
|-------|-------------|---------------|-------|

### Container Orchestration Review
| Service | Health Check | Dependencies | Resource Limits | Restart | Network |
|---------|-------------|--------------|-----------------|---------|---------|

### Deployment Readiness
| Aspect | Status | Notes |
|--------|--------|-------|

### GitOps / IaC Status
| Aspect | Status | Notes |
|--------|--------|-------|

### Findings
| # | Area | Severity | Finding | Recommendation |
|---|------|----------|---------|----------------|

### Security Posture
| Check | Status | Notes |
|-------|--------|-------|

### Recommended Pipeline
[ASCII: trigger --> lint --> types --> test --> build --> push --> deploy --> health check]

### Recommendations
1. [Priority order]
```
