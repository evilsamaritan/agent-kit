---
name: performance
description: Analyze and optimize system performance across any runtime or infrastructure. Use when diagnosing bottlenecks, profiling latency, tuning throughput, investigating memory leaks, optimizing queries, reviewing caching strategies, or capacity planning. Do NOT use for SLO/SLI design or incident response (use sre), instrumentation pipelines and metrics standards (use observability), or schema/index design (use database).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Performance Engineering

Measure, profile, and eliminate bottlenecks systematically. Performance is not just speed — it is throughput, latency percentiles, memory stability, and graceful degradation under load.

Runtime-agnostic. Apply the same methodology whether the system runs on Node.js, JVM, Go, Rust, Python, .NET, or any other platform. Discover the stack first, then apply domain-specific knowledge.

---

## Core Methodology

```
1. Profile first — never guess the bottleneck
2. Establish baseline before optimizing — you cannot improve what you do not measure
3. Optimize the measured hotspot, not the assumed one
4. Verify improvement with the same measurement — optimization without proof is refactoring
5. One change at a time — isolate variables
```

---

## Foundational Laws

| Law | Formula / Rule | Implication |
|-----|---------------|-------------|
| **Amdahl's Law** | Speedup = 1 / ((1 - P) + P/S) | Parallelizing 95% of work with infinite cores yields only 20x speedup. Find the serial bottleneck. |
| **Little's Law** | L = λ × W (items = arrival rate × wait time) | To reduce queue depth, reduce latency or reduce arrival rate. |
| **Universal Scalability Law** | Contention + coherence limit throughput | Adding resources past the inflection point *decreases* throughput. |
| **Latency hierarchy** | L1 ~1ns, L2 ~4ns, RAM ~100ns, SSD ~100μs, network ~1ms, disk ~10ms | Know your storage tier. A "fast" database query is still 1000x slower than RAM. |
| **Tail latency** | p99 often 10-100x median | Optimize for percentiles, not averages. One slow dependency poisons the whole request. |
| **Roofline model** | Performance ≤ min(compute ceiling, memory bandwidth ceiling) | Determine whether workload is compute-bound or memory-bound before optimizing. |

---

## Performance Diagnosis Decision Tree

```
System is slow. Where to start?
├── CPU utilization > 80%?
│   ├── YES → Profile CPU (flame graphs). Identify hotspot.
│   │   ├── Application code → optimize algorithm or data structure
│   │   ├── GC pauses → tune collector, reduce allocation rate
│   │   └── Kernel / syscalls → check I/O patterns, context switches
│   └── NO → CPU is not the bottleneck
├── Memory growing over time?
│   ├── YES → Heap snapshot. Find retention path.
│   │   ├── Cache without eviction → add LRU/TTL/max-size
│   │   ├── Listener/timer leak → clear on shutdown
│   │   └── Large object accumulation → pool or stream
│   └── NO → Memory is stable
├── I/O wait high?
│   ├── YES → Profile I/O (disk, network)
│   │   ├── Database queries → EXPLAIN, check indexes, N+1
│   │   ├── External API calls → connection pool, timeouts, caching
│   │   └── Disk I/O → async I/O, buffer sizing, SSD
│   └── NO → I/O is not the bottleneck
├── Concurrency issues?
│   ├── Lock contention → reduce critical section, use lock-free structures
│   ├── Thread/goroutine starvation → increase pool, reduce blocking
│   └── Deadlock → consistent lock ordering, timeout on acquisition
└── None of the above? → Measure again. The bottleneck moved or is external.
```

---

## Common Anti-Patterns

| Anti-Pattern | Why It Hurts | Fix |
|-------------|-------------|-----|
| Sync I/O on async hot path | Blocks event loop / thread pool, kills concurrency | Move to async I/O or offload to worker |
| Parse → validate → reparse | Triple the allocation cost | Parse once, pass typed result downstream |
| Unbounded cache / collection | Memory grows until OOM | Add eviction policy (LRU, TTL, max size) |
| Log serialization in hot path | JSON.stringify / fmt.Sprintf per tick | Sample logs, use structured logging with lazy eval |
| Connection per request | TCP + TLS handshake overhead per call | Use connection pooling |
| Unbounded concurrency | Promise.all(1000) / goroutine storm / thread explosion | Use semaphore, worker pool, or bounded channel |
| Timer / listener leak | Resources accumulate, never freed | Clear on shutdown, use weak references where appropriate |
| N+1 queries | 1 + N round trips instead of 1 | Batch fetch, JOIN, or dataloader pattern |
| Full table scan | Missing index on filter/join column | Add index, check EXPLAIN output |
| Optimizing without profiling | Guessing the bottleneck wastes effort | Profile first, optimize the measured hotspot |
| No baseline before optimization | Cannot measure improvement without a starting point | Establish load test baseline, then compare |
| Micro-benchmarking in isolation | Component fast alone, slow in context | Benchmark under realistic load with real data |
| Premature caching | Adds complexity without measured need | Prove the read is slow and frequent before caching |

---

## Caching Strategy Decision Tree

