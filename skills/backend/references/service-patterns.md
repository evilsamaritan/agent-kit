# Backend Service Patterns — Details

Depth for the backend skill. Adapt the pseudocode to the project's language and framework.

## Contents

- [Wiring and Scopes](#wiring-and-scopes)
- [Config Validation](#config-validation)
- [Middleware Details](#middleware-details)
- [Request Context Propagation](#request-context-propagation)
- [Startup and Shutdown Sequences](#startup-and-shutdown-sequences)
- [Outbound-Call Defaults](#outbound-call-defaults)

---

## Wiring and Scopes

One composition root constructs everything and passes it in. Hand-wiring is the default; a container is a mechanism and follows `development`'s mechanism rule.

```
config   = loadAndValidateConfig(env)            // app scope
db       = newDbPool(config.database)            // app scope
payments = newPaymentClient(config.payments)     // app scope, owns its timeout/retry policy
orders   = newOrderService(db, payments, clock)  // app scope, stateless
router   = newRouter(orders, middleware(config)) // app scope

perRequest(req):                                 // request scope
  ctx = { requestId, traceContext, caller, tx? }
  router.handle(ctx, req)
```

| Scope | Examples | Leak to watch for |
|-------|----------|-------------------|
| App | pools, clients, config, stateless services | holding a request's caller, transaction, or buffer |
| Request | transaction, caller identity, request ID, per-request cache | outliving the request in a background task without its own owner |
| Transient | builders, per-call parsers | none — cheap to create |

Common mistakes:
- Circular construction → one of the two services owns too much; split it.
- Constructing clients inside handlers → new pools per request, exhausted connections.
- A background task started from a request that keeps the request scope → it reads a closed transaction or a stale caller. Give it its own owner (`development` rule 5).

---

## Config Validation

```
schema = {
  DATABASE_URL: required, url
  PORT:         optional, int 1..65535, default 8080
  LOG_LEVEL:    optional, enum [debug, info, warn, error], default info
  API_KEY:      required, secret, min length 16
}
config = validate(env, schema)   // throws at startup, never at request time
```

- Validate types, formats, and ranges, not just presence.
- Group by concern (database, auth, flags) and pass each consumer only its group.
- Mark secrets in the schema so error messages and config dumps mask them.

---

## Middleware Details

Order: see SKILL.md. Notes on individual layers:

**Request ID / trace context**
```
inbound = header("traceparent")                 // W3C Trace Context
if inbound is valid → continue the trace; else → start a new one
requestId = header("X-Request-Id")
if requestId matches ^[A-Za-z0-9._-]{1,64}$ and the caller is a trusted proxy → keep it
else → generate one
attach both to the request context, every log line, and the response header
```
Never write an unvalidated inbound value into logs or response headers: it allows log forging and header bloat. Trace propagation depth: `observability`.

**Error mapping**
```
try: next(ctx)
catch err:
  if err is a known domain or validation error → status + stable code + safe message
  else → 500 + generic message; log err with requestId and stack
```
The mapper decides the code once; handlers return or throw typed errors and never set status codes for domain outcomes.

**Authentication**
Extract credentials, validate, attach the caller to the request context. A missing or invalid credential is 401; token validation rules and response headers: `auth`.

**Rate limiting**
Identify the client (key, user, or address), check the budget, return 429 with `Retry-After` when exceeded. Placed before authentication so credential checks cannot be flooded. Header contract: `api-design`.

---

## Request Context Propagation

What to carry: request ID, trace context, caller identity, deadline.

How to carry it, in order of portability:
1. Explicit parameter (a `ctx` argument) — simplest, visible in signatures.
2. The framework's request context.
3. Async-local / task-local storage — convenient, but invisible; keep it to the request ID and trace context.

Forward the trace context and the remaining deadline on every outbound call. Do not forward caller credentials to third parties.

---

## Startup and Shutdown Sequences

The order of steps is in SKILL.md. Details that make the sequence operable:

- Give each pool and client a bounded connect timeout, so a missing dependency fails startup instead of hanging it.
- On a migration mismatch, refuse to start rather than serving against the wrong schema.
- After failing readiness, keep serving until the load balancer or registry has deregistered the instance, then stop accepting connections.
- Close pools and clients in reverse order of creation.
- Log each step with its duration; a slow drain or close shows up in the shutdown log before it shows up as a forced kill.

Probe semantics and the deadline relative to the orchestrator's grace period: `reliability`.

---

## Outbound-Call Defaults

Each dependency gets one client wrapper that owns its connect timeout (short), a total budget taken from the caller's deadline, its retry policy, and its breaker or concurrency limit. Handlers call the wrapper and never retry on their own. Which errors are retryable, backoff with full jitter, retry budgets, and breaker thresholds: `reliability`. The idempotency precondition: `message-queues` → [idempotency-patterns.md](../../message-queues/references/idempotency-patterns.md).
