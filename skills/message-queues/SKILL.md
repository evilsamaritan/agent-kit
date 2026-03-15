---
name: message-queues
description: Design message broker architectures — broker selection, DLQ, idempotency, schema evolution, event-driven patterns. Use when choosing brokers, configuring topics, setting up consumer groups, or implementing idempotent processing. Do NOT use for synchronous APIs (use api-design) or job queues (use background-jobs).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Message Queues & Event Streaming

Message broker selection, event-driven architecture patterns, and reliable message processing.

---

## Broker Selection Decision Tree

```
What is the primary need?

├── Event replay / audit log / stream processing?
│   ├── Need Kafka ecosystem (Connect, Streams, Schema Registry)? → Kafka-protocol broker
│   ├── Want simpler ops / single binary / no JVM? → Kafka-API-compatible alternative
│   └── Want lightweight cloud-native with built-in KV? → NATS JetStream
│
├── Complex routing (topic patterns, headers, fanout)?
│   └── AMQP broker (exchange + queue model)
│
├── Request-reply + pub/sub with minimal infra?
│   └── NATS (core or JetStream for persistence)
│
├── Lightweight streaming, already using Redis?
│   └── Redis Streams
│
└── Simple task distribution, no ordering needed?
    └── Any broker with competing consumers or share groups
```

### Broker Comparison (supplementary detail)

| Feature | Kafka-protocol | AMQP broker | NATS JetStream | Redis Streams |
|---------|---------------|-------------|----------------|---------------|
| **Model** | Distributed log | Message broker | Cloud-native messaging | Append-only log |
| **Ordering** | Per partition | Per queue | Per stream | Per stream |
| **Throughput** | Millions/sec | Tens of thousands/sec | Hundreds of thousands/sec | Hundreds of thousands/sec |
| **Persistence** | Disk (retention-based) | Quorum queues (Raft) | File/memory | AOF/RDB |
| **Consumer groups** | Native | Competing consumers | Native | Native (XREADGROUP) |
| **Replay** | Yes (offset reset) | No (ack = gone) | Yes (by sequence) | Yes (by ID) |
| **Protocol** | Kafka binary protocol | AMQP 1.0 (core) / 0-9-1 | NATS protocol | Redis protocol |
| **Best for** | Event streaming, high throughput | Task routing, complex topologies | Microservices, request-reply | Lightweight streaming with Redis |

---

## Event-Driven Architecture Patterns

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| **Pub/Sub** | Publisher emits events, subscribers consume independently | Decoupled notification, fan-out |
| **Event Sourcing** | Store state changes as immutable event log | Audit trail, temporal queries, rebuilding state |
| **CQRS** | Separate read/write models, sync via events | Read-heavy with different query needs |
| **Outbox Pattern** | Write event to DB outbox table in same transaction, relay to broker | Reliable publish without 2PC |
| **Claim-Check** | Store large payload externally, send reference in message | Messages > 1MB |
| **Saga / Choreography** | Coordinate multi-service transactions via events + compensations | Distributed transactions without 2PC |

---

## Kafka-Protocol Essentials

Applies to any Kafka-protocol-compatible broker (Apache Kafka, Redpanda, WarpStream, etc.).

- **Topic**: named log, divided into partitions
- **Partition**: ordered, immutable sequence; unit of parallelism
- **Consumer group**: consumers that divide partitions among themselves
- **Offset**: consumer position in a partition; committed to track progress
- **Key**: determines partition assignment; same key = same partition = ordering guarantee

**Partition key strategy:** user_id for per-user ordering, entity_id for per-entity ordering, tenant_id for isolation, null for max throughput (round-robin).

**Exactly-once:** idempotent producer (`enable.idempotence=true`), transactions (`transactional.id`), commit offset AFTER processing with idempotency key for downstream writes.

**Share groups:** queue-like consumption without partition-to-consumer binding. Multiple consumers process from the same partitions with per-record acknowledgment and delivery counting. Use for task-queue workloads where ordering is not required. Traditional consumer groups remain best for ordered stream processing.

**KRaft metadata:** Kafka no longer requires ZooKeeper. KRaft is the only metadata mode. Simplified deployment — single process type.

> Deep dive: `references/kafka-patterns.md` -- producer/consumer config, exactly-once, schema registry, Kafka Connect, share groups, topic design, operational patterns.

---

## AMQP Broker Essentials

Applies to AMQP-compatible brokers (RabbitMQ, LavinMQ, etc.).

| Exchange | Routing | Use Case |
|----------|---------|----------|
| Direct | Exact routing key match | Task queues, point-to-point |
| Topic | Pattern match (`order.*`, `#.error`) | Flexible pub/sub |
| Fanout | All bound queues | Broadcast to all consumers |
| Headers | Header attribute match | Content-based routing |

**Queue types:** Quorum queues (Raft-based replication) are the default for durability. Classic mirrored queues are deprecated/removed. Streams provide log-based semantics (replay, time-based offset).

**DLQ config:** set `x-dead-letter-exchange`, `x-dead-letter-routing-key`, optional `x-message-ttl` and `x-max-length`. Quorum queues have a default redelivery limit (messages exceeding it are dropped or routed to DLQ).

