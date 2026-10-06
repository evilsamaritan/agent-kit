# Scheduling Patterns — Timing, Flow Control & Batch Strategies

## Contents

- [Cron Scheduling](#cron-scheduling) — Expression reference, framework implementations, pitfalls
- [Delay Queues](#delay-queues) — Future execution, cancellable delays
- [Rate-Limited Processing](#rate-limited-processing) — Rate limit vs throttle vs debounce decision
- [Debounce and Throttle Patterns](#debounce-and-throttle-patterns) — Collapse rapid triggers, steady processing
- [Batch Timing Patterns](#batch-timing-patterns) — Time-based batching, managed-queue batch windows
- [Cloud-Native Scheduling](#cloud-native-scheduling) — AWS EventBridge Scheduler + SQS + Lambda, GCP Cloud Scheduler + Cloud Tasks

---

## Cron Scheduling

### Cron Expression Reference

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0 and 7 = Sunday)
* * * * *
```

| Expression | Schedule |
|-----------|----------|
| `0 9 * * *` | Daily at 9:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 * * 1` | Weekly on Monday at midnight |
| `0 0 1 * *` | First day of every month |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |

### Framework Implementations

**BullMQ — Job Schedulers**

```typescript
await queue.upsertJobScheduler('daily-report', {
  pattern: '0 9 * * *', tz: 'America/New_York',
}, { name: 'generate-report', data: { type: 'daily-summary' } });

// Fixed interval
await queue.upsertJobScheduler('health-check', { every: 300_000 }, {
  name: 'health-check', data: {},
});
```

**Celery — Beat Scheduler**

```python
from datetime import timedelta
from celery.schedules import crontab

app.conf.beat_schedule = {
    'daily-report': {
        'task': 'tasks.generate_report',
        'schedule': crontab(hour=9, minute=0),
        'args': ('daily-summary',),
    },
    'cleanup': {
        'task': 'tasks.cleanup',
        'schedule': timedelta(hours=1),
    },
}
# Run: celery -A myapp beat  (IMPORTANT: only ONE beat instance)
```

**Sidekiq — sidekiq-cron**

```ruby
Sidekiq::Cron::Job.load_from_hash(
  'daily_report' => { 'cron' => '0 9 * * *', 'class' => 'DailyReportWorker' },
  'cleanup'      => { 'cron' => '0 */1 * * *', 'class' => 'CleanupWorker' }
)
```

### Cron Pitfalls

| Pitfall | Solution |
|---------|----------|
| Duplicate execution (multiple scheduler instances) | One scheduler process, or leader election; workers can scale freely |
| Missed execution (deploy/restart) | Persist last-run timestamp, catch up on start |
| Timezone drift | Always specify timezone explicitly |
| Overlapping runs (slow job, fast cron) | Skip-if-running guard or distributed lock |
| No visibility | Log every trigger, alert on missed runs |

**Skip-if-running guard:** take the canonical lock from `caching` ([redis-patterns.md](../../caching/references/redis-patterns.md#distributed-locking)) — random token, TTL above the job's maximum runtime, owner-checked release. A plain `DEL` in `finally` deletes another run's lock if this run outlived its TTL.

```python
@app.task
def daily_report():
    token = acquire_lock(redis_client, "lock:daily-report", ttl=3600)
    if token is None:
        return "skipped: already running"
    try:
        do_report()
    finally:
        release_lock(redis_client, "lock:daily-report", token)
```

---

## Delay Queues

Schedule jobs for future execution (one-time, not recurring).

| Use Case | Delay | Example |
|----------|-------|---------|
| Retry after failure | Exponential | 1s, 2s, 4s, 8s, 16s |
| Send reminder | Fixed | 24 hours after signup |
| Scheduled delivery | Absolute | "Send at 2 PM user's time" |
| Cooling off period | Fixed | 30 min before processing cancellation |
| SLA escalation | Fixed | Escalate if no response in 4 hours |

### Framework Implementations

```typescript
// BullMQ — delay in milliseconds
await queue.add('reminder', { userId: '123' }, { delay: 86_400_000 });

// Delay until specific timestamp
await queue.add('email', data, { delay: targetDate.getTime() - Date.now() });
```

```python
# Celery — countdown (seconds) or eta (timezone-aware datetime)
from datetime import datetime, timedelta, timezone

send_reminder.apply_async(args=[user_id], countdown=3600)
send_reminder.apply_async(args=[user_id], eta=datetime.now(timezone.utc) + timedelta(hours=1))
```

**Long delays with a Redis or SQS broker:** the worker holds an ETA task unacknowledged until it is due, and the broker redelivers any task unacknowledged past its visibility timeout (Redis transport default: one hour). A 24-hour countdown is then redelivered and run repeatedly. Either raise `broker_transport_options={'visibility_timeout': ...}` above the longest ETA and task runtime, or keep long delays out of the broker: store a `run_at` row in the database and let a periodic scheduler enqueue due jobs (or use a broker with native delayed delivery).

```ruby
# Sidekiq (scheduled set in Redis; no visibility-timeout issue)
ReminderJob.perform_in(24.hours, user_id)
ReminderJob.perform_at(24.hours.from_now, user_id)
```

### Cancellable Delays

```typescript
// BullMQ — use a known job ID so it can be removed later
await queue.add('reminder', { userId }, { delay: 86400000, jobId: `reminder-${userId}` });
const job = await queue.getJob(`reminder-${userId}`);
if (job) await job.remove();
```

```python
# Celery — revoke by task ID
result = send_reminder.apply_async(args=[user_id], countdown=86400)
# Later: app.control.revoke(result.id, terminate=False)
```

---

## Rate-Limited Processing

### Decision: Rate Limit vs Throttle vs Debounce

```
Incoming events/jobs →
├── Too many calls to external API?
│   └── Rate limit: cap at N per window, reject/queue excess
├── Bursty events that should process at steady pace?
│   └── Throttle: buffer and drain at fixed frequency
└── Rapid duplicate triggers for same entity?
    └── Debounce: wait for quiet period, process only latest
```

### Rate Limiting by Framework

```typescript
// BullMQ — worker-level
new Worker('api-calls', processor, {
  connection, limiter: { max: 100, duration: 60_000 },  // 100/min
});

// Per-tenant limits: BullMQ groups are a BullMQ Pro (paid) feature — jobs carry
// `group: { id: tenantId }` and the Pro worker sets `group: { limit: { max, duration } }`.
// Open-source alternatives: one queue per tenant class, each with its own limiter,
// or a shared token-bucket limiter checked inside the processor.
```

```python
# Celery — task-level (per worker; route to single queue for global limit)
@app.task(rate_limit='100/m')
def call_external_api(endpoint, payload):
    return requests.post(endpoint, json=payload).json()
```

```ruby
# Sidekiq Enterprise (paid) — concurrent rate limiter shared across all processes
API_LIMIT = Sidekiq::Limiter.concurrent('external-api', 10)
class ApiCallJob
  include Sidekiq::Job
  def perform(endpoint)
    API_LIMIT.within_limit { call_api(endpoint) }
  end
end
```

---

## Debounce and Throttle Patterns

### Debounce: Collapse Rapid Triggers

Process only once after a quiet period. Use when only the final state matters.

```
Events:  ─A──A──A──────A──A────────→
Debounce (2s):                     ─A→  (fires after 2s quiet)
```

**BullMQ — built-in deduplication in debounce mode:**

```typescript
await queue.add('reindex', data, {
  delay: 5000,
  deduplication: { id: `reindex-${entityId}`, ttl: 5000, extend: true, replace: true },
});
```

**Portable pattern (libraries without deduplication) — stamp a revision, check it when the job runs:**

Look-up-then-remove-then-add sequences (or revoke-then-reschedule) are not atomic: two concurrent triggers both see no pending job, and the queue keeps the older one. Make the newest trigger win at execution time instead. An atomic counter stamps each trigger; every delayed job carries its stamp; a job whose stamp is no longer the latest exits.

```typescript
async function debounceJob(queue: Queue, entityId: string, delayMs: number) {
  const revision = await redis.incr(`debounce:reindex:${entityId}`);   // atomic, newest wins
  await queue.add('reindex', { entityId, revision }, { delay: delayMs });
}

async function reindexWorker(job: Job<{ entityId: string; revision: number }>) {
  const latest = Number(await redis.get(`debounce:reindex:${job.data.entityId}`));
  if (job.data.revision !== latest) return;                            // a newer trigger owns the work
  await reindex(job.data.entityId);
}
```

The same shape works in Celery or any queue: `INCR` (or a version column updated in the same transaction as the change) when triggering, `apply_async(args=[doc_id, revision], countdown=delay)`, and an early return in the task when the revision is stale. Stale jobs still run briefly; cancelling them is an optimization, not the correctness mechanism.

### Throttle: Steady Processing Rate

Process at a fixed max frequency, buffering excess. Every event is processed.

```
Events:  ─A─B─C─D─E─F─G──────→
Throttle (1/s): ─A──B──C──D──E──F──G→
```

```typescript
// Throttle = queue (buffer) + rate-limited worker (steady drain)
new Worker('notifications', sendNotification, {
  connection, concurrency: 1, limiter: { max: 1, duration: 1000 },
});
```

### Quick Comparison

| Need | Pattern | Example |
|------|---------|---------|
| Only final state matters | Debounce | Reindex after edits |
| Every event, controlled rate | Throttle | External API calls |
| First event, skip repeats | Rate limit | Login attempts |
| Aggregate then process | Batch + delay | Analytics events |

---

## Batch Timing Patterns

### Time-Based Batching

Collect items over a time window, then process as a group. Two triggers to flush: max batch size reached, or max wait time elapsed. Implement with a buffer + timer in the worker process, or use framework-native batching.

### Managed-Queue Batch Windows

Managed queues with function triggers can deliver messages in batches (a maximum batch size plus a batching window). Report per-item failures so only failed items return to the queue instead of the whole batch. For library batches with a completion callback (for example Sidekiq Pro batches), see [queue-patterns.md](queue-patterns.md#batches-sidekiq-pro-paid-tier).

---

## Cloud-Native Scheduling

### AWS: EventBridge Scheduler + SQS + Lambda

```
EventBridge Scheduler (cron, rate, or one-time) → SQS → Lambda
                                                    ├── Success → message deleted
                                                    └── Failure → retry after visibility timeout → DLQ (redrive policy)
```

- EventBridge Scheduler: cron and rate expressions with time zones, one-time schedules
- SQS: per-message delay up to 15 minutes, visibility timeout, redrive to a dead-letter queue
- Lambda: execution time limit (15 minutes for a standard function; a Lambda Managed Instances function can run asynchronous and event-source invocations up to 90 minutes), batch windows for SQS triggers

### GCP: Cloud Scheduler + Cloud Tasks

```
Cloud Scheduler (cron) → Cloud Tasks → HTTP target (Cloud Run / functions)
                                         ├── 2xx → complete
                                         └── non-2xx or timeout → retry with backoff
```

- Cloud Scheduler: cron with time zone; HTTP or Pub/Sub targets
- Cloud Tasks: per-queue rate limits and retry config; a task can be scheduled up to 30 days ahead; the dispatch deadline for HTTP targets is bounded (set it per queue or task and keep it above the handler's runtime) — work that outlasts it needs a job runner or workflow engine
