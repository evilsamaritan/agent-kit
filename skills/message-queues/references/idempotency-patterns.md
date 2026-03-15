# Idempotency & Consumer Group Patterns

Deduplication strategies, idempotent consumers, and consumer group management.

## Contents

- [Deduplication Key](#deduplication-key)
- [Idempotent Consumer Pattern](#idempotent-consumer-pattern)
- [Dedup Cleanup](#dedup-cleanup)
- [Consumer Group Patterns](#consumer-group-patterns)

---

## Deduplication Key

```sql
CREATE TABLE processed_messages (
  idempotency_key  TEXT PRIMARY KEY,
  result           JSONB,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Before processing:
-- 1. Check if idempotency_key exists
-- 2. If yes, return stored result (skip processing)
-- 3. If no, process and store result + key atomically
```

---

## Idempotent Consumer Pattern

```python
def process_message(msg):
    dedup_key = msg.headers.get('idempotency-key') or msg.id

    with db.transaction():
        existing = db.query(
            "SELECT result FROM processed_messages WHERE idempotency_key = %s FOR UPDATE",
            [dedup_key]
        )
        if existing:
            return existing.result  # already processed

        result = do_business_logic(msg)

        db.execute(
            "INSERT INTO processed_messages (idempotency_key, result) VALUES (%s, %s)",
            [dedup_key, result]
        )

    commit_offset(msg)  # only after successful processing + dedup insert
    return result
```

---

## Dedup Cleanup

- Expire dedup entries after a window (e.g., 7 days)
- Use TTL index or scheduled cleanup job
- Window must exceed maximum possible redelivery delay

---

## Consumer Group Patterns

### Rebalancing

- **Kafka**: partition reassignment when consumers join/leave; use `cooperative-sticky` assignor
- **NATS**: pull-based consumers avoid rebalancing entirely
- **Redis Streams**: manual partition assignment via XREADGROUP

### Lag Monitoring

- **Kafka**: `kafka-consumer-groups.sh --describe` or Burrow for real-time lag
- **Alert threshold**: consumer lag growing steadily = consumers can't keep up
- **Action**: scale consumers (up to partition count) or optimize processing

### Ordering vs Parallelism Trade-off

- More partitions = more parallelism, but ordering only within partition
- If strict global order needed: single partition (limits throughput)
- If per-entity order needed: use entity ID as partition key
