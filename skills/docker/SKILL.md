---
name: docker
description: "Build and secure container images. Use for Dockerfiles, multi-stage builds, Compose, buildx, image signing, SBOM, health checks, or container debugging."
user-invocable: true
---

# Docker — Container Build & Runtime

Use the current supported release of every base image and tool. Tags in this skill are placeholders; example versions live in the references.

## Hard Rules

- NEVER run containers as root in production — numeric `USER` (for example `65532`) or a `:nonroot` base tag
- NEVER use `FROM image:latest` — pin a version tag, and a digest for production; pair digest pins with an update bot, or pinned bases silently stop getting security patches
- NEVER put secrets in Dockerfile instructions, `ARG`, or `ENV` — use `--mount=type=secret` at build time and mounted files or a secret store at runtime
- NEVER `COPY . .` before the dependency install — it busts the dependency layer
- ALWAYS include a `.dockerignore` (`.git`, dependency folders, `.env*`, build output, secrets)
- ALWAYS use exec-form `CMD`/`ENTRYPOINT` (JSON array) so the app is PID 1 and receives signals
- ALWAYS lint Dockerfiles (`hadolint`) in CI

---

## Multi-Stage Build Pattern

Build tools stay in the build stage; only runtime artifacts reach the final image. Install from the lockfile, copy source after the install, copy the runtime dependencies and build output into a minimal non-root image.

```dockerfile
FROM node:<lts>-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --omit=dev

FROM gcr.io/distroless/nodejs<lts>-debian<N>:nonroot
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["dist/server.js"]
```

Order instructions from least to most changing: base image, system packages, lockfile and dependency install, source, build. A changed layer invalidates every layer after it. Language variants (Node, Python, Go, Rust), cache mounts, and monorepo builds: [dockerfile-patterns.md](references/dockerfile-patterns.md).

## Base Image Decision Tree

```
Need a shell or package manager in the runtime image?
├── Yes → slim or alpine variant (musl: check native-library compatibility),
│         or a minimal distro-style image that has a package manager
└── No
    ├── Static binary → scratch (add CA certificates and a numeric USER)
    └── Needs a language runtime → distroless or another minimal runtime image
```

Prefer minimal bases that publish an SBOM and signatures, and verify them rather than trusting a vendor's "zero CVE" claim. Vendor names and comparison: [dockerfile-patterns.md](references/dockerfile-patterns.md).

## Runtime Behaviour

- **PID 1 and signals**: exec-form `CMD` makes the app PID 1, which ignores signals it has no handler for. The app must handle `SIGTERM` and drain; for shells, wrappers, or child processes add an init (`docker run --init`, `init: true` in Compose, or a tiny init in the image).
- **Shutdown**: set `STOPSIGNAL` if the app expects something other than `SIGTERM`, and make the stop grace period longer than the drain time. Shutdown semantics: `reliability` and `backend`.
- **Health checks without curl**: shell-less images cannot run `curl`. Use a built-in subcommand of the app binary, a small static health binary, or leave probing to the orchestrator. Semantics of liveness vs readiness: `reliability`.
- **Debugging shell-less containers**: a debug container that joins the target's namespaces (`docker run --rm -it --pid container:<id> --network container:<id> <debug-image>`), `kubectl debug` on Kubernetes, or a `:debug` variant of the base; `docker debug` where your Docker distribution provides it. Do not ship a shell in the production image just for debugging.

## Compose

Compose describes local development and single-host stacks. Use `depends_on` with `condition: service_healthy`, profiles for optional services, file-based secrets, and `develop.watch` for file sync. Production Compose and patterns: [compose-patterns.md](references/compose-patterns.md).

## Buildx, BuildKit & Bake

Buildx is the default builder. Use cache mounts for package caches, secret mounts for credentials, and Bake for multi-target builds.

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t registry.example.com/app:1.2.3 --push .
docker buildx bake                       # all targets in docker-bake.hcl, in parallel
TAG=1.2.3 docker buildx bake api         # HCL variables are overridden by environment variables
docker buildx bake api --set api.tags=registry.example.com/api:1.2.3   # override target attributes
```

`docker init` scaffolds a Dockerfile, Compose file, and `.dockerignore` for common languages; review the result against the rules above.

## Security & Supply Chain

- [ ] Non-root, numeric user; minimal base image
- [ ] No secrets in layers, `ARG`, or `ENV`
- [ ] Runtime hardening: read-only root filesystem (`--read-only` plus tmpfs), `--cap-drop=ALL` and add back only what is needed, `no-new-privileges`
- [ ] Image scan in CI (`trivy`, `grype`, `docker scout`)
- [ ] Base digests pinned and kept current by an update bot
- [ ] SBOM and provenance attached at build (`--sbom=true`, `--provenance=mode=max`), image signed (`cosign`, keyless)

Controls, verification, and policy gates: `security` (supply chain). Pipeline wiring: `ci-cd`.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Running as root | Container escape lands as host root | Numeric `USER` or `:nonroot` base |
| Shell-form `CMD` | A shell becomes PID 1 and swallows `SIGTERM`; slow, killed shutdowns | Exec-form `CMD` plus a signal handler or init |
| `latest` or floating tags in production | Non-reproducible builds, surprise breakage | Version tag plus digest, updated by a bot |
| Digest pins with no update path | Base image never gets security patches | Dependabot or Renovate bumps the digest |
| Fat base images for static or runtime-only apps | Larger attack surface and size | `scratch`, distroless, or slim |
| Secrets in `ARG`, `ENV`, or `COPY .env` | Visible in image history | Build secret mounts, runtime secret files |
| One image, many services | Any change rebuilds and redeploys everything | One image per deployable |
| Installing debug tools in the production image | Larger surface, drift from what runs | A namespace-joining debug container or `kubectl debug` |

---

## Related Knowledge

- **kubernetes** — images built here run in clusters (probes, security context)
- **ci-cd** — pipelines that build, scan, and push images
- **release-engineering** — tagging, promotion, rollback of image versions
- **security** — supply chain integrity and hardening
- **reliability** — health semantics and graceful shutdown
- **observability** — container logging and health integration

## References

- [dockerfile-patterns.md](references/dockerfile-patterns.md) — Language Dockerfiles, BuildKit features, bake, monorepo builds, `.dockerignore`, debugging, image sources (load for concrete templates and example versions)
- [compose-patterns.md](references/compose-patterns.md) — Compose dependencies, profiles, networks, volumes, secrets, multi-file and production setups
