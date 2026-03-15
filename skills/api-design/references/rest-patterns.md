# REST API Patterns

Detailed REST conventions, filtering, sorting, bulk operations, and webhook patterns.

## Contents

- [URL Design](#url-design) — resource hierarchy, filtering, sorting, naming
- [Pagination Implementations](#pagination-implementations) — cursor-based, keyset (SQL)
- [Bulk Operations](#bulk-operations) — batch create, update, delete
- [Idempotency](#idempotency) — idempotency key header, implementation pattern
- [Webhook Patterns](#webhook-patterns) — registration, delivery, signature verification
- [Caching](#caching) — ETag, Last-Modified, optimistic concurrency
- [Long-Running Operations](#long-running-operations) — async pattern with polling
- [Error Response Patterns](#error-response-patterns) — validation errors, error code registry

---

## URL Design

### Resource Hierarchy

```
/users                              # Collection
/users/{id}                         # Instance
/users/{id}/orders                  # Sub-collection
/users/{id}/orders/{orderId}        # Sub-instance

# Max 2 levels deep. Beyond that, use top-level with filters:
/orders?userId=123                  # Instead of /users/123/orders
```

### Filtering, Sorting, and Field Selection

```
# Filtering
GET /products?category=electronics&price_min=100&price_max=500
GET /products?status=active,pending          # Multiple values (OR)
GET /products?created_after=2024-01-01       # Date filtering
GET /products?search=keyboard                # Full-text search

# Sorting
GET /products?sort=price                     # Ascending (default)
GET /products?sort=-price                    # Descending (prefix -)
GET /products?sort=-created_at,name          # Multiple sort fields

# Field selection (sparse fieldsets)
GET /users?fields=id,name,email              # Only return specified fields
GET /users/{id}?include=orders,profile       # Include related resources
```

### Naming Conventions

| Convention | Example | Notes |
|-----------|---------|-------|
| Plural nouns | `/users`, `/orders` | Collections are plural |
| Lowercase + hyphens | `/user-profiles` | Not camelCase or snake_case in URLs |
| No verbs | `/users` not `/getUsers` | HTTP method is the verb |
| Query params: snake_case | `?page_size=20` | Convention for query parameters |
| Response body: camelCase | `{ "firstName": "..." }` | JavaScript convention (or snake_case for Python APIs) |

---

## Pagination Implementations

### Cursor-Based Pagination

```json
// Request
GET /orders?limit=20&after=eyJpZCI6MTAwfQ==

// Response
{
  "data": [
    { "id": "101", "total": 59.99 },
    { "id": "102", "total": 120.00 }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ==",
    "prev_cursor": "eyJpZCI6MTAxfQ==",
    "has_more": true,
    "limit": 20
  }
}
```

Cursor encoding: Base64 of `{"id": 120}` or `{"created_at": "2024-01-15", "id": 120}` for compound cursors.

### Keyset Pagination (SQL)

```sql
-- First page
SELECT * FROM orders
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Next page (using last row's values)
SELECT * FROM orders
WHERE (created_at, id) < ('2024-01-15 10:30:00', 500)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Requires a unique, indexed sort column. Compound keyset for non-unique sort fields.

---

## Bulk Operations

### Batch Create

```
POST /users/batch
Content-Type: application/json

{
  "items": [
    { "name": "Alice", "email": "alice@example.com" },
    { "name": "Bob", "email": "bob@example.com" }
  ]
}

// Response — per-item status
{
  "results": [
    { "index": 0, "status": 201, "data": { "id": "u1", "name": "Alice" } },
    { "index": 1, "status": 409, "error": { "type": "conflict", "detail": "Email exists" } }
  ],
  "summary": { "succeeded": 1, "failed": 1, "total": 2 }
}
```

### Batch Update / Delete

```
PATCH /users/batch
{
  "items": [
    { "id": "u1", "name": "Alice Updated" },
    { "id": "u2", "name": "Bob Updated" }
  ]
}

DELETE /users/batch
{
  "ids": ["u1", "u2", "u3"]
}
```

---

## Idempotency

### Idempotency Key Header

```
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "amount": 100, "currency": "USD" }
```

**Server behavior:**
1. Check if `Idempotency-Key` exists in store
2. If found, return stored response (same status code + body)
3. If not found, process request, store response with key
4. Key expires after 24-48 hours

### Implementation Pattern

```
Store: { key → { status, headers, body, created_at } }

If key exists AND request body matches → return stored response
If key exists AND request body differs → 422 Unprocessable (prevent misuse)
If key not found → process, store, return
```

---

## Webhook Patterns

### Webhook Registration

```
POST /webhooks
{
  "url": "https://example.com/hooks/orders",
  "events": ["order.created", "order.updated", "order.cancelled"],
  "secret": "whsec_abc123..."
}
```

### Webhook Delivery

```
POST https://example.com/hooks/orders
Content-Type: application/json
X-Webhook-Id: evt_abc123
X-Webhook-Timestamp: 1705334400
X-Webhook-Signature: sha256=abc123...

{
  "id": "evt_abc123",
  "type": "order.created",
  "created_at": "2024-01-15T12:00:00Z",
  "data": {
    "id": "order_456",
    "total": 99.99
  }
}
```

### Signature Verification (HMAC)

```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const timestamp = headers['x-webhook-timestamp']
  const signedPayload = `${timestamp}.${payload}`
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expected)
  )
}
```

### Webhook Delivery Contract

| Feature | Implementation |
|---------|---------------|
| Retries | Exponential backoff: 1m, 5m, 30m, 2h, 24h |
| Timeout | 30s per attempt |
| Success | 2xx status code |
| Failure | After all retries, disable webhook + notify |
| Ordering | Not guaranteed — include timestamp, use idempotency |
| Replay | `POST /webhooks/{id}/replay` — resend recent events |

---

## Caching

### ETag-Based Caching

```
# Response
GET /users/123
HTTP/1.1 200 OK
ETag: "abc123"

# Conditional request
GET /users/123
If-None-Match: "abc123"

HTTP/1.1 304 Not Modified  # No body, use cached version
```

### Last-Modified Caching

```
# Response
GET /articles
HTTP/1.1 200 OK
Last-Modified: Wed, 15 Jan 2024 12:00:00 GMT

# Conditional request
GET /articles
If-Modified-Since: Wed, 15 Jan 2024 12:00:00 GMT

HTTP/1.1 304 Not Modified
```

### Optimistic Concurrency

```
# Read with ETag
GET /users/123 → ETag: "v5"

# Update with If-Match
PUT /users/123
If-Match: "v5"
{ "name": "Updated" }

# If resource changed since read:
HTTP/1.1 412 Precondition Failed
```

---

## Long-Running Operations

### Async Pattern

```
# Start operation
POST /reports/generate
HTTP/1.1 202 Accepted
Location: /jobs/job_123

# Poll for status
GET /jobs/job_123
{
  "id": "job_123",
  "status": "processing",
  "progress": 65,
  "created_at": "2024-01-15T12:00:00Z",
  "estimated_completion": "2024-01-15T12:05:00Z"
}

# Complete
GET /jobs/job_123
{
  "id": "job_123",
  "status": "completed",
  "result_url": "/reports/rpt_456"
}
```

---

## Error Response Patterns

### Validation Error with Field Details

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Failed",
  "status": 422,
  "detail": "2 fields failed validation",
  "errors": [
    {
      "field": "email",
      "code": "invalid_format",
      "message": "Must be a valid email address",
      "value": "not-an-email"
    },
    {
      "field": "age",
      "code": "out_of_range",
      "message": "Must be between 18 and 120",
      "value": 15
    }
  ]
}
```

### Error Code Registry

| Code | HTTP Status | Meaning |
|------|------------|---------|
| `not_found` | 404 | Resource doesn't exist |
| `conflict` | 409 | Duplicate or state conflict |
| `validation_failed` | 422 | Input validation errors |
| `rate_limited` | 429 | Too many requests |
| `insufficient_funds` | 422 | Business rule violation |
| `unauthorized` | 401 | Missing/invalid credentials |
| `forbidden` | 403 | Valid credentials, insufficient permissions |
| `gone` | 410 | Resource permanently deleted |
