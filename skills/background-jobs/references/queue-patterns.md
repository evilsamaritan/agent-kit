# Queue Patterns — Framework-Specific Deep Dive

Library setup, retries, concurrency, and monitoring. Rate limiting, debounce, and delays live in [scheduling-patterns.md](scheduling-patterns.md). Check the library version in the project; APIs and editions (open source vs paid tiers) change.

## Contents

- [Product Examples](#product-examples)
- [BullMQ (Node.js/TypeScript)](#bullmq-nodejstypescript) — Setup, retry, concurrency, rate limiting, flows, monitoring
- [Celery (Python)](#celery-python) — Setup, retry, concurrency, canvas (chains/groups), monitoring
- [Sidekiq (Ruby)](#sidekiq-ruby) — Setup, concurrency, batches, monitoring
- [Temporal (Polyglot)](#temporal-polyglot-workflow-orchestration) — When to use, workflow/activity pattern, saga, monitoring
- [Job Design Patterns](#job-design-patterns-framework-agnostic) — Idempotency, DLQ handling, batch processing, graceful shutdown

---

## Product Examples

Examples, not recommendations; verify maintenance status and license.

| Category | Examples |
|---|---|
| Queue library | BullMQ (Node.js, Redis), Celery (Python), Sidekiq (Ruby), RQ / Dramatiq (Python), Oban (Elixir, PostgreSQL), River (Go, PostgreSQL), Hangfire (.NET) |
| Database-backed queue | Oban, River, Solid Queue, pg-boss, Graphile Worker — jobs in the primary database, enqueued in the business transaction |
| Durable workflow engine | Temporal, Restate, Inngest, DBOS, cloud step-function services |
| Managed cloud queue + functions | Amazon SQS + Lambda, Google Cloud Tasks + Cloud Run, Azure Queue Storage or Service Bus + Functions |

---

## BullMQ (Node.js/TypeScript)

**Backend:** Redis | **Concurrency model:** Event loop + worker threads/child processes

### Setup

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';

const connection = { host: 'localhost', port: 6379 };

// Producer
const emailQueue = new Queue('email', { connection });

// Consumer
const worker = new Worker('email', async (job) => {
  await sendEmail(job.data.to, job.data.template);
  return { sent: true };
}, {
  connection,
  concurrency: 5,
  limiter: { max: 100, duration: 60_000 }, // 100 jobs/min
});

// Events
const events = new QueueEvents('email', { connection });
events.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed`, returnvalue);
});
```

### Retry Configuration

```typescript
// Exponential backoff (built-in)
await emailQueue.add('send', { to: 'user@example.com' }, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 }, // 1s, 2s, 4s, 8s, 16s
  removeOnComplete: { age: 86400 },  // keep 24h
  removeOnFail: { age: 604800 },     // keep 7d
});

// Custom full-jitter backoff: delay = random(0, min(cap, base * 2^attempt)); policy in `reliability`
const worker = new Worker('email', processor, {
  connection,
  settings: {
    backoffStrategy: (attemptsMade) => {
      const base = 1000;
      const maxDelay = 30_000;
      return Math.random() * Math.min(maxDelay, base * Math.pow(2, attemptsMade));
    },
  },
});
```

### Concurrency

```typescript
const worker = new Worker('tasks', processor, {
  connection,
  concurrency: 10,                          // concurrent jobs per worker process
  limiter: { max: 50, duration: 60_000 },   // queue-wide rate limit, shared by all workers
});
```

Per-tenant limits: [scheduling-patterns.md](scheduling-patterns.md#rate-limited-processing).

### Job Flows (DAGs)

```typescript
import { FlowProducer } from 'bullmq';
const flow = new FlowProducer({ connection });

await flow.add({
  name: 'process-order',
  queueName: 'orders',
  data: { orderId: '123' },
  children: [
    { name: 'charge-payment', queueName: 'payments', data: { orderId: '123' } },   // ids, not amounts
    { name: 'reserve-inventory', queueName: 'inventory', data: { orderId: '123', items: ['SKU-001'] } },
  ],
});
// Parent runs only after ALL children complete
```

### Sandboxed Processor

Pass a file path to Worker instead of an inline function to run in a child process: `new Worker('reports', './processor.ts', { useWorkerThreads: true })`. Use `job.updateProgress(n)` inside the processor and `QueueEvents.on('progress', ...)` client-side.

### Monitoring

BullMQ exposes job counts, queue metrics, and events programmatically:

```typescript
const counts = await queue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed');
// { active: 3, waiting: 12, completed: 450, failed: 2, delayed: 5 }

// Bull Board (web UI) or custom Prometheus exporter
// Key metrics: queue depth, processing time, error rate, worker utilization
```

**Dashboard options:** Bull Board (OSS), Arena, Taskforce.sh (commercial)

---

## Celery (Python)

**Backend:** Redis or RabbitMQ (broker) + Redis/DB (result backend) | **Concurrency model:** Prefork (multiprocess), gevent, or eventlet

### Setup

```python
from celery import Celery

app = Celery('myapp', broker='redis://localhost:6379/0',
             backend='redis://localhost:6379/1')

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    task_acks_late=True,             # ack after completion (at-least-once)
    worker_prefetch_multiplier=1,    # fair scheduling
    task_reject_on_worker_lost=True, # re-queue if worker dies mid-task
    # Redis/SQS brokers: an unacked task is redelivered after the visibility timeout
    # (Redis default 1 hour). Keep it above the longest task runtime and the longest ETA/countdown.
    broker_transport_options={'visibility_timeout': 6 * 3600},
)

@app.task(bind=True, max_retries=5, default_retry_delay=60)
def send_email(self, to, template):
    try:
        do_send(to, template)
    except TransientError as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

### Retry Configuration

```python
# Per-task retry with exponential backoff
@app.task(bind=True, max_retries=5, autoretry_for=(TransientError,),
          retry_backoff=True, retry_backoff_max=600, retry_jitter=True)
def call_api(self, endpoint, payload, idempotency_key):
    # Retries are safe only because the key, derived from the job's intent, makes the call idempotent.
    return requests.post(endpoint, json=payload, headers={"Idempotency-Key": idempotency_key}, timeout=10).json()

# Manual retry with custom countdown
@app.task(bind=True, max_retries=3)
def process_payment(self, order_id):
    try:
        charge(order_id)
    except RateLimitError as exc:
        raise self.retry(exc=exc, countdown=60)
    except ValidationError:
        send_to_dlq(order_id)  # no retry for bad input
```

### Concurrency and Routing

Task-level `rate_limit` applies per worker process, not globally; see [scheduling-patterns.md](scheduling-patterns.md#rate-limited-processing).

```python
# Route task types to dedicated queues, each with its own worker pool
app.conf.task_routes = {
    'tasks.send_sms': {'queue': 'sms'},
    'tasks.generate_report': {'queue': 'reports'},
}
# Run worker: celery -A myapp worker -Q sms --concurrency=2
```

**Concurrency tuning:**
- CPU-bound: `--concurrency=<cpu_cores>` with prefork (default)
- I/O-bound: `--concurrency=100 --pool=gevent` for high I/O throughput
- Mixed: route CPU tasks to prefork queue, I/O tasks to gevent queue

### Task Chains and Groups (Canvas)

```python
from celery import chain, group, chord

# Sequential: charge → fulfill → notify
pipeline = chain(
    charge_payment.s(order_id),
    fulfill_order.s(),
    send_confirmation.s(),
)
pipeline.apply_async()

# Parallel: process all items, then aggregate
batch = chord(
    group(process_item.s(item_id) for item_id in item_ids),
    aggregate_results.s()
)
batch.apply_async()

# Fan-out without callback
group(send_email.s(addr) for addr in addresses).apply_async()
```

### Monitoring

**Dashboard:** Flower (OSS web UI with Prometheus metrics). Flower's Prometheus metrics include `flower_task_runtime_seconds` and `flower_worker_number_of_currently_executing_tasks`. Programmatic: `app.control.inspect().active()`, `.reserved()`, `.stats()`.

---

## Sidekiq (Ruby)

**Backend:** Redis | **Concurrency model:** Threads (single process, multiple threads)

### Setup

```ruby
# app/sidekiq/email_job.rb
class EmailJob
  include Sidekiq::Job
  sidekiq_options queue: :high, retry: 5, dead: true

  sidekiq_retry_in do |count, exception|
    (count ** 4) + 15 + (rand(10) * (count + 1)) # polynomial + jitter
  end

  def perform(user_id, template)
    user = User.find(user_id)
    UserMailer.with(user: user).deliver_template(template)
  end
end

# Enqueue (after the creating transaction commits)
EmailJob.perform_async(user.id, 'welcome')
EmailJob.perform_in(1.hour, user.id, 'reminder')
```

### Concurrency and Rate Limiting

```yaml
# config/sidekiq.yml
:concurrency: 10
:queues:
  - [critical, 6]    # weighted priority
  - [default, 3]
  - [low, 1]
```

**Capsules** (Sidekiq 7+) isolate concurrency per queue: `config.capsule("pdf") { |cap| cap.concurrency = 1; cap.queues = %w[pdf] }`. Rate limiters are an Enterprise feature.

### Batches (Sidekiq Pro, paid tier)

```ruby
batch = Sidekiq::Batch.new
batch.on(:success, BatchCallback, 'report_id' => report.id)
batch.jobs do
  data_chunks.each { |chunk| ProcessChunk.perform_async(chunk.id) }
end
# Callback fires when every job in the batch has succeeded
```

### Monitoring

Built-in web UI: `mount Sidekiq::Web => '/sidekiq'` (add Rack::Auth::Basic). Metrics: processed/failed counts, queue sizes, retry/dead set size. Sidekiq Enterprise adds historical metrics.

---

## Temporal (Polyglot Workflow Orchestration)

**Backend:** PostgreSQL, MySQL, or Cassandra | **Model:** Durable execution with event sourcing

### When to Use Temporal (Not a Simple Queue)

| Scenario | Simple Queue | Temporal |
|----------|-------------|----------|
| Fire-and-forget | Yes | Overkill |
| Multi-step with compensation (saga) | Complex custom code | Native |
| Long-running (hours/days) | Difficult | Native timers |
| Human-in-the-loop | Custom signals | Native signals/queries |
| Workflow visibility | Custom dashboard | Built-in UI |
| Cross-service orchestration | Fragile | First-class |

### TypeScript Workflow

```typescript
// workflow.ts — deterministic orchestration logic
import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './activities';

const { chargePayment, fulfillOrder, sendNotification } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '30s',
    retry: { maximumAttempts: 3, backoffCoefficient: 2.0 },
  });

export async function orderWorkflow(orderId: string): Promise<void> {
  const payment = await chargePayment(orderId);
  await fulfillOrder(orderId, payment.transactionId);
  await sendNotification(orderId, 'completed');
}
```

Python SDK follows the same pattern -- `@workflow.defn` class with `@workflow.run` method, `@activity.defn` functions.

### Retry Configuration

```typescript
// Activity-level retry (recommended)
const activities = proxyActivities<typeof acts>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2.0,
    maximumInterval: '60s',
    maximumAttempts: 5,
    nonRetryableErrorTypes: ['ValidationError', 'NotFoundError'],
  },
});

// Workflow-level retry (for entire workflow re-execution)
await client.workflow.start(orderWorkflow, {
  taskQueue: 'orders',
  workflowId: `order-${orderId}`,
  retry: { maximumAttempts: 3 },
});
```

### Saga Pattern (Compensation)

When a saga is the right design is an `architecture` decision; this is how a workflow engine expresses one. Compensations are activities too, so they must be idempotent.

```typescript
export async function orderSaga(orderId: string): Promise<void> {
  const compensations: (() => Promise<void>)[] = [];
  try {
    const payment = await chargePayment(orderId);
    compensations.push(() => refundPayment(orderId, payment.txId));

    const reservation = await reserveInventory(orderId);
    compensations.push(() => releaseInventory(orderId, reservation.id));

    await shipOrder(orderId);
  } catch (err) {
    // Compensate in reverse order
    for (const compensate of compensations.reverse()) {
      await compensate();
    }
    throw err;
  }
}
```

### Monitoring

- **Temporal Web UI:** Built-in workflow history, search by workflow ID/type, view event history
- **Metrics:** Temporal server and SDK export Prometheus metrics
- **Key metrics:** `workflow_task_schedule_to_start_latency`, `activity_schedule_to_start_latency`, `workflow_failed`, `workflow_completed` (exported with a `temporal_` prefix)

---

## Job Design Patterns (Framework-Agnostic)

### Idempotency Key

```typescript
// Key derived from intent, not from time or attempt
await queue.add('charge', { orderId: 'order-123', idempotencyKey: 'charge:order-123' });

async function processCharge(job) {
  // Claim first (unique insert), then work; on conflict return the stored result.
  // External call carries the same key so the provider deduplicates retries.
  return claimAndRun(job.data.idempotencyKey, () =>
    payments.charge({ orderId: job.data.orderId }, { idempotencyKey: job.data.idempotencyKey }),
  );
}
```

`claimAndRun` follows the claim-first pattern in [idempotency-patterns.md](../../message-queues/references/idempotency-patterns.md); a check-then-process lookup lets two concurrent attempts both run.

### Dead Letter Queue Handling

Listen for `worker.on('failed')` and check `job.attemptsMade >= job.opts.attempts`. On exhaustion: alert ops, enqueue to DLQ with original data/error/timestamp. DLQ rules: alert on every entry, include original data + error + attempt history, build replay mechanism, set 30-90 day retention.

### Batch Processing

Group items into batches (100-500 per batch) instead of one job per item. Track progress with `job.updateProgress()`.

### Graceful Shutdown

On `SIGTERM`/`SIGINT`: call `worker.close()` (stop taking jobs, let running ones finish), then exit. The drain timeout stays below the platform's kill grace period; jobs cut off mid-run are retried, so they must be idempotent. Shutdown mechanics in general: `backend`.
