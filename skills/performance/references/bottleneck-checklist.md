# Bottleneck Analysis Checklist

Detailed per-layer audit checklist. Work through each layer relevant to the system under review.

## Contents

- [Compute](#compute)
- [Memory](#memory)
- [I/O and Network](#io-and-network)
- [Database](#database)
- [Message Queues](#message-queues)
- [Caching](#caching)
- [Serialization](#serialization)
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
- [ ] Retry policy has exponential backoff with jitter
- [ ] Circuit breaker on external dependencies to prevent cascade failure
- [ ] Compression enabled where bandwidth-constrained (gzip, brotli, snappy, lz4)
- [ ] Request/response payload size reasonable (no unnecessary fields)
- [ ] Streaming used for large payloads instead of buffering entire body

## Database

- [ ] Indexes exist for all WHERE, JOIN, and ORDER BY columns in frequent queries
- [ ] EXPLAIN / EXPLAIN ANALYZE run on critical queries — verify index scans
- [ ] No N+1 query patterns (single query fetches related data, not a loop)
- [ ] Connection pool size follows formula: `(cpu_cores * 2) + spindle_count`
- [ ] Transactions are short-lived (no long-running locks)
- [ ] Batch operations used for bulk inserts/updates (not row-by-row)
- [ ] Prepared statements / parameterized queries used (plan reuse + security)
- [ ] Query results limited (LIMIT clause or pagination, no unbounded SELECTs)
- [ ] Schema migrations do not hold exclusive locks for extended periods
- [ ] Read replicas used for read-heavy workloads where consistency allows
- [ ] Partitioning / sharding strategy appropriate for data volume (if applicable)
- [ ] Slow query log enabled and monitored

## Message Queues

Applies to Kafka, RabbitMQ, NATS, SQS, Pulsar, Redis Streams, and similar.

- [ ] Producer batching configured (batch size, linger time)
- [ ] Compression enabled for high-volume topics (snappy, lz4, zstd)
- [ ] Consumer parallelism matches partition / shard count
- [ ] Acknowledgment strategy appropriate (at-least-once vs exactly-once tradeoffs)
- [ ] Backpressure handling defined (what happens when consumer cannot keep up)
- [ ] Dead letter queue configured for poison messages
- [ ] Consumer group rebalancing latency acceptable
- [ ] No synchronous processing blocking the consumer poll loop
- [ ] Offset / checkpoint commit frequency balances durability and performance
- [ ] Message serialization efficient (Protobuf / Avro vs JSON for high throughput)

## Caching

- [ ] Cache hit ratio measured and > 80% for primary caches
- [ ] Eviction policy matches access pattern (LRU for recency, LFU for frequency)
- [ ] TTL aligned with data freshness requirements
- [ ] Cache stampede protection (singleflight, probabilistic early expiry, locking)
- [ ] Cache warming strategy for cold starts / deployments
- [ ] Cache key design avoids collisions and is deterministic
- [ ] Multi-tier caching where appropriate (L1 in-process, L2 distributed)
- [ ] Cache invalidation strategy is explicit (write-through, write-behind, event-driven)
- [ ] Serialization overhead for distributed cache is acceptable
- [ ] Memory limit set on cache to prevent OOM

## Serialization

- [ ] Serialization format matches use case (JSON for readability, Protobuf/Avro for performance)
- [ ] No redundant serialization-deserialization cycles in pipeline
- [ ] Streaming parsers used for large payloads (not loading entire payload into memory)
- [ ] Schema evolution strategy defined (backward/forward compatibility)
- [ ] String encoding efficient (UTF-8, avoid unnecessary conversions)

## Concurrency

- [ ] Bounded concurrency for parallel I/O operations (semaphore, worker pool)
- [ ] No shared mutable state without synchronization
- [ ] Lock granularity appropriate (not holding locks across I/O)
- [ ] Lock-free data structures used where contention is high
- [ ] Async/await chains are not excessively deep (promise/future/task overhead)
- [ ] Graceful shutdown drains in-flight requests before exiting
- [ ] Resource cleanup on shutdown (close connections, flush buffers, cancel timers)
- [ ] Deadlock prevention (consistent lock ordering, timeouts on lock acquisition)
