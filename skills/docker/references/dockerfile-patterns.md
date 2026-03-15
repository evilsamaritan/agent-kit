# Dockerfile Patterns

Language-specific Dockerfile patterns, optimization techniques, and BuildKit features.

## Contents

- [Language-Specific Dockerfiles](#language-specific-dockerfiles) — Node.js, Python, Go, Rust
- [BuildKit Features](#buildkit-features) — Cache mounts, build secrets, multi-platform, bake
- [Optimization Techniques](#optimization-techniques) — .dockerignore, image size, layer ordering
- [Health Check Patterns](#health-check-patterns) — HTTP, database, without curl
- [Security Patterns](#security-patterns) — Non-root, read-only, capabilities, scanning
- [Debug Containers](#debug-containers) — Debug stage, netshoot
- [Supply Chain Security](#supply-chain-security) — SBOM, signing, base images

---

## Language-Specific Dockerfiles

### Node.js (TypeScript)

```dockerfile
# Build stage
FROM node:22-slim AS builder
WORKDIR /app

# Dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Source + build
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build
RUN npm prune --production

# Runtime stage
FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["dist/server.js"]
```

### Python (FastAPI / Django)

```dockerfile
FROM python:3.13-slim AS builder
WORKDIR /app

# System deps for compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Virtual env + dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.13-slim
WORKDIR /app

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Runtime system deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 && rm -rf /var/lib/apt/lists/*

COPY . .
RUN useradd -r -s /bin/false appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Go

```dockerfile
FROM golang:1.26-alpine AS builder
WORKDIR /app

# Dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /server ./cmd/server

# Scratch for minimal image (static binary needs no runtime)
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /server /server

EXPOSE 8080
ENTRYPOINT ["/server"]
```

### Rust

```dockerfile
FROM rust:1.85-slim AS builder
WORKDIR /app

# Cache dependencies (dummy build)
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Real build
COPY src/ src/
RUN touch src/main.rs  # invalidate cache for main.rs
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/myapp /
ENTRYPOINT ["/myapp"]
```

---

## BuildKit Features

### Cache Mounts (Persistent Package Cache)

```dockerfile
# npm — cache across builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# pip
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# apt
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y curl

# Go modules
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Cargo
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && cp target/release/myapp /usr/local/bin/
```

### Build Secrets (Never in Image Layer)

```dockerfile
# Mount secret at build time — NOT stored in any layer
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci

# Docker build command:
# docker build --secret id=npmrc,src=.npmrc .
```

### Multi-Platform Builds

```dockerfile
# Automatic platform args
FROM --platform=$BUILDPLATFORM golang:1.26 AS builder
ARG TARGETPLATFORM TARGETOS TARGETARCH

RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /server

FROM --platform=$TARGETPLATFORM gcr.io/distroless/static
COPY --from=builder /server /server
```

```bash
# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag myapp:latest \
  --push .
```

### Buildx Bake (Declarative Multi-Target Builds)

```hcl
# docker-bake.hcl — define multiple targets declaratively
variable "TAG" { default = "latest" }

group "default" {
  targets = ["api", "worker"]
}

target "api" {
  dockerfile = "Dockerfile"
  target     = "api"
  tags       = ["registry.example.com/api:${TAG}"]
  platforms  = ["linux/amd64", "linux/arm64"]
  cache-from = ["type=registry,ref=registry.example.com/api:cache"]
  cache-to   = ["type=registry,ref=registry.example.com/api:cache,mode=max"]
}

target "worker" {
  dockerfile = "Dockerfile"
  target     = "worker"
  tags       = ["registry.example.com/worker:${TAG}"]
  platforms  = ["linux/amd64", "linux/arm64"]
}
```

```bash
# Build all targets in parallel
docker buildx bake

# Build specific target with variable override
docker buildx bake api --set *.args.TAG=1.2.3
```

---

## Optimization Techniques

### .dockerignore Template

```
.git
.github
.vscode
node_modules
dist
build
*.md
LICENSE
.env*
.DS_Store
docker-compose*.yml
Dockerfile*
.dockerignore
coverage
.nyc_output
*.test.*
*.spec.*
__tests__
```

### Reducing Image Size

| Technique | Savings |
|-----------|---------|
| Multi-stage build | 50-90% — only copy artifacts |
| Alpine base | ~95% vs debian (5MB vs 120MB) |
| Distroless | ~97% vs debian (2-20MB) |
| `npm prune --production` | Remove devDependencies |
| `--ldflags="-w -s"` (Go) | Strip debug info (~30% smaller binary) |
| `.dockerignore` | Faster builds, smaller context |
| Combined RUN + cleanup | Fewer layers, no residual cache |

### Layer Ordering Cheat Sheet

```
FROM base                          # Rarely changes
RUN apt-get install system-deps    # Monthly
COPY lockfile ./                   # Weekly (dependency updates)
RUN install-deps                   # Weekly (uses lockfile cache)
COPY source-code ./                # Daily
RUN build                          # Daily
```

---

## Health Check Patterns

### HTTP Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Without curl (Smaller Image)

```dockerfile
# Use wget (available in alpine)
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use custom binary
COPY --from=builder /app/healthcheck /usr/local/bin/
HEALTHCHECK CMD healthcheck
```

### Database Health Checks

```dockerfile
# PostgreSQL
HEALTHCHECK CMD pg_isready -U postgres || exit 1

# MySQL
HEALTHCHECK CMD mysqladmin ping -h localhost || exit 1

# Redis
HEALTHCHECK CMD redis-cli ping || exit 1

# MongoDB
HEALTHCHECK CMD mongosh --eval "db.adminCommand('ping')" || exit 1
```

---

## Security Patterns

### Non-Root User

```dockerfile
# Create user in build stage
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Switch before CMD
USER appuser

# Or use numeric UID (works with distroless)
USER 1001
```

### Read-Only Filesystem

```bash
docker run --read-only \
  --tmpfs /tmp:rw,noexec,nosuid \
  --tmpfs /var/run:rw,noexec,nosuid \
  myapp:latest
```

### Drop Capabilities

```bash
docker run \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --security-opt=no-new-privileges \
  myapp:latest
```

### Image Scanning

```bash
# Trivy
trivy image myapp:latest

# Grype
grype myapp:latest

# Docker Scout
docker scout cves myapp:latest

# Snyk
snyk container test myapp:latest
```

---

## Debug Containers

```dockerfile
# Debug stage (optional, not used in production)
FROM builder AS debug
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget net-tools procps strace
CMD ["sh"]
```

```bash
# Build debug target only
docker build --target debug -t myapp:debug .

# Or attach to running container
docker exec -it <container-id> sh

# Or use debug image alongside
docker run --rm -it --network container:<target> nicolaka/netshoot
```

---

## Supply Chain Security

- **SBOM**: `docker buildx build --sbom=true` generates Software Bill of Materials during build
- **Image signing**: `cosign sign` / `cosign verify` (Sigstore keyless by default)
- **Secure base images**: Chainguard (~zero CVEs, SBOM + Sigstore included), Wolfi-base (has apk), distroless (no shell/package manager)
- **Linting**: `hadolint Dockerfile` for best-practice checks; use `hadolint/hadolint-action@v3` in CI

| Image Source | Shell | CVE Count | SBOM + Signatures |
|-------------|-------|-----------|-------------------|
| distroless | No | Low | No |
| Chainguard | No (static) / Yes (dev) | ~Zero | Yes (Sigstore) |
| Alpine | Yes | Low-Medium | No |
| Wolfi-base | Yes | ~Zero | Yes (Sigstore) |
