# Bottleneck Analysis Checklist

Per-layer audit checklist for compute, memory, I/O, and concurrency. Database, queue, cache, and serialization depth belongs to sibling skills; see the pointers below.

## Contents

- [Compute](#compute)
- [Memory](#memory)
- [I/O and Network](#io-and-network)
- [Database, Queues, Caching, Serialization](#database-queues-caching-serialization)
- [Concurrency](#concurrency)

---

## Compute

- [ ] No blocking / CPU-intensive work on the main thread or event loop
- [ ] CPU-bound tasks offloaded to worker threads, goroutines, or background processes
- [ ] Thread pool / worker pool sized appropriately for hardware
- [ ] No busy-wait loops or spin locks in application code
- [ ] Hot-path code avoids unnecessary allocations (object reuse, pre-allocation)
- [ ] JIT warmup considered for JVM / V8 / JSC (cold start vs steady state)
- [ ] Regex compilation cached (not recompiled per invocation)
- [ ] Cryptographic operations use hardware acceleration where available

## Memory

- [ ] No unbounded collections (maps, arrays, caches grow without limit)
- [ ] Caches have eviction policy (LRU, TTL, max size)
- [ ] Large temporary allocations avoided in hot paths
- [ ] Object pooling used for high-frequency allocations
- [ ] Weak references used for cache entries where appropriate
- [ ] No timer leaks (setInterval / recurring tasks not cleared on shutdown)
- [ ] No event listener leaks (subscriptions without unsubscribe)
- [ ] Buffer sizes appropriate (not over-allocating for small messages)
- [ ] GC-friendly patterns (avoid finalizers, reduce allocation rate in hot loops)
- [ ] Memory usage has a steady state (heap does not grow indefinitely under constant load)

## I/O and Network

- [ ] Connection pooling enabled for all external services (DB, HTTP, gRPC)
- [ ] HTTP keep-alive enabled for REST API clients
- [ ] DNS resolution cached (not re-resolved per request)
- [ ] TLS session reuse / resumption configured
- [ ] Timeouts set for all I/O operations (connect, read, write, idle)
- [ ] Retry and circuit-breaker policy follows `reliability` (idempotency, jitter, budgets)
- [ ] Compression enabled where bandwidth-constrained (gzip, brotli, snappy, lz4)
- [ ] Request/response payload size reasonable (no unnecessary fields)
- [ ] Streaming used for large payloads instead of buffering entire body

## Database, Queues, Caching, Serialization

Measure first (slow-query log, queue lag, cache hit rate and cost, serialization share of the profile), then fix in the owning skill:

- Queries, indexes, N+1, transactions, pool size on the server side → `database`
- Broker batching, consumer parallelism, backpressure, DLQ → `message-queues` and `background-jobs`
- Hit rate, eviction, stampede protection, invalidation → `caching`
- Payload formats and schema evolution → `api-design`

## Concurrency

- [ ] Bounded concurrency for parallel I/O operations (semaphore, worker pool)
- [ ] No shared mutable state without synchronization
- [ ] Lock granularity appropriate (not holding locks across I/O)
- [ ] Lock-free data structures used where contention is high
- [ ] Async/await chains are not excessively deep (promise/future/task overhead)
- [ ] Resource cleanup on shutdown (timers cancelled, connections closed); shutdown semantics in `reliability`
- [ ] Deadlock prevention (consistent lock ordering, timeouts on lock acquisition)
