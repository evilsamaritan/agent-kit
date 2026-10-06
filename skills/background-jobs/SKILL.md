---
name: background-jobs
description: "Design and operate background work. Use for task queues, scheduled and recurring jobs, delayed jobs, job retries and dead letters, workers, workflow orchestration, and job scaling. Do NOT use for broker topology or event streams to many subscribers (message-queues)."
---

# Background Jobs

Every job is idempotent, carries a small payload (ids, not blobs), has a timeout, and emits observable signals. Enqueue only after the transaction that creates the work commits — or enqueue through an outbox, or into a queue that lives in the same database transaction. A job enqueued inside an open transaction can run before the commit (and see nothing) or survive a rollback (and act on data that never existed).

Determine the job library and its version from the project before giving library-specific advice ([queue-patterns.md](references/queue-patterns.md)).

## Scope and boundaries

**Shared boundary with `message-queues`:** a command for one worker (task, schedule, workflow step) → `background-jobs`. A fact published to any number of subscribers (topic, stream, consumer group) → `message-queues`. Retry, dead-letter, and idempotency handling follow whichever of the two the work is.

| Question | Owner |
|---|---|
| Job design, queues, schedules, delays, worker concurrency, job dead letters, workflow orchestration | this skill |
| Which errors are retryable, backoff with jitter, retry budgets, deadlines | `reliability` |
| Idempotency pattern (claim first, keys from intent) | `message-queues` → [idempotency-patterns.md](../message-queues/references/idempotency-patterns.md) |
| Outbox, saga, process-manager, and CQRS design | `architecture` ([outbox](../architecture/references/integration-patterns.md#transactional-outbox), [saga](../architecture/references/integration-patterns.md#saga-and-process-manager), [CQRS](../architecture/references/integration-patterns.md#cqrs-separate-query-model)) |
| Inbound webhooks: signature verification and the sender contract | `api-design`; processing shape stays here (below) |
| Distributed locks (skip-if-running guards) | `caching` → [redis-patterns.md](../caching/references/redis-patterns.md#distributed-locking) |
| Process shutdown mechanics and probe semantics | `backend` (mechanics), `reliability` (policy) |

## Architecture decision tree

```
Need background processing →
├── Recurring or time-based (cron, nightly, "every 5 minutes")?
│   └── One scheduler that enqueues jobs (single instance or leader-elected) + normal workers
│       → scheduling-patterns.md
├── Delayed one-off ("send in 24 hours")?
│   └── Delayed job in the queue — check the backend's maximum delay and redelivery behavior
├── Single task, at least once?
│   ├── Low volume and enqueue must commit with business data → queue table in the primary database
│   ├── Already on a cloud platform, bursty load → managed queue + function runtime
│   └── Otherwise → queue library on a broker or Redis-compatible store
├── Multi-step with dependencies, compensation, waits of hours or days, human approval?
│   └── Durable workflow engine (self-hosted, managed, or a database-backed library)
└── Fan-out of one fact to many independent consumers?
    └── Not a job → message-queues
```

| Dimension | Queue library | Workflow engine | Managed cloud queue + functions |
|-----------|-------------|----------------------|--------------|
| **State** | Per job | Durable workflow history | Managed |
| **Ops burden** | Queue backend + workers | Engine cluster or service | Low |
| **Duration** | Seconds to minutes | Minutes to months | Bounded by the platform's execution limit |
| **Multi-step flows** | Library-level | Native, with retries per step | Platform-specific |
| **Best for** | Single-step async tasks | Business processes across services | Event-driven, bursty load |

Product examples per category: [queue-patterns.md](references/queue-patterns.md#product-examples).

## Delivery semantics

Queues deliver **at least once**. **Effectively-once** = at-least-once delivery + idempotent effects. Broker or queue "exactly-once" features cover only their own state; the guarantee ends at the first external side effect. `message-queues` uses the same statement.

1. **Idempotency key per job** derived from intent (`charge:order-123`), claimed before the work ([idempotency-patterns.md](../message-queues/references/idempotency-patterns.md)).
2. **Database effects** commit in the same transaction as the claim.
3. **External side effects** (payment, email, third-party API) get their own idempotency key passed to the provider, or are recorded as an outbox row in the same transaction as the state change and performed by a relay. Placing the side effect last only narrows the duplicate window; it does not close it.
4. **Explicit exception:** a duplicate is acceptable only where it is harmless (an idempotent notification, a cache refresh) — state that in the job's contract.

## Inbound webhook processing

Verify the signature, persist or enqueue the event, and return 2xx quickly; process from the queue. The job claims the provider's event id before the work (idempotent handler, as above), because providers redeliver. Reconciliation jobs that re-fetch state from the provider cover missed or out-of-order events. Signing and the sender contract: `api-design`; provider specifics: `payments`.

## Job lifecycle

```
Enqueue → Pending → Active → Completed
                      ├── Failed → classify → retryable → Retry (backoff) → Active
                      │                     └── non-retryable or budget spent → Dead letter
                      └── Stalled (timeout, worker lost) → Retry or dead letter
```

## Failure classification

Classify the error first, then count attempts:

```
Job failed →
├── Non-retryable (validation error, deserialization error, deterministic handler bug, 4xx other than 408/429)
│   └── Dead letter now; retrying cannot succeed
├── Rate limited (429) or timeout (408)
│   └── Retry after the server's Retry-After, or with backoff
├── Transient (connection reset, timeout, 502/503/504, lock conflict)
│   └── Retry with exponential backoff and jitter within a retry budget
├── Dependency down for everyone
│   └── Circuit breaker / pause the queue; do not dead-letter the backlog
└── Unknown
    └── Retry a few times, then dead letter
```

Identical errors repeated across attempts mark a poison job only when the class is non-retryable. Transient errors repeat identically during an outage; dead-lettering on a repeated signature would empty the whole queue into the dead-letter queue. Backoff formula, jitter, budgets, and deadlines: `reliability`.

## Scaling patterns

| Pattern | When | How |
|---------|------|-----|
| **Horizontal workers** | Throughput bottleneck | Add worker processes or pods |
| **Concurrency tuning** | I/O-bound jobs | Raise per-worker concurrency within downstream limits |
| **Queue partitioning** | Mixed job types or priorities | Separate queues by priority or type |
| **Rate limiting** | External API quotas | Per-queue or per-tenant limiter ([scheduling-patterns.md](references/scheduling-patterns.md#rate-limited-processing)) |
| **Weighted fair scheduling** | Priority starvation | Weighted queue polling |
| **Batching** | Many small items | Group items into batch jobs |
| **Autoscaling** | Variable load | Scale on queue depth and age of the oldest job |

Never starve lower-priority queues entirely.

## Observability

| Metric | Alert When | Indicates |
|--------|-----------|-----------|
| Queue depth and oldest-job age | Growing | Workers cannot keep up |
| Processing latency (p95) | Exceeds the job's objective | Slow jobs or contention |
| Failure and retry rate | Above baseline | Systemic failure or bad retry config |
| Dead-letter growth | Any | Failures needing investigation |
| Worker utilization | Sustained near saturation | Scale needed |

Propagate trace context through job metadata at enqueue and restore it in the worker; log `job.started`, `job.completed`, `job.failed` with job id, type, attempt, duration, and error class.

**Shutdown:** on termination, stop taking new jobs, let running jobs finish within a timeout shorter than the platform's kill grace period, then exit; jobs cut off mid-run must be safe to retry. Mechanics: `backend`.

## Job versioning

1. **Additive changes** — new payload fields with defaults; old jobs still run.
2. **Breaking changes** — a `version` field in every payload; deploy a handler that accepts old and new versions before producers emit the new one.
3. Never deploy a breaking handler change while old jobs are queued without supporting both.

## Context Adaptation

- **Monolith with one database** — a database-backed queue gives transactional enqueue with no new infrastructure.
- **Serverless workers** — execution limits cap job length; split long work or use a workflow engine.
- **Long-lived workers** — graceful shutdown and stalled-job recovery matter; set visibility or lock timeouts above the longest job.
- **Multi-tenant** — per-tenant rate limits or queues so one tenant cannot starve others.
- **User-visible progress** — store job status and expose it by polling or push (`realtime`).

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Enqueue inside an open transaction | Enqueue after commit, via outbox, or into a same-database queue |
| No retry limit | Retry budget, then dead letter |
| Dead-lettering on repeated identical errors without classifying | Classify first; pause or break the circuit for outages |
| Large payloads in job data | Store externally, pass the reference |
| Side effect without its own idempotency key | Provider idempotency key or outbox |
| Dead-letter queue as a graveyard | Alert on growth, investigate, replay after fixing |
| Queue as workflow engine | Durable workflow engine for multi-step processes |
| Two schedulers firing the same cron | One scheduler or leader election, plus skip-if-running |
| Breaking handler change with jobs queued | Versioned payloads, handler accepts both |

## Related Knowledge

- **message-queues** — event streams and broker topology (shared boundary above); idempotency pattern owner
- **reliability** — retry policy, backoff, budgets, circuit breakers, job SLOs
- **architecture** — outbox, saga, and CQRS design
- **database** — queue tables, idempotency tables, transactional enqueue
- **api-design**, **payments** — webhook contracts and provider specifics
- **kubernetes**, **docker** — running and scaling worker deployments
- **observability** — job metrics, tracing, alerting
- **realtime** — pushing job progress to clients

## References

- [queue-patterns.md](references/queue-patterns.md) — product examples; BullMQ, Celery, Sidekiq, Temporal setup, retries, concurrency, flows, monitoring
- [scheduling-patterns.md](references/scheduling-patterns.md) — cron, delayed jobs, rate limiting, debounce and throttle, batch timing, cloud-native scheduling
