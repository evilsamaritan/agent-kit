# SRE Review Checklists

Checklists for reviewing each reliability domain. Rules and rationale are in SKILL.md.

## Contents

- [Health Checks](#health-checks)
- [Graceful Shutdown](#graceful-shutdown)
- [Observability](#observability)
- [Error Handling and Resilience](#error-handling-and-resilience)
- [Configuration Management](#configuration-management)
- [SLOs and Alerting](#slos-and-alerting)
- [Incident Readiness](#incident-readiness)

---

## Health Checks

- [ ] Liveness check exists: "process is running and not deadlocked"
- [ ] Readiness check exists: can this instance serve now (warmed up, local resources ready); dependency checks only where deliberately chosen
- [ ] Startup probe exists for services with slow initialization
- [ ] Liveness checks the process only; no dependency calls
- [ ] Readiness reflects local ability to serve; critical dependencies are checked deliberately, with degraded behaviour defined
- [ ] A shared-dependency outage does not make every instance unready
- [ ] Probe endpoints are lightweight (no expensive queries)
- [ ] Probe detail (version, dependency status) is limited to internal callers
- [ ] Unready or restarting instances raise a symptom alert, not just a log line

## Graceful Shutdown

- [ ] SIGTERM handler registered in every service
- [ ] Readiness fails first and deregistration propagation is waited out before new work is refused
- [ ] New work intake then stopped (stop consuming, close listener)
- [ ] In-flight operations are drained before closing resources
- [ ] State is flushed (offsets committed, buffers flushed, DB writes completed)
- [ ] Resources are released (connections closed, pools drained, servers stopped)
- [ ] Shutdown has a timeout (don't hang forever waiting for drain)
- [ ] Exit code 0 on clean shutdown, non-zero on error or timeout
- [ ] Shutdown sequence is logged (which phase, what was abandoned if timed out)

## Observability

Review telemetry against `observability` (signals, correlation IDs, bounded metric labels, sampling, redaction). This skill only asks: can an on-call engineer answer "what is broken and for whom" from the SLIs?

---

## Error Handling and Resilience

- [ ] Errors classified: transient vs permanent
- [ ] Retries only on idempotent operations or those with an idempotency key
- [ ] Retries use exponential backoff with jitter, bounded attempts, and a budget or a single retry layer
- [ ] Deadlines propagate down the call chain
- [ ] Circuit breaker protects calls to unreliable dependencies
- [ ] Timeouts set on every external call (HTTP, DB, message queue, gRPC)
- [ ] Bulkheads isolate failure domains (one failing dependency doesn't cascade)
- [ ] Fallback behavior defined for degraded mode
- [ ] Unhandled exceptions caught at process level and trigger graceful shutdown
- [ ] Error context preserved through async boundaries
- [ ] Fatal errors trigger graceful shutdown (not abrupt process.exit or os.Exit)

## Configuration Management

- [ ] All config from environment variables or config files (not hardcoded)
- [ ] Config validated on startup (fail fast on bad config)
- [ ] Defaults are safe (no destructive operations, no production endpoints)
- [ ] No secrets in code, config files, or container images
- [ ] Configuration requirements documented (.env.example or equivalent)
- [ ] Feature flags exist for risky features (can disable without deploy)

## SLOs and Alerting

- [ ] SLIs defined for each user-facing service (latency, availability, correctness)
- [ ] SLO targets set with stakeholder agreement
- [ ] Error budget calculated and tracked
- [ ] Alerts based on SLO burn rate (not raw thresholds)
- [ ] Multi-window, multi-burn-rate alerts catch both fast and slow burns
- [ ] Alert severity maps to response urgency (page vs ticket vs log)
- [ ] Alerts are actionable (clear what to do, link to runbook)
- [ ] No alert fatigue (low noise, high signal)

## Incident Readiness

- [ ] Runbooks exist for common failure modes
- [ ] On-call rotation defined (if applicable)
- [ ] Escalation path documented
- [ ] Postmortem template exists
- [ ] Postmortem action items are tracked to completion
- [ ] Communication channels defined (where to post status updates)
- [ ] Rollback procedure documented and tested
- [ ] Game day exercises planned or conducted
- [ ] Backups restored successfully within the RTO, tested on a schedule (see recovery.md)
