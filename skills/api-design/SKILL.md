---
name: api-design
description: Design APIs — protocol selection, REST, OpenAPI 3.1, RPC patterns, pagination, versioning, error contracts. Use when choosing REST/GraphQL/gRPC, designing endpoints, writing OpenAPI specs, or implementing pagination/error responses. Do NOT use for GraphQL depth (graphql) or real-time (realtime).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# API Design — Protocol Selection & Patterns

## Protocol Selection

Decision tree — answer top-to-bottom, stop at first match:

1. **Public API for third-party developers?** → REST + OpenAPI. Universal tooling, cURL-testable, CDN-cacheable.
2. **Complex frontend data needs (multiple resources per view)?** → GraphQL. Client-driven queries, no over-fetching. See `graphql` skill.
3. **Full-stack TypeScript monorepo, you control both ends?** → tRPC. End-to-end type safety, zero codegen.
4. **Internal microservices, polyglot, high-throughput?** → gRPC. Binary Protobuf, HTTP/2 multiplexing, streaming.
5. **gRPC but need browser support without proxy?** → Connect (Buf). Speaks gRPC, gRPC-Web, and Connect protocol natively.
6. **Real-time push or bidirectional?** → SSE or WebSocket. See `realtime` skill.
7. **Default** → REST. Layer in other protocols as needs emerge.

**Mix protocols behind an API gateway:** REST for public, gRPC for internal, WebSocket for real-time. Performance difference between REST/GraphQL/tRPC for browser-to-server calls is negligible — network latency dominates.

---

## Contract-First Development

Define the API contract before writing implementation code:

1. Write OpenAPI spec (REST) or `.proto` files (gRPC) or router definition (tRPC)
2. Generate server stubs and client SDKs from the contract
3. Validate implementation against contract in CI
4. Contract becomes the single source of truth for docs, types, and tests

Benefits: parallel frontend/backend development, auto-generated SDKs, consistent documentation, catch breaking changes before deploy.

---

## REST Conventions

**Resource naming:**
```
GET    /users              → List
POST   /users              → Create
GET    /users/{id}         → Get
PUT    /users/{id}         → Replace
PATCH  /users/{id}         → Partial update
DELETE /users/{id}         → Delete
GET    /users/{id}/orders  → Sub-resource (max 2 levels)
```

Rules: Plural nouns, no verbs. Query params for filtering/sorting. Hyphens in URLs, camelCase in JSON.

### HTTP Methods & Idempotency

| Method | Idempotent | Safe | Body | Use Case |
|--------|-----------|------|------|----------|
| GET | Yes | Yes | No | Read |
| POST | **No** | No | Yes | Create, actions |
| PUT | Yes | No | Yes | Full replace |
| PATCH | **No** | No | Yes | Partial update |
| DELETE | Yes | No | No | Remove |

For non-idempotent POST: accept `Idempotency-Key` header, store result, replay on duplicate.

### Status Codes

| Range | Common Codes |
|-------|-------------|
| 2xx | 200 OK, 201 Created, 202 Accepted, 204 No Content |
| 4xx | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Too Many Requests |
| 5xx | 500 Internal, 502 Bad Gateway, 503 Unavailable |

201 for POST that creates. 204 for DELETE with no body. 429 with `Retry-After` header.

---

## RPC Patterns

### gRPC

Best for: internal microservices, polyglot systems, streaming pipelines.

| Feature | Detail |
|---------|--------|
| IDL | Protocol Buffers (`.proto` files) — schema-first contract |
| Transport | HTTP/2 — multiplexed streams, header compression |
| Serialization | Binary Protobuf — ~80% smaller than JSON |
| Streaming | Unary, server-stream, client-stream, bidirectional |
| Codegen | Auto-generate clients in 10+ languages from `.proto` |
| Browser support | Requires gRPC-Web proxy (Envoy) or use Connect protocol |

**When NOT to use gRPC:** Public APIs (poor browser support), simple CRUD (overhead not justified), teams without Protobuf experience.

### tRPC

Best for: full-stack TypeScript monorepos where both client and server are in your control.

| Feature | Detail |
|---------|--------|
| Type safety | End-to-end via TypeScript inference — no codegen |
| Schema | Zod/Valibot validators double as runtime + type contracts |
| Transport | HTTP (JSON-RPC over fetch) — works in browsers natively |
| RSC support | Native React Server Components integration (v11+) |
| Limitation | TypeScript-only — no polyglot support |

### Connect (Buf)

Best for: gRPC compatibility with browser-native HTTP support. Generates clients that speak gRPC, gRPC-Web, and Connect protocol (HTTP POST + JSON or Protobuf) without a proxy. Preferred over gRPC-Web when starting new projects.

