---
name: caching
description: Design caching strategies — cache-aside, write-through, invalidation, multi-layer architecture. Use when choosing cache strategies, designing cache layers, configuring cache headers, implementing invalidation, or preventing stampedes. Do NOT use for database query optimization (use database skill).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Caching Knowledge

**Rule:** Always set TTL on every cached value, even with event-driven invalidation. TTL catches missed events.

**Rule:** Invalidation cascades down layers: L1 -> L2 -> L3. Never invalidate only one layer.

---

## Caching Strategies

| Strategy | Read Path | Write Path | Consistency | Use When |
|----------|----------|------------|-------------|----------|
| **Cache-Aside** | App checks cache; on miss, reads DB, writes cache | App writes DB; invalidates/deletes cache | Eventual | Most common; general purpose |
| **Read-Through** | Cache fetches from DB on miss | App writes DB; cache invalidated | Eventual | Simplify app code; cache handles loading |
| **Write-Through** | App reads from cache | App writes cache; cache writes DB synchronously | Strong | Read-heavy with consistency needs |
| **Write-Behind** | App reads from cache | App writes cache; cache writes DB asynchronously | Eventual | Write-heavy; batch writes to DB |
| **Refresh-Ahead** | Cache proactively refreshes before TTL | App writes DB; cache auto-refreshes | Eventual | Predictable access patterns |

### Decision Tree

```
Need strong consistency?
  YES -> Write-Through (or skip cache)
  NO  -> Write-heavy workload?
           YES -> Write-Behind (batch writes)
           NO  -> Predictable access pattern?
                    YES -> Refresh-Ahead
                    NO  -> Cache-Aside (default)
```

---

## Cache Invalidation Strategies

| Strategy | How | Pros | Cons |
|----------|-----|------|------|
| **TTL** | Auto-expire after duration | Simple, no coupling | Stale during TTL window |
| **Event-Driven** | Invalidate on write event | Near-real-time | Requires event infrastructure |
| **Tag-Based** | Group keys by tag, purge by tag | Bulk invalidation | More complex key management |
| **Versioned Keys** | `user:123:v5` -> increment on change | No invalidation needed | Orphaned keys need cleanup |
| **Write-Through** | Update cache on every write | Always fresh | Write latency increase |

**Hybrid invalidation (modern standard):** Event-driven invalidation for critical data paths (user writes, payments). TTL-based for non-critical data where brief staleness is acceptable. Combine both: events for immediacy, TTL as safety net.

---

## Caching Layer Decision Tree

```
What are you caching?
  Static assets (JS, CSS, images, fonts)
    -> Browser cache + CDN (L3). Use hashed filenames + immutable headers.
  HTML pages
    -> CDN with short TTL + revalidation (ETag/Last-Modified).
  API responses (public, same for all users)
    -> CDN (s-maxage) + app-level cache. Invalidate on write.
  API responses (per-user)
    -> App-level cache only (private). No CDN for user-specific data.
  Session data
    -> App-level distributed cache. Short TTL, encrypt at rest.
  Hot config / feature flags
    -> In-process memory (L1). Very short TTL (5-30s).
  Computed aggregations
    -> App-level cache + write-behind. Refresh on schedule or event.
```

For Redis data structures, Lua scripts, pub/sub, clustering, and persistence, see `references/redis-patterns.md`.

---

## CDN Cache-Control Headers

| Content Type | Cache-Control | ETag | Rationale |
|-------------|---------------|------|-----------|
| Static assets (JS/CSS with hash) | `public, max-age=31536000, immutable` | Not needed | Hash changes on update |
| HTML pages | `public, max-age=0, must-revalidate` | Yes | Always check freshness |
| API responses (public) | `public, s-maxage=60, max-age=10` | Yes | CDN caches longer |
| API responses (private) | `private, max-age=60` | Yes | Per-user data |
| Real-time data | `no-store` | No | Always fresh |
| Resilient API | `public, max-age=60, stale-if-error=86400` | Yes | Serve stale if origin down |

For directive reference, surrogate keys, edge computing, and provider config, see `references/cdn-patterns.md`.

---

## Browser Cache Strategies

| Strategy | How | Use When |
|----------|-----|----------|
| Cache First | Check cache, fallback to network | Static assets, fonts |
| Network First | Try network, fallback to cache | API data that should be fresh |
| Stale-While-Revalidate | Return cache, update in background | Balance of speed + freshness |
| Cache Only | Only from cache | Offline-first, pre-cached |
| Network Only | Only from network | Real-time data, auth |

For service worker implementations and SWR/TanStack Query patterns, see `references/distributed-and-browser-patterns.md`.

---

## Distributed Caching

### Cache Stampede Prevention

