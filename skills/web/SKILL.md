---
name: web
description: "Use browser and HTTP platform behavior: fetch, cookies, CORS and CSP mechanics, browser storage, service workers, PWA and offline, Web Workers, Navigation API, View Transitions. For threat-driven security policy see security, cache policy see caching, SSE and WebSocket see realtime."
user-invocable: true
---

# Web Platform

Browser and HTTP behavior that application code depends on. Browser support differs per API; MDN compatibility tables and Baseline status are the reference, and partially supported APIs need feature detection.

## Hard rules

- Never combine `Access-Control-Allow-Origin: *` with credentials. Browsers reject it; name the exact origin.
- Never keep tokens or sensitive data in `localStorage`: no expiry, readable by any XSS. Use `HttpOnly` cookies.
- Never use synchronous XHR.
- Tie every request to an owner that can cancel it (navigation, unmount, superseded request) and give it a deadline.
- Version service worker caches and delete old versions on activate.
- Auth cookies carry `Secure`, `HttpOnly`, and an explicit `SameSite`; prefer the `__Host-` prefix.

## HTTP in the browser

HTTP/2 multiplexes streams over one connection (HPACK header compression; server push is gone from browsers, use `103 Early Hints`). HTTP/3 runs over QUIC with no transport-level head-of-line blocking. Application code rarely depends on the version; infrastructure choices live in `networking`. Method semantics and status codes: `api-design`. Conditional requests, `Vary`, compression, header mechanics: [http-patterns.md](references/http-patterns.md).

## Fetch

`fetch` rejects only on network failure or abort; a 404 or 500 resolves. Check `response.ok`.

```typescript
const res = await fetch(url, {
  signal: AbortSignal.any([AbortSignal.timeout(5000), ownerSignal]), // deadline + owner cancellation
  headers: { Accept: "application/json" },
});
if (!res.ok) throw new HttpError(res.status, await res.text());
const data = await res.json();
```

- `AbortSignal.timeout(ms)` replaces a manual timer; `AbortSignal.any` combines it with the owner's signal (feature-detect `any` on older targets, or use an `AbortController` per owner).
- Stream large bodies with `res.body.getReader()` plus `TextDecoder({ stream: true })`.
- A wrapper around `fetch` (auth header, logging, error mapping) is fine. Retry only idempotent requests (or with an idempotency key) and keep one retry layer; policy is in `reliability`.

## Storage decision tree

1. Auth token? `HttpOnly` cookie, `SameSite=Lax` (or `Strict`), `Secure`, `__Host-` prefix.
2. Small per-user preference? `localStorage` (sync, per origin, strings only).
3. Per-tab temporary state? `sessionStorage`.
4. Structured or offline data? IndexedDB (async, large).
5. HTTP responses for offline use? Cache API from a service worker.

| Storage | Capacity | Eviction | Scope | API |
|---------|----------|----------|-------|-----|
| Cookies | about 4 KB each | Per `Expires` or `Max-Age`; user-clearable | Sent with matching requests | Sync |
| `localStorage` | about 5 MB | Evictable under pressure or user action; Safari clears script-written storage after 7 days without user interaction with the site (installed home-screen web apps are exempt) | Origin | Sync |
| `sessionStorage` | about 5 MB | Ends with the tab | Tab and origin | Sync |
| IndexedDB | Quota-based, large | Evictable unless persistence is granted | Origin | Async |
| Cache API | Quota-based, large | Evictable unless persistence is granted | Origin | Async |

Browser storage is best effort. `navigator.storage.persist()` requests exemption from eviction (granted by browser heuristics or permission), and `navigator.storage.estimate()` reports usage and quota. The server remains the source of truth for anything the user cannot lose; design offline-first clients to resync.

Third-party embeds: partitioned cookies (`Partitioned` with `Secure; SameSite=None`) isolate state per top-level site. The Storage Access API (`document.requestStorageAccess()` from a user gesture in an iframe) requests unpartitioned access for legitimate embeds such as SSO or payment widgets.

## CORS decision tree

1. Same origin? No CORS.
2. Simple request (GET, HEAD, or POST with safe headers and content types)? Sent directly; the response must carry `Access-Control-Allow-Origin`.
3. Otherwise a preflight `OPTIONS` goes first.
4. Credentials? `Access-Control-Allow-Credentials: true` plus an exact origin.

```
Access-Control-Allow-Origin: https://app.example.com
Vary: Origin                     # required whenever the value depends on the request Origin
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 7200     # browsers cap the preflight cache duration
Access-Control-Expose-Headers: X-Request-Id
```

Echo only allow-listed origins, never reflect arbitrary `Origin`. CORS is a browser read-permission, not authentication. Threat model and checklist: `security`.

## CSP directives

