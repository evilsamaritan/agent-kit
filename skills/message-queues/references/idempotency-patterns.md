# Idempotency and Consumer Group Patterns

The kit's owner of the idempotency pattern: key derivation, claim-first processing, external side effects, and cleanup. API contracts (`Idempotency-Key` headers), jobs, payments, and database skills link here.

## Contents

- [Key Derivation](#key-derivation)
- [Dedup Table](#dedup-table)
- [Claim-First Consumer](#claim-first-consumer)
- [External Side Effects](#external-side-effects)
- [Dedup Cleanup](#dedup-cleanup)
- [Consumer Group Patterns](#consumer-group-patterns)

---

## Key Derivation

The key identifies one **intent**, and every retry of that intent carries the same key.

- **From intent:** a key the client generates once per user action, or a business identity (`order-123:charge`, the producer's event id). Never derive it from the current time, a random value generated per attempt, or an auto-increment id.
- **Not the broker's delivery id:** redelivery, republish from a dead-letter queue, or an outbox relay retry can produce a new message id for the same event.
- **Scoped:** unique per client, account, or tenant (`UNIQUE (scope, key)`), so callers cannot collide or read each other's results.
- **Bound to the request:** store a hash of the request payload; the same key with a different payload is a client error (conflict), not a replay.
- **HTTP side:** an `Idempotency-Key` is scoped to the caller, and a concurrent duplicate while the first request is still in flight gets 409. The full header contract is in [api-design rest-patterns.md](../../api-design/references/rest-patterns.md#idempotency).

---

## Dedup Table

```sql
CREATE TABLE processed_messages (
  scope            TEXT NOT NULL,            -- consumer name, client id, or tenant
  idempotency_key  TEXT NOT NULL,
  request_hash     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | done
  result           JSONB,
  claimed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  PRIMARY KEY (scope, idempotency_key)
);
```

---

## Claim-First Consumer

Claim the key with a unique insert **before** doing the work. Two concurrent deliveries cannot both win the insert; a `SELECT ... FOR UPDATE` on a row that does not exist yet locks nothing, so check-then-insert lets both run.

```python
def handle(msg):
    key = msg.payload["event_id"]                     # business id from the producer
    req_hash = sha256(msg.raw_payload)

    with db.transaction():
        claimed = db.execute(
            """INSERT INTO processed_messages (scope, idempotency_key, request_hash)
               VALUES (%s, %s, %s)
               ON CONFLICT (scope, idempotency_key) DO NOTHING
               RETURNING idempotency_key""",
            ["billing-consumer", key, req_hash],
        ).fetchone()

        if claimed is None:                            # someone already processed or is processing it
            row = db.query_one(
                "SELECT request_hash, result FROM processed_messages WHERE scope = %s AND idempotency_key = %s",
                ["billing-consumer", key],
            )
            if row.request_hash != req_hash:
                raise ConflictingReuse(key)            # same key, different payload
            result = row.result                        # duplicate: skip the work
        else:
            result = apply_business_change(msg)        # writes in the SAME transaction
            db.execute(
                """UPDATE processed_messages SET status = 'done', result = %s, completed_at = NOW()
                   WHERE scope = %s AND idempotency_key = %s""",
                [result, "billing-consumer", key],
            )

    commit_offset_or_ack(msg)                          # only after the transaction commits
    return result
```

If the transaction rolls back, the claim rolls back with it and redelivery retries cleanly. This covers effects inside the same database transaction only.

---

## External Side Effects

Effects outside the transaction (payment provider call, email, another service's API) cannot commit atomically with the claim. Options, strongest first:

1. **Provider idempotency key.** Pass the same key to a provider that supports idempotent requests; a retry returns the original outcome.
2. **Outbox.** Record the intended effect in the same transaction as the claim and state change; a relay performs it at least once with the key above.
3. **In-progress claim with a lease.** Commit the claim as `in_progress` with an expiry, perform the effect, then mark `done`. A redelivery that finds a live `in_progress` claim backs off; one that finds an expired claim must check the effect's real state (query the provider) before retrying.
4. **Accept duplicates** only where a repeated effect is harmless (an idempotent notification), and say so explicitly.

Doing the side effect last only narrows the window in which a crash causes a duplicate; it does not remove it.

---

## Dedup Cleanup

- Keep entries longer than the longest possible redelivery or replay window (broker retention, dead-letter replay delay, client retry horizon).
- Delete with a scheduled job or a TTL index; partition the table by time if it is large.
- Consumers that can replay from the start of a log need either permanent keys or naturally idempotent writes (versioned upserts) for old events.

---

## Consumer Group Patterns

### Rebalancing

- **Kafka protocol:** with the classic group protocol, use the cooperative-sticky assignor; with the newer consumer protocol (`group.protocol=consumer`), assignment runs on the broker. Static membership reduces rebalances on restarts ([kafka-patterns.md](kafka-patterns.md#consumer-configuration)).
- **Pull-based durable consumers** (JetStream-style): members pull from a shared consumer, so there is no partition rebalance.
- **Redis-compatible streams:** consumer groups track per-consumer pending entries; reclaim entries from dead consumers with `XAUTOCLAIM`.

### Lag Monitoring

- Measure lag per group and partition (`kafka-consumer-groups.sh --describe`, or a lag exporter feeding metrics).
- Alert on sustained lag growth rather than an absolute number.
- Remedy: scale consumers (up to the partition count for consumer groups), speed up processing, or move to share groups for unordered work.

### Ordering vs Parallelism

- More partitions give more parallelism; ordering holds only within a partition.
- Strict global order requires one partition and limits throughput.
- Per-entity order: key by the entity id.
