---
name: background-jobs
description: Design background job systems — queue selection, orchestration, scheduling, retry, scaling, observability. Use when implementing job queues, task scheduling, retry strategies, dead letter handling, or workflow orchestration. Do NOT use for message brokers (use message-queues) or real-time (use realtime).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Background Jobs — Queue, Scheduling & Orchestration

Every job MUST be idempotent, carry small payloads (IDs not blobs), have a timeout, and emit observable signals. These are non-negotiable.

---

## Architecture Decision Tree

```
Need background processing →
├── Single fire-and-forget task?
│   ├── Cloud-native serverless available? → Cloud task service + function runtime
│   └── Self-hosted? → Simple queue library (Redis-backed or broker-backed)
│
├── Multi-step with dependencies, compensation, or saga?
│   ├── Need durable execution with full control? → Workflow orchestrator (self-hosted or managed)
│   ├── Want serverless + minimal ops? → Serverless workflow engine
│   └── Cloud-native only? → Cloud step-function service
│
├── Long-running (hours/days) or human-in-the-loop?
│   └── Durable execution engine (workflow orchestrator)
│
├── Lightweight durability in existing app? (no separate infrastructure)
│   └── Embedded durable execution library (DB-backed)
│
└── Delivery semantics?
    ├── At-most-once acceptable? → Fire-and-forget, no retry
    ├── At-least-once (default) → Queue + idempotent workers
    └── Exactly-once needed? → Not achievable in distributed systems.
        Use at-least-once + idempotency keys instead.
```

### Three Architecture Categories

| Dimension | Simple Queue | Workflow Orchestrator | Cloud-Native |
|-----------|-------------|----------------------|--------------|
| **State** | Stateless jobs | Durable execution state | Managed by cloud |
| **Ops burden** | Redis/broker + workers | Orchestrator cluster or SaaS | Zero (serverless) |
| **Job duration** | Seconds to minutes | Minutes to days | Constrained by platform (often ≤15 min) |
| **DAGs/flows** | Library-level | Native | Platform-specific |
| **Best for** | Single-step async tasks | Multi-step business processes | Event-driven, bursty loads |
| **Cost model** | Infrastructure | Infrastructure or SaaS | Pay-per-invocation |

**Examples** (for reference, not recommendations): Simple queue — BullMQ, Celery, Sidekiq. Orchestrator — Temporal, Inngest, Restate, DBOS. Cloud-native — AWS SQS+Lambda, GCP Cloud Tasks, Azure Queue Storage+Functions.

---

## Delivery Semantics

Distributed queues provide **at-least-once** delivery. True exactly-once is impossible across network partitions. The correct pattern:

1. **At-least-once delivery** — the queue guarantees every message is delivered at least once
2. **Idempotent processing** — the worker guarantees running twice produces the same result
3. **Idempotency key** — unique identifier per job (e.g., `charge-order-123-v1`), checked before processing

Move non-idempotent side effects (emails, external API calls) to the end of the job, after database work. If the job fails before the side effect — nothing sent. If it fails after — the retry skips DB work and re-sends, which is typically acceptable.

---

## Job Lifecycle

```
Enqueue → Pending → Active → Completed
                      │
                      ├── Failed → Retry (backoff) → Active
                      │              └── Max retries exceeded → Dead Letter Queue
                      │
                      ├── Stalled (timeout) → Retry or DLQ
                      │
                      └── Poison pill (always fails) → DLQ immediately
```

**Poison pill detection:** If a job fails on every attempt with the same error, it is a poison pill. Route to DLQ without exhausting all retries. Track error signatures — if the error is identical across attempts, skip remaining retries.

---

## Retry Strategy Decision Tree

```
Job failed →
├── Transient error (network, timeout)?
│   └── Exponential backoff + jitter
│       delay = min(base * 2^attempt + random(0, jitter), maxDelay)
├── Rate limited (429)?
│   └── Retry after Retry-After header value
├── Bad input (validation error)?
│   └── Dead letter queue immediately — no retry
├── Upstream dependency down?
│   └── Circuit breaker → retry after cooldown
├── Same error on every attempt (poison pill)?
│   └── DLQ immediately, alert ops
└── Unknown error?
    └── Retry up to maxAttempts (3-5), then dead letter queue
```

---

## Scaling Patterns

