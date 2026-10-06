---
name: message-queues
description: "Design message broker flows. Use for broker choice, topics, partitions, consumer groups, delivery guarantees, event schemas and compatibility, broker-side dead letters, and the idempotent-consumer pattern. Do NOT use for task queues, schedules, and job retries (background-jobs)."
---

# Message Queues and Event Streaming

Broker selection, event contracts, and reliable consumption. Determine the broker, its version, and the client library from the project before giving configuration advice; several defaults changed across recent major versions ([kafka-patterns.md](references/kafka-patterns.md), [queue-patterns.md](references/queue-patterns.md)).

## Scope and boundaries

**Shared boundary with `background-jobs`:** a command for one worker (task, schedule, workflow step) → `background-jobs`. A fact published to any number of subscribers (topic, stream, consumer group) → `message-queues`. Retry, dead-letter, and idempotency handling follow whichever of the two the work is.

| Question | Owner |
|---|---|
| Broker model, topics and partitions, consumer groups, ordering, delivery guarantees, schemas, broker-side dead-letter mechanics | this skill |
| Idempotency pattern for any consumer or handler (claim first, keys derived from intent) | this skill — [idempotency-patterns.md](references/idempotency-patterns.md) |
| Choosing outbox, saga, CQRS, or event sourcing | `architecture` ([outbox](../architecture/references/integration-patterns.md#transactional-outbox), [saga](../architecture/references/integration-patterns.md#saga-and-process-manager), [CQRS](../architecture/references/integration-patterns.md#cqrs-separate-query-model)) |
| Which errors to retry, backoff, retry budgets, deadlines | `reliability` |
| Task queues, scheduled jobs, workflow orchestration | `background-jobs` |
| Webhooks to external consumers | `api-design` |

## Broker selection decision tree

```
What is the primary need?
├── Replayable event log, stream processing, many independent consumers at high volume
│   └── Log-based streaming broker (Kafka protocol or compatible)
├── Routing by key patterns or headers, per-message acknowledgement, priorities
│   └── Routed-queue broker (AMQP)
├── Request-reply plus pub/sub with minimal infrastructure, edge or IoT fan-out
│   └── Lightweight messaging with optional persistence (NATS-style)
├── Already on a cloud platform; simple queues or fan-out; no replay needed
│   └── Managed queue / topic service — decide by ordering (FIFO option), delivery semantics,
│       retention, and message size limits
├── Low volume, and enqueue must commit atomically with business data
│   └── Table-backed queue in the primary database (SKIP LOCKED-style claiming)
└── Moderate streaming and the stack already runs a Redis-compatible store
    └── Streams on that store — accept weaker durability and tooling
```

Products per model: [queue-patterns.md](references/queue-patterns.md#broker-models-and-products).

| Model | Ordering | Replay | Consumption | Typical fit |
|---|---|---|---|---|
| Log-based streaming | Per partition | Yes (offsets) | Consumer groups; queue-style share groups on recent versions | Event streams, CDC, analytics |
| Routed queues (AMQP) | Per queue | No (stream queues add it) | Competing consumers, per-message ack | Task routing, complex topologies |
| Lightweight messaging with streams | Per stream/subject | Yes (by sequence) | Pull consumers | Microservices, request-reply, edge |
| Managed cloud queue/topic | Best effort or FIFO groups | Usually no | Competing consumers | Simple distribution on one cloud |
| Table-backed queue | By query | No | Row claiming | Low volume, transactional enqueue |

## Broker-side patterns

| Pattern | Description | When |
|---|---|---|
| **Pub/sub fan-out** | One publish, many independent subscriptions | Decoupled notification |
| **Claim-check** | Store the payload externally, send a reference | Payloads beyond the broker's message limit |
| **Outbox relay** | Publish rows written in the same transaction as the state change; relay preserves order per key and publishes at least once | Reliable publish without two-phase commit; design choice in `architecture` |
| **Change data capture** | Publish from the database log | Integrating without touching write paths |

Whether to use outbox, saga, CQRS, or event sourcing at all is an `architecture` decision.

## Log-based streaming essentials

- **Topic** → partitions; a **partition** is an ordered log and the unit of parallelism.
- **Key** picks the partition: same key, same partition, same order. Key by the entity whose order matters (order id, account id); null keys spread load but drop ordering.
- **Consumer group** splits partitions across members; **offset** is the committed position. Commit after processing.
- **Share groups** (queue-style consumption with per-record acknowledgement) suit task-like work without ordering; check broker and client support for your versions.
- Increasing partitions remaps keys to partitions; plan counts up front.

Producer and consumer configuration, rebalance protocols, transactions: [kafka-patterns.md](references/kafka-patterns.md).

## Routed-queue (AMQP) essentials

| Exchange | Routing | Use case |
|----------|---------|----------|
| Direct | Exact routing key | Point-to-point |
| Topic | Pattern (`order.*`, `#.error`) | Flexible pub/sub |
| Fanout | All bound queues | Broadcast |
| Headers | Header attributes | Content-based routing |

Use replicated (quorum) queues for durability; stream queues add replay. Publish with publisher confirms and consume with manual acks. Dead-lettering: a dead-letter exchange per queue plus a delivery limit. Setup and version notes: [queue-patterns.md](references/queue-patterns.md#amqp-broker-patterns).

## Lightweight streams

Lightweight messaging systems with persistence (JetStream-style) and streams on a Redis-compatible store both provide append-only streams, consumer groups or durable consumers, explicit acks, and redelivery of unacked messages. They suit moderate volumes when that system is already in the stack. Commands and setup: [queue-patterns.md](references/queue-patterns.md).

## Delivery guarantees

Brokers deliver **at least once** under failure. **Effectively-once** = at-least-once delivery + idempotent effects. Broker "exactly-once" features (idempotent producers, transactions, publish deduplication windows) cover only the broker's own state — for example consume-transform-produce between topics. The guarantee ends at the first external side effect (database write, email, payment), which needs its own idempotency key ([idempotency-patterns.md](references/idempotency-patterns.md)). `background-jobs` uses the same statement.

## Schema evolution

**Serialization:** JSON for low volume and debugging; Avro or Protobuf with a schema registry for streams and polyglot consumers.

**Compatibility mode — decide by who upgrades first and whether consumers replay old data:**

| Mode | Checks against | Allows | Fits |
|------|---------------|--------|------|
| BACKWARD | Latest version | New schema reads data written with the previous one | Consumers upgrade first, no replay of older history |
| FORWARD | Latest version | Old schema reads data written with the new one | Producers upgrade first |
| FULL | Latest version | Both directions | Independent upgrades |
| BACKWARD_TRANSITIVE / FULL_TRANSITIVE | All earlier versions | Same, across the whole history | Consumers can replay from the start of the log |

If the topic is replayable and retention spans several schema versions, use a transitive mode. Add fields with defaults; remove only fields that have defaults. Money and identifiers are never floats in an event contract: amounts as decimal logical types or integer minor units plus currency, identifiers as strings.

## Dead letters (broker side)

1. A consumer classifies the failure (`reliability` owns which errors are retryable).
2. Retryable: redeliver with delay — broker delayed redelivery, retry topics or queues with increasing delay, or a pause-and-resume on the partition. Never block the partition with a sleep.
3. Non-retryable, or retry budget spent: publish to the dead-letter destination **and wait for its acknowledgement** before committing or acking the original.
4. Dead-letter records keep the original payload, key, headers, source position, error, and attempt history.
5. Alert on dead-letter growth; replay only after fixing the cause, through the same idempotent consumer.

Topologies and replay tooling: [queue-patterns.md](references/queue-patterns.md#dead-letter-queue-strategies).

## Idempotent consumers

Claim the message's business key with a unique insert before processing, in the same transaction as the consumer's own writes; on conflict, skip or return the stored result. Use the producer's business event id, not the broker's delivery id. Commit the offset or ack only after that transaction commits. Full pattern, key derivation, external side effects, and cleanup windows: [idempotency-patterns.md](references/idempotency-patterns.md).

## Context Adaptation

- **Single service, low volume** — a table-backed queue or managed queue avoids running a broker.
- **Ordered per entity** — partition by entity key; parallelism is bounded by partition count.
- **Replay and audit** — log-based broker with retention covering the replay window, transitive schema compatibility.
- **Multi-tenant** — tenant in the event and the key; quotas per tenant so one tenant cannot saturate consumers.
- **Regulated data** — personal data in a retained log is hard to erase; keep references or encrypt per subject and delete keys.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| No dead-letter destination | Poison messages block or loop | Bounded redelivery, then dead letter with alerting |
| Fire-and-forget dead-letter publish before commit | The record is lost if the publish fails | Wait for the publish acknowledgement, then commit |
| Unbounded retry | Infinite loops on permanent failures | Retry budget, then dead letter |
| Ignoring consumer lag | Silent processing delay | Alert on lag growth |
| Large payloads in messages | Broker pressure, slow consumers | Claim-check |
| Database write + separate broker publish | One succeeds, the other fails | Outbox relay or change data capture |
| Dedup by broker delivery id | Redelivery or republish gets a new id | Business event id from the producer |
| Float amounts in event schemas | Rounding errors across services | Decimal type or integer minor units plus currency |
| Non-transitive compatibility on a replayable topic | Old records fail to decode on replay | Transitive compatibility mode |

## Related Knowledge

- **architecture** — choosing outbox, saga, CQRS, event sourcing
- **background-jobs** — task queues, schedules, workflow orchestration (shared boundary above)
- **reliability** — retry classification, backoff, budgets
- **database** — outbox table, idempotency table, change data capture source
- **observability** — lag, throughput, and dead-letter metrics; trace context in message headers
- **api-design** — webhooks and synchronous contracts
- **realtime** — pushing broker events to clients

## References

- [kafka-patterns.md](references/kafka-patterns.md) — producer/consumer configuration, rebalance protocols, transactions, schema registry, Connect, share groups, topic design, operations
- [queue-patterns.md](references/queue-patterns.md) — broker models and products, AMQP, JetStream-style streams, Redis-compatible streams, dead-letter strategies, serialization, testing
- [idempotency-patterns.md](references/idempotency-patterns.md) — idempotency pattern owner: key derivation, claim-first consumer, external side effects, cleanup, consumer group management
