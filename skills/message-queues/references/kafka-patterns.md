# Kafka-Protocol Patterns

Producer/consumer configuration, rebalance protocols, transactions, schema registry, and Kafka Connect. Applies to Kafka-protocol-compatible brokers (Apache Kafka, Redpanda, WarpStream, and others); compatible brokers implement different subsets, so check the broker and client versions in use.

**Version notes (Apache Kafka):** 4.0 removed ZooKeeper (KRaft is the only metadata mode) and made the new consumer rebalance protocol generally available; share groups were early access in 4.0, preview in 4.1, and production-ready in 4.2. Client libraries adopt these features at different times.

## Contents

- [Producer Configuration](#producer-configuration)
- [Consumer Configuration](#consumer-configuration)
- [Transactions (Kafka-to-Kafka Exactly-Once)](#transactions-kafka-to-kafka-exactly-once)
- [Schema Registry](#schema-registry)
- [Kafka Connect](#kafka-connect)
- [Share Groups](#share-groups)
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
enable.auto.commit=false                # Commit after processing: at-least-once (duplicates possible)

# Performance
max.poll.records=500                    # Records per poll()
max.poll.interval.ms=300000             # 5 min max processing time per batch
fetch.min.bytes=1024                    # Wait for 1KB before fetching
fetch.max.wait.ms=500                   # Max wait for fetch.min.bytes
```

### Rebalance Protocol Generations

| Setting | Classic protocol (`group.protocol=classic`) | Consumer protocol (`group.protocol=consumer`, Kafka 4.0+ brokers) |
|---|---|---|
| Assignment | Client-side assignor: `partition.assignment.strategy=...CooperativeStickyAssignor` | Broker-side; the client may name one with `group.remote.assignor` |
| Rebalance behavior | Group-wide, cooperative with the sticky assignor | Incremental per member, no global pause |
| Client settings not used | — | `partition.assignment.strategy`, `session.timeout.ms`, `heartbeat.interval.ms` (set on the broker instead) |

Check which protocol your client defaults to; setting classic-only properties under the consumer protocol is rejected or ignored depending on the client.

### Consumer Pattern (at-least-once)

```java
KafkaConsumer<String, Order> consumer = new KafkaConsumer<>(props);
consumer.subscribe(List.of("orders"));

while (running) {
    ConsumerRecords<String, Order> records = consumer.poll(Duration.ofMillis(1000));
    List<Future<RecordMetadata>> pending = new ArrayList<>();

    for (ConsumerRecord<String, Order> record : records) {
        try {
            processOrder(record.value());                    // idempotent: see idempotency-patterns.md
        } catch (RetryableException e) {
            pending.add(producer.send(toRetryTopic(record, e)));
        } catch (PermanentException e) {
            pending.add(producer.send(toDeadLetterTopic(record, e)));
        }
    }

    // Wait for every retry/dead-letter publish to be acknowledged before committing.
    // If one fails, seek back to the committed offsets (or stop the consumer);
    // otherwise the next commit skips these records. Duplicates are absorbed by idempotency.
    try {
        for (Future<RecordMetadata> f : pending) {
            f.get();
        }
        consumer.commitSync();
    } catch (ExecutionException e) {
        Map<TopicPartition, OffsetAndMetadata> committed = consumer.committed(consumer.assignment());
        for (TopicPartition tp : consumer.assignment()) {
            OffsetAndMetadata om = committed.get(tp);
            if (om != null) consumer.seek(tp, om.offset());
            else consumer.seekToBeginning(List.of(tp));   // or apply auto.offset.reset policy
        }
    }
}
```

Retry topics delay processing without blocking the main partition: the retry consumer reads the record's due time from a header and pauses that partition (`consumer.pause`) until it is due, instead of sleeping inside the poll loop.

---

## Transactions (Kafka-to-Kafka Exactly-Once)

Transactions make consume-transform-produce between Kafka topics atomic: output records and input offsets commit together. They do not cover external effects (database writes, HTTP calls), which still need idempotency.

### Transactional Producer-Consumer

```java
// One stable transactional.id per producer instance (e.g. service name + instance ordinal).
// Fencing uses the consumer group metadata, so ids need not map to input partitions.
props.put("transactional.id", "order-enricher-" + instanceOrdinal);
producer.initTransactions();

while (running) {
    ConsumerRecords<String, Order> records = consumer.poll(Duration.ofMillis(1000));
    if (records.isEmpty()) continue;

    producer.beginTransaction();
    try {
        for (ConsumerRecord<String, Order> record : records) {
            producer.send(new ProducerRecord<>("orders.enriched", record.key(), enrich(record.value())));
        }
        producer.sendOffsetsToTransaction(nextOffsets(records), consumer.groupMetadata());
        producer.commitTransaction();
    } catch (ProducerFencedException | InvalidProducerEpochException e) {
        producer.close();          // another instance took over this transactional.id
        throw e;                   // stop this instance; do not continue with a fenced producer
    } catch (KafkaException e) {
        producer.abortTransaction();
        // The consumer's in-memory position has already advanced past these records.
        // Rewind to the last committed offsets so the aborted batch is processed again.
        Map<TopicPartition, OffsetAndMetadata> committed = consumer.committed(consumer.assignment());
        for (TopicPartition tp : consumer.assignment()) {
            OffsetAndMetadata om = committed.get(tp);
            if (om != null) consumer.seek(tp, om.offset());
            else consumer.seekToBeginning(List.of(tp));   // or per auto.offset.reset
        }
    }
}
```

### Checklist
1. Idempotent producer: `enable.idempotence=true` (default in current clients)
2. Stable `transactional.id` per producer instance
3. Offsets committed through `sendOffsetsToTransaction`, never `commitSync`
4. Downstream consumers use `isolation.level=read_committed`
5. On abort, seek back to committed offsets; on fencing, close the producer
6. Effects outside Kafka are idempotent ([idempotency-patterns.md](idempotency-patterns.md))

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
    {"name": "amount", "type": {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 2}},
    {"name": "currency", "type": "string"},
    {"name": "metadata", "type": ["null", "string"], "default": null}
  ]
}
```

### Compatibility Modes

| Mode | Checked against | Add Field | Remove Field | Use When |
|------|-----------------|-----------|-------------|----------|
| BACKWARD (common registry default) | Latest version | With default | Yes | Consumers upgrade first |
| FORWARD | Latest version | Yes | With default | Producers upgrade first |
| FULL | Latest version | With default | With default | Independent upgrades |
| BACKWARD_TRANSITIVE, FORWARD_TRANSITIVE, FULL_TRANSITIVE | All registered versions | As above | As above | Consumers replay history spanning several versions |
| NONE | — | Yes | Yes | Development only |

**Rule:** choose by upgrade order and replay. A replayable topic whose retention spans several schema versions needs a transitive mode; a non-transitive check only proves compatibility with the latest version. Money is a decimal logical type or integer minor units with a currency — never `float`/`double`.

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
    "key.ignore": "false",
    "schema.ignore": "false",
    "behavior.on.null.values": "delete",
    "write.method": "upsert"
  }
}
```

---

## Share Groups

Share groups (KIP-932, "queues for Kafka") give queue-like consumption on a topic: any member can receive records from any partition, each record is acknowledged individually (accept, release, reject), and the broker counts delivery attempts. Status: early access in Kafka 4.0, preview in 4.1, production-ready in 4.2; client support outside the Java client varies, so check your client before designing around them.

| Feature | Consumer Groups | Share Groups |
|---------|----------------|--------------|
| Partition assignment | One member per partition | Members share partitions |
| Acknowledgment | Offset commit (batch) | Per record |
| Ordering | Per partition | None |
| Delivery counting | Application-level (headers) | Built in, with a delivery limit |
| Use case | Ordered stream processing, stateful processing | Task-style work, scaling beyond the partition count |

Keep consumer groups for ordered or stateful processing (aggregations, windowing, stream-processing frameworks).

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
- Partitions can be added but never removed; adding them changes which partition a key maps to, so per-key ordering breaks across the change — size up front for keyed topics
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

Starting points; tune to your throughput and latency objectives.

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