```
Should you cache this?
├── Data changes < 1/min AND read:write > 10:1 → YES, cache aggressively
├── Data is user-specific AND session-scoped → local/session cache
├── Data is shared AND consistency matters → cache with invalidation
├── Data is computed expensively → cache with TTL
└── Data changes per-request → DO NOT cache

Cache layer selection:
├── Same process → in-memory (HashMap, LRU)
├── Same host, multiple processes → shared memory or local Redis
├── Multiple hosts → distributed cache (Redis, Memcached)
└── CDN-cacheable → HTTP cache headers, CDN edge
```

---

## Connection Pool Sizing

```
General formula: pool_size = (cpu_cores * 2) + effective_spindle_count
For SSD: pool_size ≈ cpu_cores * 2 + 1

Symptoms:
  Too small → "connection pool exhausted" errors, request queuing
  Too large → database context switching, OOM, diminishing returns
```

Applies to PostgreSQL, MySQL, MongoDB, Redis connection pools, HTTP client pools, and gRPC channel pools.

### Tail Latency Amplification

When a request fans out to N services, the overall p99 degrades:

```
P(all N respond within SLO) = P(single)^N
If each service has p99 = 100ms and you fan out to 5:
  P(all under 100ms) = 0.99^5 = 0.95 → your p95 is now 100ms

Mitigations:
  - Hedged requests (send to 2 replicas, take first response)
  - Deadline propagation (cancel downstream if parent deadline expires)
  - Caching at aggregation layer
  - Reduce fan-out breadth
```

---

## Runtime Quick Reference

| Runtime | Key Concerns | Profiling Tools |
|---------|-------------|----------------|
| **Node.js / Bun** | Event loop blocking, microtask queue depth, V8/JSC GC pauses | `--inspect`, `clinic.js`, `0x`, `node --prof` |
| **JVM (Java/Kotlin/Scala)** | GC tuning (G1/ZGC/Shenandoah), thread pool sizing, JIT warmup | JFR, async-profiler, VisualVM, GC logs |
| **Go** | Goroutine leaks, channel backpressure, GC STW pauses, mutex contention | `pprof`, `trace`, `expvar`, runtime metrics |
| **Rust** | Async runtime (Tokio) task starvation, allocator pressure, lock contention | `perf`, `flamegraph`, `tokio-console`, `heaptrack` |
| **Python** | GIL contention, sync I/O in async code, memory fragmentation | `cProfile`, `py-spy`, `memray`, `tracemalloc` |
| **.NET** | ThreadPool starvation, LOH fragmentation, async-over-sync | dotTrace, PerfView, `dotnet-counters`, ETW |

---

## Context Adaptation

Adapt your analysis based on the domain of the system under review.

### Frontend
- **Core Web Vitals**: LCP (Largest Contentful Paint), INP (Interaction to Next Paint, replaced FID — target < 200ms), CLS (Cumulative Layout Shift)
- **INP optimization**: break long tasks (yield to main thread), minimize input delay, reduce DOM size, defer non-critical JS, avoid layout thrashing during interaction handlers
- **Bundle size**: tree-shaking, code splitting, lazy loading, dynamic imports
- **Rendering performance**: layout thrashing, forced reflows, paint costs, compositor layers
- **Image optimization**: format selection (WebP/AVIF), responsive images, lazy loading, CDN delivery

### Backend
- **Query optimization**: EXPLAIN plans, index coverage, N+1 elimination, query batching
- **Connection pooling**: database, HTTP client, gRPC channel pool sizing and health checks
- **Async I/O**: non-blocking operations, backpressure handling, worker pool saturation
- **Memory profiling**: heap snapshots, allocation tracking, GC tuning, leak detection
- **Load testing**: baseline establishment, stress testing, soak testing, spike testing

### SRE
- **Capacity planning**: saturation forecasting, resource headroom, scaling triggers
- **Saturation monitoring**: USE method (Utilization, Saturation, Errors) per resource
- **Tail latency**: p99/p999 tracking, latency budgets, hedged requests, deadline propagation
- **Continuous profiling**: always-on low-overhead production profiling — flame graphs aggregated over time reveal chronic bottlenecks that load tests miss

### DevOps
- **Build performance**: incremental builds, dependency caching, parallelized compilation
- **CI pipeline speed**: test parallelism, cache layers, conditional stages, artifact reuse
- **Container resource limits**: CPU/memory requests and limits, OOMKill prevention, right-sizing

### AI/ML Workloads
- **Inference latency**: model loading time, batch size tuning, quantization tradeoffs (FP16/INT8)
- **GPU utilization**: kernel occupancy, memory bandwidth saturation, CPU-GPU transfer overhead
- **Throughput optimization**: request batching, speculative decoding, model sharding

---

## References

- `references/bottleneck-checklist.md` — Per-layer audit checklist (compute, memory, I/O, database, queues, caching, serialization, concurrency)
- `references/profiling-patterns.md` — Review protocol phases, eBPF observability, continuous profiling, capacity planning, new project setup

## Related Knowledge

- **observability** — Metrics (RED/USE), distributed tracing, continuous profiling, alerting on performance degradation
- **caching** — Cache strategy selection, invalidation patterns, multi-layer architecture, stampede prevention
- **database** — Query optimization, index design, connection pooling, schema design
- **sre** — SLO-driven performance targets, capacity planning, load testing in production
- **backend** — Service architecture, connection management, async patterns
- **devops** — Container resource limits, CI pipeline speed, build performance
