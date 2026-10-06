---
name: backend
description: "Structure service runtime and lifecycle. Use for request pipelines and middleware order, error mapping to transport, service wiring, startup/shutdown, readiness, resilience of outbound calls, and backend implementation or review."
user-invocable: true
---

# Backend Service Patterns

Patterns for the runtime of backend services — how a request flows through the pipeline, how errors reach the client, how a service starts, stops, and survives slow dependencies. Language-agnostic: the patterns apply whether you're in Go, Rust, Kotlin, or Node. General code practice — ownership, explicit dependencies, variant families, error handling as a principle — is in `development`.

## Scope and boundaries

**This skill covers:**
- Service wiring at startup — composition root, dependency scopes (app, request, transient)
- Middleware / interceptor pipelines and ordering
- Error mapping — error audiences, mapping to transport codes, retry safety
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
- General code practice: explicit dependencies, ownership, variant families, refactoring → `development`

## Decision tree — picking a structure

```
Does the service handle one transport (HTTP only)?
├─ yes → flat layered structure: handlers → services → repositories
└─ no → ports-and-adapters: domain core + adapters per transport (HTTP, queue, CLI)

How is the service wired?
├─ default → hand-wired composition root in main/bootstrap, explicit and readable
└─ > ~20 collaborators with several scopes → a container, still configured in one place
```

## Core patterns

### Service wiring

- **One composition root.** `main` or a bootstrap module constructs clients, repositories, and handlers and passes them in; handlers never look dependencies up at request time.
- **Name the scope of each dependency.** App lifetime (pools, clients), request scope (transaction, request ID, caller identity), transient (per call). A request-scoped value stored in an app-scoped object leaks between requests.
- **Startup factories, not one long main.** `newDB`, `newRouter`, `newApp` keep wiring readable and testable.

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

### Verifying a service change

Exercise the changed operation or endpoint, including one relevant failure: a dependency timeout, a rejected input, a retry of the same request. Check that the error reaches the client with the right code and no internal detail, that a retried write is idempotent, and that shutdown drains the new work.

## Context adaptation

**As implementer (building a new service):** pick the simplest structure; explicit wiring beats DI framework for < 20 collaborators. Install the standard middleware ordering on day one.

**As reviewer (auditing a service):** check for leaked stack traces, unbounded timeouts, missing request IDs, missing shutdown handling. These are the top four bugs that reach production.

**As architect (designing a service):** decisions here are style guides for the team, not per-service. The middleware ordering and error-type taxonomy should be the same across all services in the same team.

**As operator (operating a service):** if readiness fails, the startup sequence is usually the culprit. The lifecycle section is your first read.

## Anti-patterns

- **Big ball of main** — hundreds of lines of startup code in `main` with no decomposition into `newApp` / `newRouter` / `newDB` factories.
- **Middleware soup** — 20+ middlewares, ordering accidental, half of them doing logging.
- **Panic-driven error handling** — relying on panic/recover as control flow instead of explicit error returns.
- **Retry without idempotency** — retrying a POST that charges money. Once is the limit until you can prove it's idempotent.
- **No shutdown hook** — SIGTERM kills the process mid-request, in-flight work disappears.

## Related Knowledge

- `development` — code practice inside the service: ownership, explicit dependencies, variant families, errors
- `api-design` — contracts before this skill's patterns apply
- `auth` — identity/authorization middleware
- `database` — data access patterns
- `reliability` — SLO-driven resilience
- `observability` — instrumenting the middleware stack
- `go` / `rust` / `kotlin` / `javascript` — language-specific idioms for DI, error types, lifecycle

## References

- [service-patterns.md](references/service-patterns.md) — detailed patterns with language-agnostic examples
