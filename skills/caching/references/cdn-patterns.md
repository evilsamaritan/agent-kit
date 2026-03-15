# CDN Patterns

Cache-Control headers, surrogate keys, edge computing, and cache hierarchy.

## Contents

- [Cache-Control Header Guide](#cache-control-header-guide)
- [CDN Architecture](#cdn-architecture)
- [Surrogate Keys and Purge Strategies](#surrogate-keys-and-purge-strategies)
- [Edge Computing Patterns](#edge-computing-patterns)
- [Cache Hierarchy Design](#cache-hierarchy-design)
- [Provider-Specific Configuration](#provider-specific-configuration)
- [Troubleshooting](#troubleshooting)

---

## Cache-Control Header Guide

### Directive Reference

| Directive | Meaning | Example |
|-----------|---------|---------|
| `public` | Any cache can store | CDN, browser, proxies |
| `private` | Only browser can store | User-specific data |
| `no-store` | Do not cache at all | Sensitive data |
| `no-cache` | Cache but revalidate every time | Fresh-on-every-request |
| `max-age=N` | Browser cache for N seconds | `max-age=3600` (1hr) |
| `s-maxage=N` | CDN/proxy cache for N seconds (overrides max-age) | `s-maxage=86400` (1day) |
| `must-revalidate` | Don't serve stale even if allowed | Strict freshness |
| `stale-while-revalidate=N` | Serve stale for N seconds while refreshing | Background refresh |
| `stale-if-error=N` | Serve stale for N seconds if origin errors | Resilience |
| `immutable` | Never revalidate (content never changes) | Hashed filenames |

### Common Recipes

```http
# Static assets with hash in filename (main.a1b2c3.js)
Cache-Control: public, max-age=31536000, immutable

# HTML pages (always revalidate)
Cache-Control: public, max-age=0, must-revalidate
ETag: "abc123"

# API response cacheable by CDN
Cache-Control: public, s-maxage=3600, max-age=60, stale-while-revalidate=120

# Private user data
Cache-Control: private, max-age=300

# Sensitive data (never cache)
Cache-Control: no-store

# Resilient caching (serve stale if origin down)
Cache-Control: public, max-age=300, stale-if-error=86400
```

### Vary Header

```http
# Cache different versions based on these headers
Vary: Accept-Encoding              # gzip vs brotli
Vary: Accept-Language              # Localized content
Vary: Accept                       # JSON vs HTML
Vary: Authorization                # AVOID -- effectively disables CDN cache

# Warning: each unique Vary combination = separate cache entry
# Too many Vary values = poor cache hit rate
```

---

## CDN Architecture

### Request Flow

```
Client -> Edge PoP (nearest) -> Shield/Mid-Tier -> Origin
           |                      |
           | Cache HIT            | Cache HIT
           | -> Return            | -> Return to Edge -> Cache -> Return
           |                      |
           | Cache MISS           | Cache MISS
           | -> Forward           | -> Forward to Origin
```

### Origin Shield

A single mid-tier cache between edges and origin:
- Reduces origin load (edges share a single cache)
- Increases cache hit rate (larger combined keyspace)
- Adds latency on MISS (extra hop)

**Use when:** origin is expensive to query, content is globally popular.
**Skip when:** content is geo-specific, ultra-low latency needed.

### Cache Key Design

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

### Purge Patterns

```bash
# Purge single URL
curl -X PURGE https://cdn.example.com/products/123

# Purge by surrogate key (Fastly)
curl -X POST https://api.fastly.com/service/SVC/purge/product-123

# Purge by tag (Cloudflare)
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

### Edge Worker Pattern (Cloudflare Workers)

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Check edge cache first
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let response = await cache.match(cacheKey);

    if (!response) {
      // Cache miss -- fetch from origin
      response = await fetch(request);

      // Clone and cache (can't read body twice)
      const cachedResponse = new Response(response.body, response);
      cachedResponse.headers.set('Cache-Control', 'public, s-maxage=3600');

      // Non-blocking cache put
      event.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
      response = cachedResponse;
    }

    return response;
  },
};
```

---

## Cache Hierarchy Design

### Three-Layer Architecture

```
                          TTL    Hit Rate   Latency
L1: In-Process Memory     30s    60-80%     <1ms
    (Node.js Map, Go sync.Map, LRU cache)
          |
L2: Distributed Cache    5-60m   80-95%     1-5ms
    (Redis, Memcached)
          |
L3: CDN Edge Cache       1-24h   90-99%     10-50ms
    (Cloudflare, Fastly, CloudFront)
          |
Origin: Database / API   N/A     N/A        50-500ms
```

### Invalidation Cascade

```python
def invalidate_cache(key, tags=None):
    # L1: Delete from local memory
    local_cache.delete(key)

    # L2: Delete from Redis
    redis.delete(key)

    # L3: Purge from CDN by surrogate key
    if tags:
        cdn.purge_by_tags(tags)

    # Notify other instances to clear L1
    redis.publish('cache:invalidate', json.dumps({
        'key': key,
        'tags': tags,
    }))
```

### Write Patterns Across Layers

| Write Pattern | L1 | L2 | L3 |
|--------------|-----|-----|-----|
| Cache-Aside | Delete on write | Delete on write | TTL or purge |
| Write-Through | Update on write | Update on write | Purge |
| Write-Behind | Update on write | Async write | Purge |

---

## Provider-Specific Configuration

### Cloudflare

```
# Page Rules (legacy) or Cache Rules (modern)
Match: *.example.com/api/*
  Cache Level: Standard
  Edge Cache TTL: 1 hour
  Browser Cache TTL: 1 minute

Match: *.example.com/static/*
  Cache Level: Cache Everything
  Edge Cache TTL: 1 month

# Workers Route
Route: example.com/api/dynamic/*
  Worker: dynamic-handler
```

### AWS CloudFront

```json
{
  "CacheBehaviors": [{
    "PathPattern": "/api/*",
    "CachePolicyId": "custom-api-policy",
    "TTL": { "DefaultTTL": 60, "MaxTTL": 3600, "MinTTL": 0 },
    "AllowedMethods": ["GET", "HEAD"],
    "CachedMethods": ["GET", "HEAD"],
    "ForwardedValues": {
      "QueryString": true,
      "Headers": ["Accept", "Accept-Language"]
    }
  }]
}
```

### Vercel

```javascript
// next.config.js headers
module.exports = {
  async headers() {
    return [{
      source: '/api/:path*',
      headers: [{
        key: 'Cache-Control',
        value: 'public, s-maxage=60, stale-while-revalidate=300',
      }],
    }];
  },
};
```

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

- Cache hit rate (target: >90% for static, >70% for API)
- Origin request rate (should decrease as cache improves)
- Cache purge rate (high = too aggressive purging)
- Edge latency vs origin latency (quantify cache benefit)
- Bandwidth savings (cached bytes vs origin bytes)
