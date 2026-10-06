---
name: performance
description: "Measure performance and find the bottleneck. Use for slow requests, latency or throughput regressions, profiling, load testing, capacity, memory leaks, and resource budgets; fixes live in database, caching, and the language skills."
user-invocable: true
---

# Performance Engineering

Measure, localize, then fix. Performance is throughput, latency percentiles, memory stability, and behavior under load, not just speed. The method is runtime-agnostic: discover the stack first (runtime and version, infrastructure, data flow), then apply it.

## Scope and boundaries

**Owns:** the measurement method (profiling, benchmarking, load testing), bottleneck localization, capacity and headroom reasoning, resource budgets, and Core Web Vitals definitions, thresholds, and measurement.

**Does not own the fix:**
- Query plans, indexes, schema → `database`
- Cache design, invalidation, hit-rate tuning → `caching`
- Telemetry infrastructure, continuous-profiling pipelines → `observability`
- SLO targets and paging → `reliability`
- Ranking impact of vitals → `seo`; UI causes of slow rendering (bundles, layout, hydration) → `frontend`
- Runtime-specific tuning → the language skill (`go`, `rust`, `python`, `javascript`, `kotlin`, ...)

## Core method

```
1. Define the goal: which metric, which percentile, under what load
2. Measure a baseline in a realistic setup before changing anything
3. Profile; optimize the measured hotspot, not the assumed one
4. Change one thing at a time
5. Re-measure the same way; keep the change only if it is clearly better than noise
```

How to profile, benchmark, and load test (warm-up, coordinated omission, percentiles from histograms, noise): [profiling-patterns.md](references/profiling-patterns.md).

## Laws worth knowing

| Law | Rule | Implication |
|-----|------|-------------|
| Amdahl | Speedup = 1 / ((1 - P) + P/S) | The serial part caps the gain; parallelizing 95% of the work gives at most 20x |
| Little | L = λ × W | Concurrency in a system = arrival rate × time in system; use it to size pools and queues |
| Universal Scalability | Contention and coherence costs limit scale | Adding capacity past a point lowers throughput |
| Tail latency | A request that fans out to N parts waits for the slowest | p99 of the whole is worse than p99 of any part |
| Roofline | Performance is capped by compute or memory bandwidth | Know which one binds before optimizing |

## Where to look first

```
System is slow. Which resource is saturated?
├── CPU high → CPU profile (flame graph)
│   ├── Application code → algorithm or data structure
│   ├── Garbage collection → allocation rate, collector settings
│   └── Kernel / syscalls → I/O pattern, context switches
├── Memory growing over time → heap / allocation profile, find the retaining path
├── Time spent waiting (low CPU) → off-CPU / wall-clock profile and traces
│   ├── Database → see `database`
│   ├── Remote calls → timeouts, pooling, fan-out; see `reliability`
│   └── Locks, pools, queues → contention profile, pool wait time
├── Only some requests slow → tail analysis: traces for the slow ones, compare with fast ones
└── Nothing stands out → measure again; the bottleneck moved, is external, or the test is wrong
```

For a per-layer audit of compute, memory, I/O, concurrency, and a pointer list for the rest, use [bottleneck-checklist.md](references/bottleneck-checklist.md). For a full review of a system, follow [workflows/review.md](workflows/review.md).

## Core Web Vitals

Three user-centric metrics, judged on **field data at the 75th percentile** (per page type and device class, on real users). Lab runs are diagnostics, not the verdict.

| Metric | Measures | Good (p75) |
|--------|----------|------------|
| LCP (Largest Contentful Paint) | Loading: when the main content renders | 2.5 s or less |
| INP (Interaction to Next Paint) | Responsiveness: latency of interactions across the visit | 200 ms or less |
| CLS (Cumulative Layout Shift) | Visual stability: unexpected layout movement | 0.1 or less |

INP replaced FID as the responsiveness vital. The metric set and thresholds are owned by web.dev and are revised from time to time; cite that source, not this table, in a report.

