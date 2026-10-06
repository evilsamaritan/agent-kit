# HTTP Patterns

Header mechanics that have no better owner. Other topics live elsewhere: status codes and error contracts in `api-design` (RFC 9457 problem details), Cache-Control policy and CDN strategy in `caching`, SSE protocol in `realtime`, threat-driven header policy and review in `security`.

## Contents

- [Conditional Requests](#conditional-requests)
- [Cache-Control Mechanics](#cache-control-mechanics)
- [Vary and Content Negotiation](#vary-and-content-negotiation)
- [Compression](#compression)
- [Early Hints](#early-hints)
- [Security Header Syntax](#security-header-syntax)
- [Service Worker Script Caching](#service-worker-script-caching)

---

## Conditional Requests

```
HTTP/1.1 200 OK
ETag: "abc123"
Cache-Control: no-cache

GET /resource HTTP/1.1
If-None-Match: "abc123"

HTTP/1.1 304 Not Modified
ETag: "abc123"
```

- Strong ETag `"abc123"`: byte-for-byte identical. Weak `W/"abc123"`: semantically equivalent.
- Prefer ETag over `Last-Modified` (`If-Modified-Since` has one-second resolution and clock dependence). Send both only when intermediaries need it.
- Use `If-Match` (or `If-Unmodified-Since`) on `PUT` and `PATCH` for optimistic concurrency: a mismatch returns `412 Precondition Failed`, so concurrent edits do not overwrite each other.
- `Range` and `If-Range` allow resumable downloads and media seeking; the server answers `206` with `Content-Range`.

## Cache-Control Mechanics

What each directive means. Which to apply to which resource is policy: see `caching`.

| Directive | Effect |
|-----------|--------|
| `max-age=N` | Fresh for N seconds |
| `s-maxage=N` | Overrides `max-age` for shared caches (CDN, proxy) |
| `no-cache` | May be stored, but must be revalidated before reuse |
| `no-store` | Do not store at all |
| `public` / `private` | Shared caches may store / only the browser may store |
| `must-revalidate` | Once stale, never serve without revalidating |
| `stale-while-revalidate=N` | Serve stale for N seconds while refreshing in the background |
| `stale-if-error=N` | Serve stale for N seconds when the origin errors |
| `immutable` | Will not change during freshness lifetime; skip revalidation |

A response carrying `Set-Cookie` or user-specific data needs `private` or `no-store`; shared caches must not store it.

## Vary and Content Negotiation

```
Accept: application/json, text/html;q=0.9, */*;q=0.1
Accept-Language: en-US, en;q=0.9, fr;q=0.5
Accept-Encoding: gzip, br, zstd

Content-Type: application/json; charset=utf-8
Content-Language: en-US
Content-Encoding: br
Vary: Accept-Encoding, Accept-Language
```

- Quality values run 0.0 to 1.0 (default 1.0).
- `Vary` lists every request header the response depends on. Missing `Vary: Accept-Encoding` lets a cache serve a compressed body to a client that cannot decode it; missing `Vary: Origin` on dynamic CORS responses lets one origin's headers be served to another.
- Each `Vary` value splits the cache. Do not vary on `Cookie` or `Authorization` for public caches; make such responses `private`.
- Use `Content-Type: application/problem+json` for RFC 9457 errors (contract in `api-design`).

## Compression

| Algorithm | Notes |
|-----------|-------|
| gzip | Universal fallback |
| Brotli (`br`) | Usually smaller than gzip on text; pre-compress static assets at build time |
| zstd | Fast at good ratios, useful for dynamic responses; Chrome and Firefox have decoded it for some time and Safari only from 26.3, so negotiate it through `Accept-Encoding` and keep `br` or `gzip` available |

Ratios depend on content and level; measure on your payloads. Serve pre-compressed `.br` and `.gz` files by `Accept-Encoding`. Skip compression for tiny responses (about 1 KB) and already-compressed formats (images, video, archives).

## Early Hints

`103 Early Hints` lets the server send preload hints before the final response is ready; it replaces HTTP/2 server push.

```
HTTP/1.1 103 Early Hints
Link: </style.css>; rel=preload; as=style
Link: </main.js>; rel=preload; as=script

HTTP/1.1 200 OK
Content-Type: text/html
```

## Security Header Syntax

Threat-driven policy and review: `security`. Syntax and configuration:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'

# Cross-origin isolation (needed for SharedArrayBuffer)
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

- `includeSubDomains` in HSTS assumes every subdomain serves HTTPS; drop it otherwise. Add `preload` only as an opt-in, after submitting to the preload list and accepting that removal is slow. A long `max-age` with `preload` is effectively irreversible.
- `frame-ancestors` supersedes `X-Frame-Options`; send the legacy header only for very old clients.

## Service Worker Script Caching

Serve `sw.js` (and any script it imports) with `Cache-Control: no-cache` so updates are discovered, and register with `updateViaCache: "none"`. Hashed application assets can still be immutable. Browsers also bypass the HTTP cache for service worker script checks after about 24 hours, but do not rely on it.
