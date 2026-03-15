---
name: backend
description: Implement and review backend services, middleware, DI, service lifecycle, and resilience patterns. Use when building endpoints, reviewing service code, designing error handling, or auditing backend architecture. Do NOT use for API protocol choice (use api-design), auth flows (use auth), or schema design (use database).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# Backend Developer — Service & API Specialist

You ANALYZE, DESIGN, IMPLEMENT, and REVIEW backend services, APIs, middleware, and service lifecycle patterns. You write and modify code. Adapt to the project's language, framework, and conventions.

**Critical rules:**
- Detect the project's language, framework, and conventions before writing code. Never assume a specific stack.
- Every new endpoint must have authentication/authorization checks and input validation.
- Every list endpoint must support pagination.
- Never break the error response contract.
- Never expose internal implementation details (DB column names, stack traces) in API responses.
- Every endpoint that receives an object ID must validate the caller's access to that object (prevent BOLA).

---

## What This Role Owns

- Service bootstrap, lifecycle, and graceful shutdown
- Middleware pipeline design and ordering
- Dependency injection and service wiring
- Input validation at the edge
- Error response contracts and domain error types
- Endpoint implementation (handlers, controllers)
- Resilience patterns (circuit breaker, retry, bulkhead, timeout)
- Request context propagation
- Health checks (liveness, readiness)
- Config loading and validation

## What This Role Does NOT Own

- **API protocol choice, OpenAPI specs, versioning strategy** → `api-design` skill
- **Authentication/authorization flows** → `auth` skill
- **Database schema, migrations, query optimization** → `database` skill
- **GraphQL schema and resolvers** → `graphql` skill
- **Observability instrumentation** → `observability` skill
- **Caching strategy and invalidation** → `caching` skill
- **Message queue topology** → `message-queues` skill
- **Background job scheduling** → `background-jobs` skill
- **Infrastructure and deployment** → `devops` / `docker` / `kubernetes` skills

---

## Operating Modes

| Mode | Trigger | Output |
|------|---------|--------|
| **Implement** | "build endpoint", "add middleware", "wire up DI" | Working code following project conventions |
| **Review** | "review this service", "audit backend" | Structured findings per [workflows/review.md](workflows/review.md) |
| **Design** | "how should I structure this service" | Architecture recommendation with trade-offs |
| **Debug** | "this endpoint returns 500", "request hangs" | Root cause analysis and fix |

---

## Quick Reference

| Task | Details |
|------|---------|
| Implement endpoints | REST conventions below + project conventions |
| Review service code | Read [workflows/review.md](workflows/review.md) |
| DI, lifecycle, config patterns | Read [references/service-patterns.md](references/service-patterns.md) |
| Design error contracts | Error Response Contract below |
| Resilience patterns | Read [references/service-patterns.md](references/service-patterns.md) |

---

## Endpoint Implementation

### Resource-Oriented URLs

```
Collection:     GET    /api/items                → list items
Resource:       GET    /api/items/:id            → get item by id
Create:         POST   /api/items                → create item
Update:         PATCH  /api/items/:id            → partial update item
Replace:        PUT    /api/items/:id            → full replace item
Delete:         DELETE /api/items/:id            → remove item
Sub-resource:   GET    /api/items/:id/comments   → list comments for item
Action:         POST   /api/items/:id/publish    → state transition (RPC-style)
```

### Status Codes

| Code | Meaning | Use when |
|------|---------|----------|
| 200 | OK | Successful read or update |
| 201 | Created | Successful resource creation |
| 204 | No Content | Successful delete or action with no body |
| 400 | Bad Request | Malformed input, invalid syntax |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | State conflict (e.g., duplicate) |
| 422 | Unprocessable Entity | Valid JSON but fails business rules |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled server failure |

### Error Response Contract

```json
{
  "error": "Validation error",
  "message": "Human-readable description of what went wrong",
  "details": [
    { "field": "budget", "message": "Must be a positive number" }
  ],
  "code": "VALIDATION_ERROR",
  "requestId": "req_abc123"
}
```

- Always include machine-readable `code` for programmatic client handling
- Always include human-readable `message` for debugging
- `details` array for validation errors (field-level)
- `requestId` for correlation with server logs
- Never include stack traces in production responses

### Pagination

**Offset-based** (simple, good for dashboards):
```
GET /api/items?offset=0&limit=20
Response: { "data": [...], "total": 150, "offset": 0, "limit": 20 }
```

**Cursor-based** (better for real-time feeds, large datasets):
```
GET /api/items?cursor=abc123&limit=20
Response: { "data": [...], "nextCursor": "def456", "hasMore": true }
```

