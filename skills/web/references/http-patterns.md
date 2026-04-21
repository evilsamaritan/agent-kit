# HTTP Patterns

## Contents

- [Status Codes](#status-codes)
- [Caching](#caching)
- [Content Negotiation](#content-negotiation)
- [Streaming](#streaming)
- [Security Headers](#security-headers)
- [Compression](#compression)

---

## Status Codes

### Success (2xx)

| Code | Meaning | When to use |
|------|---------|-------------|
| 200 | OK | Default success — GET, PUT, PATCH |
| 201 | Created | POST that created a resource — include `Location` header |
| 202 | Accepted | Async processing started — not yet complete |
| 204 | No Content | Success with no body — DELETE, PUT with no response |

### Redirection (3xx)

| Code | Meaning | When to use |
|------|---------|-------------|
| 301 | Moved Permanently | URL changed forever — browsers cache aggressively |
| 302 | Found | Temporary redirect — use 307 instead for method preservation |
| 304 | Not Modified | Conditional request — ETag/Last-Modified matched |
| 307 | Temporary Redirect | Like 302 but preserves HTTP method |
| 308 | Permanent Redirect | Like 301 but preserves HTTP method |

### Client Error (4xx)

| Code | Meaning | When to use |
|------|---------|-------------|
| 400 | Bad Request | Malformed syntax, invalid parameters |
| 401 | Unauthorized | No/invalid authentication — should be "Unauthenticated" |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource does not exist |
| 405 | Method Not Allowed | Endpoint exists but method is wrong |
| 409 | Conflict | State conflict (duplicate, version mismatch) |
| 413 | Content Too Large | Request body exceeds limit |
| 422 | Unprocessable Content | Valid syntax but semantic errors (validation) |
| 429 | Too Many Requests | Rate limited — include `Retry-After` header |

### Server Error (5xx)

| Code | Meaning | When to use |
|------|---------|-------------|
| 500 | Internal Server Error | Unexpected server failure |
| 502 | Bad Gateway | Upstream service returned invalid response |
| 503 | Service Unavailable | Temporary overload — include `Retry-After` |
| 504 | Gateway Timeout | Upstream service timed out |

---

## Caching

### Cache-Control Directives

```
# Public cacheable, revalidate after 1 hour
Cache-Control: public, max-age=3600, must-revalidate

# Private (user-specific), stale-while-revalidate pattern
Cache-Control: private, max-age=60, stale-while-revalidate=300

# No caching at all
Cache-Control: no-store

# Cache but always revalidate (use with ETag)
Cache-Control: no-cache

# Immutable — never revalidate (use with hashed filenames)
Cache-Control: public, max-age=31536000, immutable
```

| Directive | Effect |
|-----------|--------|
| `public` | Any cache can store (CDN, proxy, browser) |
| `private` | Only browser can store (user-specific data) |
| `max-age=N` | Fresh for N seconds |
| `s-maxage=N` | Override max-age for shared caches (CDN) |
| `no-cache` | Must revalidate with server before using cached copy |
| `no-store` | Never cache — sensitive data |
| `must-revalidate` | Don't serve stale — revalidate when expired |
| `stale-while-revalidate=N` | Serve stale for N seconds while fetching fresh |
| `stale-if-error=N` | Serve stale for N seconds if origin returns 5xx |
| `immutable` | Will never change — skip revalidation |

### ETag / Conditional Requests

```
# Server response with ETag
HTTP/1.1 200 OK
ETag: "abc123"
Cache-Control: no-cache

# Client conditional request
GET /resource HTTP/1.1
If-None-Match: "abc123"

# Server response — not modified
HTTP/1.1 304 Not Modified
ETag: "abc123"
```

**Weak vs Strong ETags:**
- Strong: `"abc123"` — byte-for-byte identical
- Weak: `W/"abc123"` — semantically equivalent (allows minor formatting changes)

### Last-Modified / If-Modified-Since

```
# Response
Last-Modified: Wed, 12 Mar 2025 10:00:00 GMT

# Conditional request
If-Modified-Since: Wed, 12 Mar 2025 10:00:00 GMT
```

**Prefer ETags over Last-Modified** — more precise, handles sub-second changes.

### Vary Header

```
# Response varies by these request headers — cache separately
Vary: Accept, Accept-Encoding, Authorization
```

**Always include `Vary: Accept-Encoding`** when serving compressed content. Otherwise CDNs may serve gzipped content to clients that don't support it.

---

## Content Negotiation

```
# Request — client preferences
Accept: application/json, text/html;q=0.9, */*;q=0.1
Accept-Language: en-US, en;q=0.9, fr;q=0.5
Accept-Encoding: gzip, br, zstd

# Response — what server chose
Content-Type: application/json; charset=utf-8
Content-Language: en-US
Content-Encoding: br
```

**Quality values (q):** 0.0 to 1.0, default 1.0. Higher = more preferred.

### JSON API Content Type

```
Content-Type: application/vnd.api+json          # JSON:API
Content-Type: application/problem+json          # RFC 7807 errors
Content-Type: application/json; charset=utf-8   # Standard JSON
```

---

## Streaming

### Server-Sent Events (SSE)

```
# Response headers
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

# Event format
data: {"message": "hello"}

event: update
data: {"status": "processing"}
id: 42
retry: 5000

# Client
const source = new EventSource("/events");
source.onmessage = (e) => console.log(JSON.parse(e.data));
source.addEventListener("update", (e) => { /* ... */ });
```

### Chunked Transfer

```
# Response headers
Transfer-Encoding: chunked

# Body — each chunk: size in hex + \r\n + data + \r\n
5\r\n
Hello\r\n
6\r\n
 World\r\n
0\r\n
\r\n
```

### HTTP/2 Server Push (deprecated in browsers)

Use `103 Early Hints` instead:

```
HTTP/1.1 103 Early Hints
Link: </style.css>; rel=preload; as=style
Link: </main.js>; rel=preload; as=script

HTTP/1.1 200 OK
Content-Type: text/html
```

---

## Security Headers

```
# Essential security headers
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()

# Cross-Origin isolation (required for SharedArrayBuffer)
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

---

## Compression

| Algorithm | Ratio | Speed | Support | Use |
|-----------|-------|-------|---------|-----|
| gzip | Good | Fast | Universal | Default fallback |
| Brotli (br) | Better | Slower compress, fast decompress | Modern browsers | Static assets (pre-compress) |
| zstd | Best | Fast | Newest | Large payloads, APIs |

```
# Request
Accept-Encoding: gzip, br, zstd

# Response
Content-Encoding: br
```

**Pre-compress static assets** at build time (`.br`, `.gz` files). Let reverse proxy serve the right version based on `Accept-Encoding`.

**Minimum size:** Don't compress responses under ~1KB — overhead exceeds savings.
