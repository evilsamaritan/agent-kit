# Queue Patterns

Broker models and products, AMQP exchanges, NATS JetStream, Redis-compatible streams, and dead-letter strategies. Check broker and client versions before copying setup code.

## Contents

- [Broker Models and Products](#broker-models-and-products)
- [AMQP Broker Patterns](#amqp-broker-patterns)
- [NATS JetStream Patterns](#nats-jetstream-patterns)
- [Redis Streams Patterns](#redis-streams-patterns)
- [Dead Letter Queue Strategies](#dead-letter-queue-strategies)
- [Message Serialization](#message-serialization)
- [Testing Patterns](#testing-patterns)

---

## Broker Models and Products

Examples per model in SKILL.md's decision tree; verify current versions, limits, and licenses before choosing.

| Model | Examples | Notes |
|---|---|---|
| Log-based streaming (Kafka protocol) | Apache Kafka, Redpanda, WarpStream, managed Kafka services | Compatible brokers implement different feature subsets (transactions, share groups) |
| Routed queues (AMQP) | RabbitMQ, LavinMQ | RabbitMQ 4.0 removed classic mirrored queues; quorum queues replicate |
| Lightweight messaging with streams | NATS with JetStream | Subjects, durable pull consumers, built-in KV and object store |
| Managed cloud queue / topic | Amazon SQS + SNS, Google Pub/Sub, Azure Service Bus | FIFO or ordering-key options, delivery semantics, retention, and size limits differ per service |
| Table-backed queue | PostgreSQL with `FOR UPDATE SKIP LOCKED`, libraries built on it | Enqueue commits with business data; polling load grows with volume |
| Streams on a Redis-compatible store | Redis Streams, Valkey | Durability depends on the store's persistence settings |

---

## AMQP Broker Patterns

Examples use RabbitMQ (amqplib). Patterns apply to any AMQP-compatible broker.

### Exchange + Queue Topology

```
                    +---------+      +-----------+
Publisher --------> | Exchange | ---> | Queue     | ---> Consumer
                    | (topic)  |      | (orders)  |
                    |          | ---> | Queue     | ---> Consumer
                    |          |      | (invoices)|
                    +---------+      +-----------+
```

### Topic Exchange Setup (Node.js / amqplib)

```javascript
const amqp = require('amqplib');

async function setup() {
  const conn = await amqp.connect('amqp://localhost');
  const ch = await conn.createChannel();

  // Declare exchange
  await ch.assertExchange('events', 'topic', { durable: true });

  // Declare queues with DLQ
  await ch.assertExchange('events.dlx', 'direct', { durable: true });
  await ch.assertQueue('events.dlq', { durable: true });
  await ch.bindQueue('events.dlq', 'events.dlx', '');

  await ch.assertQueue('order-processing', {
    durable: true,
    arguments: {
      'x-queue-type': 'quorum',       // replicated
      'x-dead-letter-exchange': 'events.dlx',
      'x-delivery-limit': 5,          // quorum queues: dead-letter after 5 redeliveries
    },
  });

  // Bind queue to exchange with routing pattern
  await ch.bindQueue('order-processing', 'events', 'order.*');

  // Publish on a confirm channel and wait for the broker's confirm
  const pub = await conn.createConfirmChannel();
  pub.publish('events', 'order.created', Buffer.from(JSON.stringify({
    eventId: 'evt-7f3a',               // business event id: consumers dedup on this
    orderId: '123',
    amountMinor: 9999,                  // integer minor units, never floats for money
    currency: 'EUR',
  })), {
    persistent: true,                   // survive broker restart (with a durable queue)
    messageId: 'evt-7f3a',
    timestamp: Math.floor(Date.now() / 1000),
    headers: { 'x-retry-count': 0 },
  });
  await pub.waitForConfirms();
}
```

### Consumer with Manual Ack

```javascript
async function consume(conn, pub) {     // pub: a confirm channel opened at startup
  const ch = await conn.createChannel();
  await ch.prefetch(10);                // Process 10 at a time

  ch.consume('order-processing', async (msg) => {
    try {
      const order = JSON.parse(msg.content.toString());
      await processOrder(order);
      ch.ack(msg);                      // Success -- acknowledge
    } catch (err) {
      const retryCount = (msg.properties.headers['x-retry-count'] || 0);
      if (isRetryable(err) && retryCount < 3) {
        // Republish to a delay queue (TTL + dead-letter back to the main exchange) on a
        // confirm channel; ack the original only after the broker confirms the copy
        pub.publish('events.retry', msg.fields.routingKey, msg.content, {
          ...msg.properties,
          headers: { ...msg.properties.headers, 'x-retry-count': retryCount + 1 },
        });
        await pub.waitForConfirms();
        ch.ack(msg);
      } else {
        ch.nack(msg, false, false);     // Send to DLQ (no requeue)
      }
    }
  });
}
```

### Queue Type Selection

| Type | Replication | Use When |
|------|-------------|----------|
| Quorum (default) | Raft-based, 3+ nodes | Production workloads requiring durability |
| Classic | None (single node) | Development, non-critical data |
| Stream | Log-based, append-only | Replay, large fan-out, time-based offset |

**Note:** Classic mirrored queues are removed in modern AMQP broker versions. Use quorum queues for replicated messaging.

### Priority Queue

Quorum queues need no queue argument for priority. In RabbitMQ 4.0 through 4.2 they have two effective levels (priority above 4 is high, the rest normal); from RabbitMQ 4.3 they support strict priority across 32 levels (0-31). `x-max-priority` applies to classic queues only, which are not replicated. Separate queues per priority with weighted consumers are the portable alternative.

```javascript
await ch.assertQueue('tasks', {
  durable: true,
  arguments: { 'x-queue-type': 'quorum' },
});

// Publish with priority
ch.sendToQueue('tasks', Buffer.from(data), {
  priority: 5,                          // 4.0-4.2 quorum queues: >4 = high, otherwise normal; 4.3+: strict 0-31
  persistent: true,
});
```

---

## NATS JetStream Patterns

Examples use the `jetstream` package of the Go client (the newer API; the older `nc.JetStream()` context is legacy).

### Stream and Consumer Setup (Go)

```go
js, err := jetstream.New(nc)

stream, err := js.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
    Name:      "ORDERS",
    Subjects:  []string{"orders.>"},
    Storage:   jetstream.FileStorage,
    Retention: jetstream.LimitsPolicy,
    MaxAge:    7 * 24 * time.Hour,
    Replicas:  3,
    Discard:   jetstream.DiscardOld,
})

cons, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
    Durable:       "order-processor",    // shared by all instances: they pull from one consumer
    AckPolicy:     jetstream.AckExplicitPolicy,
    AckWait:       30 * time.Second,
    MaxDeliver:    5,
    FilterSubject: "orders.created",
})
```

### Pull Consumption

```go
cc, err := cons.Consume(func(msg jetstream.Msg) {
    if err := processOrder(msg.Data()); err != nil {
        msg.NakWithDelay(5 * time.Second)   // redeliver later; MaxDeliver bounds attempts
        return
    }
    msg.Ack()
})
defer cc.Stop()
```

Use `msg.DoubleAck(ctx)` when the processing must know the ack reached the server. Publish deduplication: set the `Nats-Msg-Id` header to the business event id; the stream drops duplicates within its duplicate window.

### Key-Value Store

```go
kv, err := js.CreateKeyValue(ctx, jetstream.KeyValueConfig{
    Bucket:  "user-sessions",
    TTL:     24 * time.Hour,
    History: 5,
})

kv.Put(ctx, "user.123", []byte(`{"active": true}`))   // keys use dots, not colons
entry, err := kv.Get(ctx, "user.123")
kv.Delete(ctx, "user.123")

watcher, err := kv.Watch(ctx, "user.*")
for update := range watcher.Updates() {
    if update != nil {
        fmt.Printf("key %s changed\n", update.Key())
    }
}
```

### Request-Reply Pattern

```go
// Service (responder)
nc.Subscribe("api.orders.get", func(msg *nats.Msg) {
    order := fetchOrder(string(msg.Data))
    msg.Respond([]byte(order))
})

// Client (requester)
reply, err := nc.Request("api.orders.get", []byte("order-123"), 2*time.Second)
```

---

## Redis Streams Patterns

### Producer with Trimming

```python
import redis

r = redis.Redis()

# Add message with auto-generated ID
msg_id = r.xadd('orders', {
    'user_id': 'u123',
    'item': 'widget',
    'qty': '5',
    'idempotency_key': 'order-abc-123',
}, maxlen=100000,                     # Trim to 100K messages
   approximate=True)                  # Approximate trimming (faster)
```

### Consumer Group Pattern

```python
# Create consumer group (idempotent)
try:
    r.xgroup_create('orders', 'processors', id='0', mkstream=True)
except redis.ResponseError:
    pass  # Group already exists

# Consumer loop
consumer_name = f"consumer-{os.getpid()}"

while True:
    # Read new messages
    entries = r.xreadgroup(
        'processors', consumer_name,
        {'orders': '>'},              # '>' means only new messages
        count=10,
        block=5000                    # Block 5 seconds
    )

    for stream, messages in entries:
        for msg_id, data in messages:
            try:
                process_order(data)
                r.xack('orders', 'processors', msg_id)
            except Exception as e:
                log.error(f"Failed to process {msg_id}: {e}")
                # Message stays in PEL (Pending Entries List)
```

### Claiming Stuck Messages

```python
# Reclaim entries idle for over 60 s from dead consumers (XAUTOCLAIM, Redis 6.2+)
def reclaim_stuck_messages():
    result = r.xautoclaim('orders', 'processors', consumer_name,
                          min_idle_time=60000, start_id='0-0', count=100)
    claimed = result[1]   # [next_start_id, entries, ...]; the tail length depends on the server version
    for msg_id, data in claimed:
        attempts = r.xpending_range('orders', 'processors', msg_id, msg_id, 1)[0]['times_delivered']
        if attempts > 5:
            r.xadd('orders:dlq', data)               # dead-letter first ...
            r.xack('orders', 'processors', msg_id)    # ... then ack the original
        else:
            process_with_idempotency(msg_id, data)
```

---

## Dead Letter Queue Strategies

### Retry Topics with Increasing Delay (Kafka)

Which errors are retryable and the backoff policy come from `reliability`; this is the broker topology.

```
Topic: orders (main)
Topic: orders.retry.1 (1s delay)
Topic: orders.retry.2 (5s delay)
Topic: orders.retry.3 (30s delay)
Topic: orders.dlq (final failure)

Flow:
  orders -> fail -> orders.retry.1 (consumer waits 1s before processing)
                    -> fail -> orders.retry.2 (consumer waits 5s)
                               -> fail -> orders.retry.3 (consumer waits 30s)
                                          -> fail -> orders.dlq
```

Each retry consumer reads the due time from a header and pauses its partition until then; it never sleeps inside the poll loop (that triggers rebalances). Every hop publishes, waits for the acknowledgement, then commits.

### DLQ Message Format

```json
{
  "original_topic": "orders",
  "original_key": "user-123",
  "original_value": { "order_id": "o456", "amount_minor": 9999, "currency": "EUR" },
  "error": {
    "type": "ProcessingException",
    "message": "Payment gateway timeout",
    "stack_trace": "..."
  },
  "retry_history": [
    { "attempt": 1, "timestamp": "2025-01-01T10:00:00Z", "error": "Connection refused" },
    { "attempt": 2, "timestamp": "2025-01-01T10:00:02Z", "error": "Timeout" },
    { "attempt": 3, "timestamp": "2025-01-01T10:00:06Z", "error": "Timeout" }
  ],
  "dlq_timestamp": "2025-01-01T10:00:14Z"
}
```

### DLQ Reprocessing

```python
def reprocess_dlq(filter_fn=None, limit=100):
    """Replay DLQ messages back to original topic."""
    messages = consume_from_dlq(limit=limit)

    for msg in messages:
        if filter_fn and not filter_fn(msg):
            continue

        # Republish to original topic
        produce(
            topic=msg['original_topic'],
            key=msg['original_key'],
            value=msg['original_value'],
            headers={'x-reprocessed-from': 'dlq', 'x-original-dlq-id': msg['id']},
        )

        ack_dlq_message(msg['id'])                     # after the republish is acknowledged
        log.info(f"Reprocessed DLQ message {msg['id']} to {msg['original_topic']}")
```

---

## Message Serialization

### Format Comparison

| Format | Size | Speed | Schema | Human-Readable |
|--------|------|-------|--------|----------------|
| JSON | Large | Moderate | Optional (JSON Schema) | Yes |
| Avro | Small | Fast | Required (built-in) | No |
| Protobuf | Small | Fastest | Required (.proto) | No |
| MessagePack | Small | Fast | No | No |

**Decision:** JSON for debugging and low volume; Avro or Protobuf with a schema registry for streams; Protobuf when contracts are shared with gRPC services. Whatever the format, amounts are decimals or integer minor units, never floats.

---

## Testing Patterns

### Embedded Broker Testing

```java
// Testcontainers (JVM): org.testcontainers.kafka.KafkaContainer with a KRaft image.
// Pin the tag to the broker version you run in production.
@Container
static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("apache/kafka:4.2.2"));

@Test
void shouldProcessOrder() {
    Properties props = new Properties();
    props.put("bootstrap.servers", kafka.getBootstrapServers());
    // ... test with real Kafka
}
```

```python
# pytest with testcontainers
@pytest.fixture
def redis_stream():
    with RedisContainer("redis:8") as redis:          # match the production server version
        yield redis.get_client()

def test_consumer_processes_message(redis_stream):
    redis_stream.xadd('orders', {'user_id': 'u1', 'item': 'test'})
    # ... assert processing result
```

### Consumer Testing Checklist
1. Happy path: message processed successfully
2. Retryable error: message retried with backoff
3. Permanent error: message sent to DLQ
4. Duplicate message: idempotent processing (same result)
5. Poison message: doesn't block queue
6. Consumer restart: resumes from last committed offset
7. Ordering: messages with same key processed in order
