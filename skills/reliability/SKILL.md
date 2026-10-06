---
name: reliability
description: "Design and operate reliable services. Use for SLO/SLI, error budgets, burn-rate paging, probes, graceful shutdown, timeouts and retries, circuit breakers, incidents, backups and disaster recovery (RPO/RTO), and toil."
user-invocable: true
---

# Reliability

SRE patterns for keeping production healthy — SLOs, incident response, graceful degradation, toil reduction. This skill is about **what to measure and how to respond**; instrumentation details (OTel, metrics pipelines) live in `observability`.

## Scope and boundaries

**This skill covers:**
- SLO / SLI / error budget design and lifecycle
- Liveness, readiness, and startup probe semantics (mechanics in `backend`)
- Graceful shutdown semantics and in-flight work preservation
- Circuit breakers, bulkheads, load shedding
- Timeout, deadline, and retry policy (owner of the policy)
- Backups, RPO/RTO, restore verification, failover tiers
- Paging policy and burn-rate thresholds
- Incident response — roles, cadence, comms, timeline
- Blameless postmortems — structure, action items, follow-up
- On-call hygiene — rotations, handoffs, alert quality
- Toil definition and reduction
- Chaos engineering — intentional failure injection

**This skill does not cover:**
- Metrics / tracing / log instrumentation and alert rule syntax → `observability`
- Idempotency keys and consumer deduplication → `message-queues` (idempotency-patterns reference)
- Code form of probes, shutdown hooks, and client timeouts → `backend`
- Schema migration and database restore mechanics → `database`
- Bottleneck profiling → `performance`
- CI/CD pipelines → `ci-cd`
- Release strategy → `release-engineering`
- Container orchestration → `kubernetes`

## Which lever?

```
What is going wrong?
├── SLO or budget breach, cause unclear → SLO framework, then observability to localize
├── A dependency is failing or slow → timeouts + bounded retries + circuit breaker + fallback
├── Load exceeds capacity → load shedding, bulkheads, then capacity work (performance)
├── A release caused it → rollback first (release-engineering, ci-cd)
├── Data or a region is lost → recovery (references/recovery.md)
└── Same manual fix keeps recurring → toil
```

## SLO framework

### SLO = SLI + target + window

- **SLI** — a metric that measures user-visible reliability (availability, latency, correctness).
- **Target** — the goal (e.g., p99 latency < 300ms, 99.9% success rate).
- **Window** — the period the target applies to (rolling 28 days is the default).

### Error budget

Error budget = (1 − SLO target) × requests in window.

Rules:
- **Budget burned fast** = freeze risky changes; focus on reliability work.
- **Budget intact** = ship new features; experiment.
- **Budget always 100%** = SLO is too loose, raise the target.
- **Budget always exceeded** = SLO is too tight, lower the target or fix the system.

### What SLIs to pick

Per user-visible flow:

- **Availability** — fraction of requests that succeed (non-5xx, not-timed-out)
- **Latency** — p99 of the same path
- **Correctness** — for things with business invariants (payments, orders): fraction with wrong state

Don't SLO internal metrics the user doesn't experience. CPU% is not an SLI.

## Health checks

