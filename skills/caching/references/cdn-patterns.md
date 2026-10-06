# CDN Patterns

Edge cache keys, surrogate keys and purge, edge workers, layered invalidation, and provider configuration. The Cache-Control policy per content type is in [SKILL.md](../SKILL.md#cache-control-policy); directive grammar and semantics are owned by `web`.

## Contents

- [Vary and the Cache Key](#vary-and-the-cache-key)
- [Edge Cache Key](#edge-cache-key)
- [Surrogate Keys and Purge Strategies](#surrogate-keys-and-purge-strategies)
- [Edge Computing Patterns](#edge-computing-patterns)
- [Cache Hierarchy Design](#cache-hierarchy-design)
- [Provider-Specific Configuration](#provider-specific-configuration)
- [Troubleshooting](#troubleshooting)

---

## Vary and the Cache Key

```http
# Cache different versions based on these headers
Vary: Accept-Encoding              # gzip vs brotli
Vary: Accept-Language              # Localized content
Vary: Accept                       # JSON vs HTML
Vary: Authorization                # avoid: per-user responses should be `private`, not shared-cached

# Warning: each unique Vary combination = separate cache entry
# Too many Vary values = poor cache hit rate
```

---

## Edge Cache Key

Edge, shield, and origin topology (PoPs, origin shield, routing) is owned by `networking`. This section covers what forms the cache key.

Default cache key: `scheme + host + path + query string`

Customize to improve hit rate:
```
# Ignore query parameter order
/products?color=red&size=L = /products?size=L&color=red

# Ignore tracking parameters
/page?utm_source=twitter -> strip utm_* from cache key

# Include headers in key (sparingly)
Key: path + Accept-Language (for localized content)
```

---

## Surrogate Keys and Purge Strategies

### Surrogate Key Tagging

Assign tags to responses so you can purge related content in bulk:

```http
# Response from origin
HTTP/1.1 200 OK
Surrogate-Key: product-123 category-electronics homepage-featured user-content
Cache-Control: public, s-maxage=86400
```

The tag header name is provider-specific: Fastly reads `Surrogate-Key` (space-separated), Cloudflare reads `Cache-Tag` (comma-separated). Send the one your CDN reads.

### Purge Patterns

```bash
# Purge single URL
curl -X PURGE https://cdn.example.com/products/123

# Purge by surrogate key (Fastly)
curl -X POST https://api.fastly.com/service/SVC/purge/product-123

# Purge by tag (Cloudflare; matches the Cache-Tag response header)
curl -X POST https://api.cloudflare.com/client/v4/zones/ZONE/purge_cache \
  -d '{"tags": ["product-123"]}'

# Purge everything (nuclear option -- avoid)
curl -X POST https://api.cloudflare.com/client/v4/zones/ZONE/purge_cache \
  -d '{"purge_everything": true}'
```

### Purge Strategy Matrix

| Trigger | Purge Method | Latency | Use When |
|---------|-------------|---------|----------|
| Content update | Surrogate key purge | Seconds | Product/article update |
| Deploy | Purge by path pattern | Seconds | HTML template changes |
| Emergency | Purge everything | Seconds | Security incident, bad deploy |
| Scheduled | TTL expiry | Automatic | Periodic refresh |

### Best Practices
- Tag generously: each response can have multiple surrogate keys
- Purge specifically: purge by key, not by URL pattern
- Automate: trigger purge from CMS/API on content change
- Monitor purge rate: high purge rate = TTL too long or too much dynamic content

---

## Edge Computing Patterns

### Edge Functions Use Cases

| Use Case | Logic at Edge | Benefit |
|----------|--------------|---------|
| A/B testing | Route to variant based on cookie | No origin round-trip |
| Geo-routing | Redirect based on country | Lower latency |
| Auth validation | Verify JWT at edge | Block unauthorized early |
| Response transformation | Inject headers, modify HTML | No origin change needed |
| Rate limiting | Count requests at edge | Protect origin |
| Image optimization | Resize/format at edge | Bandwidth savings |

### Edge Worker Pattern (Cloudflare Workers syntax)

Cache only what is public and keyed correctly: successful GET responses without `Set-Cookie`, for requests without credentials, and only as long as the origin's own `Cache-Control` allows.

```javascript
export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' || request.headers.has('Authorization') || request.headers.has('Cookie')) {
      return fetch(request);                       // never share-cache credentialed requests
    }

    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    const cc = response.headers.get('Cache-Control') || '';
    const cacheable =
      response.status === 200 &&
      !response.headers.has('Set-Cookie') &&
      !/no-store|private/.test(cc);

    if (cacheable) {
      ctx.waitUntil(cache.put(request, response.clone()));   // origin headers decide the TTL
    }
    return response;
  },
};
```

---

## Cache Hierarchy Design

Layer roles and TTL ranges: [distributed-and-browser-patterns.md](distributed-and-browser-patterns.md#multi-layer-caching).

### Invalidation Order

Source first, then outward: commit → delete the shared (L2) entry → broadcast L1 deletion → purge the edge by surrogate key for public content. Code: [distributed-and-browser-patterns.md](distributed-and-browser-patterns.md#invalidation-order).

### Write Patterns Across Layers

| Write Pattern | L1 | L2 | L3 |
|--------------|-----|-----|-----|
| Cache-aside (default) | Broadcast delete | Delete after commit | TTL or purge by tag |
| Write-through (one writer per key) | Broadcast delete | Updated by the writer | Purge by tag |

---

## Provider-Specific Configuration

### Cloudflare

Cache Rules match paths and set edge and browser TTLs, or respect origin headers. Static paths can be marked eligible for caching; API paths should respect origin `Cache-Control` and bypass on cookies or `Authorization`. Workers routes run code before the cache.

### AWS CloudFront

Each cache behavior (path pattern) references a **cache policy** (TTL bounds and which headers, cookies, and query strings form the cache key) and an **origin request policy** (what is forwarded to the origin without entering the key). Keep the key minimal; forward extra values through the origin request policy. Private bucket origins use Origin Access Control (OAC). Invalidations are by path.

### Framework-managed headers

Hosting platforms and frameworks often set `Cache-Control` from route configuration (for example a `headers()` function in the framework config). Set the policy there per route instead of patching it at the edge.

---

## Troubleshooting

### Debug Headers

```bash
# Check cache status
curl -I https://example.com/page

# Look for these headers:
# CF-Cache-Status: HIT/MISS/BYPASS/EXPIRED/DYNAMIC    (Cloudflare)
# X-Cache: Hit from cloudfront / Miss from cloudfront   (CloudFront)
# X-Served-By: cache-sjc1234-SJC                       (Fastly)
# Age: 3600                                             (seconds since cached)
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Always MISS | Vary: * or Vary: Authorization | Remove unnecessary Vary headers |
| Low hit rate | Query params in cache key | Normalize query param order, strip tracking params |
| Stale content | No purge on content change | Implement surrogate key purge on write |
| Different content per user | Missing `private` directive | Add `Cache-Control: private` for user-specific responses |
| 304 without body savings | Missing ETag/Last-Modified | Add conditional response headers |

### Monitoring Metrics

- Cache hit ratio per path class (compare against your own baseline, not a universal target)
- Origin request rate (should fall as the cache improves)
- Purge rate (high means TTLs are too long or content too dynamic)
- Edge vs origin latency, and bytes served from cache
