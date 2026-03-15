# Profiling Patterns & Operational Performance

Covers the review protocol, modern observability tooling, and capacity planning.

## Contents

- [Review Protocol](#review-protocol)
- [Modern Observability](#modern-observability)
- [Capacity Planning](#capacity-planning)
- [New Project Setup](#new-project-setup)

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

## Modern Observability

### Continuous Profiling

Always-on, low-overhead profiling in production (< 1% CPU overhead). Flame graphs aggregated over time reveal chronic bottlenecks that load tests miss.

```
When to use continuous profiling:
├── Performance regression detected but load test cannot reproduce → continuous profiling shows production-specific patterns
├── Cost optimization needed → identify which code paths consume the most CPU/memory in production
├── Intermittent slowdowns → aggregate flame graphs across time windows to find chronic hotspots
└── Multi-tenant variance → compare profiles between tenants to find outlier behavior
```

Continuous profiling integrates with OpenTelemetry via the OTel Profiling protocol, enabling correlation of profiles with traces and metrics in a single pipeline.

| Approach | Instrumentation | Best For |
|----------|----------------|----------|
| Agent-based (push model) | Language SDK in application | Per-language CPU, allocation, lock profiling |
| eBPF-based (pull model) | Kernel-level, zero app changes | Platform-wide, polyglot environments |
| IDE-integrated | Development-time profiling | Local optimization loops |

### eBPF Observability

Kernel-level tracing without application changes. Use when you need to see what the runtime cannot tell you. eBPF shifts profiling responsibility from application teams to platform teams.

| Use Case | Tool |
|----------|------|
| TCP latency, retransmits | `tcplife`, `tcpretrans` (bcc) |
| Disk I/O latency | `biolatency`, `biosnoop` (bcc) |
| DNS resolution time | `gethostlatency` (bcc) |
| Off-CPU analysis | `offcputime` (bcc), `perf sched` |
| General tracing | `bpftrace` one-liners |
| GPU profiling | eGPU (extending eBPF to GPU workloads) |

---

## Capacity Planning

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

## New Project Setup

When setting up performance infrastructure from scratch:

```
Profiling tool selection:
├── Need vendor-neutral telemetry? → OpenTelemetry-based pipeline
├── Kubernetes-native, zero instrumentation? → eBPF-based profiler
├── Deep runtime profiling (allocations, locks)? → Language-specific agent
└── Development-time only? → IDE-integrated or CLI profiler

Load testing tool selection:
├── Need scriptable, CI-friendly tests? → Code-based load testing tool
├── Need distributed load generation? → Cloud-based load testing service
├── Simple HTTP benchmarking? → CLI benchmarking tool (wrk, hey, ab)
└── Need to simulate browser behavior? → Browser-based load testing

Metrics pipeline selection:
├── Vendor-neutral, portable? → OpenTelemetry Collector + backend of choice
├── Single-vendor simplicity? → Commercial APM with built-in metrics
└── Self-hosted, open source? → Time-series DB + visualization layer
```

Establish baseline metrics before optimizing. You cannot improve what you do not measure.

Use framework-native benchmarking for hot path micro-benchmarks (e.g., `cargo bench`, `go test -bench`, `vitest bench`).