| Directive | Controls |
|-----------|----------|
| `default-src` | Fallback for fetch directives |
| `script-src` | JavaScript; use nonces or hashes plus `'strict-dynamic'` |
| `style-src` | CSS; `'self'` plus a nonce; allow inline styles with `'unsafe-inline'` only as a documented legacy exception |
| `connect-src` | fetch, XHR, WebSocket targets |
| `img-src`, `frame-src`, `media-src` | Resource sources |
| `object-src` | Plugins; set `'none'` |
| `base-uri` | `<base>`; set `'self'` or `'none'` |
| `form-action` | Form targets |
| `frame-ancestors` | Who may embed this page (replaces `X-Frame-Options`) |

A nonce is a fresh random value per response, injected into both the header and the script tags. Never put a nonce on cacheable static HTML or CDN-cached pages; use hashes there. Roll out with `Content-Security-Policy-Report-Only` first. Policy design and review: `security`.

## Service workers

Lifecycle: install (precache with `event.waitUntil`), activate (delete old caches), then fetch events while the worker is alive (it may be terminated when idle, so keep no state in globals).

| Strategy | Behavior | Use for |
|----------|----------|---------|
| Cache first | Cache, fall back to network | Hashed static assets, fonts |
| Network first | Network, fall back to cache | Pages and API data that should be fresh |
| Stale-while-revalidate | Cache now, refresh in background | Semi-dynamic content |
| Network only | Always network | Auth, real-time data |

Route strategies by request type inside one `fetch` handler; two handlers that both call `respondWith` for the same request break. Cache only `GET` responses with `response.ok`. Serve `sw.js` itself with `Cache-Control: no-cache`. Code and update-flow caveats: [browser-apis.md](references/browser-apis.md).

## PWA checklist

- Web app manifest: `name`, `short_name`, `icons` (192 and 512 px, maskable variant), `start_url`, `display`.
- HTTPS and a responsive viewport meta tag; `theme-color`.
- A service worker with an offline fallback if offline use is a goal. Install prompts in current browsers depend on the manifest and engagement heuristics; a service worker is not required for installability in all of them.
- Push notifications (Push and Notification APIs) are optional and need explicit permission UX.

## Modern browser APIs

Support column is coarse; MDN's compatibility tables hold the per-browser detail.

| API | Purpose | Support |
|-----|---------|---------|
| View Transitions | Animated DOM state changes | Same-document: Baseline; cross-document and newer features vary |
| Navigation API | Intercept and manage navigations | Baseline since January 2026 (newly available) |
| Popover API | Non-modal top-layer UI (menus need their own ARIA pattern); `<dialog>` for modal | Baseline; `popover="hint"` is not (Chromium and Firefox only) |
| Speculation Rules | Prefetch or prerender likely navigations | Chromium-led; progressive enhancement |
| CloseWatcher | Unified close gestures for custom UI | Partial; not in Safari |
| `scheduler.yield()` / `postTask` | Yield and prioritize main-thread work | Partial; fall back to `await new Promise(r => setTimeout(r))` |
| Intersection and Resize Observers | Visibility and element size changes | Baseline |

Detail and code: [browser-apis.md](references/browser-apis.md).

## Context adaptation

- **Frontend:** fetch lifecycle, storage choice, workers, service worker update flow, navigation and transitions.
- **Backend:** CORS and cookie attributes, `Vary` and conditional requests, CSP header generation (nonce per response).
- **SEO overlap:** a service worker or client-only rendering can change what crawlers see (`seo`); Core Web Vitals work is in `performance`.

## Anti-patterns

1. **Speculation without limits**: prerendering many pages wastes bandwidth and fires side effects early; use `moderate` or `conservative` eagerness and gate side effects (see browser-apis).
2. **Hand-built modal and popover stacking with z-index**: use `<dialog>.showModal()` for modal UI and `popover` for non-modal top-layer UI.
3. **Treating `fetch` success as HTTP success**: skipping the `response.ok` check.

## Related knowledge

- `html` and `css`: markup, layout, and CSS styling of dialog, popover, and view transitions (the JavaScript APIs are here)
- `security`: threat-driven CORS, CSP, cookie, and HSTS policy and review (syntax and configuration are here)
- `caching`: cache policy per content type, invalidation, CDN purge, stampede (Cache-Control grammar and service worker mechanics are here)
- `api-design`: methods, status codes, error contracts
- `reliability`: retry policy and deadlines
- `realtime`: WebSocket, SSE, WebTransport
- `networking`: DNS, CDN, TLS, load balancing
- `seo`: crawlability effects
- `performance`: Core Web Vitals measurement

## References

- [http-patterns.md](references/http-patterns.md): conditional requests, Cache-Control mechanics, Vary and compression negotiation, Early Hints, security-header syntax
- [browser-apis.md](references/browser-apis.md): service worker code, workers, IndexedDB, observers, View Transitions, Navigation API, Speculation Rules, Popover, CloseWatcher, Scheduler
