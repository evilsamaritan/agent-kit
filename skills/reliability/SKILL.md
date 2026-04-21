---
name: reliability
description: Site reliability patterns — SLOs, SLIs, error budgets, health checks, graceful shutdown, circuit breakers, chaos engineering, incident response, postmortems, toil reduction, on-call practices. Use when defining SLOs, designing health probes, reviewing shutdown behavior, writing runbooks, running an incident, or reducing toil. Do NOT use for CI/CD (use ci-cd), observability instrumentation (use observability), or performance profiling (use performance).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# Reliability

SRE patterns for keeping production healthy — SLOs, incident response, graceful degradation, toil reduction. This skill is about **what to measure and how to respond**; instrumentation details (OTel, metrics pipelines) live in `observability`.

## Scope and boundaries

**This skill covers:**
- SLO / SLI / error budget design and lifecycle
- Health vs readiness vs startup probes
- Graceful shutdown and in-flight work preservation
- Circuit breakers, bulkheads, load shedding
- Timeout / retry / jitter policies (operational angle)
- Incident response — roles, cadence, comms, timeline
- Blameless postmortems — structure, action items, follow-up
- On-call hygiene — rotations, handoffs, alert quality
- Toil definition and reduction
- Chaos engineering — intentional failure injection

**This skill does not cover:**
- Metrics / tracing / log instrumentation → `observability`
- Bottleneck profiling → `performance`
- CI/CD pipelines → `ci-cd`
- Release strategy → `release-engineering`
- Container orchestration → `kubernetes`

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

Three probes, three purposes:

| probe | answer | action on failure |
|-------|--------|-------------------|
| startup | "has the process finished booting?" | keep waiting (don't kill) |
| readiness | "can this instance serve traffic right now?" | remove from load balancer; keep process alive |
| liveness | "is this process hung?" | restart the process |

Common mistakes:
- Using liveness as readiness → traffic drops, restart storm.
- Readiness checks that don't check dependencies → sending traffic to a node with a broken DB connection.
- Liveness checks that ping an internal endpoint the same process serves → flapping.

## Graceful shutdown

On SIGTERM:

1. **Stop accepting new connections** (remove from LB, close listener).
2. **Let in-flight requests drain** (with a deadline).
3. **Flush buffers** — logs, metrics, write queues.
4. **Close outbound connections** (DB pools, queue clients).
5. **Exit** within the kill timeout.

If any step can't complete within budget, log loudly and exit anyway. Hanging is worse than incomplete shutdown.

## Circuit breakers, bulkheads, load shedding

- **Circuit breaker** — when a dependency is sustained-unhealthy, stop calling it (fail fast) until a probe says it's back.
- **Bulkhead** — isolate resource pools per dependency / tenant / priority class. One failing neighbor doesn't exhaust the whole pool.
- **Load shedding** — when inbound rate exceeds capacity, reject lowest-priority traffic early (at the edge) rather than dying everywhere.

## Incident response

### Roles (even for a one-person incident, name the hats)

- **Incident Commander (IC)** — owns decisions. Doesn't type commands.
- **Ops lead** — executes the fix.
- **Comms lead** — updates status page, Slack, customers.
- **Scribe** — keeps the timeline.

### Cadence

- **First 5 minutes:** confirm impact, page IC, start timeline.
- **Every 15 minutes:** status update (impact, current hypothesis, next action, ETA).
- **Mitigation before root cause.** Stop the bleeding first, understand later.
- **One change at a time.** Parallel changes destroy diagnosis.

### When to page

- Customer-visible breach of an SLO's burn rate is paging-worthy.
- Internal metrics that don't tie to a user experience should not page.
- Alerts that don't lead to action should be deleted or downgraded.

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

## Toil

Toil = manual, repetitive, automatable, low-value work. Characteristics: **no lasting value** + **scales linearly with service growth**.

Rules:
- Budget: SRE time spent on toil < 50%. More than that and reliability work starves.
- Automate on the third occurrence. Less than that, it might not be toil.
- Document even the toil — tribal knowledge is worse than toil.

## Chaos engineering

Run controlled failures **in production** (or a prod-like env) to verify the system handles them:

- Kill a random pod — does traffic reroute?
- Inject latency into a dependency — does the circuit breaker open?
- Drop 10% of packets — does retry logic behave?

Start in staging, move to prod only when:
- You have real-time visibility into blast radius.
- You have a kill switch.
- You run during business hours (not 2am).

## Context adaptation

**As operator:** this is your home skill. SLOs define your budget; incident response is your job description.

**As architect:** NFR choices (availability, latency) become SLOs at runtime. Design for the SLO, not beyond it.

**As implementer:** graceful shutdown, health checks, timeouts are implementation concerns. Skipping them creates operational debt.

**As reviewer:** check for missing shutdown handlers, unbounded retries, paging alerts with no clear action, SLOs that measure the wrong thing.

## Anti-patterns

- **SLO that measures everything** — one giant SLO covering all endpoints. Impossible to act on.
- **Alert fatigue** — 50 alerts a day, half ignored. The real one gets missed.
- **Root cause = the last person who touched it.** Blame-driven postmortems kill psychological safety and learning.
- **Paging on symptoms, not SLO burn.** CPU high → page. But CPU doesn't hurt the user; latency does.
- **No kill switch for chaos.** Experiments that can't be stopped = outages.
- **Heroic recovery, no documentation** — the incident closes, nobody knows how. Next time takes the same hours.

## Related Knowledge

- `observability` — instrumentation details (metrics, tracing, logging)
- `performance` — when the SLO breach is a bottleneck
- `architecture` — SLOs are the runtime projection of architectural choices
- `release-engineering` — bad releases are the #1 cause of incidents
- `ci-cd` — rollback speed is a reliability lever

## References

- [patterns.md](references/patterns.md) — reliability patterns with tradeoffs
- [review-checklists.md](references/review-checklists.md) — operational readiness review checklists
