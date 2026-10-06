# Performance Review Protocol

Use for a structured review of a system or service. Method details (how to profile, benchmark, load test) are in [../references/profiling-patterns.md](../references/profiling-patterns.md).

## Phase 1: Discovery

Map the system before analyzing it.

1. **Runtime** — language, runtime version, framework
2. **Infrastructure** — databases, queues, caches, load balancers, CDNs
3. **Data flow** — ingress to egress, every hop annotated
4. **Hot paths** — what runs per request, per second, per minute, on demand
5. **Targets** — latency and throughput objectives that exist (or should)

## Phase 2: Measure and localize

1. Get a baseline from production telemetry or a realistic load test.
2. Find the saturated resource (CPU, memory, I/O, locks, pools, downstream).
3. Profile the saturated resource and the slow requests.
4. Walk the layers in [../references/bottleneck-checklist.md](../references/bottleneck-checklist.md) for what the evidence points to. Database and cache findings go to `database` and `caching` for the fix.

## Phase 3: Report

Adapt sections to what is relevant.

```
## Performance Assessment

### Summary
[2-3 sentences: posture, main bottleneck, risk]

### Evidence
[Baseline numbers, profile findings, load-test conditions]

### Hot Path Analysis
| Path | Frequency | Operations | Measured latency | Bottleneck |
|------|-----------|-----------|------------------|-----------|

### Findings
| # | Area | Severity | Finding | Location | Recommendation |
|---|------|----------|---------|----------|----------------|

### Optimization Opportunities
| # | Area | Current | Expected | Effort | Impact |
|---|------|---------|----------|--------|--------|

### Recommendations
1. [Highest impact, lowest effort first; each with the measurement that will confirm it]
```
