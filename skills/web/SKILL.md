---
name: web
description: Apply web platform APIs — HTTP, fetch, CORS, CSP, storage, service workers, PWA, View Transitions, Navigation API, Speculation Rules, Popover API. Use when working with browser APIs, HTTP protocols, or offline patterns. Do NOT use for HTML/CSS (use html/css) or framework patterns (use react/vue).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Web Platform

Expert-level web platform knowledge. HTTP protocols, browser APIs, security headers, offline patterns.

---

## Hard Rules

- NEVER use `Access-Control-Allow-Origin: *` with credentials — browsers reject it; specify exact origin
- NEVER store sensitive data in `localStorage` — no expiry, no HttpOnly, XSS-accessible; use HttpOnly cookies
- NEVER use synchronous XHR — blocks main thread; use `fetch` with `async/await`
- ALWAYS use AbortController with fetch — leaked requests waste bandwidth and cause race conditions
- ALWAYS version service worker caches — unversioned caches serve outdated content forever
- ALWAYS set `SameSite`, `Secure`, and `HttpOnly` on auth cookies

---

## HTTP Fundamentals

**HTTP/2** — binary framing, multiplexed streams over single TCP connection, header compression (HPACK), server push (deprecated in browsers).

**HTTP/3** — QUIC (UDP-based), 0-RTT connection setup, no head-of-line blocking, built-in TLS 1.3.

| Method | Safe | Idempotent | Body | Use for |
|--------|------|------------|------|---------|
| GET | Yes | Yes | No | Read resources |
| POST | No | No | Yes | Create, actions, RPC |
| PUT | No | Yes | Yes | Full replace |
| PATCH | No | No | Yes | Partial update |
| DELETE | No | Yes | Optional | Remove |
| HEAD | Yes | Yes | No | Check existence, headers |
| OPTIONS | Yes | Yes | No | CORS preflight |

---

## Fetch API Patterns

```typescript
// AbortController — always use for cancellable requests
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

const response = await fetch(url, {
  signal: controller.signal,
  headers: { "Content-Type": "application/json" },
});
clearTimeout(timeout);

// Streaming response — large payloads
const reader = response.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process(decoder.decode(value, { stream: true }));
}
```

**Request interceptor pattern:** wrap `fetch` for auth tokens, logging, retry logic.

---

## Storage Decision Tree

1. **Auth token?** → HttpOnly cookie with `SameSite=Lax`, `Secure`, `__Host-` prefix
2. **Small user preference?** → `localStorage` (5-10MB, sync, per-origin)
3. **Per-tab temp state?** → `sessionStorage` (tab lifetime)
4. **Structured data / offline?** → IndexedDB (async, large capacity)
5. **HTTP response cache?** → Cache API (service worker)

| Storage | Capacity | Persistence | Scope | Sync |
|---------|----------|-------------|-------|------|
| Cookies | 4KB | Configurable | Per-domain, sent with requests | Sync |
| `localStorage` | 5-10MB | Permanent | Per-origin | Sync |
| `sessionStorage` | 5-10MB | Tab lifetime | Per-tab + origin | Sync |
| IndexedDB | Large (GB) | Permanent | Per-origin | Async |
| Cache API | Large | Permanent | Per-origin | Async |

**Storage quota:** `navigator.storage.estimate()` returns `{ usage, quota }`. Request persistent storage with `navigator.storage.persist()`.

**Partitioned cookies (CHIPS)** — third-party cookies with `Partitioned` attribute + `Secure` + `SameSite=None`. Isolated per top-level site. Required for iframe embeds in a cookie-partitioned browser. See `Set-Cookie: ...; Secure; SameSite=None; Partitioned`.

**Storage Access API** — call `document.requestStorageAccess()` from a user-gestured iframe to request unpartitioned cross-site cookie access. Use for legitimate embeds (SSO widgets, payment iframes) that need cross-site state.

---

## CORS Decision Tree

1. **Same origin?** → No CORS needed
2. **Simple request?** (GET/HEAD/POST + safe headers + safe content types) → Browser sends request directly, checks `Access-Control-Allow-Origin`
3. **Not simple?** → Browser sends preflight `OPTIONS` first
4. **Credentials needed?** → `Access-Control-Allow-Credentials: true` + explicit origin (NOT `*`)

```
# Server response headers
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400          # Cache preflight for 24h
Access-Control-Expose-Headers: X-Request-Id  # Headers readable by JS
```

---

## CSP Directives

