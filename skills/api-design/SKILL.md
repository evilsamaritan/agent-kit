---
name: api-design
description: "Design API protocols and contracts. Use for REST, OpenAPI, RPC, endpoint design, error formats, pagination, idempotency keys, webhooks, rate-limit headers, versioning, deprecation, and backward compatibility."
---

# API Design — Protocol Selection & Contracts

## Scope and boundaries

**This skill owns:** protocol choice, the contract (OpenAPI, `.proto`), resource and endpoint design, error format, pagination, the idempotency-key contract, webhooks (sender and receiver), rate-limit response headers, compatibility, versioning, and deprecation.

**It defers:** GraphQL schemas and execution → `graphql`; persistent connections and push → `realtime`; credentials, tokens, and authorization → `auth`; input trust and API threat modelling → `security`; middleware placement and error mapping in code → `backend`; retry policy on the client side → `reliability`; provider-specific payment webhooks → `payments`.

## Protocol Selection

Answer top to bottom, stop at the first match:

1. **Third-party developers or unknown clients?** → REST + OpenAPI. Universal tooling, cacheable, testable from any HTTP client.
2. **Many views each needing a different slice of a connected graph, clients you ship?** → GraphQL (`graphql`).
3. **One language, one repository, you own both ends?** → End-to-end typed RPC that shares types without a separate IDL.
4. **Internal services in several languages, high call volume or streaming?** → Schema-first binary RPC over HTTP/2 (gRPC-style).
5. **Browsers must call that RPC contract directly?** → A gRPC-compatible protocol with browser support, or a translating proxy.
6. **Server push or bidirectional messages?** → SSE or WebSocket (`realtime`).
7. **Default** → REST. Add other protocols as needs emerge.

Mixing protocols is normal: REST at the public edge, RPC inside, a push channel for live updates. For browser-to-server calls, network latency dominates protocol overhead; choose by contract and tooling, not by benchmark. Product examples, deadlines, status codes, and Protobuf evolution: [rpc-patterns.md](references/rpc-patterns.md).

## Contract-First Development

1. Write the contract first: OpenAPI (REST), `.proto` (RPC), or the shared router types (typed RPC).
2. Generate server stubs, validators, and clients from it.
3. Check the implementation against the contract in CI, and diff the contract on every change to catch breaking changes (rules below).

## REST Conventions

```
GET    /users              → List
POST   /users              → Create
GET    /users/{id}         → Get
PUT    /users/{id}         → Replace
PATCH  /users/{id}         → Partial update
DELETE /users/{id}         → Delete
GET    /users/{id}/orders  → Sub-resource (max 2 levels)
```

Plural nouns, no verbs, lowercase hyphenated path segments. **Casing:** choose one casing for JSON fields and query parameters once per API (camelCase or snake_case), write it in the contract, and apply it everywhere, including pagination envelopes, errors, and webhook payloads.

| Method | Idempotent | Safe | Use |
|--------|-----------|------|-----|
| GET | Yes | Yes | Read |
| POST | No | No | Create, actions |
| PUT | Yes | No | Full replace |
| PATCH | No | No | Partial update |
| DELETE | Yes | No | Remove |

