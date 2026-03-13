# SRE Patterns and Anti-Patterns

Platform-agnostic reliability patterns, common failure modes, and domain knowledge.

## Contents

- [Observability Frameworks](#observability-frameworks)
- [Circuit Breaker Pattern](#circuit-breaker-pattern)
- [Retry Patterns](#retry-patterns)
- [SLO-Based Alerting](#slo-based-alerting)
- [Chaos Engineering Practices](#chaos-engineering-practices)
- [Progressive Delivery Patterns](#progressive-delivery-patterns)
- [Common Operational Failures](#common-operational-failures)
- [Anti-Patterns](#anti-patterns)

---

## Observability Frameworks

### Golden Signals (Google SRE Book)

Use for any service. Monitor all four for every user-facing service.

| Signal | What to measure | Alert when |
|--------|----------------|------------|
| Latency | Response time at p50, p95, p99 | p99 exceeds SLO threshold |
| Traffic | Requests/sec, messages/sec | Unexpected drop or spike |
| Errors | Error rate (5xx, failed operations) | Error budget burn rate too high |
| Saturation | Resource utilization approaching limits | Above 80% sustained |

### RED Method (Tom Wilkie)

Best for request-driven microservices:
- **Rate**: requests per second
- **Errors**: failed requests per second
- **Duration**: distribution of request latency

### USE Method (Brendan Gregg)

Best for infrastructure resources (CPU, memory, disk, network):
- **Utilization**: percentage of resource busy
- **Saturation**: degree of queued work
- **Errors**: count of error events

### OpenTelemetry Integration

```
Application Code
    |
    v
OpenTelemetry SDK (instrument once)
    |
    +---> Metrics   ---> Any metrics backend
    +---> Traces    ---> Any tracing backend
    +---> Logs      ---> Any log aggregator
```

Key principles:
- Instrument with OpenTelemetry SDK, not vendor-specific libraries
- Use semantic conventions for attribute names (http.request.method, db.system, etc.)
- Set up context propagation (W3C Trace Context headers) across all service boundaries
- Configure sampling: 100% for errors, percentage-based for normal traffic
- Export via OTLP protocol to collector, then fan out to backends

---

## Circuit Breaker Pattern

```
         Closed (normal)
        /               \
  Success               Failure count
  resets                hits threshold
  counter                    |
       \                     v
        \              Open (failing)
         \            /           \
          \     Timer             All requests
           \   expires            fail fast
            \     |
             v    v
          Half-Open (testing)
          /                 \
    Test request          Test request
    succeeds              fails
        |                    |
        v                    v
     Closed               Open
```

Configuration parameters:
- **Failure threshold**: number of failures before opening (e.g., 5 failures in 60 seconds)
- **Open duration**: how long to reject requests before testing (e.g., 30 seconds)
- **Half-open max requests**: how many test requests in half-open state (e.g., 1-3)
- **Success threshold**: successes needed in half-open to close (e.g., 3)

---

## Retry Patterns

### Exponential Backoff with Jitter

```
delay = min(base * 2^attempt + random_jitter, max_delay)

Attempt 1: 100ms  + jitter(0-50ms)
Attempt 2: 200ms  + jitter(0-100ms)
Attempt 3: 400ms  + jitter(0-200ms)
Attempt 4: 800ms  + jitter(0-400ms)
Attempt 5: give up
```

### What to retry vs what not to retry

| Retry | Do NOT retry |
|-------|-------------|
| Network timeout (no response received) | 400 Bad Request (client error) |
| 503 Service Unavailable | 401/403 Auth failure |
| 429 Too Many Requests (with backoff) | 404 Not Found |
| Connection refused (service restarting) | Data validation errors |
| Temporary DNS failure | Business logic errors |

---

## SLO-Based Alerting

### Burn Rate Alerting

Instead of "alert if error rate > 1%", alert on how fast the error budget is being consumed.

```
Monthly SLO: 99.9% availability
Error budget: 0.1% = 43.2 minutes/month

Burn rate 1x  = budget exhausted in 30 days   (normal)
Burn rate 14x = budget exhausted in ~2 days    (alert: page)
Burn rate 6x  = budget exhausted in ~5 days    (alert: ticket)
Burn rate 1x  = on track                       (no alert)
```

### Multi-Window Alert Matrix

| Severity | Long window | Short window | Action |
|----------|------------|--------------|--------|
| Page (P1) | 1h burn rate > 14x | 5m burn rate > 14x | Wake someone up |
| Ticket (P2) | 6h burn rate > 6x | 30m burn rate > 6x | Fix during business hours |
| Log (P3) | 3d burn rate > 1x | 6h burn rate > 1x | Investigate when convenient |

Both windows must fire to trigger the alert. This eliminates false positives from brief spikes.

---

## Chaos Engineering Practices

### Experiment Framework

1. **Define steady state**: what does "working normally" look like? (SLI values, error rates, latency)
2. **Hypothesize**: "if we kill service X, the system should failover within 30 seconds"
3. **Inject failure**: kill process, add latency, drop packets, fill disk, exhaust connections
4. **Observe**: did the system behave as expected? Did alerts fire? Did failover work?
5. **Learn**: document findings, fix weaknesses, update runbooks

### Common Experiments

| Experiment | What it tests | Start with |
|-----------|--------------|------------|
| Kill a service instance | Auto-restart, load balancer rerouting | Staging |
| Add network latency (100-500ms) | Timeout handling, circuit breakers | Staging |
| Block dependency access | Fallback behavior, graceful degradation | Staging |
| Fill disk to 95% | Log rotation, alerting, cleanup scripts | Staging |
| Exhaust connection pool | Pool sizing, timeout behavior, queuing | Staging |
| Simulate clock skew | Time-dependent logic, token validation | Staging |

### Game Day Checklist

- [ ] Scenario designed with clear hypothesis
- [ ] Blast radius limited (staging first, then canary in production)
- [ ] Rollback plan ready (can stop the experiment instantly)
- [ ] Observability in place (dashboards, alerts, logs visible)
- [ ] Team briefed (participants know the drill)
- [ ] Results documented (what happened, what was learned)

---

## Progressive Delivery Patterns

### Canary Deployment

```
Step 1: Deploy new version alongside old
Step 2: Route 1-5% of traffic to new version
Step 3: Monitor SLIs for the canary cohort
Step 4: If SLIs healthy, increase to 25%, 50%, 100%
Step 5: If SLIs degrade, route 100% back to old version
```

### Feature Flags for Reliability

Use feature flags to decouple deployment from release:
- Deploy code with flag OFF
- Enable for internal users first
- Enable for percentage of external users
- Monitor SLIs per cohort
- Kill switch: disable instantly without redeploying

### Rollback Decision Matrix

| Signal | Action |
|--------|--------|
| Error rate doubled after deploy | Immediate rollback |
| Latency p99 increased > 50% | Immediate rollback |
| Error budget burn rate > 14x | Immediate rollback |
| Single user report, metrics stable | Investigate, don't rollback yet |
| Memory slowly increasing | Monitor, set a time-boxed investigation |

---

## Common Operational Failures

1. **No graceful shutdown** -- SIGKILL after timeout, uncommitted work, duplicate processing on restart
2. **OOM kill** -- no memory limits, unbounded caches or buffers grow until killed
3. **Zombie process** -- process in pool but not processing, causes stalls and uneven load
4. **Log explosion** -- debug logging in production fills disk, degrades I/O performance
5. **Config drift** -- environment docs outdated, new instances can't start without tribal knowledge
6. **Lying health check** -- returns 200 while dependency is actually down
7. **Alert fatigue** -- too many noisy alerts, real failures get ignored
8. **No runbook** -- incident happens, nobody knows the recovery steps
9. **Unbounded retries** -- failing dependency gets hammered with retries, making recovery harder
10. **Missing timeouts** -- one slow dependency causes cascading slowdowns across the system

---

## Anti-Patterns

| Anti-Pattern | Why it fails | Instead |
|-------------|-------------|---------|
| Alert on raw thresholds | Too many false positives, misses slow degradation | Alert on SLO burn rate |
| Average latency as SLI | Hides tail latency problems | Use percentiles (p95, p99) |
| Monitoring without alerting | Nobody sees the dashboard at 3am | Automated alerts with runbook links |
| Retry without backoff | Thundering herd during outages | Exponential backoff with jitter |
| Health check that always returns OK | Orchestrator thinks service is healthy when it's broken | Check actual dependency connectivity |
| Logging everything at DEBUG | Disk fills, important signals lost in noise | Structured logging with appropriate levels |
| Manual incident response | Slow response, inconsistent actions | Runbooks with automated first-response |
| Postmortem blame culture | People hide mistakes, root causes stay unfixed | Blameless postmortems focused on systemic fixes |
| Single point of failure in monitoring | Monitoring goes down with the system it monitors | Independent monitoring path |
| Feature flags without cleanup | Flag debt accumulates, code becomes unreadable | Expiry dates on flags, regular cleanup |
