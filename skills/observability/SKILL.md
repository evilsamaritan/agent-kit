---
name: observability
description: Design observability systems — tracing, metrics (RED/USE), logging, alerting, profiling, eBPF, pipelines. Use when implementing instrumentation, metrics, logging, profiling, or alerting. Do NOT use for SLO/SLI (use sre) or bottleneck analysis (use performance).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Observability Knowledge

Observability engineering expertise — traces, metrics, logs, profiles, and alerting.

---

## Signal Types

| Signal | What | When | How They Connect |
|--------|------|------|-----------------|
| **Traces** | Request flow across services | Debug latency, understand dependencies | Trace ID links spans across services |
| **Metrics** | Aggregated numeric measurements | Monitor trends, alert on anomalies | Exemplars link metrics to traces |
| **Logs** | Discrete events with context | Debug specific errors, audit trail | Correlation ID links logs to traces |
| **Profiles** | CPU/memory/allocation flame graphs | Find chronic hotspots, optimize code | Profile ID links to trace spans |

### Signal Selection

- **"Why is this request slow?"** — Traces (find the slow span)
- **"Is the system healthy right now?"** — Metrics (RED dashboard)
- **"What exactly happened at 3:42am?"** — Logs (filter by trace_id + timestamp)
- **"Is this getting worse over time?"** — Metrics (trend over hours/days)
- **"Where is CPU time spent under load?"** — Profiles (flame graph aggregated over time)
- **"What's happening at the network/kernel level?"** — eBPF-based telemetry (zero-instrumentation)

---

## Instrumentation Decision Tree

```
Need observability for a service?
├── Application code you own
│   ├── Standard HTTP/DB/messaging → auto-instrumentation (OTel SDK)
│   ├── Business logic, custom operations → manual spans + custom metrics
│   └── CPU/memory hotspots → continuous profiling agent
├── Infrastructure / kernel-level
│   ├── Network flows, DNS, TCP → eBPF-based network observability
│   ├── System calls, security events → eBPF kernel tracing
│   └── Service mesh traffic → sidecar/mesh telemetry export
└── Third-party / unmodifiable code
    └── eBPF auto-instrumentation (zero-code, kernel-level)
```

---

## OpenTelemetry

OTel is the standard for instrumentation. All four signals (traces, metrics, logs, profiles) have stable specifications. SDK setup and auto-instrumentation details are in the tracing reference.

**Key decisions:**

| Decision | Guidance |
|----------|----------|
| Protocol | OTLP over gRPC (default) or HTTP |
| Sampling | Tail-based in production: 100% errors + slow, 10% normal |
| Collector | Always deploy a collector; agent mode for collection, gateway for sampling |
| Resource attributes | `service.name`, `service.version`, `deployment.environment` (minimum) |
| Semantic conventions | Follow OTel semconv stable attributes |
| Profiling | Enable OTel profiling signal for CPU/memory correlation with traces |

---

## Distributed Tracing

### Context Propagation

W3C Trace Context: `traceparent: 00-{trace_id}-{parent_span_id}-{flags}`

Propagation works automatically with OTel auto-instrumentation for HTTP. For message queues, inject/extract trace context into message headers manually.

### Sampling Strategies

| Strategy | How | Use When |
|----------|-----|----------|
| Always On | Sample 100% | Development, low traffic |
| Probability | Sample N% | Production baseline (1-10%) |
| Rate Limiting | N traces/second | Predictable cost |
| Tail-Based | Decide after trace completes | Keep errors + slow, drop normal |
| Parent-Based | Follow parent's decision | Consistent end-to-end sampling |

### Span Best Practices

- Add business context as attributes (`order.id`, `customer.tier`), never PII
- Set span status: `OK` on success, `ERROR` with message on failure
- Record exceptions with `recordException()`
- Create child spans for meaningful sub-operations, not every function call

---

## Metrics Design

### RED Method (for Services)

| Metric | What | Query Pattern |
|--------|------|--------------|
| **Rate** | Requests/sec | `rate(http_requests_total[5m])` |
| **Errors** | Failed requests/sec | `rate(http_requests_total{status=~"5.."}[5m])` |
| **Duration** | Latency distribution | `histogram_quantile(0.99, rate(..._bucket[5m]))` |

### USE Method (for Resources)

| Metric | What | Examples |
|--------|------|---------|
| **Utilization** | % time busy | CPU %, memory %, disk I/O % |
| **Saturation** | Work queued | Queue depth, thread pool waiting |
| **Errors** | Error events | Disk errors, OOM kills, connection failures |

### Histogram vs Summary

| Feature | Histogram | Summary |
|---------|-----------|---------|
| Aggregatable across instances | Yes | No |
| Percentile computation | Server-side | Client-side |
| **Recommendation** | **Default choice** | Rarely needed |

---

## Structured Logging

Every log entry: JSON with `timestamp`, `level`, `service`, `trace_id`, `message`. See logging reference for full format, redaction patterns, and logger setup.

### Log Level Quick Reference

| Level | When | Alert? |
|-------|------|--------|
| ERROR | Unexpected failure, needs attention | Yes |
| WARN | Degraded operation, recoverable | Monitor trends |
| INFO | Significant business events | No |
| DEBUG | Developer troubleshooting (disabled in prod) | No |

---

## Continuous Profiling

The fourth observability signal. Always-on, low-overhead sampling of CPU, memory, and allocations in production.

### When to Profile

- **CPU flame graphs** — identify hot code paths under real traffic
- **Memory allocation profiles** — find allocation-heavy code causing GC pressure
- **Lock contention profiles** — detect goroutine/thread blocking
- **Off-CPU profiles** — find time spent waiting on I/O, locks, scheduling

