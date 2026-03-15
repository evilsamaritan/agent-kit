# Scheduling Patterns — Timing, Flow Control & Batch Strategies

## Contents

- [Cron Scheduling](#cron-scheduling) — Expression reference, framework implementations, pitfalls
- [Delay Queues](#delay-queues) — Future execution, cancellable delays
- [Rate-Limited Processing](#rate-limited-processing) — Rate limit vs throttle vs debounce decision
- [Debounce and Throttle Patterns](#debounce-and-throttle-patterns) — Collapse rapid triggers, steady processing
- [Batch Timing Patterns](#batch-timing-patterns) — Time-based batching, SQS/Lambda, Sidekiq Pro
- [Cloud-Native Scheduling](#cloud-native-scheduling) — AWS EventBridge+SQS+Lambda, GCP Cloud Scheduler+Tasks

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

**BullMQ — Job Schedulers (v5+)**

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
| Duplicate execution (multiple instances) | Leader election or single-scheduler deployment |
| Missed execution (deploy/restart) | Persist last-run timestamp, catch up on start |
| Timezone drift | Always specify timezone explicitly |
| Overlapping runs (slow job, fast cron) | Skip-if-running guard or distributed lock |
| No visibility | Log every trigger, alert on missed runs |

**Skip-if-running guard (Celery example):**

```python
@app.task
def daily_report():
    r = redis.Redis()
    if not r.set('lock:daily-report', 'locked', nx=True, ex=3600):
        return 'Skipped — already running'
    try:
        do_report()
    finally:
        r.delete('lock:daily-report')
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
# Celery — countdown (seconds) or eta (datetime)
send_reminder.apply_async(args=[user_id], countdown=86400)
send_reminder.apply_async(args=[user_id], eta=datetime.utcnow() + timedelta(hours=24))
```

```ruby
# Sidekiq
ReminderWorker.perform_in(24.hours, user_id)
ReminderWorker.perform_at(Time.now + 24.hours, user_id)
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

// BullMQ — per-group (multi-tenant)
await queue.add('api-call', data, {
  group: { id: tenantId, limit: { max: 10, duration: 1000 } },
});
```

```python
# Celery — task-level (per worker; route to single queue for global limit)
@app.task(rate_limit='100/m')
def call_external_api(endpoint, payload):
    return requests.post(endpoint, json=payload).json()
```

```ruby
# Sidekiq Enterprise — concurrent rate limiter (shared across all processes)
API_LIMIT = Sidekiq::Limiter.concurrent('external-api', 10)
class ApiCallWorker
  include Sidekiq::Worker
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

**BullMQ debounce — remove-and-re-add with delay:**

```typescript
async function debounceJob(queue: Queue, entityId: string, data: object, delayMs: number) {
  const jobId = `reindex-${entityId}`;
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === 'delayed' || state === 'waiting') await existing.remove();
  }
  await queue.add('reindex', data, { jobId, delay: delayMs });
}
```

**Celery debounce — revoke-and-reschedule:**

```python
def debounced_reindex(doc_id, delay=5):
    task_key = f'debounce:task:{doc_id}'
    prev = redis_client.get(task_key)
    if prev:
        app.control.revoke(prev.decode(), terminate=False)
    result = reindex_document.apply_async(args=[doc_id], countdown=delay)
    redis_client.set(task_key, result.id, ex=delay + 10)
```

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

### SQS + Lambda Native Batching

```
BatchSize: 1-10000 messages per invocation
MaximumBatchingWindowInSeconds: 0-300
Partial batch response: report individual item failures (others return to queue)
```

### Sidekiq Pro Batches

```ruby
batch = Sidekiq::Batch.new
batch.on(:success, BatchCallback, 'report_id' => report.id)
batch.jobs do
  chunks.each { |chunk| ProcessChunk.perform_async(chunk.id) }
end
# Callback fires when ALL jobs in batch complete
```

---

## Cloud-Native Scheduling

### AWS: EventBridge Scheduler + SQS + Lambda

```
EventBridge rule (cron/rate) → SQS → Lambda
                                       ├── Success → delete message
                                       └── Failure → retry → DLQ
```

- EventBridge Scheduler: cron/rate expressions, one-time schedules, timezone support
- SQS: built-in delay (0-15 min), visibility timeout, redrive to DLQ
- Lambda: max 15 min execution, batch window up to 5 min

### GCP: Cloud Scheduler + Cloud Tasks

```
Cloud Scheduler (cron) → Cloud Tasks → HTTP target (Cloud Run/Function)
                                         ├── 2xx → complete
                                         └── Non-2xx → retry (exponential backoff)
```

- Cloud Scheduler: cron with timezone, Pub/Sub or HTTP targets
- Cloud Tasks: rate limiting, retry config, dispatch deadlines up to 30 days
- Task delay: schedule up to 30 days in the future
