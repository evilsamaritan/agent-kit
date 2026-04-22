---
name: docker
description: Build and secure container images. Use when writing Dockerfiles, multi-stage builds, Compose v2, buildx/bake, distroless/Chainguard, SBOM, image signing, health checks, or docker init. Do NOT use for orchestration (use kubernetes) or CI/CD pipelines (use ci-cd).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Docker — Container Build & Runtime

## Hard Rules

- NEVER run containers as root in production — use `USER nonroot` or `USER 1001`
- NEVER use `FROM image:latest` — pin version + digest for reproducibility
- NEVER put secrets in Dockerfile instructions — use `--mount=type=secret` or runtime env
- NEVER `COPY . .` before dependency install — cache-busts dependency layer
- ALWAYS include a `.dockerignore` — exclude `.git`, `node_modules`, `.env*`, secrets
- ALWAYS lint Dockerfiles with `hadolint` before committing

---

## Multi-Stage Build Pattern

```dockerfile
# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Stage 2: Runtime (minimal)
FROM gcr.io/distroless/nodejs22-debian12
COPY --from=builder /app/dist /app
WORKDIR /app
CMD ["server.js"]
```

Pattern: install deps, copy source, build, copy artifacts to minimal runtime image.

## Layer Caching Strategy

Order Dockerfile instructions from least-changing to most-changing:

```
1. Base image         (rarely changes)
2. System packages    (changes monthly)
3. Dependencies       (changes weekly)  ← COPY package*.json + install
4. Source code        (changes daily)   ← COPY . .
5. Build step         (changes daily)
```

**Cache-busting rule:** Any changed layer invalidates all subsequent layers.

## Dockerfile Best Practices

| Practice | Do | Don't |
|----------|-----|-------|
| Copy deps first | `COPY package*.json ./` then `RUN npm ci` | `COPY . .` then `RUN npm ci` |
| Non-root user | `USER nonroot` or `USER 1001` | Run as root |
| Copy vs Add | `COPY` for files | `ADD` (unless extracting tar or URL) |
| One process | One CMD per container | Multiple services in one container |
| .dockerignore | Include `node_modules`, `.git`, `*.md` | No .dockerignore (bloated context) |
| Specific tags | `FROM node:22.14-slim` | `FROM node:latest` |
| Combined RUN | `RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*` | Separate RUN per package |
| Lint Dockerfiles | `hadolint Dockerfile` | No linting (inconsistent, error-prone) |

## Base Image Decision Tree

```
Need shell/debugging?
├── Yes → Alpine (~5MB) or Wolfi (~6MB, fewer CVEs)
└── No
    ├── Static binary? → scratch (0MB base)
    └── Runtime needed? → distroless or Chainguard (~2-20MB)
```

Chainguard images: zero known CVEs, rebuilt nightly, include SBOM + Sigstore signatures + SLSA Build Level 2 attestations.

## Scaffolding with `docker init`

Run `docker init` in a project directory to generate a production-ready Dockerfile, compose.yaml, and .dockerignore. Detects language (Go, Node, Python, Rust, Java) and applies multi-stage build patterns automatically.

```bash
docker init    # interactive — detects project, asks port + entry point
```

## Compose v2 Patterns

```yaml
services:
  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    profiles: ["app"]

  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
    volumes:
      - pgdata:/var/lib/postgresql/data

secrets:
  db_password:
    file: ./secrets/db_password.txt

volumes:
  pgdata:
```

Key features: `depends_on` + `condition: service_healthy`, `profiles`, `secrets`, `develop.watch` (file sync without rebuild).

## Buildx, BuildKit & Bake

Buildx is the default builder. Bake is GA — use it for multi-target builds.

```bash
# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t app:latest .

# Cache mount (persistent package cache across builds)
RUN --mount=type=cache,target=/root/.npm npm ci

# Secret mount (build-time secrets, not in layer)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci

# Bake — declarative multi-target builds (docker-bake.hcl)
docker buildx bake                                    # build all targets in parallel
docker buildx bake api --var TAG=1.2.3                # single target + variable
```

Bake: define build targets in HCL/JSON/Compose. Parallelizes independent targets. Supports remote cache, policies, and `--var` for CLI variable overrides.

## Security & Supply Chain Checklist

- [ ] Non-root user (`USER nonroot` / `USER 1001`)
- [ ] Minimal base image (distroless, Chainguard, Alpine, scratch)
- [ ] No secrets in image layers (use `--mount=type=secret` or runtime env)
- [ ] Read-only root filesystem (`--read-only`)
- [ ] Drop all capabilities (`--cap-drop=ALL --cap-add=NET_BIND_SERVICE`)
- [ ] Scan images for CVEs (`trivy`, `grype`, `docker scout`)
- [ ] Pin image digests for production (`FROM node@sha256:abc123...`)
- [ ] Generate SBOM (`docker buildx build --sbom=true`)
- [ ] Sign images (`cosign sign`, Sigstore keyless)
- [ ] Verify provenance (SLSA attestations, `cosign verify-attestation`)
- [ ] Lint Dockerfiles (`hadolint`)

## Health Check Patterns

| Type | Use Case | Example |
|------|----------|---------|
| HTTP | Web services | `curl -f http://localhost:3000/health` |
| TCP | Database/cache | `pg_isready`, `redis-cli ping` |
| Command | Custom logic | `test -f /tmp/healthy` |

---

## Context Adaptation

**DevOps** — Multi-stage builds for CI/CD, registry caching, multi-arch builds, Compose for local dev, supply chain (SBOM, signing, scanning in CI).

**Security** — Non-root containers, read-only filesystems, capability dropping, build-time secrets (`--mount=type=secret`), runtime secrets (env, mounted files), pinned digests, Sigstore attestations, Chainguard base images.

**SRE** — Health check patterns (HTTP, TCP, command), resource limits, OOM prevention, graceful shutdown via STOPSIGNAL, logging drivers, restart policies.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Running as root | Container escape = host root | `USER nonroot` in Dockerfile |
| Fat base images (ubuntu, debian) | 100MB+ bloat, larger attack surface | Alpine, Chainguard, distroless, or scratch |
| `latest` tag in production | Non-reproducible builds, surprise breakage | Pin specific version + digest |
| `COPY . .` before dependency install | Cache-busts dependency layer on every code change | Copy lockfile first, install, then copy source |
| No .dockerignore | Bloated build context, secrets leaked | Ignore `.git`, `node_modules`, secrets |
| Hardcoded secrets in Dockerfile | Secrets baked into image layers | Build secrets (`--mount=type=secret`) or runtime env |
| No SBOM or image signing | Invisible supply chain, unverifiable provenance | `--sbom=true`, cosign sign, Sigstore attestations |
| Skipping Dockerfile linting | Inconsistent, insecure patterns slip in | `hadolint` in CI pipeline |

---

## Related Knowledge

- **kubernetes** — container images built here run in Kubernetes clusters
- **devops** — CI/CD pipelines that build, scan, and push images
- **security** — container security hardening, supply chain integrity
- **observability** — container logging drivers, health check integration

## References

- [dockerfile-patterns.md](references/dockerfile-patterns.md) — Language-specific Dockerfile patterns, optimization techniques, and BuildKit features
- [compose-patterns.md](references/compose-patterns.md) — Compose v2 advanced patterns, networking, volumes, and production configurations
- [container-patterns.md](references/container-patterns.md) — General container runtime patterns, security, restart policies

Load references when you need language-specific Dockerfile templates or complex Compose configurations.
