# Kafka-Protocol Patterns

Producer/consumer configuration, exactly-once semantics, schema registry, and Kafka Connect. Applies to any Kafka-protocol-compatible broker (Apache Kafka, Redpanda, WarpStream, etc.).

## Contents

- [Producer Configuration](#producer-configuration)
- [Consumer Configuration](#consumer-configuration)
- [Exactly-Once Semantics](#exactly-once-semantics)
- [Schema Registry](#schema-registry)
- [Kafka Connect](#kafka-connect)
- [Topic Design](#topic-design)
- [Operational Patterns](#operational-patterns)

---

## Producer Configuration

### Essential Settings

```properties
# Durability
acks=all                              # Wait for all ISR replicas to acknowledge
enable.idempotence=true               # Prevent duplicate writes on retry
max.in.flight.requests.per.connection=5  # Safe with idempotence enabled

# Batching (throughput vs latency trade-off)
batch.size=65536                      # 64KB batch size
linger.ms=5                           # Wait up to 5ms to fill batch
compression.type=lz4                  # LZ4 for speed, zstd for ratio

# Reliability
retries=2147483647                    # Max retries (bounded by delivery.timeout.ms)
delivery.timeout.ms=120000            # 2 minute total timeout
request.timeout.ms=30000             # Per-request timeout

# Serialization
key.serializer=StringSerializer       # Or Avro/Protobuf with schema registry
value.serializer=StringSerializer
```

### Producer Pattern (Java)

```java
Properties props = new Properties();
props.put("bootstrap.servers", "broker1:9092,broker2:9092");
props.put("acks", "all");
props.put("enable.idempotence", "true");
props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
props.put("value.serializer", "io.confluent.kafka.serializers.KafkaAvroSerializer");
props.put("schema.registry.url", "http://schema-registry:8081");

KafkaProducer<String, Order> producer = new KafkaProducer<>(props);

ProducerRecord<String, Order> record = new ProducerRecord<>(
    "orders",               // topic
    order.getUserId(),      // key (determines partition)
    order                   // value
);

// Async send with callback
producer.send(record, (metadata, exception) -> {
    if (exception != null) {
        log.error("Send failed: topic={} key={}", record.topic(), record.key(), exception);
    } else {
        log.info("Sent: topic={} partition={} offset={}",
            metadata.topic(), metadata.partition(), metadata.offset());
    }
});
```

---

## Consumer Configuration

### Essential Settings

```properties
# Group management
group.id=order-processor
group.instance.id=order-processor-1     # Static membership (reduces rebalances)

# Offset management
auto.offset.reset=earliest              # Start from beginning if no committed offset
enable.auto.commit=false                # Manual commit for exactly-once

# Performance
max.poll.records=500                    # Records per poll()
max.poll.interval.ms=300000             # 5 min max processing time per batch
fetch.min.bytes=1024                    # Wait for 1KB before fetching
fetch.max.wait.ms=500                   # Max wait for fetch.min.bytes

# Rebalance strategy
partition.assignment.strategy=org.apache.kafka.clients.consumer.CooperativeStickyAssignor
```

### Consumer Pattern

```java
KafkaConsumer<String, Order> consumer = new KafkaConsumer<>(props);
consumer.subscribe(List.of("orders"));

while (running) {
    ConsumerRecords<String, Order> records = consumer.poll(Duration.ofMillis(1000));

    for (ConsumerRecord<String, Order> record : records) {
        try {
            processOrder(record.value());
            // Don't commit here -- batch commit below
        } catch (RetryableException e) {
            // Send to retry topic with backoff
            retryProducer.send(new ProducerRecord<>("orders.retry", record.key(), record.value()));
        } catch (PermanentException e) {
            // Send to DLQ
            dlqProducer.send(new ProducerRecord<>("orders.dlq", record.key(), record.value()));
        }
    }

    // Commit after processing entire batch
    consumer.commitSync();
}
```

---

## Exactly-Once Semantics

### Transactional Producer-Consumer

```java
// Producer setup
props.put("transactional.id", "order-processor-txn");
producer.initTransactions();

// Consume-transform-produce loop
while (running) {
    ConsumerRecords<String, Order> records = consumer.poll(Duration.ofMillis(1000));

    producer.beginTransaction();
    try {
        for (ConsumerRecord<String, Order> record : records) {
            ProcessedOrder result = transform(record.value());
            producer.send(new ProducerRecord<>("processed-orders", record.key(), result));
        }

        // Commit consumer offsets within the same transaction
        Map<TopicPartition, OffsetAndMetadata> offsets = currentOffsets(records);
        producer.sendOffsetsToTransaction(offsets, consumer.groupMetadata());

        producer.commitTransaction();
    } catch (Exception e) {
        producer.abortTransaction();
        // Consumer will re-read from last committed offset
    }
}
```

### Exactly-Once Checklist
1. Idempotent producer: `enable.idempotence=true`
2. Transactional producer: set `transactional.id`
3. Manual offset commits within transaction
4. Consumer `isolation.level=read_committed`
5. Downstream writes must be idempotent (dedup key in DB)

---

## Schema Registry

### Avro Schema Evolution

```json
{
  "type": "record",
  "name": "Order",
  "namespace": "com.example.events",
  "fields": [
    {"name": "order_id", "type": "string"},
    {"name": "user_id", "type": "string"},
    {"name": "amount", "type": "double"},
    {"name": "currency", "type": "string", "default": "USD"},
    {"name": "metadata", "type": ["null", "string"], "default": null}
  ]
}
```

### Compatibility Modes

| Mode | Add Field | Remove Field | Change Type | Use When |
|------|-----------|-------------|-------------|----------|
| BACKWARD (default) | With default | Yes | No | Consumers upgrade first |
| FORWARD | Yes | With default | No | Producers upgrade first |
| FULL | With default | With default | No | Independent upgrades |
| NONE | Yes | Yes | Yes | Development only |

**Rule:** Use FULL compatibility in production. Every field addition needs a default. Every removal needs the field to already have a default.

### Schema Registry API

```bash
# Register schema
curl -X POST http://schema-registry:8081/subjects/orders-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema": "{\"type\":\"record\",\"name\":\"Order\",...}"}'

# Check compatibility
curl -X POST http://schema-registry:8081/compatibility/subjects/orders-value/versions/latest \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema": "{...new schema...}"}'

# List subjects
curl http://schema-registry:8081/subjects
```

---

## Kafka Connect

### Source Connector (DB -> Kafka)

```json
{
  "name": "postgres-orders-source",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium",
    "database.dbname": "orders_db",
    "table.include.list": "public.orders",
    "topic.prefix": "cdc",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_orders",
    "publication.name": "orders_pub",
    "transforms": "route",
    "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
    "transforms.route.regex": "cdc\\.public\\.(.*)",
    "transforms.route.replacement": "orders.$1.events"
  }
}
```

### Sink Connector (Kafka -> External)

```json
{
  "name": "elasticsearch-sink",
  "config": {
    "connector.class": "io.confluent.connect.elasticsearch.ElasticsearchSinkConnector",
    "topics": "processed-orders",
    "connection.url": "http://elasticsearch:9200",
    "type.name": "_doc",
    "key.ignore": "false",
    "schema.ignore": "false",
    "behavior.on.null.values": "delete",
    "write.method": "upsert"
  }
}
```

---

## Share Groups

Share groups (KIP-932) provide queue-like semantics on top of Kafka topics. Unlike consumer groups where each partition is assigned to exactly one consumer, share groups allow multiple consumers to process from the same partitions concurrently.

### Key Characteristics

| Feature | Consumer Groups | Share Groups |
|---------|----------------|--------------|
| Partition assignment | 1 consumer per partition | Any consumer reads any partition |
| Acknowledgment | Offset-based (batch) | Per-record |
| Ordering | Per-partition guaranteed | No ordering guarantee |
| Delivery counting | Manual (via headers) | Built-in (max delivery attempts) |
| Use case | Stream processing | Task queues, work distribution |

### When to Use Share Groups

- Task-queue workloads where ordering does not matter
- Scaling consumers beyond partition count
- Work distribution where any consumer can process any record

### When to Keep Consumer Groups

- Ordered stream processing (per-partition ordering required)
- Stateful processing (aggregations, windowing)
- Kafka Streams / Flink applications

---

## Topic Design

### Naming Convention
```
<domain>.<entity>.<event-type>
Example: orders.payment.completed
         users.profile.updated
         inventory.stock.low
```

### Partition Count Guidelines
- Start with `max(expected_throughput_MB/s, expected_consumer_count)`
- Can increase partitions but NEVER decrease (breaks key-based ordering)
- Common starting points: 6 for low volume, 12-24 for medium, 50+ for high

### Retention Settings
```properties
# Time-based retention
retention.ms=604800000              # 7 days (default)

# Size-based retention
retention.bytes=1073741824          # 1GB per partition

# Compacted topics (keep latest per key)
cleanup.policy=compact
min.compaction.lag.ms=3600000       # Don't compact last 1 hour
```

---

## Operational Patterns

### Consumer Lag Monitoring

```bash
# Check lag for a consumer group
kafka-consumer-groups.sh --bootstrap-server broker:9092 \
  --describe --group order-processor

# Key metrics to alert on:
# - LAG column: growing = consumers can't keep up
# - CURRENT-OFFSET vs LOG-END-OFFSET: gap = unprocessed messages
```

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Consumer lag (messages) | > 10,000 | > 100,000 |
| Consumer lag growth rate | Increasing for 5min | Increasing for 15min |
| Under-replicated partitions | > 0 for 5min | > 0 for 15min |
| Offline partitions | Any | Any |
| Request latency (p99) | > 100ms | > 1s |

### Partition Reassignment
```bash
# Generate reassignment plan
kafka-reassign-partitions.sh --bootstrap-server broker:9092 \
  --topics-to-move-json-file topics.json \
  --broker-list "1,2,3" --generate

# Execute reassignment
kafka-reassign-partitions.sh --bootstrap-server broker:9092 \
  --reassignment-json-file plan.json --execute

# Throttle reassignment to avoid impacting production
kafka-reassign-partitions.sh --bootstrap-server broker:9092 \
  --reassignment-json-file plan.json --execute --throttle 50000000
```