| Directive | Controls | Example |
|-----------|----------|---------|
| `default-src` | Fallback for all fetch directives | `'self'` |
| `script-src` | JavaScript sources | `'self' 'nonce-abc123'` |
| `style-src` | CSS sources | `'self' 'unsafe-inline'` |
| `connect-src` | fetch, XHR, WebSocket targets | `'self' https://api.example.com` |
| `img-src` | Image sources | `'self' data: https:` |
| `frame-src` | iframe sources | `'none'` |
| `form-action` | Form submission targets | `'self'` |
| `base-uri` | `<base>` element | `'self'` |

**Nonces over hashes** for dynamic content. `'strict-dynamic'` trusts scripts loaded by trusted scripts.

**Report-only mode:** `Content-Security-Policy-Report-Only` to test before enforcing.

---

## Service Workers Lifecycle

```
Install → Activate → Fetch (idle ↔ terminated)
```

1. **Install** — cache essential assets (`event.waitUntil(caches.open(...))`)
2. **Activate** — clean old caches (`event.waitUntil(caches.delete(...))`)
3. **Fetch** — intercept requests, apply caching strategy

| Strategy | Behavior | Use for |
|----------|----------|---------|
| Cache First | Cache → Network (fallback) | Static assets, fonts |
| Network First | Network → Cache (fallback) | API calls, fresh content |
| Stale-While-Revalidate | Cache immediately → update cache from network | Semi-dynamic content |
| Network Only | Network always | Auth, real-time data |
| Cache Only | Cache always | Offline-only resources |

---

## PWA Checklist

- `manifest.json` — `name`, `short_name`, `icons` (192px + 512px), `start_url`, `display: standalone`
- Service worker registered with offline fallback
- HTTPS everywhere (required for service workers)
- Responsive viewport meta tag
- `theme-color` meta tag + manifest
- Push notifications via Push API + Notification API

---

## Modern Browser APIs Quick Reference

| API | Purpose | When to use |
|-----|---------|-------------|
| View Transitions | Animated DOM state changes (SPA + MPA) | Page transitions, list reordering |
| Navigation API | Intercept and manage navigations | SPA routing, back/forward control |
| Speculation Rules | Prerender/prefetch future navigations | Instant page loads |
| Popover API | Top-layer popover UI without JS | Tooltips, dropdowns, dialogs |
| CloseWatcher | Device-specific close gestures (Escape, back) | Modals, drawers, popovers |
| Scheduler API | Prioritize background tasks | Defer non-critical work |
| Intersection Observer | Detect element visibility | Lazy loading, infinite scroll |
| Resize Observer | Detect element size changes | Component-level responsive behavior |

See `references/browser-apis.md` for detailed patterns and code examples.

---

## Context Adaptation

**Frontend focus:** Fetch API, AbortController, storage APIs, service workers, PWA, Web Workers, streaming responses, client-side caching, View Transitions, Navigation API, Speculation Rules, Popover API.

**Backend focus:** HTTP semantics, status codes, cache headers (`Cache-Control`, `ETag`, `Vary`), CORS configuration, CSP header generation, cookie attributes, content negotiation.

**SEO overlap:** Service workers affect crawlability. HTTP caching and compression affect Core Web Vitals. See `seo` skill for meta tags and structured data. See `performance` skill for profiling and optimization. See `html/css` skill for semantic markup and layout.

---

## Anti-Patterns

1. **CORS `*` with credentials** — browsers reject this combination; always specify exact origin
2. **`localStorage` for sensitive data** — no expiry, no HttpOnly, XSS-accessible; use HttpOnly cookies
3. **Synchronous XHR** — blocks main thread; use `fetch` with `async/await`
4. **Ignoring AbortController** — leaked requests waste bandwidth and cause race conditions
5. **Unversioned service worker caches** — stale cache without eviction serves outdated content forever
6. **Speculation without limits** — prerendering too many pages wastes bandwidth; use `moderate` or `conservative` eagerness
7. **Manual popover/modal stacking** — use Popover API with top-layer instead of z-index hacks

---

## Related Knowledge

- **html/css** — semantic markup, layout patterns, CSS features
- **security** — CORS, CSP, cookie security, XSS prevention
- **caching** — Cache-Control headers, CDN integration, service worker caching
- **seo** — service worker impact on crawlability, HTTP caching and Core Web Vitals
- **realtime** — WebSocket, SSE, WebTransport (for real-time communication patterns)
- **networking** — DNS, CDN, TLS/mTLS, load balancing (infrastructure-level)

---

## References

Load on demand for detailed patterns and deep-dive knowledge:

- `references/http-patterns.md` — HTTP caching, ETags, status codes, content negotiation, streaming, security headers
- `references/browser-apis.md` — service workers, Web Workers, IndexedDB, observers, performance APIs, View Transitions L2, Navigation API, Speculation Rules, Popover API, CloseWatcher, Scheduler API