| probe | answer | action on failure |
|-------|--------|-------------------|
| startup | "has the process finished booting?" | keep waiting (don't kill); use for slow boots |
| readiness | "can this instance serve traffic right now?" | remove from load balancer; keep process alive |
| liveness | "is this process hung?" | restart the process |

Rules:
- **Liveness is optional and checks the process only.** Skip it unless the process can wedge in a way a restart fixes. No dependency calls: a database outage must never restart every instance.
- **Readiness is local ability to serve.** Check what this instance needs itself (warmed up, accepting work, local resources). Check a critical dependency only deliberately, and define the degraded behaviour first.
- **Do not fail readiness for a shared downstream.** If the database or a common service goes down and every instance turns unready, the load balancer removes all capacity and a partial outage becomes a total one. Serve degraded or fail the request instead.
- **Restrict probe detail to internal callers.** Versions and dependency status are for operators, not the public internet.
- Conventional paths: `/livez` and `/readyz` (Kubernetes details in `kubernetes`).

Common mistakes: liveness used as readiness (restart storm), readiness that always returns OK on a node with a broken connection, a "deep" check that calls a dependency on every probe and adds load to it.

## Graceful shutdown

On SIGTERM:

1. **Fail readiness first** and wait for deregistration to propagate (load balancers and endpoint lists need seconds to stop sending traffic). Keep serving during this wait. On Kubernetes this wait is a `preStop` delay, and `terminationGracePeriodSeconds` must exceed it plus the drain, flush, and close time (manifests in `kubernetes`).
2. **Stop accepting new connections** and let in-flight requests drain, with a deadline.
3. **Flush buffers** — logs, metrics, write queues; commit consumer offsets.
4. **Close outbound connections** (DB pools, queue clients).
5. **Exit** within the platform's kill timeout.

If any step can't complete within budget, log loudly and exit anyway. Hanging is worse than incomplete shutdown.

## Timeouts, retries, deadlines

This skill owns the policy. Mechanics for a given client library live in `backend`.

- **A deadline on every call**, derived from the caller's remaining budget and propagated downstream. No unbounded waits.
- **Retry only what is safe.** Idempotent operations, or operations carrying an idempotency key (pattern in `message-queues`, idempotency-patterns reference). Never blind-retry a non-idempotent write after a timeout: the first attempt may have succeeded.
- **Retry only transient failures.** Connection errors, timeouts, 408, 429 (honor `Retry-After`), 502/503/504. Most other 4xx are caller errors and are not retried.
- **Bounded attempts, exponential backoff with full jitter:** `delay = random(0, min(cap, base * 2^attempt))`. Cap the delay.
- **Budget retries and bound the total time.** Retry in one layer of a call chain, or cap retries to a fraction of requests; layered retries multiply load during an outage. Stop at the overall deadline, not only at the attempt count.
- **Do not retry through an open circuit breaker.**

Table and parameters: [patterns.md](references/patterns.md#retry-patterns).

## Circuit breakers, bulkheads, load shedding

- **Circuit breaker** — when a dependency is sustained-unhealthy, stop calling it (fail fast) until a probe says it's back. States and parameters in the patterns reference.
- **Bulkhead** — isolate resource pools per dependency / tenant / priority class. One failing neighbor doesn't exhaust the whole pool.
- **Load shedding** — when inbound rate exceeds capacity, reject lowest-priority traffic early (at the edge) rather than dying everywhere.

## Incident response

### Roles (even for a one-person incident, name the hats)

- **Incident Commander (IC)** — owns decisions. Doesn't type commands.
- **Ops lead** — executes the fix.
- **Comms lead** — updates the status page, internal channels, and customers.
- **Scribe** — keeps the timeline.

### Cadence

- **First 5 minutes:** confirm impact, page IC, start timeline.
- **Every 15 minutes:** status update (impact, current hypothesis, next action, ETA).
- **Mitigation before root cause.** Stop the bleeding first, understand later.
- **One change at a time.** Parallel changes destroy diagnosis.

### When to page (policy owner)

- Page on SLO burn rate: a fast burn over a long and a short window together (for example about 14x over 1 h and 5 min) and a slower burn over longer windows (for example about 6x over 6 h and 30 min) at lower urgency. Rule syntax: `observability`, alerting reference.
- Internal metrics and log lines that don't tie to a user experience do not page.
- Alerts that don't lead to action are deleted or downgraded.

## Postmortems

Blameless, factual, and actionable.

Structure:
1. **Summary** — one paragraph for humans scanning the list.
2. **Impact** — duration, what the user saw, affected population.
3. **Timeline** — timestamped events from trigger to resolution.
4. **Root cause** — technical + organizational factors (usually both).
5. **What went well / what went badly.**
6. **Action items** — owner, deadline, severity. Tracked to completion.

**"Human error" is never a root cause.** If a human action caused the outage, the system allowed that action too easily — that's the cause.

## Recovery

Backups, restore drills, RPO/RTO, and failover tiers: [recovery.md](references/recovery.md). Start from the requirement, not the tool:

```
How much data loss and downtime can the business accept?
├── RPO/RTO unknown → get them agreed first; everything else follows
├── RPO of minutes or less → continuous replication or point-in-time recovery
├── RTO of minutes → standby ready to serve (warm or active)
└── Hours or days acceptable → backup and restore, rehearsed
```

A backup that has never been restored is not a backup.

## Toil

Toil is manual, repetitive, automatable work with no lasting value that grows with the service. Keep it under about half of an operator's time and make it visible by tagging it. Automate when the cost of repeating it exceeds the cost of automating; decision tree and tracking in [patterns.md](references/patterns.md#toil-reduction-patterns).

## Chaos engineering

Inject controlled failure to verify the system degrades as designed (kill an instance, add latency, block a dependency). Start in staging; move to production only with visibility into blast radius and a kill switch. Experiment framework, catalog, and game-day checklist: [patterns.md](references/patterns.md#chaos-engineering-practices).

## Context adaptation

**As operator:** this is your home skill. SLOs define your budget; incident response is your job description.

**As architect:** NFR choices (availability, latency) become SLOs at runtime. Design for the SLO, not beyond it.

**As implementer:** graceful shutdown, health checks, timeouts are implementation concerns. Skipping them creates operational debt.

**As reviewer:** check for missing shutdown handlers, retries without deadlines or idempotency, liveness probes that call dependencies, paging alerts with no clear action, SLOs that measure the wrong thing, backups with no restore test.

## Anti-patterns

- **SLO that measures everything** — one giant SLO covering all endpoints. Impossible to act on.
- **Alert fatigue** — 50 alerts a day, half ignored. The real one gets missed.
- **Root cause = the last person who touched it.** Blame-driven postmortems kill psychological safety and learning.
- **Paging on causes, not SLO burn.** CPU high → page. But CPU doesn't hurt the user; latency does.
- **Retrying non-idempotent writes** or stacking retries in every layer of a call chain.
- **Readiness that fails when a shared dependency fails.** Every instance leaves rotation at once.
- **No kill switch for chaos.** Experiments that can't be stopped = outages.
- **Heroic recovery, no documentation** — the incident closes, nobody knows how. Next time takes the same hours.

## Related Knowledge

- `observability` — instrumentation details (metrics, tracing, logging)
- `performance` — when the SLO breach is a bottleneck
- `architecture` — SLOs are the runtime projection of architectural choices
- `release-engineering` — bad releases are a leading cause of incidents; rollout and rollback strategy
- `ci-cd` — rollback speed is a reliability lever
- `backend` — code form of probes, shutdown hooks, and client timeouts (startup/shutdown mechanics; this skill owns probe semantics and shutdown budgets)
- `message-queues` — idempotency pattern that makes retries safe
- `database` — backups, point-in-time recovery, schema migration
- `kubernetes` — probe and termination configuration

## References

- [patterns.md](references/patterns.md) — circuit breaker, retry parameters, chaos, toil, on-call, dependencies, anti-patterns
- [recovery.md](references/recovery.md) — RPO/RTO, backups, restore verification, failover tiers, drills
- [review-checklists.md](references/review-checklists.md) — operational readiness review checklists
