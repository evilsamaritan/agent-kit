---
name: caching
description: "Design cache ownership, keys, and invalidation. Use for cache-aside, write-through, multi-layer caches, Cache-Control policy, CDN purge, stampede prevention, and distributed locks. Do NOT use for HTTP header grammar or service-worker code (web)."
---

# Caching

## Rules

- **The cache is never the authority.** The source of truth is the store that owns the record; the default write path updates the source, then deletes the cache entry (not updates it).
- **Every cached value has a TTL**, even with event-driven invalidation. TTL bounds the damage of a missed event and of the read-repopulate race.
- **Invalidate from the source outward:** commit the write → delete the shared entry (L2) → broadcast deletion of in-process copies (L1) → purge the edge only for content that needs it. A reader can still refill a layer with a value read just before the commit; TTL or versioned keys bound that window.
- **The key contains everything that changes the result** — tenant, identity or role, locale, API or schema version. A missing key component serves one user's data to another.
- **Pick a policy per layer.** Each layer states its TTL, its invalidation trigger, and what happens when the cache is down.

## Scope and boundaries

| Question | Owner |
|---|---|
| Cache placement, keys, TTLs, invalidation, layering, stampede control, Cache-Control policy per content type, CDN purge, distributed locks | this skill |
| HTTP header grammar and semantics (`Cache-Control` directives, `ETag`, `Vary`), service-worker and Cache API code | `web` |
| CDN topology, DNS, TLS, edge routing | `networking` |
| Asset storage and upload | `file-storage` (uses this skill's header policy) |
| Query tuning that removes the need for a cache; authoritative storage | `database` |
| Measuring hit rate impact, latency, capacity | `performance` |
| Behavior when the cache or origin fails | `reliability` |

## Strategy decision tree

```
Who owns the record, and can the cache lose a write?
├── Source of truth is a database or service; the cache only speeds up reads
│   ├── Default → Cache-aside: read through the cache, write the source, delete the key
│   ├── Want loading logic out of callers → Read-through (cache library loads on miss); same write path
│   └── Hot keys with predictable access → add refresh-ahead before TTL
├── Reads must see the latest write immediately
│   └── Skip the cache for that path, or write-through with one writer per key
│       (concurrent writers can commit in one order to the source and another to the cache)
└── Write volume too high for the source
    └── Write-behind only with a durable queue between cache and source and a stated loss window;
        otherwise batch writes in the application, not in the cache
```

## Cache key and value

- Compose keys from the namespace, the entity id, and every input that changes the result: `{tenant}:user:{id}:v{schema}:{locale}`.
- Never cache an authorization decision or a permission-filtered result without the caller's identity or role in the key.
- Version serialized values (schema version in the key or the value) so a deploy can ignore or read old entries instead of failing on them.
- Cache negative results ("not found") with a short TTL to absorb repeated misses; invalidate them on create.
- Keep values small; store large blobs elsewhere and cache the reference.

## Invalidation strategies

| Strategy | How | Pros | Cons |
|----------|-----|------|------|
| **TTL** | Expire after a duration | Simple, no coupling | Stale during the TTL window |
| **Event-driven** | Delete on a change event from the source | Near-real-time | Needs reliable events; missed events rely on TTL |
| **Tag-based** | Group keys or responses by tag, purge by tag | Bulk invalidation | Tag bookkeeping |
| **Versioned keys** | Bump a version in the key on change (`user:123:v5`) | No delete needed, no race | Old keys linger until TTL |

Combine: events for critical paths, TTL as the safety net everywhere.

## What to cache where

```
What are you caching?
├── Static assets with content hashes → browser + CDN, long-lived immutable
├── HTML pages → CDN with revalidation (ETag), short or zero freshness
├── Public API responses, same for every caller → CDN (s-maxage) + application cache; purge or expire on write
├── Per-user API responses → application cache keyed by user, `private` to browsers, never shared CDN cache
├── Session data → distributed cache with short TTL; encrypt if it holds secrets
├── Hot configuration / feature flags → in-process cache, seconds-long TTL
└── Computed aggregates → application cache refreshed on schedule or on change event
```

Multi-layer architecture (L1 in-process, L2 distributed, L3 edge), per-layer TTL ranges, and lookup code: [distributed-and-browser-patterns.md](references/distributed-and-browser-patterns.md#multi-layer-caching).

## Cache-Control policy

This table is the policy; directive grammar and semantics live in `web`.

| Content | Cache-Control | Validator |
|---|---|---|
| Hashed static assets (`main.a1b2c3.js`) | `public, max-age=31536000, immutable` | Not needed |
| HTML pages | `no-cache` (store, revalidate every use) | `ETag` |
| Public API responses | `public, s-maxage=60, max-age=0` (tune per endpoint), add `stale-while-revalidate` where brief staleness is fine | `ETag` |
| Per-user responses | `private, max-age=0` or `no-cache` | `ETag` |
| Sensitive data (tokens, personal records) | `no-store` | — |
| Public content that should survive origin failure | add `stale-if-error=86400` | — |

Edge mechanics — surrogate keys, purge APIs, edge workers, cache-key normalization: [cdn-patterns.md](references/cdn-patterns.md).

## Stampede and distributed locks

When a hot key expires, many callers recompute it at once. Options: serve stale while one caller refreshes (default), probabilistic early refresh (XFetch), a per-key lock with a bounded wait, or pre-warming for predictable spikes. Algorithms: [distributed-and-browser-patterns.md](references/distributed-and-browser-patterns.md#cache-stampede-prevention).

The canonical distributed lock recipe — random token value, owner-checked release, TTL longer than the work or renewed, fencing token when the lock guards a write — is in [redis-patterns.md](references/redis-patterns.md#distributed-locking). Other skills link here instead of writing their own.

## Client and service-worker caches

Service-worker strategies and code belong to `web`. The caching consequences: version cache names so a deploy can drop old entries, and invalidate client-side query caches after a mutation for every query whose result the mutation changes.

## Context Adaptation

- **Single instance** — an in-process cache is enough; invalidation is a local delete.
- **Many instances** — in-process copies need a broadcast delete or short TTL; shared state belongs in L2.
- **Multi-tenant** — tenant in every key; per-tenant memory limits or eviction so one tenant cannot evict everyone.
- **Serverless or short-lived processes** — in-process caches are cold on every start; rely on L2 and the edge.
- **Regulated or personal data** — prefer not caching it; if cached, encrypt, set short TTLs, and include it in erasure flows.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Cache without TTL | Stale data lives forever after a missed event | TTL on every value |
| Update cache on write | Concurrent writes leave the cache and source disagreeing | Delete on write; next read repopulates |
| Invalidating L1 before L2 | L1 refills from the still-stale L2 | Source, then L2, then L1, then edge |
| Key without tenant or identity | One caller sees another's data | Key from every input that changes the result |
| Write-behind without a durable queue | Cache crash loses acknowledged writes | Durable queue and stated loss window, or write the source |
| Caching everything | Low hit rate, wasted memory | Cache hot, expensive, reusable results |
| Unconditional lock release | Deletes another worker's lock after expiry | Owner-checked release (canonical recipe) |
| Unthrottled warming | Warming load looks like an attack on the origin | Rate-limit warming; warm the top keys only |

**Warming:** after a cold start or before a known spike, warm the most-used keys from access data at a limited rate; otherwise let serve-stale absorb cold misses.

**Observability:** track hit ratio per keyspace, eviction rate, memory use, and origin request rate; a falling hit ratio usually means a key-cardinality or `Vary` problem. Dashboards and alerting: `observability`.

## Related Knowledge

- **web** — HTTP caching semantics, `ETag`/`Vary`, service workers and the Cache API
- **networking** — CDN topology and edge routing
- **database** — authoritative storage and query tuning
- **performance** — measuring whether a cache helps
- **reliability** — degraded modes when the cache or origin fails, circuit breakers
- **observability** — cache metrics and alerts

## References

- [redis-patterns.md](references/redis-patterns.md) — data structures, Lua scripts, pub/sub invalidation, canonical distributed lock, clustering, persistence, licensing note
- [cdn-patterns.md](references/cdn-patterns.md) — edge cache keys, surrogate keys and purge, edge workers, provider configuration, troubleshooting
- [distributed-and-browser-patterns.md](references/distributed-and-browser-patterns.md) — stampede prevention, sharding keys across nodes, multi-layer caching, client-side cache invalidation