> Deep dive: `references/queue-patterns.md` -- exchange topology, consumer setup, priority queues.

---

## NATS JetStream Essentials

- **Stream**: persistent storage of messages on subjects
- **Consumer**: durable subscription with ack tracking (pull consumers preferred for backpressure)
- **Key-Value**: built-in KV store backed by JetStream
- **Object Store**: large binary storage backed by JetStream
- **Request-Reply**: built-in pattern with timeouts

| Retention | Behavior | Use When |
|-----------|----------|----------|
| Limits | Keep N messages or N bytes | Bounded streams |
| Interest | Delete after all consumers ack | Work queues |
| WorkQueue | Delete after first consumer ack | Task distribution |

**Exactly-once:** combine message deduplication (`Nats-Msg-Id` header) with double acks for exactly-once publish and consume without heavy transaction protocols.

> Deep dive: `references/queue-patterns.md` -- stream/consumer setup, pull consumers, KV store, request-reply.

---

## Redis Streams Essentials

Core operations: `XADD` (produce), `XREADGROUP` (consume in group), `XACK` (acknowledge), `XPENDING` (check unacked), `XCLAIM` (claim stuck messages from dead consumers).

Best fit when Redis is already in the stack and streaming needs are moderate. Not a replacement for dedicated brokers at high scale.

> Deep dive: `references/queue-patterns.md` -- producer trimming, consumer group pattern, claiming stuck messages.

---

## Schema Evolution

Schema management is broker-agnostic — the pattern applies regardless of which broker carries the messages.

**Serialization decision:** JSON for debugging/low volume. Avro with schema registry for streaming. Protobuf for gRPC integration or polyglot systems.

**Compatibility modes:**

| Mode | Add Field | Remove Field | Best For |
|------|-----------|-------------|----------|
| BACKWARD | With default | Yes | Consumers upgrade first |
| FORWARD | Yes | With default | Producers upgrade first |
| FULL | With default | With default | Independent upgrades (recommended for prod) |

**Rules:** Use FULL compatibility in production. Every field addition needs a default value. Every removal requires the field to already have a default.

> Deep dive: `references/kafka-patterns.md` -- schema registry API, Avro schema examples, compatibility checks.

---

## Dead Letter Queues

**Flow:** message fails -> retry count < max (3-5)? -> requeue with exponential backoff (`base * 2^attempt` + jitter) -> exceeded? -> DLQ with original message, error details, retry history, timestamps, source topic.

**Monitoring:** alert when DLQ depth > 0. Dashboard by error type, age, and source topic.

> Deep dive: `references/queue-patterns.md` -- retry topologies, DLQ message format, reprocessing scripts.

---

## Idempotency

**Pattern:** store `idempotency_key` + result in DB atomically with processing. On duplicate, return stored result. Commit offset only after successful processing + dedup insert.

**Cleanup:** expire dedup entries after a window (e.g., 7 days). Window must exceed maximum possible redelivery delay.

> Deep dive: `references/idempotency-patterns.md` -- dedup schema, idempotent consumer code, consumer group management.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| No DLQ | Poison messages block the queue forever | Always configure DLQ with alerting |
| Ignoring consumer lag | Silent data processing delays | Monitor lag, alert on growth trends |
| Unbounded retry | Infinite loops on permanent failures | Max retries + exponential backoff + DLQ |
| Large messages in queues | Broker pressure, slow consumers | Claim-check: store payload externally, send reference |
| Tight coupling via message format | Breaking changes cascade | Schema registry, versioned schemas, backward compatibility |
| Direct DB writes + broker publish | Dual-write inconsistency on partial failure | Outbox pattern: write to DB outbox table, relay to broker |
| Using classic mirrored queues (AMQP) | Deprecated, removed in modern versions | Quorum queues for replication |
| Skipping schema validation | Silent contract drift between services | Schema registry with compatibility enforcement |

---

## Context Adaptation

| Domain | Relevant Aspects |
|--------|-----------------|
| **Backend services** | Broker selection, consumer group design, idempotency, DLQ |
| **Data engineering** | Event sourcing, schema evolution, exactly-once, replay |
| **DevOps / Platform** | Broker deployment, monitoring, partition management, scaling |
| **Microservices** | Saga/choreography, outbox pattern, schema contracts, routing |

---

## Related Knowledge

- **api-design** skill — synchronous API patterns that complement async messaging
- **background-jobs** skill — job queues (BullMQ/Celery/Sidekiq) for task-level work; message-queues covers broker-level event streaming. Boundary: if the work is "process this task" use background-jobs; if it is "propagate this event to N subscribers" use message-queues
- **realtime** skill — event-driven backends feeding real-time frontends (broker -> WebSocket/SSE)

---

## References

- [kafka-patterns.md](references/kafka-patterns.md) -- Producer/consumer config, exactly-once, schema registry, Kafka Connect, topic design, operations
- [queue-patterns.md](references/queue-patterns.md) -- AMQP exchanges, NATS JetStream, Redis Streams, DLQ strategies, serialization, testing
- [idempotency-patterns.md](references/idempotency-patterns.md) -- Dedup schema, idempotent consumer code, consumer group rebalancing, lag monitoring
