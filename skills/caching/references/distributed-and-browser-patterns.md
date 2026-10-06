# Distributed and Browser Caching Patterns

Cache stampede prevention, spreading keys across nodes, multi-layer caching, and client-side cache invalidation. Service-worker code lives in `web`.

## Contents

- [Cache Stampede Prevention](#cache-stampede-prevention)
- [Spreading Keys Across Nodes](#spreading-keys-across-nodes)
- [Multi-Layer Caching](#multi-layer-caching)
- [Client-Side Cache Invalidation](#client-side-cache-invalidation)

---

## Cache Stampede Prevention

When a popular key expires, many requests recompute it at once and hit the source together.

| Solution | How | Trade-off |
|----------|-----|-----------|
| **Serve stale while revalidating** | Keep a soft expiry inside the value; after it passes, one caller refreshes while others get the old value | Brief staleness |
| **Probabilistic early expiry (XFetch)** | Each reader refreshes early with a probability that rises near expiry | Slight extra recompute load |
| **Per-key lock** | One caller recomputes; others wait briefly or serve stale | Waiters add latency |
| **Pre-warming** | Refresh known hot keys before expiry or before a spike | Needs predictable access |

### XFetch (probabilistic early expiry)

```python
import math, random, time

def xfetch(key, ttl, beta=1.0):
    entry = cache.get(key)               # stores (value, delta, expiry); delta = last recompute time in seconds
    now = time.time()
    if entry is not None:
        value, delta, expiry = entry
        if now - delta * beta * math.log(random.random()) < expiry:
            return value                 # not chosen to refresh early
    start = time.time()
    value = recompute()
    delta = time.time() - start
    cache.set(key, (value, delta, now + ttl), ttl=ttl)
    return value
```

### Per-key lock with bounded wait

Uses the canonical lock from [redis-patterns.md](redis-patterns.md#distributed-locking): random token, owner-checked release.

```python
def get_with_lock(key, ttl=3600, lock_ttl=10, wait_s=1.0):
    value = cache.get(key)
    if value is not None:
        return value

    token = acquire_lock(redis, f"lock:{key}", ttl=lock_ttl)   # returns a token or None
    if token:
        try:
            value = compute_value()
            cache.set(key, value, ttl=ttl)
            return value
        finally:
            release_lock(redis, f"lock:{key}", token)          # deletes only if the token still matches

    deadline = time.monotonic() + wait_s                        # bounded wait, no recursion
    while time.monotonic() < deadline:
        time.sleep(0.05)
        value = cache.get(key)
        if value is not None:
            return value
    return compute_value()          # or serve a stale copy / fail fast, per the endpoint's contract
```

---

## Spreading Keys Across Nodes

Client-side consistent hashing (a hash ring with virtual nodes) spreads keys over independent cache nodes so that adding or removing a node remaps only about 1/N of the keys; client libraries provide it. Redis Cluster does not use a ring: it maps each key to one of 16384 fixed hash slots and moves whole slots between nodes ([redis-patterns.md](redis-patterns.md#clustering)).

---

## Multi-Layer Caching

```
Request -> L1 (in-process) -> L2 (distributed cache) -> L3 (CDN edge, HTTP only) -> Origin
```

| Layer | Example technology | Typical TTL | Size | Use for |
|-------|-----------|-----|------|---------|
| L1 | In-process map or LRU | Seconds | Small (per process) | Hot data, configuration |
| L2 | Redis-compatible store, Memcached | Minutes | GBs | Shared API and object cache, sessions |
| L3 | CDN | Minutes to days | Large | Static assets, public responses |

TTL ranges are starting points; set them from how stale each item may be.

### Lookup

```python
def get_cached(key):
    value = local_cache.get(key)                 # L1
    if value is not None:
        return value

    value = redis.get(key)                       # L2
    if value is not None:
        local_cache.set(key, value, ttl=30)
        return value

    value = load_from_source(key)
    redis.set(key, value, ex=3600)
    local_cache.set(key, value, ttl=30)
    return value
```

### Invalidation order

```python
def on_write(entity_id, data):
    db.update(entity_id, data)                              # 1. commit to the source of truth
    redis.delete(f"entity:{entity_id}")                     # 2. shared layer
    redis.publish("cache:invalidate", f"entity:{entity_id}") # 3. every instance drops its L1 copy
    if is_public(entity_id):
        cdn.purge_by_tags([f"entity-{entity_id}"])          # 4. edge, only for public content

# every instance
def on_invalidation(key):
    local_cache.delete(key)
```

A reader that fetched from the source before step 1 can still write the old value back after step 2. Bound that window with short TTLs or remove it with versioned keys. Pub/sub delivery is fire-and-forget, so a disconnected instance keeps its L1 copy until TTL — keep L1 TTLs short.

---

## Client-Side Cache Invalidation

Client query caches (TanStack Query, SWR, Apollo, and similar) hold server data keyed by a query key. The caching rules carry over:

- The query key includes every parameter that changes the result (ids, filters, locale, user).
- After a mutation, invalidate or update every query whose result the mutation changes, including lists and counts.
- Set a freshness window per query from how stale the data may be; refetch on focus or reconnect where staleness matters.

Data-fetching structure in the UI belongs to `frontend`; service-worker caches belong to `web`.