| Solution | How | Trade-off |
|----------|-----|-----------|
| **Locking** | First request locks, others wait | Latency for waiters |
| **Probabilistic Early Expiry** | Random early refresh before TTL | Slight extra cache traffic |
| **Stale-While-Revalidate** | Serve stale, refresh async | Brief staleness |
| **Pre-warming** | Refresh before expiry | Needs predictable patterns |

For XFetch algorithm, consistent hashing, and multi-layer architecture, see `references/distributed-and-browser-patterns.md`.

---

## Multi-Layer Caching

| Layer | Category | TTL | Size | Use For |
|-------|----------|-----|------|---------|
| L1 | In-process memory (LRU, Map) | 5-30s | Small (100MB) | Hot data, config |
| L2 | Distributed cache (key-value store) | 1-60min | Medium (GB) | Session, API cache |
| L3 | Edge cache (CDN) | 1-24hr | Large (TB) | Static, public API |

**Invalidation cascades down:** invalidate L1 -> L2 -> L3. Use event-driven invalidation + TTL safety net.

---

## Context Adaptation

### Frontend
- Set Cache-Control headers on responses; use hashed filenames for immutable assets
- Service Worker cache: Cache First for static, SWR for API data
- Use SWR/TanStack Query for data fetching with built-in cache management
- IndexedDB for large offline-capable datasets

### Backend
- Cache-Aside: check cache -> miss -> query DB -> populate cache
- Write-through for data that must be consistent
- Distributed locks for cache stampede prevention
- Connection pooling to cache store; pipeline commands for batching

### DevOps
- CDN configuration: Cache-Control headers, surrogate keys, purge automation
- Edge caching rules: cache static, bypass dynamic, vary on auth
- Cache purge on deploy (or use hashed filenames)
- Monitor cache hit rate, eviction rate, memory usage

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Cache without TTL | Stale data lives forever | Always set TTL, even if long |
| Cache stampede | All requests hit DB when key expires | Locking, probabilistic early expiry, or SWR |
| No invalidation on write | Users see stale data after writes | Event-driven invalidation + TTL safety net |
| Inconsistent cache and DB | Cache updated but DB write fails | Delete cache on write (not update); DB is source of truth |
| Caching everything | Wastes memory, low hit rates | Cache hot data only; monitor hit rates |
| No stale-if-error | Origin failure = user failure | Add `stale-if-error=86400` for resilience |
| Warming too aggressively | Overwhelms origin on deploy | Rate-limit warming requests; warm top-N keys only |

---

## Cache Warming

```
When to warm?
  Cold start (deploy, scale-up, failover)
    -> Warm top-N keys from access logs or analytics
  Predictable traffic spike (sale, event)
    -> Pre-warm via synthetic requests or background job
  New cache node added
    -> Backfill from peer node or origin
```

| Approach | How | Risk |
|----------|-----|------|
| **Deploy-time warming** | Post-deploy hook fetches top URLs | Delays deploy if slow |
| **Background job** | Scheduled job refreshes popular keys | Origin load during warming |
| **Peer backfill** | New node copies from existing node | Stale data if peer is behind |
| **Lazy + SWR** | No warming; SWR handles cold miss gracefully | First request is slow |

**Rule:** Rate-limit warming requests. Warming 10,000 keys at once simulates a DDoS on your origin.

---

## Observability

| Metric | Target | Alert When |
|--------|--------|------------|
| Cache hit rate | >90% static, >70% API | Drops below threshold |
| Eviction rate | Low, stable | Sudden spike (memory pressure) |
| Cache latency (p99) | <5ms L2, <50ms L3 | Exceeds SLO |
| Origin request rate | Decreasing over time | Increases (cache bypass) |
| Memory usage | <80% of allocated | >90% (eviction imminent) |

**Diagnosis flow:** Low hit rate -> check eviction rate -> if high, increase memory or reduce TTL spread -> if low, check key cardinality and Vary headers.

---

## Related Knowledge

- **database** — query optimization that reduces cache need, connection pooling
- **performance** — cache hit rate analysis, capacity planning
- **web-platform** — Cache-Control headers, service worker caching strategies
- **observability** — cache metrics, dashboards, alerting on hit rate degradation
- **sre** — cache failure modes, circuit breakers, graceful degradation

## References

- [redis-patterns.md](references/redis-patterns.md) -- Data structures, Lua scripts, pub/sub, clustering, persistence
- [cdn-patterns.md](references/cdn-patterns.md) -- Cache-Control, surrogate keys, edge computing, cache hierarchy
- [distributed-and-browser-patterns.md](references/distributed-and-browser-patterns.md) -- Stampede prevention, consistent hashing, multi-layer caching, service workers, SWR