---

## Pagination

Decision tree:

- **Small dataset, admin panel, need random page access?** → Offset (`?page=3&limit=20`). Simple but drifts on inserts, O(n) at scale.
- **Feed, timeline, large dataset, real-time data?** → Cursor (`?after=eyJpZCI6MTAwfQ==&limit=20`). Stable under mutations, consistent performance.
- **Large table with indexed sort column, API-first?** → Keyset (`?after_id=500&limit=20`). SQL-optimized, requires unique indexed column.

### Cursor Pagination Best Practices

Cursors must be opaque — Base64-encode internal state (e.g., `{"id":100,"created_at":"..."}`) to prevent client tampering. Include pagination metadata in response:

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTAwfQ==",
    "prev_cursor": "eyJpZCI6ODF9",
    "has_more": true,
    "limit": 20
  }
}
```

Handle invalid/expired cursors with 400 Bad Request or 410 Gone and prompt client to restart. Document cursor expiration behavior and maximum `limit` values.

---

## Versioning

Decision tree:

- **Public API with external consumers?** → URL path (`/v2/users`). Explicit, easy routing, simple for third parties.
- **Internal API, want clean URLs?** → Header (`API-Version: 2`). Clients choose when to upgrade.
- **Standards-driven, content negotiation?** → Accept header with vendor media type.

### Deprecation Strategy

1. Announce deprecation with `Deprecation` header and `Sunset` header (RFC 8594) in responses
2. Log usage of deprecated versions — contact active consumers
3. Maintain deprecated version for a documented period (minimum 6-12 months for public APIs)
4. Return `410 Gone` after sunset date

---

## Error Contracts (RFC 9457)

RFC 9457 (successor to RFC 7807) defines the standard error format. Content type: `application/problem+json`.

```json
{
  "type": "https://api.example.com/errors/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "Balance $10.00 < withdrawal $25.00",
  "instance": "/transfers/abc123",
  "errors": [{ "field": "amount", "message": "Exceeds balance" }]
}
```

Rules: Consistent structure on every error. Machine-readable `type` URI. Human-readable `detail`. Include `instance` for traceability. Extend with custom fields (e.g., `errors` array for validation) as needed.

---

## Rate Limiting

Response headers:

| Header | Purpose |
|--------|---------|
| `RateLimit-Limit` | Max requests in window |
| `RateLimit-Remaining` | Requests left in current window |
| `RateLimit-Reset` | Seconds until window resets |
| `Retry-After` | Seconds to wait (on 429 response) |

Algorithms: token bucket (allows bursts), sliding window (smooth distribution), fixed window (simplest). Client strategy: exponential backoff with jitter on 429.

---

## Context Adaptation

- **Backend:** Endpoint implementation, middleware, request/response serialization, idempotency handling, input validation
- **Architect:** Protocol selection, API strategy, versioning policy, API gateway patterns, BFF (Backend for Frontend), contract-first workflow
- **Frontend:** Client SDK usage, error handling, retry logic, optimistic updates, caching, pagination state management
- **Platform/DevOps:** API gateway configuration, rate limiting infrastructure, monitoring, OpenAPI-driven CI validation

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Verbs in URLs (`/getUser`) | Nouns only: `GET /users/{id}` |
| Inconsistent error formats | RFC 9457 everywhere |
| Breaking changes without versioning | Version + deprecation timeline with Sunset header |
| N+1 API calls | Include related data, sparse fieldsets, or compound endpoints |
| Choosing gRPC for a public API | REST or GraphQL for external consumers; gRPC for internal |
| One protocol for everything | Mix protocols: REST public, gRPC internal, WebSocket real-time |
| Offset pagination on large datasets | Cursor or keyset pagination for stable, performant results |
| Implementation-first development | Contract-first: define spec, generate stubs, validate in CI |
| Exposing internal IDs in cursors | Opaque Base64-encoded cursors to prevent client tampering |

---

## Related Knowledge

- **graphql** — schema design, resolvers, federation when choosing GraphQL
- **realtime** — WebSocket, SSE when the API needs real-time capabilities
- **backend** — endpoint implementation, middleware, request/response handling
- **auth** — OAuth2, API keys, JWT when securing API endpoints
- **security** — input validation, OWASP API security top 10

## References

- [rest-patterns.md](references/rest-patterns.md) — filtering, sorting, bulk operations, idempotency, webhook patterns, caching, async operations, error codes
- [openapi-patterns.md](references/openapi-patterns.md) — OpenAPI 3.1 schema patterns, components, discriminators, security schemes, SDK generation

Load references when you need detailed implementation patterns or OpenAPI schema examples.