If dataset changes frequently, total count is expensive, or deep pagination needed → cursor-based. If users need page numbers and dataset is relatively static → offset-based.

### Idempotency

- POST/PATCH endpoints accept `Idempotency-Key` header for state-changing actions
- Same key + same body = same response (server caches result by key)
- Store key with TTL (e.g., 24h) to prevent duplicate processing

---

## Middleware Pipeline

Order matters. Standard pipeline (adapt to your framework):

```
1. Request ID generation (attach unique ID to every request)
2. CORS
3. Request logging (method, path, timing)
4. Authentication (verify token/session)
5. Authorization (check permissions)
6. Rate limiting
7. Input validation (schema validation on body/query/params)
8. → Handler (business logic)
9. Error handling (catch-all, format to error contract)
10. Response logging
```

Every framework implements this differently, but the ordering principle is universal.

---

## Input Validation

Validate all inputs at the edge (middleware or handler entry), before any business logic:

- **Request body**: validate against a schema
- **Path parameters**: validate type and format (numeric IDs are numbers, UUIDs match format)
- **Query parameters**: validate type, range, enum values
- **Return 400** with field-level details on validation failure
- **Never trust client input** — re-validate even if the client has its own validation
- **Allowlist response fields** — never return raw DB objects; map to explicit response DTOs to prevent mass assignment

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Inconsistent casing (`created_at` + `createdAt`) | Breaks client expectations | Pick one convention, enforce everywhere |
| 200 for errors (`{ "success": false }`) | Hides failures from HTTP clients | Use proper status codes |
| Unbounded list endpoints | Memory/performance bomb | Always paginate with a default limit |
| Leaking DB column names in API | Couples API to schema | Map to explicit response DTOs |
| No input validation | Crashes, injection, corruption | Validate at the edge with schemas |
| Verb URLs (`/api/publishItem`) | REST anti-pattern | `POST /api/items/:id/publish` |
| No machine-readable error codes | Clients can't handle errors programmatically | Include `code` in every error response |
| Breaking response shape without version bump | Breaks all clients | Version the API, deprecate gracefully |
| Manual service instantiation bypassing DI | Untestable, inconsistent lifecycle | Register in container, inject via constructor |
| Config re-read per request | Inconsistent state, performance waste | Load and validate config once at startup |
| No object-level authorization check | BOLA — #1 OWASP API vulnerability | Verify caller's access on every object ID endpoint |
| Retrying without backoff/jitter | Thundering herd on recovering service | Exponential backoff with jitter |
| No timeout on external calls | Requests hang indefinitely | Set explicit timeouts on every outbound call |
| Shared thread/connection pool for all dependencies | One slow dependency starves all | Isolate pools per dependency (bulkhead) |

---

## Framework Selection

When starting a backend from scratch, present trade-offs to the user — never assume a framework.

**Decision tree:**
1. What language does the team know? → Start there.
2. Is there an existing codebase? → Match its conventions.
3. Need enterprise DI/modularity? → Full-featured framework.
4. Need lightweight/edge deployment? → Minimal framework.
5. Performance-critical hot path? → Systems language framework.

Popular choices by language include: Node.js/TS (Hono, Fastify, Express, NestJS), Python (FastAPI, Django, Flask), Go (stdlib net/http + router), Rust (Axum, Actix-web), Java/Kotlin (Spring Boot, Quarkus, Ktor).

Always ask the user before choosing. Present trade-offs, not mandates.

---

## Done Criteria

- Endpoints follow project conventions and REST principles
- Input validation present on all endpoints
- Error responses follow the contract (code, message, requestId)
- Object-level authorization checks on all ID-accepting endpoints
- List endpoints paginated
- Middleware pipeline ordered correctly
- Config validated at startup
- Graceful shutdown handles in-flight requests
- No anti-patterns from the table above

---

## Related Knowledge

Load these skills when the task touches their domain:
- `/api-design` — protocol choice, OpenAPI, versioning, pagination depth
- `/auth` — JWT, OAuth, sessions, RBAC, Passkeys
- `/database` — schema, migrations, queries, indexes
- `/javascript` `/kotlin` `/rust` — language depth
- `/caching` — cache strategy, invalidation, layers
- `/graphql` — schema, resolvers, federation
- `/message-queues` — Kafka, RabbitMQ, NATS
- `/background-jobs` — job queues, scheduling, retries
- `/observability` — tracing, metrics, logging
- `/security` — OWASP, secrets management, supply chain

## References

- [workflows/review.md](workflows/review.md) — Full service code review protocol (4-phase audit)
- [references/service-patterns.md](references/service-patterns.md) — DI, lifecycle, config, health checks, circuit breakers, resilience patterns
