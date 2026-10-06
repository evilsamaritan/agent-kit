---
name: database
description: "Design or review data storage and access. Use for schemas, migrations, indexes, slow queries, N+1, ORM data access, transactions, multi-tenancy, and relational, document, or vector stores (Postgres, MySQL, SQLite, and similar). Do NOT use for cache design (caching) or search relevance (search)."
---

# Database

Determine the engine, its version, and the data-access library from the project (driver and ORM in the manifest, migration config, container image) before giving engine-specific advice.

## Scope and boundaries

| Question | Owner |
|---|---|
| Schemas, constraints, indexes, query plans, transactions, isolation, migrations, partitioning, row-level security, ORM and query-builder use, vector columns and ANN indexes | this skill |
| Which component is authoritative for which data; repository and unit-of-work boundaries; outbox, saga, CQRS, event sourcing as design choices; sharding strategy | `architecture` ([repository](../architecture/references/integration-patterns.md#repository-and-unit-of-work), [outbox](../architecture/references/integration-patterns.md#transactional-outbox), [CQRS](../architecture/references/integration-patterns.md#cqrs-separate-query-model)) |
| Idempotency pattern (claim first, keys derived from intent) | `message-queues` → [idempotency-patterns.md](../message-queues/references/idempotency-patterns.md) |
| Cache layers, invalidation, distributed locks | `caching` |
| Retrieval quality: hybrid ranking, reranking, relevance evaluation | `search` |
| Measuring query latency and capacity | `performance` |
| Threat model, encryption and key management, PII handling policy | `security`, `compliance` |
| Rolling out code and schema together | `release-engineering` (the migration steps themselves stay here) |
| Backup and point-in-time-restore mechanics | this skill |
| RPO/RTO targets, restore drills | `reliability` ([recovery.md](../reliability/references/recovery.md)) |

## Rules

- Give durable data one authoritative store. Caches, read projections, and in-memory copies are not authoritative.
- Make retryable writes idempotent, or define an explicit at-most-once contract and its failure behavior. An upsert that overwrites newer state on replay is repeatable, not idempotent.
- Keep audit trails append-only when the domain or a compliance requirement depends on immutable history.
- Give derived values a declared source. Persist denormalized aggregates only with explicit update, rebuild, and reconciliation semantics.
- Use exact numeric types for money (DECIMAL/NUMERIC or integer minor units with a currency) — never floating point.
- Store instants with timezone information (UTC).
- Every migration step stays compatible with the application version still running. Destructive steps go last and roll forward.

## Database type decision tree

```
What is the primary workload?
├─ Structured data with relationships → Relational (SQL)
│  ├─ Embedded / edge / single-file → SQLite-class engine
│  └─ Shared server → PostgreSQL- or MySQL-compatible engine
│     (rich types and extensions favor PostgreSQL; existing hosting and tooling often decide)
├─ Document-shaped data read and written as a whole → Document store
│  └─ Built-in sharding required → sharded document store
├─ Time-series, IoT, metrics → Time-series engine, or a time-series extension on an existing relational DB
├─ Similarity search over embeddings → vector extension on the existing DB first; dedicated vector DB at scale
└─ Analytics, OLAP, columnar scans → Columnar / analytical engine
```

Engine short-lists and syntax: [engine-specific.md](references/engine-specific.md). Start with a single instance; add read replicas when read load demands it and the code tolerates replication lag.

## Core patterns

### Schema design
- Surrogate vs natural keys; prefer time-ordered UUIDs (UUIDv7) for new distributed-generated keys.
- Foreign keys, cascading rules, CHECK constraints for domain invariants, NOT NULL by default.
- Enums: database-level types are cheap to read and costly to change; a lookup table or CHECK is easier to extend.

### Transactions and concurrency
- Pick the isolation level per operation; know which anomalies the engine's default allows.
- Optimistic concurrency with a version column (`WHERE version = $expected`); pessimistic row locks or advisory locks when contention is high.
- Keep transactions short; never hold one open across a network call to another service.

### Idempotent writes
- Claim with a unique key first (`INSERT ... ON CONFLICT DO NOTHING RETURNING`), then read and return the stored result on conflict. Full pattern: [idempotency-patterns.md](../message-queues/references/idempotency-patterns.md).
- Keys come from the caller's intent (client key, business id), scoped per client — never auto-increment ids or timestamps.
- `ON CONFLICT DO UPDATE` only for last-writer-wins data guarded by a version or timestamp in the `WHERE` clause.

### Safe migrations
- **Expand → migrate → contract.** Add the new structure, backfill, switch reads, then remove the old structure in a later release. Never rename or drop a column in one step.
- **Know the lock.** Each DDL statement takes a lock that differs by engine and form; a statement that waits for a lock blocks every query queued behind it. Set a short lock timeout for migration sessions and retry instead of waiting.
- **Indexes:** build concurrently or online (`CREATE INDEX CONCURRENTLY`, online DDL). A concurrent build cannot run inside a transaction and can leave an invalid index on failure — check and drop it.
- **Constraints:** add unvalidated, then validate separately (`NOT VALID` then `VALIDATE CONSTRAINT`); reach NOT NULL through a validated CHECK on large tables.
- **Single runner:** exactly one process applies migrations per deploy, as a pre-deploy step or hook, a one-off job, or a migration lock the tool takes. Replicas check at startup that the schema version is applied and do not run migrations themselves; concurrent runners race on the same DDL. A failed or interrupted migration must be safe to re-run (idempotent steps, or tracked per step).
- **Backfills:** batched, throttled, resumable, with a stop condition — never one UPDATE over the whole table.
- **Rewrites:** changing a column type or adding a volatile default can rewrite the table; plan these as new column plus backfill.
- **Destructive steps:** run only after no deployed code reads the structure; recover by rolling forward and from a verified backup or point-in-time recovery, not from a down migration.

### Backup and restore
- Take base backups plus continuous log archiving (WAL/binlog) so the database restores to any point in time; a snapshot alone restores only to its own moment.
- Restore into a separate instance, replay logs to the target time, check integrity and row counts, then cut over or copy the data back. A backup never restored is untested.
- Encrypt backups and keep them outside the failure domain of the primary. Targets (RPO/RTO), schedules, and drills are set by `reliability` ([recovery.md](../reliability/references/recovery.md)).

### Indexing and query optimization
- B-tree by default; GIN/GiST for documents, arrays, full text, ranges; BRIN for naturally ordered large tables.
- Composite index order: equality columns before range columns; covering and partial indexes for hot paths.
- Read plans with actual execution (`EXPLAIN (ANALYZE, BUFFERS)` or the engine's equivalent) on production-like data.
- N+1: batch or join; assert query counts in tests ([orm-patterns.md](references/orm-patterns.md)).

### Connections
- The sum of all pools across all application instances, workers, and poolers must stay under the server's connection limit.
- Size from Little's law (throughput times time each request holds a connection). The rule of thumb `cores of the database host * 2 + effective spindles` is only a starting point for total active connections to a database server; it counts the database host's cores, not the application's. Verify by measuring pool wait time (`performance` owns the method).
- Put an external pooler in front when many instances connect.
- A transaction-mode pooler breaks session state: use transaction-scoped settings (`SET LOCAL`), and check prepared-statement and advisory-lock support.

### Partitioning
- Declarative partitioning by RANGE (time), LIST (tenant, region), or HASH; queries must filter on the partition key to prune.
- Create future partitions ahead of time from a scheduled job; keep a default partition to catch strays.

### Multi-tenancy
- Shared tables with `tenant_id` (index prefix), schema per tenant, or database per tenant — trade isolation against operational cost.
- Row-level security as defense in depth: tenant set per transaction, policy forced on the table owner, application role without bypass rights ([schema-patterns.md](references/schema-patterns.md#multi-tenant-row-level-security)).

### Vector columns
- Store embeddings next to the rows they describe; dimension and distance metric must match the embedding model, and every vector records which model produced it.
- HNSW for recall at the cost of memory and build time; IVF-style indexes build faster with lower recall.
- Filtered ANN queries can return fewer rows than requested or skip the index. Test recall with the real filters; use partitioning, partial or per-tenant indexes, or the engine's iterative or filtered scan options.

## Context Adaptation

- **Greenfield schema** — constraints and types right from the first migration; adding them later costs a validation pass over live data.
- **Large legacy table** — every change is an online-migration problem: lock timeouts, concurrent index builds, batched backfills.
- **Many app instances or serverless** — connection count is the first limit; pool externally.
- **Multi-region** — decide where writes go; replicas serve stale reads, and read-your-writes needs routing.
- **Regulated data** — retention, erasure, and audit requirements shape the schema (`compliance`); encryption and masking policy is `security`.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| FLOAT/DOUBLE for money | Rounding errors accumulate | DECIMAL/NUMERIC or integer minor units |
| Auto-increment or timestamp as idempotency key | Different on every retry | Key from the caller's intent, scoped per client |
| `ON CONFLICT DO UPDATE` as idempotency | A stale replay overwrites newer state | Claim with `DO NOTHING`, return the stored result |
| Mutable status without history | Cannot audit transitions | Append-only status log or event table |
| Stored balance with no source | Diverges from entries | Derive from ledger entries, or reconcile against them |
| Timestamps without timezone | Off-by-hours bugs across regions | TIMESTAMPTZ or UTC by convention |
| N+1 queries in loops | One round trip per parent row | Join or batch fetch |
| Unbounded SELECT | Memory exhaustion | Paginate (keyset for deep pages) or cap |
| Index build or ALTER without lock timeout | Blocks all traffic behind the lock queue | Lock timeout plus retry; concurrent or online DDL |
| Rename or drop in one migration | Breaks the running app version | Expand-contract over several releases |
| Session-level tenant setting on a pooled connection | Next request inherits another tenant | Transaction-scoped setting (`SET LOCAL`) |
| Filtered vector query without recall testing | Silently returns too few or wrong neighbors | Measure recall with filters; partition or use filtered scans |

## Related Knowledge

- **architecture** — data authority, repository and unit of work, outbox, saga, CQRS, event sourcing, sharding strategy ([integration-patterns.md](../architecture/references/integration-patterns.md))
- **message-queues** — idempotency pattern owner; outbox relay and CDC transport
- **backend** — connection lifecycle and request-scoped transactions in service code
- **performance** — query profiling, capacity, pool sizing from measurement
- **reliability** — RPO/RTO requirements, restore drills ([recovery.md](../reliability/references/recovery.md))
- **release-engineering**, **ci-cd** — coordinating and running migrations in the delivery pipeline
- **security**, **compliance** — encryption, masking, retention, erasure
- **search** — full-text and hybrid retrieval beyond what the database offers
- **caching** — cache-aside around queries, distributed locks

## References

- [schema-patterns.md](references/schema-patterns.md) — idempotent command table, ledger, event log and projection table shapes, soft delete, optimistic concurrency, row-level security, audit log, temporal tables
- [engine-specific.md](references/engine-specific.md) — PostgreSQL, MySQL, SQLite, MongoDB syntax and differences; recent PostgreSQL features; time-series, vector, and edge engines; engine short-list
- [orm-patterns.md](references/orm-patterns.md) — ORM vs query builder vs raw SQL, Active Record vs Data Mapper, product notes per language, N+1, loading strategy, async sessions, ORM migrations
- [review-protocol.md](workflows/review-protocol.md) — database review workflow for an existing data layer