| Pattern | When | How |
|---------|------|-----|
| **Horizontal workers** | Throughput bottleneck | Add worker processes/pods |
| **Concurrency tuning** | I/O-bound jobs | Increase per-worker concurrency |
| **Queue partitioning** | Mixed job types | Separate queues by priority/type |
| **Rate limiting** | External API constraints | Per-queue or per-group limiters |
| **Weighted fair scheduling** | Priority starvation | Process N high-priority, then 1 low |
| **Batch processing** | High-volume small jobs | Group items into batch jobs |
| **Autoscaling** | Variable load | Scale workers on queue depth metric |

**Priority levels:** Critical (1) → High (5) → Normal (10) → Low (20) → Bulk (50). Never starve lower queues entirely.

---

## Observability

**Essential metrics (instrument these first):**

| Metric | Alert When | Indicates |
|--------|-----------|-----------|
| Queue depth | Growing over time | Workers can't keep up |
| Processing latency (p95) | Exceeds SLA | Slow jobs or resource contention |
| Error rate | Spike above baseline | Systemic failure |
| Retry rate | >20% of total jobs | Transient errors or bad retry config |
| DLQ growth | Any growth | Permanent failures need investigation |
| Worker utilization | >90% sustained | Scale up needed |

**Tracing:** Propagate trace context (e.g., OpenTelemetry) through job metadata — serialize trace ID into the job payload at enqueue, extract at worker. This links async job spans to the originating request. Add business identifiers (user_id, order_id) as span attributes for correlation.

**Structured logging per job:** Emit `job.started`, `job.completed`, `job.failed` events with: job_id, job_type, duration_ms, attempt_number, queue_name, error_type (if failed).

**Graceful shutdown:** SIGTERM → stop accepting → finish current (with timeout < kill grace period) → flush metrics → exit 0.

---

## Job Versioning

When job handler logic changes while jobs are still in the queue:

1. **Additive changes** — add new fields with defaults, old jobs still process correctly
2. **Breaking changes** — deploy new handler version alongside old one; route by version field in job payload
3. **Schema migration** — include a `version` field in every job payload; handler switches on version

Never deploy a breaking handler change without draining the queue or supporting both versions.

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| No retry limits | Set maxAttempts (3-5), then DLQ |
| Synchronous job execution | Always process asynchronously in worker |
| Large payloads in job data | Store externally, pass reference ID |
| No dead letter handling | DLQ with alerting and manual retry UI |
| Queue as workflow engine | Use a durable execution engine for multi-step orchestration |
| Ignoring completion events | Emit events, update status, trigger downstream |
| DLQ as graveyard | Treat DLQ growth as an alert, investigate immediately |
| Assuming exactly-once delivery | Design for at-least-once + idempotency keys |
| Deploying breaking handler changes | Version job payloads, support old + new handlers |
| No poison pill detection | Track error signatures, fast-DLQ repeat failures |

---

## Context Adaptation

| Role | Relevant Aspects |
|------|-----------------|
| **Backend engineer** | Job design, retry config, idempotency, queue selection |
| **DevOps / SRE** | Worker scaling, autoscaling on queue depth, graceful shutdown, observability |
| **Architect** | Queue vs orchestrator decision, delivery semantics, saga patterns |
| **Frontend engineer** | Progress tracking via polling/SSE, job status endpoints |
| **Data engineer** | Batch processing, ETL job scheduling, backpressure |

---

## Related Knowledge

- **message-queues** skill — broker-level event streaming (Kafka, RabbitMQ, NATS, Redis Streams); use for pub/sub and event-driven architecture. Boundary: message-queues = transport layer, background-jobs = processing layer
- **realtime** skill — delivering job results or progress to clients via WebSocket/SSE
- **devops** skill — container orchestration, deployment of worker infrastructure
- **sre** skill — SLOs for job processing latency, error budgets, incident response
- **database** skill — job state persistence, idempotency key storage, transactional outbox pattern
- **observability** skill — metrics pipelines, distributed tracing, alerting rules

---

## References

- [queue-patterns.md](references/queue-patterns.md) — Framework-specific deep dive: BullMQ, Celery, Sidekiq, Temporal setup, retry, concurrency, monitoring
- [scheduling-patterns.md](references/scheduling-patterns.md) — Cron scheduling, delay queues, rate limiting, debounce/throttle, batch timing

Load references when you need framework-specific code or advanced scheduling patterns.
