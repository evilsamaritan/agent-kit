# Dockerfile Patterns

Language Dockerfiles, BuildKit features, monorepo builds, `.dockerignore`, debugging, and image sources.

Example versions (as of 2026-10): Node 24 (Node 26 becomes LTS on 2026-10-28), Python 3.14, Go 1.27, Rust 1.99, Debian 13 for distroless. Replace them with the current supported release and pin a digest in production, kept current by an update bot.

## Contents

- [Language-Specific Dockerfiles](#language-specific-dockerfiles) — Node.js, Python, Go, Rust
- [BuildKit Features](#buildkit-features) — Cache mounts, build secrets, multi-platform, bake
- [Monorepo Builds](#monorepo-builds) — Root context, turbo prune, selective COPY
- [Optimization Techniques](#optimization-techniques) — .dockerignore, image size
- [Health Check Patterns](#health-check-patterns) — HTTP, database, without curl
- [Security Patterns](#security-patterns) — Non-root, read-only, capabilities, scanning
- [Debug Containers](#debug-containers) — namespace-joining debug container, `docker debug`, debug stage, netshoot
- [Supply Chain and Image Sources](#supply-chain-and-image-sources) — SBOM, signing, base images

---

## Language-Specific Dockerfiles

Every runtime stage ends as a numeric non-root user. Use the lockfile-strict install of your package manager (`npm ci`, `pnpm install --frozen-lockfile`, `yarn install --immutable`, `pip install --require-hashes` or a locked resolver).

### Node.js (TypeScript)

```dockerfile
FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build && npm prune --omit=dev

FROM gcr.io/distroless/nodejs24-debian13:nonroot
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["dist/server.js"]
```

The `:nonroot` tag runs as UID 65532. `--ignore-scripts` skips install scripts; add back a rebuild step for dependencies that compile native code.

### Python (FastAPI / Django)

```dockerfile
FROM python:3.14-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.14-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin appuser
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1
COPY --chown=appuser . .
USER 10001
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Go

```dockerfile
FROM golang:1.27-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-w -s" -o /server ./cmd/server

# Static binary needs no runtime; add CA certificates for outbound TLS
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /server /server
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/server"]
```

`scratch` has no `/tmp` and no timezone data; copy them or use `gcr.io/distroless/static:nonroot` if the app needs them.

### Rust

```dockerfile
FROM rust:1.99-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release --locked
COPY src/ src/
RUN touch src/main.rs && cargo build --release --locked

FROM gcr.io/distroless/cc-debian13:nonroot
COPY --from=builder /app/target/release/myapp /myapp
ENTRYPOINT ["/myapp"]
```

The dummy-build trick caches dependencies; a dedicated cache tool or cache mounts are alternatives. Use a `musl` target with `scratch` for fully static binaries.

---

## BuildKit Features

### Cache Mounts

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN --mount=type=cache,target=/go/pkg/mod go mod download
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release --locked && cp target/release/myapp /usr/local/bin/
```

A cache mount is not part of the image; copy build outputs out of any mounted `target` directory in the same `RUN`. Debian-based images delete apt caches by default; disable that behaviour before cache-mounting apt directories.

### Build Secrets

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

```bash
docker build --secret id=npmrc,src=.npmrc .
```

The secret is available only during that `RUN` and is not stored in any layer.

### Multi-Platform Builds

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.27 AS builder
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build -o /server ./cmd/server

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /server /server
ENTRYPOINT ["/server"]
```

Cross-compile on the build platform where the toolchain supports it; QEMU emulation works for everything else but is slow. Native runners per architecture plus a manifest merge is the fastest option in CI.

### Buildx Bake

```hcl
# docker-bake.hcl
variable "TAG" { default = "dev" }

group "default" { targets = ["api", "worker"] }

target "api" {
  target     = "api"
  tags       = ["registry.example.com/api:${TAG}"]
  platforms  = ["linux/amd64", "linux/arm64"]
  cache-from = ["type=registry,ref=registry.example.com/api:cache"]
  cache-to   = ["type=registry,ref=registry.example.com/api:cache,mode=max"]
}

target "worker" {
  target = "worker"
  tags   = ["registry.example.com/worker:${TAG}"]
}
```

```bash
docker buildx bake                                   # all targets in parallel
TAG=1.2.3 docker buildx bake api                     # override an HCL variable (environment variable)
docker buildx bake api --set api.tags=registry.example.com/api:1.2.3   # override a target attribute
docker buildx bake --set "*.args.NODE_ENV=production"                 # override a build arg on all targets
```

---

## Monorepo Builds

Each service needs workspace context to resolve internal packages but should produce a minimal image. Build from the repository root with a per-service Dockerfile: `docker build -f apps/api/Dockerfile .`. Keep a root `.dockerignore`.

### Root context, selective COPY

```dockerfile
FROM node:24-slim AS deps
RUN npm install -g pnpm@<version>
WORKDIR /app
# Install layer: invalidated only when manifests or the lockfile change
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN pnpm --filter @org/shared build && pnpm --filter @org/api build

FROM deps AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter @org/api...

FROM gcr.io/distroless/nodejs24-debian13:nonroot
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
CMD ["apps/api/dist/index.js"]
```

Workspace packages must reach the runtime image with their built output; bundling the service into one file removes this step. Check how your package manager links workspace packages (symlinks into `node_modules` break when only some folders are copied) and, if needed, use its deploy or bundle command to produce a self-contained folder.

### turbo prune

`turbo prune <package> --docker` writes a pruned workspace: `out/json/` (manifests only, for the install layer), `out/full/` (source of needed packages only), and the pruned lockfile.

```dockerfile
FROM node:24-slim AS base
RUN npm install -g pnpm@<version> turbo@<version>

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @org/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@org/api

# Runner: install production dependencies from the pruned lockfile
FROM base AS runner
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/apps/api/dist ./apps/api/dist
USER 1001
CMD ["node", "apps/api/dist/index.js"]
```

The runner needs the pruned lockfile next to the manifests; copying only `package.json` makes a frozen install fail. Built output of workspace dependencies must be copied too, as above.

### Registry layer cache per package

In CI, give each image its own cache scope or ref (`type=gha,scope=api`, or a registry cache ref per image) so layer caches do not collide. Pipeline wiring: `ci-cd`.

---

## Optimization Techniques

### .dockerignore Template

```
.git
.github
.vscode
.idea
node_modules
dist
build
coverage
*.log
*.md
.env
.env.*
.DS_Store
docker-compose*.yml
Dockerfile*
.dockerignore
**/*.test.*
**/*.spec.*
```

Without a `.dockerignore`, the whole directory goes to the builder, slowing builds and risking secrets in layers. Do not ignore files that a `COPY` needs (for example `*.md` when a README is packaged).

### Reducing Image Size

| Technique | Effect |
|-----------|--------|
| Multi-stage build | Only runtime artifacts ship |
| Minimal base (slim, distroless, scratch) | Orders of magnitude smaller than a full distro |
| Prune dev dependencies | `npm prune --omit=dev`, `pnpm install --prod` |
| Strip debug info | `-ldflags="-w -s"` (Go), `strip` (C/Rust) |
| `.dockerignore` | Smaller context, faster builds |
| One `RUN` with cleanup | No residual package caches |

---

## Health Check Patterns

`HEALTHCHECK` feeds Docker and Compose; Kubernetes ignores it and uses its own probes. Health semantics: `reliability`.

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -fsS http://localhost:3000/readyz || exit 1
```

Without curl: `wget --spider` on Alpine, a health subcommand in the app binary (`CMD ["/app", "healthcheck"]`), or a tiny static health binary copied into the image. Database images ship their own tools (`pg_isready`, `mysqladmin ping`, `redis-cli ping`, `mongosh --eval "db.adminCommand('ping')"`).

---

## Security Patterns

```dockerfile
# Debian/Ubuntu-based image
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home app
# Alpine
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app
# Always switch with the numeric ID, which also works on shell-less images
USER 10001:10001
```

```bash
docker run --read-only --tmpfs /tmp:rw,noexec,nosuid \
  --cap-drop=ALL --cap-add=NET_BIND_SERVICE --security-opt=no-new-privileges \
  myapp:1.2.3

trivy image myapp:1.2.3        # or: grype myapp:1.2.3 / docker scout cves myapp:1.2.3
```

Binding ports below 1024 needs `NET_BIND_SERVICE`; prefer an unprivileged port and map it.

---

## Debug Containers

```bash
docker run --rm -it --pid container:<target> --network container:<target> nicolaka/netshoot   # join the target's namespaces; works on any Docker Engine
kubectl debug -it <pod> --image=nicolaka/netshoot --target=<container>   # Kubernetes equivalent (ephemeral container)
docker debug <container>                                   # shell with tooling, no image changes (availability depends on your Docker distribution and plan)
docker exec -it <container> sh                             # only if the image has a shell
```

A debug build stage (`FROM builder AS debug`, `docker build --target debug`) is an option for local use; never deploy it. Distroless publishes `:debug` variants with a shell for troubleshooting.

---

## Supply Chain and Image Sources

Build with `--sbom=true --provenance=mode=max` to attach an SBOM and provenance attestation. `mode=max` records build-argument values and the full Dockerfile, so never pass secrets as build args (`mode=min` is the default). Sign and verify once, in the pipeline:

```bash
cosign sign registry.example.com/myapp@sha256:<digest>              # keyless in CI via OIDC
cosign verify registry.example.com/myapp@sha256:<digest> \
  --certificate-identity <workflow identity> --certificate-oidc-issuer <issuer>
syft registry.example.com/myapp:1.2.3 -o spdx-json > sbom.json && grype sbom:sbom.json
```

Sign digests, not tags. Enforcement (admission policy, SLSA levels, dependency pinning): `security`.

| Base image source | Shell | Notes |
|-------------------|-------|-------|
| distroless (Google) | No (`:debug` has one) | Language runtimes; `:nonroot` tags |
| Chainguard / Wolfi | No (static), yes (dev variants) | Publishes SBOMs and signatures; which tags are free depends on the vendor's current terms |
| Alpine | Yes | musl libc; check native-library compatibility |
| Debian/Ubuntu slim | Yes | glibc; largest of these but most compatible |

Verify claims such as CVE counts against a scan of the exact tag you use.
