---
name: backend
description: "Structure service runtime code. Use for request pipelines and middleware order, error mapping to transport codes, service wiring and dependency scopes, config validation, startup/shutdown mechanics, outbound-call defaults, and backend implementation or review."
---

# Backend Service Patterns

How a request flows through a service, how errors reach the client, and how a service starts and stops. Language-agnostic: the patterns apply in any server stack. Code practice inside the service — ownership, explicit dependencies, variant families, errors as a principle — is owned by `development`; this skill adds only what is specific to a service runtime.

## Scope and boundaries

**This skill covers:**
- Service wiring at startup — composition root, dependency scopes (app, request, transient), config validation
- Middleware / interceptor pipelines and their order
- Error mapping — error audiences, mapping to transport codes
- Startup and shutdown mechanics — the order of steps inside the process, the drain implementation
- Request scoping — request ID, trace context, per-request resources
- Outbound-call defaults — where timeouts, retries, and breakers are placed in code

**This skill does not cover:**
- Module and service structure (layers, ports and adapters) → `architecture`; when wiring needs a container → `development` (mechanism rule)
- HTTP/RPC contract design, idempotency keys, rate-limit headers → `api-design`
- Auth (OAuth, JWT, sessions, authorization) → `auth`
- Data access patterns, ORM, schema migrations → `database`; repository and unit of work → `architecture`
- Queue producers/consumers → `message-queues`, `background-jobs`
- Probe semantics, shutdown budgets, retry and breaker policy, SLOs → `reliability`
- Instrumentation → `observability`
- Language idioms → the language skill

## Decision tree — where does this concern go?

```
Does it apply to every request regardless of operation (identity, request ID, logging, limits)?
├─ yes → middleware / interceptor, placed by the order below
└─ no → Is it about the shape of this operation's input?
        ├─ yes → handler-level validation at the transport boundary
        └─ no → Is it a business rule or invariant?
                ├─ yes → the domain owner of that state (`development`), not middleware
                └─ no → Is it about calling another system?
                        ├─ yes → the outbound client wrapper (timeout, retry, breaker)
                        └─ no → composition root (wiring, config, lifecycle)
```

## Core patterns

### Service wiring

- **One composition root.** `main` or a bootstrap module constructs clients, repositories, and handlers and passes them in; how dependencies arrive in domain code follows `development` rule 4.
- **Name the scope of each dependency.** App lifetime (pools, clients), request scope (transaction, request ID, caller identity), transient (per call). A request-scoped value stored in an app-scoped object leaks between requests and between callers.
- **Validate config at startup and fail fast.** Types, formats, and ranges, not just presence; never at request time; never echo secret values in the error.

### Middleware pipeline

Order is outermost-first; each layer wraps everything below it. The error mapper must wrap auth, rate limiting, and validation, or their errors bypass it.

1. Panic / crash recovery
2. Request ID + trace context
3. Error mapping (error → transport code and safe body)
4. Logging (start / end / duration / status)
5. Rate limiting — before authentication, so credential checks are protected
6. Authentication (identity)
7. Body parsing / validation
8. Business handler — authorization runs in the domain or service layer against the object (see `auth`); route-level permission middleware is only a coarse gate

### Error handling

- **Separate error types by audience.** Internal errors carry detail for logs and traces; user-visible errors carry a stable code and a safe message. Never leak stack traces, SQL, or upstream messages.
- **Map at the edge.** Transport codes (HTTP status, gRPC status) are decided once, in the error mapper. Expected domain outcomes map to specific codes; anything unrecognised maps to a generic 500 and is logged with the request ID. The response body format is in `api-design`.
- **Retries need idempotent targets.** Before marking an error retryable, check the operation is idempotent (pattern: `message-queues` → [idempotency-patterns.md](../message-queues/references/idempotency-patterns.md)).

### Startup and shutdown mechanics

- **Startup order.** Validate config → open pools and clients → check migrations are applied (do not run them from every replica; see `database`) → start consumers and workers → bind the port → report ready.
- **Shutdown order is the reverse.** On SIGTERM: fail readiness → wait for the load balancer or registry to deregister the instance → stop accepting connections and pause consumers → drain in-flight work under a deadline → flush buffers and commit offsets → close pools → exit. Force-exit when the deadline passes.
- **Probe endpoints in code.** `/livez` answers from process state alone and makes no dependency calls; `/readyz` reports not-ready during startup and shutdown and checks only what this instance needs to serve. Policy (what each probe may check, drain budget against the orchestrator's grace period, why readiness must not fail on a shared downstream): `reliability`.

### Outbound calls — defaults in code

- **Every outbound call has a timeout.** Connect timeout short (about 1–3 s); total per-call budget derived from the caller's remaining deadline, which is propagated downstream.
- **Retries, backoff, breakers, bulkheads** live in one client wrapper per dependency, not in handlers, and follow the `reliability` policy: retry only idempotent operations or those carrying an idempotency key, full-jitter backoff under a retry budget and the overall deadline, one retry layer, and no retry through an open breaker.

### Verifying a service change

Exercise the changed operation, including one relevant failure: a dependency timeout, a rejected input, a retry of the same request. Check that the error reaches the client with the right code and no internal detail, that a retried write is idempotent, and that shutdown drains the new work.

## Context adaptation

**Implementer:** hand-wire the composition root; install the middleware order on day one; add the shutdown hook with the first long-lived resource.

**Reviewer:** check for leaked internal errors, an error mapper placed inside auth, unbounded outbound calls, request-scoped values in app-scoped objects, unvalidated inbound request IDs, and missing shutdown handling.

## Anti-patterns

- **Big ball of main** — hundreds of lines of startup code with no `newDB` / `newRouter` / `newApp` factories.
- **Middleware soup** — 20+ middlewares, ordering accidental, several of them logging.
- **Error mapper inside the pipeline** — auth and validation errors escape as raw 500s or framework defaults.
- **Catch-all translation** — every exception becomes one business error code; outages look like user mistakes (`development` rule 6).
- **Retry without idempotency** — retrying a POST that charges money.
- **No shutdown hook** — SIGTERM kills the process mid-request; in-flight work disappears.

## Related Knowledge

- `development` — code practice inside the service: ownership, explicit dependencies, variant families, errors
- `architecture` — module and service structure, repository and unit of work, integration patterns (outbox, saga)
- `api-design` — contracts, error body format, idempotency keys, rate-limit headers
- `auth` — identity middleware and authorization placement
- `database` — data access, ORM, migrations
- `reliability` — probe semantics, shutdown budgets, retry and breaker policy
- `observability` — trace context and instrumenting the pipeline

## References

- [service-patterns.md](references/service-patterns.md) — wiring and scopes, config validation, middleware details, request context propagation, startup/shutdown sequences
