---
name: observability
description: "Instrument and investigate systems. Use for metrics, logs, distributed tracing, alert rules, telemetry pipelines and collectors, log redaction, and continuous-profiling or eBPF collection."
user-invocable: true
---

# Observability

Telemetry design: which signal answers which question, how to instrument, how to move telemetry, how to keep it cheap and safe. Check the project's SDK major version and semantic-convention version before copying setup snippets; names and APIs changed between majors.

## Scope and boundaries

**Owns:** signal selection, instrumentation, OpenTelemetry setup, collector pipelines, sampling, metric and log design, log redaction, alert rule mechanics and routing, profiles and eBPF as telemetry sources.

**Does not own:**
- SLO targets, burn-rate policy, severity, what pages a human, incident process → `reliability`
- Profiling and benchmarking method, reading flame graphs, bottleneck hunting → `performance`
- Retention and PII obligations → `compliance`
- Cluster deployment of agents and collectors → `kubernetes`

## Signal selection

| Question | Signal |
|----------|--------|
| Why is this request slow, where did it go? | Traces (find the slow span) |
| Is the system healthy, is it getting worse? | Metrics (rate, errors, duration per service; utilization, saturation, errors per resource) |
| What exactly happened to this request or at this time? | Logs filtered by `trace_id` |
| Where is CPU or memory spent under real traffic? | Profiles |
| What does the network or kernel see, in code I cannot change? | eBPF-based telemetry |

Signals link through identifiers: trace ID in logs, exemplars on metrics, span ID on profile samples where supported. Design the links first; dashboards come later.

## Instrumentation decision tree

```
Code I own?
├── Standard HTTP / DB / messaging → library auto-instrumentation
├── Business operations → manual spans + custom metrics (bounded labels)
└── Hotspots only visible in production → continuous profiling agent
Code I cannot modify, or a platform-wide baseline?
├── Network flows, DNS, TCP → eBPF network telemetry
└── Basic request rate/errors/duration → eBPF or mesh telemetry (no business context)
```

eBPF trades SDK depth for reach. It gives network and kernel visibility and basic RED for unmodifiable code, at a measurable overhead. It has limits: encrypted traffic, application context, and cross-service context propagation. It does not replace SDK spans or business attributes. Use both for business-critical services.

## OpenTelemetry decisions

Traces, metrics, and logs have stable APIs and protocol, though SDK maturity varies by language and signal. Profiles are alpha and not a production dependency yet. Volatile status (signals, deprecations, semconv renames) is in [tracing-patterns.md](references/tracing-patterns.md#volatile-status).

| Decision | Guidance |
|----------|----------|
| Protocol | OTLP (gRPC or HTTP) |
| Collector | Run one for anything beyond a single service or local development: agent tier for local collection, gateway tier for sampling and routing |
| Resource attributes | At minimum `service.name`, `service.version`, `deployment.environment.name` |
| Attribute names | Follow current stable semantic conventions; do not invent near-duplicates |
| Context propagation | W3C Trace Context; inject and extract manually through message headers |
| Errors on spans | Record the failure, set span status `ERROR`, correlate the error log by `trace_id`. Exception and event recording is moving to log-based events; SDK call names are in the reference |
| Span content | Business context as attributes (`order.id`, `customer.tier`), never PII; child spans for meaningful sub-operations, not every function |

### Sampling choice

```
Low traffic or development → keep 100%
Production, cost matters
├── Need all errors and slow traces → tail-based at a gateway (see tracing reference for the trace-ID routing requirement)
├── Predictable cost, no tail logic → probability or rate-limited head sampling
└── Cross-service consistency → parent-based
```

## Metrics

- Services: rate, errors, duration. Resources: utilization, saturation, errors.
- Latency as a histogram (aggregatable across instances), not a summary and never an average.
- Label values must be bounded: route template, not raw path; never user or request IDs. Put those in traces.
- Counters for events, gauges for values that go up and down, units in names.
- Details, queries, and bucket design: [metrics-patterns.md](references/metrics-patterns.md).

## Logs

Structured, one event per line, with `timestamp`, `level`, `service`, `message`, `trace_id`. Redaction is owned here: allowlisted fields plus a final-stage scrubber. Level table, redaction, and logger setup: [logging-patterns.md](references/logging-patterns.md).

## Alerting

Alert on symptoms users feel, not causes. A log line or an ERROR level is not a page. `reliability` decides what pages and at what burn rate; this skill writes the rules, grouping, inhibition, and routing. Templates and noise reduction: [alerting-patterns.md](references/alerting-patterns.md).

## Profiles as telemetry

Continuous profiling is always-on sampled CPU, allocation, and lock profiling in production, for chronic hotspots load tests miss. Today use a vendor-neutral continuous-profiling agent; OTel profiles are an emerging option. Method for using profiles (what to look for, flame graphs) is in `performance`.

## Pipelines

Route telemetry through collectors, not directly from applications to backends: buffering, enrichment, sampling, routing, fan-out, and cost control (filter, aggregate, or drop low-value data before storage).

```
App → [agent collector] → [gateway collector] → backend(s)
```

## Context Adaptation

- **Backend:** spans around business logic, database, and external calls; logger enriched with trace context.
- **Platform:** collector fleet management, sampling policy, multi-backend routing, retention tiers by cost.
- **Reliability work:** service and resource dashboards feed SLO tracking; burn-rate rules follow the policy from `reliability`.

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Logs without `trace_id` | Inject trace context in the logger |
| Unbounded metric labels | Bounded labels; per-request detail in traces |
| Alerting on causes or log lines | Symptom and burn-rate alerts |
| Sampling randomly in production when errors matter | Tail-based, with the routing prerequisite |
| Exporting directly to backends | Collector tier |
| Metrics with no dashboard or owner | Add the view and an owner when adding the metric |
| Copying setup snippets across SDK majors | Check the project's SDK version first |
| Treating eBPF as a full SDK replacement | Use it for network, kernel, and baseline; SDK for business context |

## Related Knowledge

- `reliability` — SLO, burn-rate policy, severity, paging, incidents
- `performance` — profiling and measurement method
- `compliance` — retention and PII obligations on telemetry
- `security` — audit trails and security event monitoring
- `kubernetes` — deploying collectors and agents

## References

- [tracing-patterns.md](references/tracing-patterns.md) — OTel SDK setup, spans, propagation, tail sampling, collector deployment, volatile status
- [metrics-patterns.md](references/metrics-patterns.md) — Prometheus-style RED/USE instrumentation, queries, histograms, recording rules, dashboards
- [logging-patterns.md](references/logging-patterns.md) — log format, levels, trace correlation, redaction, logger setup
- [alerting-patterns.md](references/alerting-patterns.md) — alert templates, multi-window burn rate, routing, noise reduction, runbooks
