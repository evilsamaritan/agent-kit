# Container Patterns

## Contents

- [Multi-Stage Build Pattern](#multi-stage-build-pattern)
- [Layer Caching Strategy](#layer-caching-strategy)
- [Base Image Selection](#base-image-selection)
- [Security Hardening](#security-hardening)
- [Monorepo Build Strategy](#monorepo-build-strategy)
- [Multi-Arch Builds](#multi-arch-builds)
- [Docker Compose Architecture](#docker-compose-architecture)
- [Supply Chain Security](#supply-chain-security)
- [.dockerignore Essentials](#dockerignore-essentials)

---

## Multi-Stage Build Pattern

Separate build-time dependencies from runtime. Produces minimal, secure images.

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine
RUN adduser -D appuser
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER appuser
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

Adapt the pattern to your runtime: Bun, Deno, Go, Rust, Python, Java, etc. The principle is the same -- build tools stay in the build stage, only artifacts reach runtime.

---

## Layer Caching Strategy

Order layers from least-changed to most-changed:

```
1. Base image (rarely changes)
2. System dependencies (rarely changes)
3. Lockfile copy (changes when deps change)
4. Dependency install (cached if lockfile unchanged)
5. Source code copy (changes every commit)
6. Build step (runs when source changes)
```

Cache-busting rule: any layer change invalidates all subsequent layers. Place expensive operations (dependency install) before frequently changing layers (source code).

---

## Base Image Selection

| Image Type | When to Use | Trade-off |
|-----------|------------|-----------|
| `alpine` variants | General purpose, small footprint | May need musl compatibility |
| `distroless` | Production, security-focused | No shell, harder to debug |
| `slim` variants | Need glibc compatibility | Larger than alpine |
| Full OS images | Development, debugging | Large, unnecessary in production |

Prefer pinned tags (`node:22.1-alpine`) over floating tags (`node:latest`, `node:22`) for reproducibility.

---

## Security Hardening

1. **Non-root user** -- always create and switch to a non-root user in runtime stage
2. **Read-only filesystem** -- mount with `--read-only` where possible, use tmpfs for temp dirs
3. **No secrets in layers** -- never COPY .env files; use runtime injection
4. **Minimal packages** -- only install what the application needs
5. **Image scanning** -- integrate Trivy, Grype, or Snyk into CI pipeline
6. **Signed images** -- use cosign or Notary for image provenance

```dockerfile
# Non-root pattern
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Read-only with tmpfs
# docker run --read-only --tmpfs /tmp myimage
```

---

## Monorepo Build Strategy

When a monorepo has shared packages, each service needs the full workspace context for dependency resolution but should produce a minimal image.

**Pattern: Root-context, per-service target**

```dockerfile
# Build from repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
WORKDIR /app

# 1. Copy lockfile + all package.json files for workspace resolution
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN npm ci --frozen-lockfile

# 2. Copy source (after install for caching)
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY tsconfig.json ./

# 3. Build
RUN npm run --workspace=apps/api build

# 4. Runtime (minimal)
FROM node:22-alpine
RUN adduser -D appuser
WORKDIR /app
COPY --from=base /app/apps/api/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
USER appuser
CMD ["node", "dist/index.js"]
```

---

## Multi-Arch Builds

Build images for multiple CPU architectures (amd64, arm64) when deploying across different hardware.

```bash
# Create a multi-arch builder
docker buildx create --name multiarch --use

# Build and push for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag registry.example.com/myapp:v1.0.0 \
  --push .
```

CI integration: most CI platforms support buildx. Use QEMU emulation or native runners per architecture.

---

## Docker Compose Architecture

### Service Dependencies

```yaml
services:
  api:
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    restart: unless-stopped
    networks:
      - internal
      - public

  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - internal

networks:
  internal:
    internal: true
  public:

volumes:
  db-data:
```

### Environment Management

- Use `.env` files for local development
- Use Compose override files: `docker-compose.override.yml` for dev-specific config
- Use Compose profiles (`--profile dev`, `--profile test`) for selective service startup

---

## Supply Chain Security

### SBOM Generation

Software Bill of Materials tracks every dependency in your container image.

```bash
# Generate SBOM with syft
syft myimage:tag -o spdx-json > sbom.json

# Scan SBOM for vulnerabilities
grype sbom:sbom.json
```

### Image Signing

Sign images to verify provenance and integrity.

```bash
# Sign with cosign
cosign sign --key cosign.key registry.example.com/myapp:v1.0.0

# Verify in deployment
cosign verify --key cosign.pub registry.example.com/myapp:v1.0.0
```

### Policy Enforcement

- Require signed images in production deployments
- Scan images on push to registry (CI gate)
- Block images with critical CVEs from deployment

---

## .dockerignore Essentials

Always create a `.dockerignore` at the build context root:

```
.git
.github
.env
.env.*
node_modules
dist
*.log
.DS_Store
.vscode
.idea
.claude
**/*.test.*
**/*.spec.*
```

Without .dockerignore, every file in the build context is sent to the Docker daemon, bloating build time and potentially leaking secrets into image layers.