### Integration with Traces

Link profile data to trace spans for drill-down: "this span is slow → here's where CPU time is spent." OTel profiling signal provides this correlation natively.

---

## eBPF-Based Observability

eBPF enables kernel-level observability without modifying application code or injecting agents.

### Use Cases

| Use Case | What eBPF Provides |
|----------|-------------------|
| Zero-code service instrumentation | HTTP/gRPC metrics and traces from kernel syscalls |
| Network observability | Flow-level visibility — every TCP connection, DNS query, HTTP request |
| Security observability | Syscall tracing, process execution, file access events |
| Deep performance profiling | Kernel-level flame graphs, scheduler analysis |

### Decision: eBPF vs SDK Instrumentation

- **eBPF** — use when you cannot modify the application, need network/kernel visibility, or want zero-overhead baseline telemetry
- **SDK** — use when you need business-context attributes, custom spans, or application-level metrics
- **Both** — combine eBPF baseline with SDK for business-critical services

---

## Observability Pipelines

Route telemetry through a pipeline (collector) rather than exporting directly from applications to backends.

### Pipeline Architecture

```
App → [Agent Collector] → [Gateway Collector] → Backend(s)
         (local buffer)     (sampling, routing,
                             enrichment, fan-out)
```

### Pipeline Capabilities

- **Sampling** — tail-based sampling at the gateway level
- **Enrichment** — add resource attributes, Kubernetes metadata
- **Routing** — send different signals to different backends
- **Fan-out** — export to multiple backends simultaneously
- **Cost control** — filter, aggregate, or drop low-value telemetry before it reaches storage

---

## AI-Assisted Observability

AI/ML is augmenting (not replacing) human observability workflows.

### Emerging Patterns

| Pattern | What It Does | Maturity |
|---------|-------------|----------|
| Anomaly detection | ML-based baseline deviation alerting | Production-ready |
| Root cause analysis | Correlate signals to suggest probable cause | Emerging |
| Natural language querying | "Show me error rate for checkout last hour" → query | Emerging |
| Alert correlation | Group related alerts into incidents automatically | Production-ready |
| Predictive alerting | Forecast resource exhaustion before it happens | Emerging |

### Guidance

- Use AI for noise reduction and correlation, not as sole alerting mechanism
- Require human approval for automated remediation actions
- Validate AI suggestions against actual telemetry data

---

## Alerting

Alert on symptoms (error rate, latency), not causes (CPU, threads). See alerting reference for templates and noise reduction.

### Severity Quick Reference

| Severity | Response | Example |
|----------|----------|---------|
| Critical (P1) | Page on-call | Service down, data loss |
| High (P2) | Within 1 hour | Error rate elevated |
| Warning (P3) | Next business day | Disk 80% full |
| Info | No action | Deploy completed |

### Noise Reduction Checklist

- `for` duration: 5-15min before firing (avoids flapping)
- Group by service/team (one notification, not 50)
- Inhibition: suppress sub-alerts when root cause is alerting
- Silence during planned maintenance

---

## Context Adaptation

### Backend
- Custom spans around business logic, DB calls, external API calls
- Application-specific metrics (orders processed, payments completed)
- Correlate logs with trace IDs (inject trace context into logger)

### SRE
- Service overview dashboards (RED), resource usage dashboards (USE)
- Alert routing: page for P1, team channel for P2-P3
- SLO monitoring: burn rate alerts for error budget consumption

### DevOps
- Log aggregation pipeline: collector → storage backend
- Metric collection: scrape-based or push-based via OTel Collector
- Retention policy: high-res 15d, downsampled 90d, archived 1y

### Platform / Infrastructure
- eBPF-based network and kernel observability for cluster-wide visibility
- Observability pipeline management: collector fleet, sampling policies, cost control
- Multi-backend routing for different teams or compliance requirements

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Logging without correlation IDs | Include `trace_id` in every log entry |
| High-cardinality metric labels | Avoid `user_id`, `request_id` as labels; use trace attributes |
| Alerting on causes not symptoms | Alert on error rate, latency (user-facing) |
| No trace sampling in production | Tail-based: 100% errors, 10% normal |
| Metrics without dashboards | Create dashboard when adding metric |
| No production profiling | Enable continuous profiling — low overhead, high signal |
| Exporting directly to backends | Route through a collector for buffering, sampling, and processing |
| Treating AI alerts as ground truth | AI suggests, humans verify — always check underlying data |
| Ignoring eBPF for infra visibility | eBPF provides zero-code kernel-level telemetry for gaps SDK can't cover |

---

## References

- [tracing-patterns.md](references/tracing-patterns.md) — OTel SDK setup (Node/Python/Go/Java), span attributes, sampling config, context propagation, collector deployment
- [metrics-patterns.md](references/metrics-patterns.md) — RED/USE implementation, query cookbook, histogram design, recording rules, alerting rules, dashboard patterns
- [logging-patterns.md](references/logging-patterns.md) — Structured log format, trace correlation, sensitive data redaction, logger setup (Node/Python)
- [alerting-patterns.md](references/alerting-patterns.md) — Symptom-based alerting, severity routing, alert templates, noise reduction, runbook structure

## Related Knowledge

- **sre** — SLO/SLI management, error budgets, incident response, operational readiness
- **performance** — Profiling, bottleneck analysis, capacity planning
- **devops** — CI/CD pipelines, infrastructure provisioning, deployment strategies
- **kubernetes** — Container orchestration, cluster observability, network policies
- **security** — Security event monitoring, audit trails
