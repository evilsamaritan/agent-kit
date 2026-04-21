# SRE Review Checklists

Detailed checklists for Phase 2 analysis. Use these to systematically evaluate each reliability domain.

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
- [ ] Readiness check exists: "can accept work" (dependencies connected, warmed up)
- [ ] Startup probe exists for services with slow initialization
- [ ] Health check endpoints are lightweight (no expensive queries or external calls)
- [ ] Health checks reflect actual dependency state (not just returning 200)
- [ ] Unhealthy state triggers an alert, not just a log line
- [ ] Health checks are used by orchestrator/load balancer for routing decisions
- [ ] Health check responses include version, uptime, and dependency status

## Graceful Shutdown

- [ ] SIGTERM handler registered in every service
- [ ] New work intake stopped first (deregister from LB, stop consuming, reject requests)
- [ ] In-flight operations are drained before closing resources
- [ ] State is flushed (offsets committed, buffers flushed, DB writes completed)
- [ ] Resources are released (connections closed, pools drained, servers stopped)
- [ ] Shutdown has a timeout (don't hang forever waiting for drain)
- [ ] Exit code 0 on clean shutdown, non-zero on error or timeout
- [ ] Shutdown sequence is logged (which phase, what was abandoned if timed out)

## Observability

**Structured Logging**
- [ ] All logs are structured (JSON in production)
- [ ] Every log entry has: timestamp, level, service name, message
- [ ] Correlation IDs thread through request lifecycle
- [ ] No sensitive data in logs (API keys, secrets, PII, credentials)
- [ ] Log levels are appropriate (not everything is INFO or DEBUG)
- [ ] Errors include stack trace and context (what was the operation, what were the inputs)
- [ ] Human-readable format available for local development

**Metrics**
- [ ] Golden signals instrumented: latency, traffic, errors, saturation
- [ ] Application-specific metrics defined (business KPIs)
- [ ] Metric labels/dimensions are bounded (no unbounded cardinality from user IDs or URLs)
- [ ] Histograms used for latency (not averages)
- [ ] Resource metrics collected: CPU, memory, disk, network, connection pool usage

**Distributed Tracing**
- [ ] Trace context propagated across service boundaries
- [ ] Spans created for significant operations (DB queries, external calls, message processing)
- [ ] Span attributes include relevant context (operation type, result, error info)
- [ ] Sampling strategy defined (100% for errors, percentage for normal traffic)
- [ ] Trace IDs correlate with log entries

## Error Handling and Resilience

- [ ] Errors classified: retryable vs fatal
- [ ] Retries use exponential backoff with jitter
- [ ] Retry count is bounded (max attempts)
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
- [ ] Multi-window alerts to catch both fast burns and slow burns
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
