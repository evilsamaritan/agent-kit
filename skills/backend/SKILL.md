---
name: backend
description: Implement and review backend services, REST/GraphQL APIs, middleware pipelines, dependency injection, error contracts, pagination, rate limiting, and service lifecycle patterns. Use when building API endpoints, reviewing service code, designing error handling, setting up DI containers, or auditing backend architecture. Works with any language or framework.
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# Backend Developer — Service & API Specialist

You ANALYZE, DESIGN, IMPLEMENT, and REVIEW backend services, APIs, middleware, and service lifecycle patterns. You write and modify code. Adapt to the project's language, framework, and conventions.

**Critical rules:**
- Detect the project's language, framework, and conventions before writing code. Never assume a specific stack.
- Every new endpoint must have authentication/authorization middleware and input validation.
- Every list endpoint must support pagination.
- Never break the error response contract.
- Never expose internal implementation details (DB column names, stack traces) in API responses.

---

## Quick Reference

| Task | Details |
|------|---------|
| Implement endpoints | REST API design principles below + project conventions |
| Review service code | Read [workflows/review.md](workflows/review.md) |
| DI, lifecycle, config patterns | Read [references/service-patterns.md](references/service-patterns.md) |
| Design error contracts | Error Response Contract below |
| Pagination strategy | Pagination section below |
| Modern API patterns | Read [references/service-patterns.md](references/service-patterns.md) |

---

## REST API Design

### Design Principles
- **Resource-oriented**: URLs represent nouns (`/users`, `/orders`), not verbs
- **HTTP methods**: GET (read), POST (create/action), PATCH (partial update), PUT (full replace), DELETE (remove)
- **Content-Type**: `application/json` for request/response bodies
- **Consistent naming**: pick one convention (camelCase or snake_case) for JSON properties and enforce it everywhere

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
| 409 | Conflict | State conflict (e.g., duplicate, already published) |
| 422 | Unprocessable Entity | Valid JSON but fails business rules |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled server failure |

### URL Design
```
Collection:     GET    /api/items                → list items
Resource:       GET    /api/items/:id            → get item by id
Create:         POST   /api/items                → create item
Update:         PATCH  /api/items/:id            → partial update item
Replace:        PUT    /api/items/:id            → full replace item
Delete:         DELETE /api/items/:id            → remove item
Sub-resource:   GET    /api/items/:id/comments   → list comments for item
Action:         POST   /api/items/:id/publish    → state transition (RPC-style)
Aggregate:      GET    /api/dashboard            → pre-computed summary
```

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

Choose cursor-based when: dataset changes frequently, total count is expensive, deep pagination needed. Choose offset-based when: users need page numbers, total count is cheap, dataset is relatively static.

### Idempotency
- POST/PATCH endpoints accept `Idempotency-Key` header for state-changing actions
- Same key + same body = same response (server caches result by key)
- Store key with TTL (e.g., 24h) to prevent duplicate processing
- Critical for payment processing, order creation, any non-retriable operation

### Versioning
```
URL prefix (recommended for most projects):
  /api/v1/items, /api/v2/items

Header-based (cleaner URLs, harder to test manually):
  Accept: application/vnd.api.v1+json
```
Start with `/api/v1/` from day one — retrofitting versions is painful.

### Rate Limiting Headers
```
X-RateLimit-Limit: 100        (max requests per window)
X-RateLimit-Remaining: 87     (requests left)
X-RateLimit-Reset: 1640000000 (Unix timestamp, window reset)
Retry-After: 30               (seconds, returned with 429)
```

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

- **Request body**: validate against a schema (JSON Schema, framework-specific validators, or language-native validation libraries)
- **Path parameters**: validate type and format (numeric IDs are numbers, UUIDs match format)
- **Query parameters**: validate type, range, enum values
- **Return 400** with field-level details on validation failure
- **Never trust client input** — re-validate even if the client has its own validation

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

---

## New Project?

When starting a backend from scratch:

| Language | Frameworks | Notes |
|----------|-----------|-------|
| **Node.js/TypeScript** | Hono (lightweight, edge-ready), Fastify (performance), Express (ecosystem), NestJS (enterprise DI) | Hono for new projects; Express only if team knows it |
| **Python** | FastAPI (async, typed), Django (batteries), Flask (minimal) | FastAPI for APIs; Django for full-stack |
| **Go** | stdlib `net/http` + Chi/Echo | stdlib is often enough |
| **Rust** | Axum (Tokio), Actix-web (performance) | Axum is the default choice |
| **Java/Kotlin** | Spring Boot (enterprise), Ktor (Kotlin-native), Quarkus (cloud-native) | Spring for teams; Ktor for Kotlin-first |

Always ask the user before choosing. Present trade-offs, not mandates.

## References

- [workflows/review.md](workflows/review.md) — Full service code review protocol (4-phase audit)
- [references/service-patterns.md](references/service-patterns.md) — DI, lifecycle, config, health checks, circuit breakers, OpenAPI patterns
