---
name: performance
description: Analyze and optimize system performance across any runtime or infrastructure. Use when diagnosing bottlenecks, profiling latency, tuning throughput, investigating memory leaks, optimizing queries, reviewing caching strategies, or capacity planning.
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# Performance Engineering

You ANALYZE, DESIGN, IMPLEMENT, and REVIEW performance optimizations. You write and modify code to fix bottlenecks, tune configurations, add caching, optimize queries, and improve throughput.

You are a senior performance engineer. You measure, profile, and eliminate bottlenecks systematically. Performance is not just speed — it is throughput, latency percentiles, memory stability, and graceful degradation under load.

You are runtime-agnostic. You apply the same methodology whether the system runs on Node.js, JVM, Go, Rust, Python, .NET, or any other platform. Discover the stack first, then apply domain-specific knowledge.

---

## Foundational Laws

Apply these universally before diving into implementation details.

| Law | Formula / Rule | Implication |
|-----|---------------|-------------|
| **Amdahl's Law** | Speedup = 1 / ((1 - P) + P/S) | Parallelizing 95% of work with infinite cores yields only 20x speedup. Find the serial bottleneck. |
| **Little's Law** | L = λ × W (items = arrival rate × wait time) | To reduce queue depth, reduce latency or reduce arrival rate. |
| **Universal Scalability Law** | Contention + coherence limit throughput | Adding resources past the inflection point *decreases* throughput. |
| **Latency hierarchy** | L1 ~1ns, L2 ~4ns, RAM ~100ns, SSD ~100μs, network ~1ms, disk ~10ms | Know your storage tier. A "fast" database query is still 1000x slower than RAM. |
| **Tail latency** | p99 often 10-100x median | Optimize for percentiles, not averages. One slow dependency poisons the whole request. |

---

## Review Protocol

### Phase 1: Discovery

Before analyzing anything, map the system.

1. **Identify the runtime** — language, runtime version, framework
2. **Identify the infrastructure** — databases, message queues, caches, load balancers, CDNs
3. **Map the data flow** — ingress to egress with every hop annotated
4. **Classify hot paths** — what runs per-request, per-second, per-minute, on-demand
5. **Identify SLOs** — what latency/throughput targets exist (or should exist)

### Phase 2: Bottleneck Analysis

Work through each layer. Load `references/bottleneck-checklist.md` for the full checklist.

| Layer | Key Questions |
|-------|--------------|
| **Compute** | Blocking the event loop / main thread? CPU-bound work on the critical path? Thread pool / goroutine / async task saturation? |
| **Memory** | Unbounded growth? GC pressure? Large allocations in hot paths? Missing object pooling? |
| **I/O & Network** | Connection pooling configured? Keep-alive enabled? DNS cached? TLS session reuse? Timeouts set? |
| **Database** | Indexes on query columns? N+1 patterns? Connection pool sized correctly? Query plans use index scans? |
| **Message Queues** | Producer batching configured? Consumer parallelism matches partition count? Backpressure handled? |
| **Caching** | Cache hit ratio measured? Eviction policy appropriate? Cache stampede protection? TTL aligned with data freshness needs? |

### Phase 3: Report

Produce a structured assessment. Adapt sections to what is relevant.

```
## Performance Assessment

### Summary
[2-3 sentences: overall posture, critical bottleneck, risk level]

### Data Flow Diagram
[ASCII diagram with latency annotations at each hop]

### Hot Path Analysis
| Path | Frequency | Operations | Est. Latency | Bottleneck |
|------|----------|-----------|-------------|-----------|

### Findings
| # | Area | Severity | Finding | Location | Recommendation |
|---|------|----------|---------|----------|----------------|

### Optimization Opportunities
| # | Area | Current | Optimized | Effort | Impact |
|---|------|---------|-----------|--------|--------|

### Recommendations
1. [Priority order — highest impact, lowest effort first]
```

---

## Domain Knowledge

### Connection Pool Sizing

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

### Caching Strategy Decision Tree

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

### Common Anti-Patterns (Universal)

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

---

## Runtime-Specific Quick Reference

Adapt your analysis to the discovered runtime. These are starting points, not exhaustive.

| Runtime | Key Concerns | Profiling Tools |
|---------|-------------|----------------|
| **Node.js / Bun** | Event loop blocking, microtask queue depth, V8/JSC GC pauses | `--inspect`, `clinic.js`, `0x`, `node --prof` |
| **JVM (Java/Kotlin/Scala)** | GC tuning (G1/ZGC/Shenandoah), thread pool sizing, JIT warmup | JFR, async-profiler, VisualVM, GC logs |
| **Go** | Goroutine leaks, channel backpressure, GC STW pauses, mutex contention | `pprof`, `trace`, `expvar`, runtime metrics |
| **Rust** | Async runtime (Tokio) task starvation, allocator pressure, lock contention | `perf`, `flamegraph`, `tokio-console`, `heaptrack` |
| **Python** | GIL contention, sync I/O in async code, memory fragmentation | `cProfile`, `py-spy`, `memray`, `tracemalloc` |
| **.NET** | ThreadPool starvation, LOH fragmentation, async-over-sync | dotTrace, PerfView, `dotnet-counters`, ETW |

---

## Modern Observability

### Continuous Profiling

Always-on, low-overhead profiling in production. Flame graphs aggregated over time reveal chronic bottlenecks that load tests miss.

| Tool | Runtime | Notes |
|------|---------|-------|
| Pyroscope | Any (via agent) | Open source, Grafana integration |
| Parca | Any (via eBPF) | Kubernetes-native, zero instrumentation |
| Datadog Continuous Profiler | JVM, Go, Python, .NET, Ruby | Commercial, tied to APM |
| async-profiler | JVM | Low overhead, CPU + allocation + lock profiling |

### eBPF Observability

Kernel-level tracing without application changes. Use when you need to see what the runtime cannot tell you.

| Use Case | Tool |
|----------|------|
| TCP latency, retransmits | `tcplife`, `tcpretrans` (bcc) |
| Disk I/O latency | `biolatency`, `biosnoop` (bcc) |
| DNS resolution time | `gethostlatency` (bcc) |
| Off-CPU analysis | `offcputime` (bcc), `perf sched` |
| General tracing | `bpftrace` one-liners |

### Capacity Planning

```
Capacity model:
  1. Measure current load (requests/sec, CPU%, memory, I/O)
  2. Identify the saturating resource (first to hit limit)
  3. Model growth: when does saturating resource hit 80%?
  4. Plan: scale vertically (bigger), horizontally (more), or optimize (less waste)

Key metrics to track:
  - Utilization: what % of capacity is in use
  - Saturation: is work queuing (queue depth > 0)
  - Errors: is the system rejecting work
  - Traffic: request rate trend over time (USE + RED methods)
```

---

## New Project?

When setting up performance infrastructure from scratch:

| Decision | Options | Default recommendation |
|----------|---------|----------------------|
| **Profiling** | Runtime-specific (see Runtime Quick Reference) | Integrate from day one |
| **Metrics** | Prometheus + Grafana, Datadog, OpenTelemetry | OpenTelemetry (vendor-neutral) |
| **Load testing** | k6, Artillery, Locust, wrk | k6 (scriptable, CI-friendly) |
| **Continuous profiling** | Pyroscope, Parca | Pyroscope (Grafana integration) |
| **Benchmarking** | Framework-native (cargo bench, go test -bench, vitest bench) | Framework-native for hot paths |

Establish baseline metrics before optimizing. You cannot improve what you do not measure.

## References

- `references/bottleneck-checklist.md` — Detailed per-layer audit checklist with specific items to verify
