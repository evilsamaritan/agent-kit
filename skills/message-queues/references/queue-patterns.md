# Queue Patterns

AMQP broker exchanges, NATS JetStream, Redis Streams, and DLQ strategies.

## Contents

- [AMQP Broker Patterns](#amqp-broker-patterns)
- [NATS JetStream Patterns](#nats-jetstream-patterns)
- [Redis Streams Patterns](#redis-streams-patterns)
- [Dead Letter Queue Strategies](#dead-letter-queue-strategies)
- [Message Serialization](#message-serialization)
- [Testing Patterns](#testing-patterns)

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
      'x-dead-letter-exchange': 'events.dlx',
      'x-message-ttl': 30000,         // Messages expire after 30s if unacked
    },
  });

  // Bind queue to exchange with routing pattern
  await ch.bindQueue('order-processing', 'events', 'order.*');

  // Publish
  ch.publish('events', 'order.created', Buffer.from(JSON.stringify({
    orderId: '123',
    userId: 'u456',
    amount: 99.99,
  })), {
    persistent: true,                   // Survive broker restart
    messageId: 'msg-unique-id',        // For idempotency
    timestamp: Date.now(),
    headers: { 'x-retry-count': 0 },
  });
}
```

### Consumer with Manual Ack

```javascript
async function consume() {
  const ch = await conn.createChannel();
  await ch.prefetch(10);                // Process 10 at a time

  ch.consume('order-processing', async (msg) => {
    try {
      const order = JSON.parse(msg.content.toString());
      await processOrder(order);
      ch.ack(msg);                      // Success -- acknowledge
    } catch (err) {
      const retryCount = (msg.properties.headers['x-retry-count'] || 0);
      if (retryCount < 3) {
        // Retry with incremented count
        ch.publish('events', msg.fields.routingKey, msg.content, {
          ...msg.properties,
          headers: { ...msg.properties.headers, 'x-retry-count': retryCount + 1 },
        });
        ch.ack(msg);                    // Ack original to prevent infinite nack loop
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

Quorum queues support 2-level priority (normal: 0-4, high: 5-10). For fine-grained priority, use classic queues (development only) or application-level priority sorting.

```javascript
await ch.assertQueue('high-priority-tasks', {
  durable: true,
  arguments: { 'x-max-priority': 10 },
});

// Publish with priority
ch.sendToQueue('high-priority-tasks', Buffer.from(data), {
  priority: 8,                          // 0 (lowest) to 10 (highest)
  persistent: true,
});
```

---

## NATS JetStream Patterns

### Stream and Consumer Setup (Go)

```go
js, _ := nc.JetStream()

// Create stream
_, err := js.AddStream(&nats.StreamConfig{
    Name:       "ORDERS",
    Subjects:   []string{"orders.>"},       // Wildcard subject matching
    Storage:    nats.FileStorage,
    Retention:  nats.LimitsPolicy,
    MaxAge:     7 * 24 * time.Hour,         // 7 day retention
    MaxMsgs:    -1,                         // Unlimited messages
    Replicas:   3,                          // 3-way replication
    Discard:    nats.DiscardOld,            // Drop oldest when limit reached
})

// Create durable consumer
_, err = js.AddConsumer("ORDERS", &nats.ConsumerConfig{
    Durable:       "order-processor",
    DeliverPolicy: nats.DeliverAllPolicy,
    AckPolicy:     nats.AckExplicitPolicy,
    AckWait:       30 * time.Second,
    MaxDeliver:    5,                       // Max redelivery attempts
    FilterSubject: "orders.created",
    DeliverGroup:  "processors",            // Load balance across group
})
```

### Pull-Based Consumer (Preferred)

```go
sub, _ := js.PullSubscribe("orders.created", "order-processor")

for {
    msgs, err := sub.Fetch(10, nats.MaxWait(5*time.Second))
    if err != nil {
        continue
    }
    for _, msg := range msgs {
        if err := processOrder(msg.Data); err != nil {
            msg.Nak()              // Trigger redelivery
        } else {
            msg.Ack()
        }
    }
}
```

### Key-Value Store

```go
kv, _ := js.CreateKeyValue(&nats.KeyValueConfig{
    Bucket:  "user-sessions",
    TTL:     24 * time.Hour,
    History: 5,                // Keep 5 revisions
})

// CRUD operations
kv.Put("user:123", []byte(`{"active": true, "last_seen": "2025-01-01"}`))
entry, _ := kv.Get("user:123")
kv.Delete("user:123")

// Watch for changes
watcher, _ := kv.Watch("user.*")
for update := range watcher.Updates() {
    if update != nil {
        fmt.Printf("Key %s changed: %s\n", update.Key(), update.Value())
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
# Claim messages pending for over 60 seconds (dead consumer recovery)
def claim_stuck_messages():
    pending = r.xpending_range('orders', 'processors', '-', '+', count=100)

    for entry in pending:
        msg_id = entry['message_id']
        idle_time = entry['time_since_delivered']
        delivery_count = entry['times_delivered']

        if idle_time > 60000:  # 60 seconds
            if delivery_count > 5:
                # Move to DLQ
                msg = r.xrange('orders', msg_id, msg_id)
                if msg:
                    r.xadd('orders:dlq', msg[0][1])
                    r.xack('orders', 'processors', msg_id)
            else:
                # Claim and retry
                r.xclaim('orders', 'processors', consumer_name, 60000, msg_id)
```

---

## Dead Letter Queue Strategies

### Retry with Exponential Backoff (Kafka)

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

### DLQ Message Format

```json
{
  "original_topic": "orders",
  "original_key": "user-123",
  "original_value": { "order_id": "o456", "amount": 99.99 },
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

        ack_dlq_message(msg['id'])
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

**Decision:** Use JSON for debugging/low volume. Avro with Schema Registry for Kafka. Protobuf for gRPC integration. MessagePack for Redis Streams.

---

## Testing Patterns

### Embedded Broker Testing

```java
// Testcontainers (JVM)
@Container
static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));

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
    with RedisContainer("redis:7") as redis:
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
