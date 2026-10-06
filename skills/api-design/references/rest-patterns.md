# REST API Patterns

Filtering, pagination, bulk operations, idempotency, webhooks, conditional requests, and header standards. Examples use camelCase for JSON and query parameters; an API that chose snake_case applies it the same way everywhere.

## Contents

- [URL Design](#url-design) — hierarchy, filtering, sorting, field selection
- [Pagination](#pagination) — cursor contents, signing, seek SQL
- [Bulk Operations](#bulk-operations) — per-item results
- [Idempotency](#idempotency) — key contract, in-flight duplicates
- [Webhooks](#webhooks) — delivery contract, signing, receiving
- [Conditional Requests](#conditional-requests) — ETag, optimistic concurrency
- [Long-Running Operations](#long-running-operations) — 202 and polling
- [Error Response Patterns](#error-response-patterns) — validation errors, code registry
- [Deprecation Headers](#deprecation-headers) — standards status
- [Rate-Limit Headers](#rate-limit-headers) — standards status

---

## URL Design

```
/users                              # Collection
/users/{id}                         # Instance
/users/{id}/orders                  # Sub-collection
/users/{id}/orders/{orderId}        # Sub-instance

# Deeper than 2 levels → top-level collection with a filter
/orders?userId=123
```

```
GET /products?category=electronics&priceMin=100&priceMax=500
GET /products?status=active,pending          # several values (OR)
GET /products?createdAfter=2026-01-01
GET /products?sort=-createdAt,name           # "-" = descending
GET /users?fields=id,name,email              # sparse fieldset
GET /users/{id}?include=orders,profile       # related resources
```

Validate filter and sort fields against an allowlist; never pass them into a query unchecked.

---

## Pagination

### Response shape

```json
{
  "data": [{ "id": "101", "total": "59.99" }, { "id": "102", "total": "120.00" }],
  "pagination": { "nextCursor": "v1.eyJrIjpb...", "hasMore": true, "limit": 20 }
}
```

### Cursor contents and integrity

A cursor carries the last row's sort key, the sort and filter it belongs to, a version, and an expiry:

```
payload = { v: 1, sort: "-createdAt,id", filterHash: h(filters), key: ["2026-01-15T10:30:00Z", 500], exp: now + 24h }
cursor  = base64url(payload) + "." + base64url(HMAC(serverKey, payload))

on request:
  verify HMAC (constant time) → else 400
  check v, exp, sort, filterHash match this request → else 400 "restart pagination"
  treat key values as typed input (parse the timestamp, the integer id)
```

Without signing, validate every decoded field as untrusted input and still bind the cursor to the query. Encrypt instead of sign only when the sort key itself must stay hidden.

### Seek (keyset) query

```sql
-- first page
SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 21;

-- next page: values from the cursor key
SELECT * FROM orders
WHERE (created_at, id) < ($1, $2)
ORDER BY created_at DESC, id DESC
LIMIT 21;
```

Fetch `limit + 1` rows to compute `hasMore`. Add a unique tie-breaker (`id`) to any non-unique sort key, and index the full sort tuple. Backward paging reverses the comparison and the order, then reverses the page before returning it.

---

## Bulk Operations

```
POST /users/batch
{ "items": [ { "name": "Alice", "email": "alice@example.com" }, { "name": "Bob", "email": "bob@example.com" } ] }

Response with per-item results:
{
  "results": [
    { "index": 0, "status": 201, "data": { "id": "u1" } },
    { "index": 1, "status": 409, "error": { "type": "https://api.example.com/errors/conflict", "detail": "Email already registered" } }
  ],
  "summary": { "succeeded": 1, "failed": 1, "total": 2 }
}
```

Decide and document whether a batch is all-or-nothing or per-item. Cap batch size. A retried batch needs an idempotency key like any other write.

---

## Idempotency

```
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
{ "amount": "100.00", "currency": "USD" }
```

Server contract:

| Situation | Response |
|-----------|----------|
| New key | Claim it, process, store status + body, return |
| Same key, same caller, same request hash, completed | Replay the stored response |
| Same key, request in progress | 409 with `Retry-After` (or wait briefly) — never execute twice; the client retries with the same key |
| Same key, different request body | 422 — key reused for a different request |
| Key older than the retention window (24–48 h typical) | Treated as new; document the window |

Keys are scoped to the caller (account or credential), so two callers cannot collide or read each other's results. The client generates the key once per intent and reuses it on every retry; a key built from a timestamp defeats the mechanism. Storage pattern (claim with a unique insert before processing): `message-queues` → [idempotency-patterns.md](../../message-queues/references/idempotency-patterns.md).

---

## Webhooks

One contract for both sides. Provider-specific payment webhooks: `payments`.

### Sending

```
POST https://receiver.example.com/hooks/orders
Content-Type: application/json
webhook-id: evt_01J9Z3...
webhook-timestamp: 1767225600
webhook-signature: v1,<base64 HMAC-SHA256 of "id.timestamp.body">

{ "id": "evt_01J9Z3...", "type": "order.created", "createdAt": "2026-01-01T00:00:00Z", "data": { "id": "order_456" } }
```

The header names follow the Standard Webhooks convention; many providers use their own names with the same three parts (event id, timestamp, signature over timestamp and raw body).

| Contract item | Rule |
|---------------|------|
| Signature | HMAC over id, timestamp, and the exact raw body; support two active secrets for rotation |
| Retries | Retry timeouts, 408, 429 (honour `Retry-After`), and 5xx with full-jitter backoff over hours to a day; stop on 2xx; treat 410 as unsubscribe; other 4xx count toward disabling the endpoint. Policy: `reliability` |
| Timeout | Short per attempt (seconds); receivers acknowledge fast |
| Ordering | Not guaranteed — include `createdAt` and a resource version |
| Delivery | At-least-once — receivers deduplicate by event id |
| Failure | Disable the endpoint after sustained failure and notify the owner |
| Replay | An endpoint or console action to resend events from a time range |
| Payload | Thin events (ids + type) are safer to evolve; receivers fetch current state |

Validate receiver URLs at registration (scheme, no private or link-local addresses) — outbound webhooks are an SSRF path.

### Receiving

```
verifyWebhook(rawBody, headers, secrets, tolerance = 300s):
  id, ts, sigHeader = headers["webhook-id"], headers["webhook-timestamp"], headers["webhook-signature"]
  if any missing → 400
  if |now - ts| > tolerance → 400                  # replay window
  expected = HMAC-SHA256(secret, id + "." + ts + "." + rawBody) for each active secret
  for each signature in sigHeader:
    if len(signature) == len(expected) and constantTimeEqual(signature, expected) → ok
  else → 400

handle:
  verify on the raw bytes, before any JSON parsing
  claim event id with a unique insert → duplicate: return 2xx, do nothing
  enqueue processing; return 2xx quickly
  processing re-reads current state and is idempotent per resource
```

Constant-time comparison functions usually throw or return early on different lengths — compare lengths first. Return a non-2xx only when you want the sender to retry.

---

## Conditional Requests

```
GET /users/123                → 200, ETag: "v5"
GET /users/123                → If-None-Match: "v5" → 304 Not Modified

PUT /users/123                → If-Match: "v5"
  changed since read          → 412 Precondition Failed
  If-Match required but absent → 428 Precondition Required
```

Use `If-Match` on updates where lost writes matter. Cache-Control policy for API responses: `caching`.

---

## Long-Running Operations

```
POST /reports
→ 202 Accepted, Location: /operations/op_123

GET /operations/op_123
{ "id": "op_123", "status": "running", "progress": 65 }

GET /operations/op_123
{ "id": "op_123", "status": "succeeded", "resultUrl": "/reports/rpt_456" }
{ "id": "op_123", "status": "failed", "error": { "type": "...", "detail": "..." } }
```

Statuses form a closed set the client handles exhaustively. Offer a webhook or push notification for completion when polling is expensive. The worker side: `background-jobs`.

---

## Error Response Patterns

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Failed",
  "status": 422,
  "detail": "2 fields failed validation",
  "errors": [
    { "field": "email", "code": "invalid_format", "message": "Must be a valid email address" },
    { "field": "age", "code": "out_of_range", "message": "Must be between 18 and 120" }
  ]
}
```

Never echo the submitted value: it can be a password, a token, or personal data, and it ends up in client logs.

| Code | Status | Meaning |
|------|--------|---------|
| `unauthorized` | 401 | Missing or invalid credentials |
| `forbidden` | 403 | Valid credentials, insufficient permission |
| `not_found` | 404 | Resource does not exist (or is hidden from this caller) |
| `conflict` | 409 | Duplicate or state conflict, including in-flight idempotency key |
| `precondition_failed` | 412 | `If-Match` did not match |
| `validation_failed` | 422 | Input failed semantic validation |
| `rate_limited` | 429 | Too many requests; see `Retry-After` |
| `gone` | 410 | Removed permanently, or version past sunset |

---

## Deprecation Headers

- `Deprecation` — RFC 9745. A Structured Fields date when the resource is or becomes deprecated: `Deprecation: @1767225600`.
- `Sunset` — RFC 8594. An HTTP date after which the resource may stop responding: `Sunset: Thu, 01 Jul 2027 00:00:00 GMT`.
- `Link: <https://api.example.com/docs/migrate-v2>; rel="deprecation"` — where to read about it.

---

## Rate-Limit Headers

The IETF `RateLimit` and `RateLimit-Policy` fields (draft-ietf-httpapi-ratelimit-headers, Structured Fields syntax) are an Internet-Draft, not an RFC (draft 11, May 2026). In practice:

- `429` + `Retry-After` is the stable contract; always send it.
- Many APIs send `X-RateLimit-Limit` / `-Remaining` / `-Reset`; older drafts used `RateLimit-Limit` / `-Remaining` / `-Reset`.
- Pick one scheme, document it in the contract, and do not mix them across endpoints. Adopting the draft's syntax means tracking later revisions until it is published.
