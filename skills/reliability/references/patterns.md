# SRE Patterns and Anti-Patterns

Platform-agnostic reliability patterns, common failure modes, and domain knowledge.

## Contents

- [Circuit Breaker Pattern](#circuit-breaker-pattern)
- [Retry Patterns](#retry-patterns)
- [Chaos Engineering Practices](#chaos-engineering-practices)
- [Progressive Delivery Patterns](#progressive-delivery-patterns)
- [Toil Reduction Patterns](#toil-reduction-patterns)
- [On-Call Excellence](#on-call-excellence)
- [Dependency Management](#dependency-management)
- [Common Operational Failures](#common-operational-failures)
- [Anti-Patterns](#anti-patterns)

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
| Inject certificate expiry | TLS renewal automation, alerting | Staging |
| Corrupt DNS resolution | DNS fallback, caching, timeout handling | Staging |

### Game Day Checklist

- [ ] Scenario designed with clear hypothesis
- [ ] Blast radius limited (staging first, then canary in production)
- [ ] Rollback plan ready (can stop the experiment instantly)
- [ ] Observability in place (dashboards, alerts, logs visible)
- [ ] Team briefed (participants know the drill)
- [ ] Results documented (what happened, what was learned)
- [ ] Action items tracked (findings fed back into reliability backlog)

### Maturity Progression

```
Level 1: Manual experiments in staging only
Level 2: Scheduled game days with documented results
Level 3: Automated experiments in CI/CD (staging gate)
Level 4: Continuous chaos in production canaries with auto-rollback
```

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

## Toil Reduction Patterns

### Toil Classification

| Category | Examples | Automation priority |
|----------|---------|-------------------|
| Deployment toil | Manual deploys, config changes, cert rotation | High -- automate first |
| Incident toil | Manual restarts, log searching, scaling | High -- build runbook automation |
| Operational toil | User account management, quota changes | Medium -- self-service portals |
| Reporting toil | Manual status reports, capacity spreadsheets | Medium -- automated dashboards |
| Maintenance toil | Dependency updates, cleanup scripts | Low -- schedule and batch |

### Automation Decision Framework

```
Should you automate this?
├── Done > 2x/week AND takes > 15 min each time → Automate now
├── Done weekly AND error-prone (human mistakes) → Automate now
├── Done monthly AND well-documented → Automate when capacity allows
├── Done rarely AND requires judgment → Keep manual, improve runbook
└── One-time task → Do not automate
```

### Toil Tracking

- Measure toil hours per engineer per sprint
- Target: < 50% of time on toil, > 50% on engineering work
- Review toil trends quarterly -- rising toil signals scaling problems
- Tag tickets as "toil" to make it visible in sprint retrospectives

---

## On-Call Excellence

### Rotation Design

- Minimum 2 people in rotation (primary + secondary)
- Rotation length: 1 week is standard; longer rotations cause fatigue
- Handoff procedure: outgoing documents active issues, pending changes, recent incidents
- Follow-the-sun: distribute across time zones to avoid night pages

### Alert Quality Standards

- Every alert must be actionable (not "CPU is high" -- instead "service X is burning error budget")
- Every alert links to a runbook with diagnosis steps
- Track alert-to-incident ratio: target > 50% of pages result in real action
- Regularly review and prune alerts that never lead to action

### On-Call Health Metrics

| Metric | Healthy | Needs attention |
|--------|---------|----------------|
| Pages per shift | < 5 | > 10 |
| False positive rate | < 20% | > 40% |
| Time to acknowledge | < 5 min | > 15 min |
| Time to mitigate | < 30 min | > 2 hours |
| Escalation rate | < 10% | > 30% |

### Compensation and Sustainability

- Compensate on-call time (pay or time off)
- Post-incident recovery time after major incidents
- Track interrupt rate and adjust staffing when it exceeds capacity
- Rotate people off on-call if burnout indicators appear

---

## Dependency Management

### Dependency Mapping

For every service, document:
- Critical dependencies (service cannot function without them)
- Degradable dependencies (service can function in degraded mode)
- Optional dependencies (nice-to-have, can be fully disabled)

### Fallback Strategies

| Dependency type | Fallback pattern |
|----------------|-----------------|
| Database (primary) | Read replica, cached data, queue writes for retry |
| External API | Cached last-known-good response, default values, feature disable |
| Auth service | Cached tokens/sessions, graceful deny with retry |
| Search index | Degraded search (DB fallback), show cached results |
| CDN / static assets | Origin fallback, local cache |

### Blast Radius Analysis

Before any change, ask:
1. What services depend on this component?
2. If this component fails, what is the user impact?
3. Can dependent services degrade gracefully?
4. How long until the failure is detected by alerts?
5. What is the rollback procedure?

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
11. **Single point of failure** -- no redundancy for critical path components
12. **Toil accumulation** -- manual operational work grows faster than automation efforts

---

## Anti-Patterns

| Anti-Pattern | Why it fails | Instead |
|-------------|-------------|---------|
| Alert on raw thresholds | Too many false positives, misses slow degradation | Alert on SLO burn rate |
| Average latency as SLI | Hides tail latency problems | Use percentiles (p95, p99) |
| Monitoring without alerting | Nobody sees the dashboard at 3am | Automated alerts with runbook links |
| Retry without backoff | Thundering herd during outages | Exponential backoff with jitter |
| Health check that always returns OK | Orchestrator thinks service is healthy when it's broken | Check actual dependency connectivity |
| Manual incident response | Slow response, inconsistent actions | Runbooks with automated first-response |
| Postmortem blame culture | People hide mistakes, root causes stay unfixed | Blameless postmortems focused on systemic fixes |
| Single point of failure in monitoring | Monitoring goes down with the system it monitors | Independent monitoring path |
| Feature flags without cleanup | Flag debt accumulates, code becomes unreadable | Expiry dates on flags, regular cleanup |
| No error budget policy | SLOs are numbers on a dashboard, not decision tools | Formal policy with stakeholder agreement |
| Hero culture in on-call | One person handles everything, no knowledge sharing | Documented runbooks, pair on incidents, rotate |
| Automating without understanding | Automated fix masks the root cause | Understand first, then automate the known-good fix |
| No toil tracking | Toil grows invisibly until burnout | Tag and measure toil hours, review quarterly |