Measure with field sources (CrUX, Search Console, or your own real-user monitoring) and with the `web-vitals` library or a `PerformanceObserver` (entry types `largest-contentful-paint`, `event`, `layout-shift`), sent to your telemetry with page, device, and navigation type. Diagnose a failing metric from the attribution (LCP element and its phases, the slow interaction and its handler, the shifting node). Fixes: UI causes in `frontend`, ranking relevance in `seo`.

## Caching

Do not design caches here. Premature caching adds invalidation cost without a measured need. Measure the read's frequency and cost and the hit rate you could reach, then use `caching` for design and invalidation.

## Connection and thread pool sizing

Size from measurement, not a constant.

1. **Server limit first.** The sum of all pools across all application instances (and replicas, jobs, and tools) must stay below the server's connection limit. A pool of 20 on 50 instances is 1000 connections.
2. **Little's law for the target.** Needed connections ≈ throughput × time each request holds a connection. Start there, and add headroom for variance.
3. **Verify by measuring pool wait time** and server-side saturation, not by watching for errors. Too small shows as queuing on the pool; too large shows as contention on the server (context switching, memory) and no further gain.
4. **No universal formula.** Start from the Little's law figure and the server limit, then load test and adjust; the database side of pooling is in `database`.

This does not carry over to key-value stores, HTTP clients, or RPC channels: those multiplex differently, so size by concurrency needs (Little's law) and the remote side's limits.

## Tail latency amplification

If a request needs N parallel calls and each is under its p99 99% of the time, the whole is under it only 0.99^N of the time (about 95% for N = 5). Mitigations: reduce fan-out, propagate deadlines and cancel, hedge idempotent requests, cache at the aggregation layer.

## Context Adaptation

- **Backend:** load testing baseline, async I/O and backpressure, memory and allocation profiling.
- **Frontend:** measure Core Web Vitals in the field (section above), use lab tools to reproduce; fixes are in `frontend`.
- **Reliability:** saturation (USE method) per resource, headroom, scaling triggers, tail-latency budgets.
- **CI/CD:** build and test time, cache layers, container resource requests and limits.
- **ML serving:** measure latency and throughput separately, vary batch size, watch accelerator utilization and host-to-device transfer, and separate model load time from steady-state time.

## Anti-Patterns

| Anti-Pattern | Why It Hurts | Fix |
|-------------|-------------|-----|
| Optimizing without profiling | Wasted effort on the wrong thing | Profile first |
| No baseline | Cannot show an improvement | Record before and after under the same conditions |
| Comparing averages | Hides tail latency | Percentiles from histograms |
| Micro-benchmark only | Fast alone, slow in context | Also test under realistic load and data |
| Load generator waits on slow responses | Understates latency (coordinated omission) | Open-model arrival rate; measure from intended send time |
| Sync I/O on an async hot path | Blocks the event loop or thread pool | Async I/O or offload |
| Unbounded concurrency, cache, or collection | Memory or resource exhaustion | Semaphore, worker pool, eviction |
| N+1 calls or connection per request | Round-trip and handshake cost | Batch, pool (details in `database`) |
| Several changes at once | Cannot attribute the effect | One change per measurement |
| Premature caching | Complexity without measured need | Measure, then see `caching` |

## Related Knowledge

- `observability` — metrics, traces, continuous-profiling infrastructure
- `caching` — cache design and invalidation
- `database` — queries, indexes, pooling on the database side
- `reliability` — SLO-driven targets, saturation, load shedding
- `backend` — service structure, async patterns
- `ci-cd` — build speed, container limits
- `seo`, `frontend` — ranking relevance and UI causes of poor vitals
- `development` — code practice this skill applies when changing the measured hotspot

## References

- [profiling-patterns.md](references/profiling-patterns.md) — profile types, reading flame graphs, benchmarking and load-test method, noise, capacity planning, tool selection, tools by runtime
- [bottleneck-checklist.md](references/bottleneck-checklist.md) — compute, memory, I/O, concurrency checklist and pointers to sibling skills
- [workflows/review.md](workflows/review.md) — performance review protocol and report template
