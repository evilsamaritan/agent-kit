# System Design

Distributed systems, databases, caching, messaging, API design, resilience, scalability.

## Contents

- [CAP Theorem and Consistency Models](#cap-theorem-and-consistency-models)
- [Database Selection](#database-selection)
- [Caching Strategies](#caching-strategies)
- [Messaging: Queues and Event Streaming](#messaging-queues-and-event-streaming)
- [API Design](#api-design)
- [Resilience Patterns](#resilience-patterns)
- [Scalability Patterns](#scalability-patterns)
- [Observability: The Three Pillars](#observability-the-three-pillars)

---

## CAP Theorem and Consistency Models

**CAP:** A distributed system can guarantee at most 2 of 3:
- **C**onsistency — every read returns the latest write
- **A**vailability — every request gets a (possibly stale) response
- **P**artition tolerance — the system works despite network failures

Network partitions are inevitable. **The real choice is CP vs AP** — what to sacrifice *during* a partition.

**CP systems** (banking, payments, inventory): prefer returning an error over returning stale data.  
**AP systems** (social feeds, recommendations, shopping carts): prefer returning stale data over returning an error.

**Most systems use both** — different subsystems choose different points. User sessions: AP. Payment processing: CP. Profile data: AP. Account balance: CP.

### Consistency models (strongest to weakest)

| Model | Guarantee | Cost |
|-------|-----------|------|
| **Linearizability** | Operations appear instantaneous; reads always return latest write | Highest (coordination on every op) |
| **Serializable** | Transactions execute as if serial | High |
| **Causal** | Cause precedes effect for all nodes | Medium |
| **Eventual** | All replicas converge; may return stale reads | Lowest |

Choose per subsystem. Don't default to "eventual consistency everywhere" — it transfers consistency burden to application code, which is harder to reason about.

---

## Database Selection

**Default to PostgreSQL.** Add specialized stores only when PostgreSQL genuinely cannot serve the need.

| Workload | Recommended | Notes |
|----------|-------------|-------|
| General CRUD, ACID transactions | PostgreSQL | Default choice |
| Global-scale distributed SQL | CockroachDB / YugabyteDB | When geo-distribution is required |
| Vector search < 50M vectors | pgvector on PostgreSQL | Eliminates separate vector DB |
| Vector search > 50M vectors | Qdrant, Milvus, Pinecone | Purpose-built at scale |
| Time-series metrics / IoT | TimescaleDB or InfluxDB | Built on PostgreSQL (TimescaleDB) |
| Large-scale analytics | ClickHouse | 10-100x faster than Postgres for OLAP |
| Graph relationships | Neo4j | Only when traversal is the primary access pattern |
| Caching / session | Redis | Industry standard |
| Event log / append-only | Append-only table or EventStoreDB | Simple Postgres table often sufficient |

**Multi-DB is normal for AI/ML systems.** Relational + vector + graph + cache is a common production stack.

### When NOT to add a database

Before adding a new database type:
1. Can PostgreSQL do this with an extension? (pgvector, TimescaleDB, Citus)
2. Will the team be able to operate this in production?
3. What is the backup/restore story?
4. What happens when this service goes down?

Every new DB type is operational complexity. The benefit must exceed the cost.

---

## Caching Strategies

### Cache decision tree

```
Is data expensive to compute or fetch?
  YES → Cache it
  
Is data mutable?
  NO  → Long TTL, invalidate on change (write-through)
  YES → Short TTL, or event-based invalidation

Do multiple app instances need cache consistency?
  YES → Distributed cache (Redis)
  NO  → Local in-process cache (faster, simpler)
```

### Strategies

**Cache-Aside (default):** Application checks cache, on miss reads from DB, populates cache.
```
read(key):
  value = cache.get(key)
  if value == null:
    value = db.get(key)
    cache.set(key, value, ttl=300s)
  return value
```
Lazy — only caches what's read. Risk: thundering herd on cold start.

**Write-Through:** Write to cache AND DB simultaneously.  
Use for: data that must always be fresh when read (financial data, inventory levels).  
Cost: every write is two writes.

**Write-Behind:** Write to cache, async flush to DB.  
Use for: high-throughput writes where some lag is acceptable (analytics, counters).  
Risk: data loss if cache fails before flush.

**Read-Through:** Cache handles the DB read on miss (cache is the abstraction).  
Use for: when you want cache logic outside application code.

### Cache invalidation (the hard problem)

Strategies in order of complexity:
1. **TTL expiration** — simplest; stale data guaranteed to expire
2. **Event-based invalidation** — on write, publish invalidation event to all cache instances via Redis Pub/Sub
3. **Write-through** — invalidate on every write

**Never** hold stale data forever. Every cache entry needs a TTL — even as a safety net.

**Cache stampede mitigation:** Use probabilistic early expiration or a lock-based read. When many requests miss simultaneously, only one fetches from DB while others wait.

### Multi-layer cache architecture

```
Browser cache → CDN → API Gateway cache → App-level (Redis) → DB
```

Each layer serves different data and timescales:
- Browser/CDN: static assets, public content (minutes to hours)
- API Gateway: rate-limited endpoints, auth results (seconds to minutes)
- Redis: session data, computed aggregations, expensive DB queries (seconds to hours)

---

## Messaging: Queues and Event Streaming

### When to use async messaging

Use async messaging when:
- The caller doesn't need the result to proceed
- Operations can be decoupled in time
- You need guaranteed delivery (at-least-once)
- You need fan-out (one message → many consumers)
- You need to buffer against traffic spikes

Don't use async messaging when:
- The caller needs the result to complete its work
- Latency is critical (each hop adds 5–50ms+)
- Exactly-once is required and you can't handle idempotency

### Choosing a message broker

| Broker | Throughput | Best for |
|--------|-----------|---------|
| **Apache Kafka** | 500K–1M msg/s | Event streaming, event sourcing, audit log, data pipelines |
| **RabbitMQ** | 50K–100K msg/s | Complex routing, work queues, enterprise messaging |
| **NATS JetStream** | 1M+ msg/s | Cloud-native, IoT, edge, microservices, low latency |
| **Redis Streams** | 100K–500K msg/s | When you already have Redis; simple pub/sub |

**Kafka** is not a queue — it's an immutable log. Consumers can replay, multiple consumer groups get all messages. Use for event sourcing, audit, or pipelines where replay matters.

**RabbitMQ** is a queue — messages are consumed and removed. Use for work distribution, delayed tasks, complex routing.

### Outbox Pattern (mandatory for reliable event publishing)

Problem: You can't atomically write to a DB AND publish to a message broker.

Solution:
```
BEGIN TRANSACTION
  INSERT INTO orders (...)        -- business data
  INSERT INTO outbox (event, payload, published=false)  -- event
COMMIT

[Background process: polling or CDC]
  SELECT * FROM outbox WHERE published=false
  broker.publish(event)
  UPDATE outbox SET published=true WHERE id=?
```

Use Outbox whenever: events must be published reliably; service restarts must not lose events.

### Saga Pattern (distributed transactions)

When a business operation spans multiple services:

```
PlaceOrder saga:
1. CreateOrder (local) → emit OrderCreated
2. ReserveInventory → emit InventoryReserved (or InventoryFailed)
3. ChargePayment → emit PaymentCharged (or PaymentFailed)
4. ShipOrder → emit OrderShipped

Compensation (on failure at step 3):
3. emit PaymentFailed
2. ReleaseInventory (compensating action)
1. CancelOrder (compensating action)
```

**Choreography** (event-based): each service reacts to events. Simpler but harder to observe.  
**Orchestration** (central coordinator): a saga service sends commands. Easier to observe but single point of logic.

---

## API Design

### REST, GraphQL, gRPC decision

| Protocol | Use for |
|----------|---------|
| **REST** | Public/external APIs; widest compatibility; standard HTTP tooling |
| **gRPC** | Internal service-to-service; 10x lower latency than REST; strong typing |
| **GraphQL** | Client-server with complex data fetching; mobile/web UI clients |

**Common hybrid:** GraphQL gateway for clients → gRPC between services → REST for external/legacy.

### REST best practices (Stripe-standard)

- **Resources are nouns:** `/orders/123`, not `/getOrder?id=123`
- **HTTP verbs carry semantics:** GET (read), POST (create), PUT (replace), PATCH (update), DELETE (delete)
- **Consistent response structure:** every resource has `id`, `object`, `created`, standard error shape
- **Typed IDs:** use prefixed IDs (`ord_abc123`, `cus_xyz789`) — you always know what you have
- **Idempotency:** POST endpoints accept an `Idempotency-Key` header — safe to retry
- **Date versioning:** `/v1/`, `/v2/` or `?api-version=2024-01-01`
- **Rich errors:** include `type`, `message`, `param`, `doc_url`
- **Pagination:** cursor-based over offset for large datasets

### gRPC best practices

- Define services in `.proto` files — source of truth for the contract
- Use `google.protobuf.Timestamp` for dates, `google.type.Money` for currency
- Stream large responses rather than returning huge messages
- Implement deadlines/timeouts on all client calls
- Use gRPC reflection for discoverability

---

## Resilience Patterns

Apply in this order — don't skip to the end:

### 1. Timeouts (mandatory on everything external)
Every call to a database, external service, or other component must have a timeout.  
No timeout = one slow dependency can exhaust all threads/connections.

Rule of thumb: timeout < P99 acceptable latency for that call.

### 2. Idempotency
Design writes to be safely retried.  
Technique: accept a client-provided idempotency key; deduplicate based on it.

Without idempotency, retries cause duplicate operations (double charges, double orders).

### 3. Retries with backoff + jitter
```
attempt 1: immediate
attempt 2: 1s delay
attempt 3: 2s delay + random(0–500ms)
attempt 4: 4s delay + random(0–500ms)
→ give up, return error
```

**Only retry transient errors** (network timeout, 429, 503). Never retry `400 Bad Request`.  
**Add jitter** (random delay) to prevent thundering herd when many clients retry simultaneously.

### 4. Circuit Breaker
Prevents cascading failures by "opening" when a dependency fails repeatedly.

States:
```
CLOSED (normal) → failures exceed threshold → OPEN (reject all calls)
OPEN → after timeout → HALF-OPEN (try one call)
HALF-OPEN → success → CLOSED
HALF-OPEN → failure → OPEN
```

**Configure:** failure threshold (e.g., 50% failure rate over 10 requests), open duration (e.g., 30s), success threshold to close (e.g., 3 consecutive successes).

### 5. Bulkhead
Isolate resources to prevent one failing component from exhausting shared resources.

Technique: separate thread pools or connection pools per dependency.  
If dependency A is slow and consumes all threads, dependency B calls still succeed because they have their own pool.

### Failure mode planning

For every external dependency, define:
1. What happens if it's slow? (timeout + circuit breaker)
2. What happens if it's down? (graceful degradation — serve stale data, disable feature, or fail fast)
3. What happens if it returns garbage? (validate responses; don't propagate corrupt data)

---

## Scalability Patterns

### Horizontal vs Vertical Scaling

**Vertical** (bigger machine): simple, no code changes, but has a ceiling and is a SPOF.  
**Horizontal** (more machines): complex, requires stateless design, but theoretically unlimited.

Design for horizontal scaling from the start: no local state, no sticky sessions (or manage them with distributed cache), no server-local files.

### Stateless design

Stateless services scale horizontally. State lives in:
- Database (durable state)
- Cache (ephemeral state)
- Client (session tokens)

A request routed to any instance should produce the same result.

### Database scaling (in order of complexity)

1. **Read replicas** — scale reads; write to primary, read from replicas
2. **Connection pooling** — reduce connection overhead (PgBouncer for PostgreSQL)
3. **Caching** — reduce DB load at the application layer
4. **Vertical scaling** — bigger machine for the DB
5. **Sharding** — partition data across multiple DB instances (last resort; high complexity)

Sharding adds: cross-shard query complexity, rebalancing operations, application-level routing. Don't shard until single-node capacity is actually exhausted.

### CQRS for read scaling

When read load vastly exceeds write load:
- Write to normalized DB
- Asynchronously maintain denormalized read models in a separate store (or DB)
- Queries hit the read model; commands hit the write model

---

## Observability: The Three Pillars

### Metrics (what's happening)
- **RED metrics** (for services): Rate, Errors, Duration
- **USE metrics** (for resources): Utilization, Saturation, Errors
- **Business metrics**: conversion rate, revenue, active users

Instrument from day one. Adding observability to an unobservable system is expensive.

### Traces (why it's happening)
Distributed tracing across service/module boundaries.  
Each request carries a trace ID. Each operation creates a span.  
Standard: OpenTelemetry (vendor-neutral, captures logs + metrics + traces).

Use traces to: identify which service is slow, understand request fan-out, debug intermittent failures.

### Logs (what happened)
- Structured logging (JSON) — machine-readable
- Correlated with trace ID — link logs to traces
- Log levels: ERROR (needs immediate attention), WARN (unexpected but handled), INFO (significant events), DEBUG (development only)

**Health checks:** every service exposes `/health` (liveness) and `/ready` (readiness).  
Liveness: is the process alive?  
Readiness: can the process serve traffic? (DB connected, cache available, etc.)
