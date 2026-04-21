---
name: backend
description: Patterns for backend services — dependency injection, middleware, error handling, service lifecycle, resilience, request pipelines. Language-agnostic. Use when building or reviewing services, structuring middleware, designing error contracts, or implementing graceful startup/shutdown. Do NOT use for API protocol choice (use api-design), auth flows (use auth), schemas (use database), or language idioms (use go/rust/kotlin/javascript).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# Backend Service Patterns

Patterns for structuring backend services — how to wire dependencies, organize middleware, handle errors, and manage lifecycle. Language-agnostic: the patterns apply whether you're in Go, Rust, Kotlin, or Node.

## Scope and boundaries

**This skill covers:**
- Dependency injection / wiring / service locator patterns (including tradeoffs)
- Middleware / interceptor pipelines and ordering
- Error handling — error types, wrapping, mapping to transport
- Service lifecycle — startup order, dependency readiness, graceful shutdown
- Resilience patterns — timeouts, retries with jitter, circuit breakers, bulkheads (summary — see `reliability` for depth)
- Request scoping — request ID, trace context, per-request resources

**This skill does not cover:**
- HTTP/REST/GraphQL contract design → `api-design`
- Auth (OAuth, JWT, sessions, RBAC) → `auth`
- Database access patterns → `database`
- Queue producers/consumers → `message-queues`, `background-jobs`
- Observability instrumentation → `observability`
- Deep SRE/SLO work → `reliability`
- Language idioms → `go`, `rust`, `kotlin`, `javascript`

## Decision tree — picking a structure

```
Does the service handle one transport (HTTP only)?
├─ yes → flat layered structure: handlers → services → repositories
└─ no → ports-and-adapters: domain core + adapters per transport (HTTP, queue, CLI)

Does the service have > 10 collaborators wired at startup?
├─ yes → formal DI (constructor injection, explicit wiring module)
└─ no → hand-wired composition in main/bootstrap — keep it explicit and readable
```

## Core patterns

### Dependency injection

- **Constructor injection** is the default. Dependencies arrive through the constructor / factory function and stay immutable.
- **Avoid service locators / global state** — they hide dependencies and break tests.
- **Do not build DI frameworks for a small service.** Explicit wiring in `main` is simpler until the service has > ~20 collaborators.
- **Scope matters.** Singleton (app lifetime), request-scoped (per-request), transient (new per call) — name the scope explicitly.

### Middleware pipeline

Standard ordering, outermost first:

1. Panic / crash recovery
2. Request ID + trace context
3. Logging (start / end / duration)
4. Authentication (identity)
5. Authorization (permissions)
6. Rate limiting
7. Body parsing / validation
8. Business handler
9. Error mapping (exception → transport-level error)

Do not skip the early middleware — if your handler throws before the logging middleware runs, you won't know.

### Error handling

- **Separate error types by audience.** Internal errors (for logs, observability) vs user-visible errors (for the response). Never leak stack traces to users.
- **Wrap, don't replace.** When crossing a layer boundary, wrap the lower-layer error with context ("reading user %d from db: %w") rather than losing it.
- **Map at the edge.** Transport-level error codes (HTTP 4xx/5xx, gRPC codes) are decided at the outermost error mapper, not sprinkled through handlers.
- **Retries + idempotency go together.** A retryable error must point to an idempotent operation, or it's a bug.

### Service lifecycle

- **Startup order.** Open DB connections → verify migrations → warm caches → start background workers → *then* bind the HTTP/gRPC port. Readiness checks fail until the port is bound and dependencies are green.
- **Graceful shutdown.** On SIGTERM: stop accepting new connections → drain in-flight requests (with a deadline) → close DB/queue connections → exit. Budget per step; refuse to hang indefinitely.
- **Health vs readiness.** *Health* = "the process is alive". *Readiness* = "can handle traffic". They are not the same endpoint.

### Resilience — defaults

- **Timeouts everywhere.** No unbounded calls to external systems. Default 1–3s, tune per dependency.
- **Retry with jitter + budget.** Exponential backoff + full jitter. Cap total retries to a budget (e.g., 3 attempts, 30s total), not just attempt count.
- **Circuit breaker for dependencies that degrade.** Open on sustained failure; half-open probes before fully closing.
- **Bulkhead the worst neighbor.** Don't let one slow downstream exhaust the whole connection pool.

## Context adaptation

**As implementer (building a new service):** pick the simplest structure; explicit wiring beats DI framework for < 20 collaborators. Install the standard middleware ordering on day one.

**As reviewer (auditing a service):** check for leaked stack traces, unbounded timeouts, missing request IDs, missing shutdown handling. These are the top four bugs that reach production.

**As architect (designing a service):** decisions here are style guides for the team, not per-service. The middleware ordering and error-type taxonomy should be the same across all services in the same team.

**As operator (operating a service):** if readiness fails, the startup sequence is usually the culprit. The lifecycle section is your first read.

## Anti-patterns

- **Big ball of main** — hundreds of lines of startup code in `main` with no decomposition into `newApp` / `newRouter` / `newDB` factories.
- **Middleware soup** — 20+ middlewares, ordering accidental, half of them doing logging.
- **Panic-driven error handling** — relying on panic/recover as control flow instead of explicit error returns.
- **Shared global mutable state** — package-level singletons that everyone reaches into. Kills tests, hides dependencies.
- **Retry without idempotency** — retrying a POST that charges money. Once is the limit until you can prove it's idempotent.
- **No shutdown hook** — SIGTERM kills the process mid-request, in-flight work disappears.

## Related Knowledge

- `api-design` — contracts before this skill's patterns apply
- `auth` — identity/authorization middleware
- `database` — data access patterns
- `reliability` — SLO-driven resilience
- `observability` — instrumenting the middleware stack
- `go` / `rust` / `kotlin` / `javascript` — language-specific idioms for DI, error types, lifecycle

## References

- [service-patterns.md](references/service-patterns.md) — detailed patterns with language-agnostic examples
