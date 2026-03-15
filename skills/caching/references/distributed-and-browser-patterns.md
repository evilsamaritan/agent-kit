# Distributed and Browser Caching Patterns

Cache stampede prevention, consistent hashing, multi-layer architecture, service workers, and client-side data caching.

## Contents

- [Cache Stampede Prevention](#cache-stampede-prevention)
- [Consistent Hashing](#consistent-hashing)
- [Multi-Layer Caching](#multi-layer-caching)
- [Service Worker Strategies](#service-worker-strategies)
- [Client-Side Data Caching (SWR)](#client-side-data-caching-swr)

---

## Cache Stampede Prevention

When a popular key expires, many requests hit the DB simultaneously.

| Solution | How | Trade-off |
|----------|-----|-----------|
| **Locking** | First request locks, others wait | Latency for waiters |
| **Probabilistic Early Expiry** | Random early refresh before TTL | Slight extra cache traffic |
| **Stale-While-Revalidate** | Serve stale, refresh async | Brief staleness |
| **Pre-warming** | Refresh before expiry | Needs predictable patterns |

### XFetch Algorithm (Probabilistic Early Expiry)

```python
import random, math

def xfetch(key, ttl, beta=1.0):
    cached = redis.get(key)
    if cached:
        value, expiry, delta = cached
        # Probabilistic early recompute
        if time.now() - delta * beta * math.log(random.random()) >= expiry:
            # Recompute early to prevent stampede
            return recompute_and_cache(key, ttl)
        return value
    return recompute_and_cache(key, ttl)
```

### Locking Pattern

```python
def get_with_lock(key, ttl=3600, lock_ttl=10):
    value = redis.get(key)
    if value is not None:
        return value

    lock_key = f"lock:{key}"
    if redis.set(lock_key, "1", nx=True, ex=lock_ttl):
        # Won the lock -- compute and cache
        try:
            value = compute_value()
            redis.set(key, value, ex=ttl)
            return value
        finally:
            redis.delete(lock_key)
    else:
        # Another request is computing -- wait and retry
        time.sleep(0.1)
        return redis.get(key) or get_with_lock(key, ttl, lock_ttl)
```

---

## Consistent Hashing

Distribute cache keys across multiple Redis nodes so adding/removing nodes only remaps ~1/N keys:

```
Key "user:123" -> hash -> node 2
Key "user:456" -> hash -> node 1
Key "user:789" -> hash -> node 3

Add node 4: only ~25% of keys remap (not 100%)
```

Use Redis Cluster (automatic) or client-side consistent hashing (manual).

### Virtual Nodes

Each physical node gets multiple positions on the hash ring (e.g., 150 virtual nodes per physical node) to ensure even distribution:

```python
import hashlib

class ConsistentHash:
    def __init__(self, nodes, vnodes=150):
        self.ring = {}
        self.sorted_keys = []
        for node in nodes:
            for i in range(vnodes):
                key = hashlib.md5(f"{node}:{i}".encode()).hexdigest()
                self.ring[key] = node
                self.sorted_keys.append(key)
        self.sorted_keys.sort()

    def get_node(self, key):
        hash_key = hashlib.md5(key.encode()).hexdigest()
        for ring_key in self.sorted_keys:
            if hash_key <= ring_key:
                return self.ring[ring_key]
        return self.ring[self.sorted_keys[0]]
```

---

## Multi-Layer Caching

### Architecture

```
Request -> L1 (in-memory, <1ms) -> L2 (Redis, ~1ms) -> L3 (CDN, ~10ms) -> Origin
```

| Layer | Technology | TTL | Size | Use For |
|-------|-----------|-----|------|---------|
| L1 | Process memory (Map, LRU) | 5-30s | Small (100MB) | Hot data, config |
| L2 | Redis / Memcached | 1-60min | Medium (GB) | Session, API cache |
| L3 | CDN (Cloudflare, Fastly) | 1-24hr | Large (TB) | Static, public API |

**Invalidation cascades down:** invalidate L1 -> L2 -> L3. Use event-driven invalidation + TTL safety net.

### Multi-Layer Lookup Implementation

```python
def get_cached(key):
    # L1: In-process memory
    value = local_cache.get(key)
    if value is not None:
        return value

    # L2: Redis
    value = redis.get(key)
    if value is not None:
        local_cache.set(key, value, ttl=30)  # Backfill L1
        return value

    # L3/Origin: Fetch from source
    value = fetch_from_origin(key)
    redis.set(key, value, ex=3600)           # Backfill L2
    local_cache.set(key, value, ttl=30)      # Backfill L1
    return value
```

---

## Service Worker Strategies

| Strategy | How | Use When |
|----------|-----|----------|
| Cache First | Check cache, fallback to network | Static assets, fonts |
| Network First | Try network, fallback to cache | API data that should be fresh |
| Stale-While-Revalidate | Return cache, update in background | Balance of speed + freshness |
| Cache Only | Only from cache | Offline-first, pre-cached |
| Network Only | Only from network | Real-time data, auth |

### Cache First Implementation

```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open('v1').then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
```

### Stale-While-Revalidate Implementation

```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        caches.open('v1').then((cache) => cache.put(event.request, response.clone()));
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
```

---

## Client-Side Data Caching (SWR)

### React Query / TanStack Query

```javascript
const { data, isLoading } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  staleTime: 5 * 60 * 1000,        // Fresh for 5 minutes
  gcTime: 30 * 60 * 1000,          // Keep in cache for 30 minutes
  refetchOnWindowFocus: true,       // Refetch when tab becomes active
});
```

### SWR (Vercel)

```javascript
const { data, error, isLoading } = useSWR(
  `/api/users/${userId}`,
  fetcher,
  {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,         // Dedupe requests within 5s
    refreshInterval: 60000,         // Poll every 60s
  }
);
```

### Cache Invalidation in React Query

```javascript
// After a mutation, invalidate related queries
const mutation = useMutation({
  mutationFn: updateUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['user', userId] });
    queryClient.invalidateQueries({ queryKey: ['users'] }); // List too
  },
});
```
