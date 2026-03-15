# Backend Service Patterns

Universal patterns for backend services. Adapt to your project's language and framework.

## Contents

- [Dependency Injection](#dependency-injection)
- [Config Validation](#config-validation)
- [Service Lifecycle](#service-lifecycle)
- [Graceful Shutdown](#graceful-shutdown)
- [Health Checks](#health-checks)
- [Circuit Breaker](#circuit-breaker)
- [Retry with Backoff](#retry-with-backoff)
- [Bulkhead](#bulkhead)
- [Timeout](#timeout)
- [OpenAPI-First Design](#openapi-first-design)
- [Middleware Pipeline Patterns](#middleware-pipeline-patterns)
- [Request Context Propagation](#request-context-propagation)

---

## Dependency Injection

DI decouples service creation from service usage. Every major backend framework/language has a DI approach.

### Core Principles
1. **Constructor injection** — dependencies passed in at construction, not fetched at runtime
2. **Singletons for stateful resources** — DB pools, message queues, loggers: create once, share everywhere
3. **Transient for stateless handlers** — request handlers, use cases: new instance per invocation (or per request scope)
4. **No service locator** — do not call `container.get(ServiceName)` inside business logic; inject what you need
5. **Register in one place** — one container/module file that wires everything together

### Pattern (pseudocode)
```
container = new Container()

// Infrastructure first — everything depends on these
container.register("config", singleton(loadConfig()))
container.register("db", singleton(createDbPool(config)))
container.register("logger", singleton(createLogger(config)))
container.register("messageQueue", singleton(createMQ(config)))

// Domain services — depend on infrastructure
container.register("userService", class UserService(db, logger))
container.register("orderService", class OrderService(db, logger, messageQueue))

// Handlers — depend on domain services
container.register("createOrderHandler", class CreateOrderHandler(orderService, logger))
```

### Common Mistakes
- Circular dependencies in registration → split into smaller services
- Manual `new Service(dep1, dep2)` in handler code → always use the container
- Registering everything as transient → stateful resources leak connections

---

## Config Validation

Validate all configuration at startup. Fail fast with clear error messages.

### Pattern (pseudocode)
```
configSchema = {
  DATABASE_URL: required, string, url format
  PORT: optional, number, default 3000
  LOG_LEVEL: optional, enum [debug, info, warn, error], default "info"
  API_KEY: required, string, min length 16
  REDIS_URL: optional, string, url format
}

config = validate(environment_variables, configSchema)
// Throws at startup if validation fails — never at request time
```

### Principles
- Load once at startup, inject everywhere via DI
- Validate types, formats, and ranges — not just presence
- Provide sensible defaults for optional values
- Never log secrets; mask or omit from error messages
- Separate config by concern: database config, auth config, feature flags

---

## Service Lifecycle

Standard bootstrap sequence for any backend service:

```
1. Load and validate config
2. Create DI container / wire dependencies
3. Connect to infrastructure (DB pool, message queue, cache)
4. Start consumers (message queue, event listeners)
5. Start HTTP server (accept traffic)
6. Register shutdown hooks (reverse order of startup)
```

The ordering is critical — do not accept HTTP traffic before infrastructure is ready.

---

## Graceful Shutdown

Shutdown in reverse order of startup. Never drop in-flight work.

```
On SIGTERM / SIGINT:
  1. Stop accepting new requests (close HTTP listener)
  2. Stop accepting new messages (pause consumers)
  3. Drain in-flight work (wait for active requests/messages to complete)
  4. Flush pending writes (commit offsets, flush buffers)
  5. Close infrastructure connections (DB pool, message queue, cache)
  6. Exit process
```

### Principles
- Set a shutdown timeout (e.g., 30 seconds) — force-exit if drain takes too long
- Log shutdown progress at each step
- Close resources in reverse order of initialization
- Health check should return unhealthy once shutdown starts (so load balancers stop routing)

---

## Health Checks

Two distinct probes serving different purposes:

| Probe | Purpose | Checks | Returns |
|-------|---------|--------|---------|
| **Liveness** (`/health/live`) | Is the process running? | Process is up | 200 OK |
| **Readiness** (`/health/ready`) | Can it handle traffic? | DB connected, queues connected, dependencies reachable | 200 OK or 503 |

### Principles
- Liveness: lightweight, no external calls. If this fails, orchestrator restarts the process.
- Readiness: checks all critical dependencies. If this fails, load balancer stops routing traffic.
- Return structured JSON: `{ "status": "healthy", "checks": { "db": "ok", "queue": "ok" } }`
- During shutdown, readiness returns 503 immediately (stop receiving new traffic).

---

## Circuit Breaker

Prevent cascading failures when calling external services.

```
States:
  CLOSED   → normal operation, requests pass through
  OPEN     → failures exceeded threshold, requests fail immediately (fast-fail)
  HALF-OPEN → after cooldown, allow one probe request to test recovery

Transitions:
  CLOSED → OPEN:      when failure count exceeds threshold in time window
  OPEN → HALF-OPEN:   after cooldown period expires
  HALF-OPEN → CLOSED: if probe request succeeds
  HALF-OPEN → OPEN:   if probe request fails
```

### When to use
- Calling external APIs (payment providers, third-party services)
- Calling other internal microservices over the network
- Any I/O operation that can hang or fail unpredictably

### When NOT to use
- Local database queries (use connection pool limits instead)
- In-process function calls

---

## Retry with Backoff

Automatically retry transient failures with increasing delays.

```
Retry strategy:
  attempt 1 → immediate
  attempt 2 → wait base_delay (e.g., 100ms)
  attempt 3 → wait base_delay * 2 + jitter
  attempt 4 → wait base_delay * 4 + jitter
  give up   → after max_retries (e.g., 3-5)
```

### Principles
- Add random jitter to prevent thundering herd on recovery
- Only retry on transient errors (5xx, timeout, connection reset) — never on 4xx
- Set a maximum number of retries with a total timeout cap
- Make the operation idempotent before adding retries
- Log each retry attempt with attempt number and delay

### When to use
- HTTP calls to external services returning 502/503/504
- Message queue publish failures
- Distributed lock acquisition

### When NOT to use
- Validation errors (4xx) — retrying won't help
- Operations that are not idempotent without an idempotency key

---

## Bulkhead

Isolate resources per dependency to prevent one slow dependency from starving others.

```
Without bulkhead:
  Shared pool (100 threads) → Service A (slow) consumes 95 → Service B starved

With bulkhead:
  Pool A (50 threads) → Service A (slow) consumes 50, hits limit
  Pool B (50 threads) → Service B unaffected, still serving
```

### Principles
- Assign separate thread/connection pools per external dependency
- Set pool size based on expected throughput and acceptable latency
- Reject excess requests immediately (fail fast) rather than queuing unbounded
- Monitor pool utilization — approaching limits signals capacity issues

### When to use
- Multiple external service dependencies with different reliability profiles
- Shared infrastructure resources (DB pools, HTTP clients)

### When NOT to use
- Single-dependency services (pool limits are sufficient)
- In-process computations

---

## Timeout

Set explicit time limits on every outbound call to prevent indefinite blocking.

### Principles
- Every outbound HTTP call, DB query, and queue operation must have a timeout
- Set timeouts shorter than the caller's timeout (cascading timeouts)
- Use connect timeout (short, e.g., 1-3s) + read timeout (longer, e.g., 5-30s)
- Return a clear error when timeout is exceeded — do not silently retry
- Propagate deadline/timeout context across service boundaries

### Layered timeout strategy
```
Client request timeout:     30s (overall request budget)
  → Downstream service A:  10s (must complete within caller's budget)
    → Database query:        5s (must complete within A's budget)
  → Downstream service B:   5s
```

---

## OpenAPI-First Design

Define the API contract before implementing it. Generate code/validation from the spec.

### Workflow
1. Write OpenAPI spec (YAML/JSON) defining endpoints, request/response schemas, error shapes
2. Generate server stubs or validation middleware from the spec
3. Implement handlers against the generated interfaces
4. Generate client SDKs from the same spec
5. Validate responses against the spec in tests

### Benefits
- Single source of truth for API contract
- Auto-generated documentation (Swagger UI, Redoc)
- Client/server contract enforcement
- Breaking change detection via spec diff

### Principles
- Spec lives in version control alongside code
- CI validates that implementation matches spec
- Response validation in tests catches drift
- Use `$ref` for shared schemas (error response, pagination envelope)

---

## Middleware Pipeline Patterns

### Authentication Middleware
```
Extract token from Authorization header (or cookie)
Validate token (verify signature, check expiration)
Attach user context to request (user ID, roles, permissions)
If invalid → return 401
If expired → return 401 with specific code (TOKEN_EXPIRED)
```

### Authorization Middleware
```
Read user context from request (set by auth middleware)
Check if user has required permission for this endpoint
If forbidden → return 403
```

### Request ID Middleware
```
Check for incoming X-Request-Id header
If present → use it (for distributed tracing)
If absent → generate a unique ID (UUID v4 or similar)
Attach to request context
Include in all log entries
Include in response headers
```

### Rate Limiting Middleware
```
Identify client (API key, IP, user ID)
Check request count against limit for current window
If under limit → allow, decrement remaining
If over limit → return 429 with Retry-After header
Include rate limit headers in every response
```

---

## Request Context Propagation

Carry request metadata through the entire call chain for observability.

### What to propagate
- `requestId` — unique per request, for log correlation
- `traceId` — for distributed tracing across services
- `userId` — authenticated user, for audit logging
- `startTime` — for request duration measurement

### How to propagate
- Framework-specific request context (most frameworks provide this)
- Thread-local / async-local storage (language-specific: AsyncLocalStorage in Node.js, Context in Go, ThreadLocal in Java)
- Explicit parameter passing (simplest, most portable)

### Principles
- Set context at the middleware layer (once, at request entry)
- Pass to all service calls, DB queries, and outgoing HTTP requests
- Include in all log entries (structured logging with context fields)
- Forward `traceId` to downstream services via headers