For non-idempotent POST that a client may retry (payments, orders, messages), accept an `Idempotency-Key` header scoped to the caller. Server contract: [rest-patterns.md](references/rest-patterns.md#idempotency); the storage pattern (claim first, then process) is owned by `message-queues` → [idempotency-patterns.md](../message-queues/references/idempotency-patterns.md).

Status codes: 201 for create, 204 for delete without body, 401 for missing or invalid credentials, 403 for an authenticated caller without permission, 409 for state conflicts, 422 for semantic validation, 429 with `Retry-After`. Clients may retry 408, 429, 502, 503, and 504; most other 4xx are not retryable (policy: `reliability`).

## Pagination

- **Small dataset, needs random page access (admin tables)?** → Offset (`?page=3&limit=20`). Simple; drifts on inserts; slow at depth.
- **Feeds, large or changing datasets?** → Seek (keyset) pagination on a unique, indexed sort key, exposed through an opaque cursor.

**Cursors are opaque to clients and untrusted by the server.** Base64 is encoding, not protection: a client can decode, edit, and re-encode it. Either sign the cursor (HMAC with a server key, plus a version and expiry) or validate every decoded field as ordinary input, and bind the cursor to the sort and filter it was issued for. Clamp `limit` to a documented maximum. Reject an invalid or expired cursor with 400 and tell the client to restart. SQL and response shapes: [rest-patterns.md](references/rest-patterns.md#pagination).

## Compatibility

Evolve additively; version only when you cannot.

| Safe (additive) | Breaking |
|-----------------|----------|
| New endpoint or operation | Removing or renaming a field, endpoint, or parameter |
| New optional request field or parameter | New required input, or an optional input becoming required |
| New response field | Changing a field's type, format, unit, or meaning |
| Looser validation | Tighter validation (shorter max length, narrower range) |
| New enum value — only if the contract says clients must tolerate unknown values | New enum value without that rule; removing an enum value |
| New error `type` under an existing status | Changing status codes or error semantics for existing cases |

- **Consumers are tolerant readers:** ignore unknown fields, handle unknown enum values with an explicit branch, never depend on field order.
- **Producers are conservative:** never reuse a removed field name with new meaning; default values for new optional inputs preserve old behavior.
- Run a contract diff in CI and fail on breaking changes unless a new version is being introduced.

## Versioning

Only for changes that cannot be made additively:

- **Public API with external consumers?** → URL path (`/v2/users`). Explicit, easy to route.
- **Internal API, clients upgrade on their own schedule?** → Header (`API-Version: 2`).
- **Content negotiation is already in use?** → Media type version in `Accept`.

**Deprecation:** signal it in responses with the `Deprecation` and `Sunset` headers plus a `Link` to the migration guide; log callers of deprecated operations and contact them; keep the old version for the documented period; return `410 Gone` after sunset. Header syntax and standards status: [rest-patterns.md](references/rest-patterns.md#deprecation-headers).

## Error Contracts (RFC 9457)

Problem Details, content type `application/problem+json`:

```json
{
  "type": "https://api.example.com/errors/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "Balance 10.00 USD is below the requested 25.00 USD",
  "instance": "/transfers/abc123",
  "errors": [{ "field": "amount", "code": "exceeds_balance" }]
}
```

One structure for every error. Machine-readable `type` URI; human-readable `detail` that never contains internal messages, stack traces, or echoed sensitive input. Extension members (such as `errors`) are documented in the contract.

## Rate Limiting

Return 429 with `Retry-After` — the stable, universally understood part. Remaining-quota headers are optional; pick one scheme, document it, and keep it consistent (status of the standard headers: [rest-patterns.md](references/rest-patterns.md#rate-limit-headers)). Algorithm choice: token bucket for bursts, sliding window for smooth limits, fixed window for simplicity. Limit per caller identity, not only per address.

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Verbs in URLs (`/getUser`) | `GET /users/{id}` |
| Inconsistent error formats | RFC 9457 everywhere |
| Breaking change shipped as a patch | Additive change, or a new version with a deprecation timeline |
| Mixed casing across endpoints | One casing per API, written in the contract |
| N+1 API calls | Include related data, sparse fieldsets, or a compound endpoint |
| Binary RPC for third-party developers | REST or GraphQL at the public edge |
| Offset pagination on large, changing datasets | Seek pagination through opaque cursors |
| Trusting decoded cursors | Sign them, or validate and bind them to the query |
| Echoing submitted values in validation errors | Return field and code; never the value |

## Related Knowledge

- `graphql` — schema design, resolvers, federation
- `realtime` — WebSocket, SSE, push
- `backend` — middleware order and error mapping in code
- `auth` — credentials, OAuth scopes, security schemes in the contract
- `security` — input validation, API threat categories
- `reliability` — client retry policy and budgets
- `payments` — provider webhook specifics

## References

- [rest-patterns.md](references/rest-patterns.md) — filtering, pagination SQL, bulk operations, idempotency contract, webhooks (sender and receiver), conditional requests, long-running operations, deprecation and rate-limit headers
- [openapi-patterns.md](references/openapi-patterns.md) — OpenAPI 3.1/3.2 schemas, components, discriminators, webhooks, security schemes, SDK generation
- [rpc-patterns.md](references/rpc-patterns.md) — RPC protocol examples, deadlines, status codes, Protobuf evolution
