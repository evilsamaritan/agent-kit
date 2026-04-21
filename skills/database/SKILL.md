---
name: database
description: Review and design database schemas, migrations, indexes, queries, and data access patterns. Use when auditing schemas, writing migrations, optimizing queries, or designing data models. Covers relational, document, key-value, and vector stores. Do NOT use for API design (use api-design skill).
user-invocable: true
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
---

# Database Knowledge

Database design and review expertise for relational, document, key-value, and vector stores.

---

## Rules

- Database is the source of truth -- not application memory, not caches, not message queues.
- Every write must be idempotent -- replay-safe by design.
- Audit trails are immutable -- append-only, no updates or deletes.
- State is derived -- compute aggregates from events/entries, never store mutable running totals.
- Use exact numeric types for money (DECIMAL/NUMERIC) -- never floating point.
- Timestamps must include timezone information.
- Migrations must be backward-compatible -- the previous application version must still work after each migration step.

---

## Database Type Decision Tree

```
What is the primary workload?

├─ Structured data with relationships → Relational (SQL)
│  ├─ Embedded / edge / single-file → SQLite-based¹
│  ├─ Read-heavy, simple schema → MySQL-compatible¹
│  └─ Complex queries, rich types, extensibility → PostgreSQL-compatible¹
│
├─ Flexible schema, document-shaped data → Document store¹
│  └─ Horizontal scale + built-in sharding needed? → Yes: sharded document store
│
├─ Low-latency caching, sessions, counters → In-memory key-value store¹
│
├─ Time-series, IoT, metrics → Time-series engine¹
│  └─ Already on PostgreSQL? → Consider time-series extension
│
├─ Similarity search, embeddings, RAG → Vector store
│  ├─ Already have a relational DB? → Use vector extension (e.g., pgvector)²
│  └─ Dedicated vector workload at scale → Specialized vector database¹
│
└─ Analytics, OLAP, columnar scans → Columnar / analytical engine¹
```

¹ Popular choices listed in `references/engine-specific.md`.
² Vector extensions allow keeping vectors and relational data in one system -- query in the same transaction, no separate infrastructure.

Start with a single instance. Add read replicas when read load demands it.

---

## Scope and Boundaries

### In Scope
- Schema design: tables, constraints, indexes, enums, triggers, partitioning
- Migrations: sequential, versioned, backward-compatible, zero-downtime
- Query optimization: EXPLAIN ANALYZE, covering indexes, N+1 detection
- Data modeling: normalization, strategic denormalization, natural vs surrogate keys
- Transactions, isolation levels, concurrency control
- Vector search integration in relational databases

### Out of Scope
- API design and endpoints → `api-design`
- ORM integration and repository patterns → `backend`
- System-level architecture (CQRS, event sourcing, sharding strategy) → `architect`
- Query profiling and bottleneck analysis → `performance`
- Row-level security, encryption, PII masking → `security`

---

## Core Patterns

### Schema Design
- Primary keys: natural vs surrogate, UUID vs sequential (prefer UUIDv7 for new systems -- time-ordered, no coordination)
- Foreign keys, cascading rules, referential integrity
- Check constraints for domain validation
- Enums: database-level vs application-level trade-offs

### Transactions and Consistency
- ACID guarantees, isolation levels (read committed, repeatable read, serializable)
- Optimistic concurrency (version columns, conditional updates)
- Pessimistic locking (row locks, advisory locks)
- Distributed transactions and eventual consistency trade-offs

### Idempotent Writes
- Upsert patterns (ON CONFLICT / ON DUPLICATE KEY)
- Conditional inserts with business keys
- Deduplication via stable idempotency keys (not auto-increment IDs)
- Version-guarded updates (WHERE version = $expected)

### Migration Strategy
- Sequential, versioned, backward-compatible migrations
- **Expand-contract pattern**: add new structure → migrate data → remove old structure
- Zero-downtime: add column (nullable or with default), backfill, then add constraint
- Never rename or remove columns in a single step -- use expand-contract over multiple deployments

### Indexing and Query Optimization
- B-tree, hash, GIN, GiST, BRIN, and full-text indexes
- Covering indexes, partial indexes, composite index ordering (equality before range)
- Query plans (EXPLAIN ANALYZE with BUFFERS)
- N+1 query detection and resolution (JOIN, subquery, batch fetch)
- Revisit indexes as query patterns evolve

### Partitioning
- Declarative partitioning (RANGE, LIST, HASH)
- Partition pruning for query performance on large tables
- Common strategies: by time (logs, events), by tenant, by region

### Vector Search
- Vector columns store embeddings alongside relational data
- Index types: IVFFlat (faster build, approximate), HNSW (better recall, more memory)
- Hybrid queries: combine vector similarity with relational filters
- Dimensionality and distance metric must match the embedding model

### Modern Patterns
- **Read replicas**: routing reads to replicas, replication lag awareness
- **Logical replication**: selective table replication, CDC pipelines
- **Time-series**: partitioning by time, retention policies, rollup aggregates
- **Multi-tenancy**: schema-per-tenant, row-level security, shared-table with tenant_id
- **Edge databases**: SQLite-based distributed databases for low-latency edge reads

---

## Context Adaptation

### Backend
- Schema design: tables, constraints, indexes, enums, triggers
- Migrations: sequential, versioned; expand-contract for zero-downtime
- ORM patterns and query builder integration
- Connection pooling: sizing = (cores * 2) + spindles; external pooler for production
- Query optimization: EXPLAIN ANALYZE, N+1 detection, batch fetching

### Architect
- Data modeling: normalization (1NF-BCNF), strategic denormalization
- Sharding: hash-based, range-based, tenant-based partitioning
- CQRS/event sourcing: separate write models from read models, append-only event logs
- Database type selection (use decision tree above)

### DevOps
- Backup and restore strategies, point-in-time recovery
- Replication setup: streaming, logical, cross-region
- Connection pooler deployment and monitoring
- Migration automation in CI/CD pipelines
- Blue-green database deployments with expand-contract migrations

### Security
- Row-level security policies for tenant isolation
- Encryption at rest: transparent data encryption, column-level encryption
- PII masking: views that redact sensitive columns
- Audit trails: append-only audit log tables

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| FLOAT/DOUBLE for money | Rounding errors accumulate | DECIMAL/NUMERIC with explicit precision |
| Auto-increment as idempotency key | Different on every insert, useless for replay | Stable business key (client_order_id, event_id) |
| Missing index on frequently queried column | Full table scan on every lookup | Add index matching access pattern |
| Mutable status without history | Cannot audit state transitions | Append-only status log or event table |
| Storing computed balance as a field | Diverges from source entries over time | Derive from ledger/event entries |
| Timestamps without timezone | Off-by-hours bugs in multi-region deployments | Always store with timezone (UTC) |
| N+1 queries in loops | Linear DB roundtrips per parent record | JOIN, subquery, or batch fetch |
| Unbounded SELECT without LIMIT | Memory exhaustion on large tables | Always paginate or cap results |
| No partitioning on billion-row tables | Scans, vacuum, and maintenance degrade | Declarative partitioning by time or tenant |
| Rename/drop column in single migration | Breaks previous app version during deploy | Expand-contract over multiple deploys |
| Vector index without filters | Full-table similarity scan | Combine vector index with partition or partial index |

---

## Related Knowledge

- **backend** -- ORM integration, connection pooling, repository patterns, data access layers
- **architect** -- Data modeling decisions, CQRS/event sourcing, sharding strategy, CAP trade-offs
- **performance** -- Query optimization, EXPLAIN ANALYZE, index tuning, connection pool sizing
- **security** -- Row-level security, encryption at rest, PII masking, audit trails
- **devops** -- Backup automation, replication setup, migration CI/CD, blue-green deploys
- **search** -- Full-text search, vector/semantic search at scale

---

## References

- [schema-patterns.md](references/schema-patterns.md) -- Reusable schema design patterns (idempotent writes, ledger, event sourcing, CQRS)
- [engine-specific.md](references/engine-specific.md) -- Engine-specific features, syntax, and selection guide
- [orm-patterns.md](references/orm-patterns.md) -- ORM selection, Active Record vs Data Mapper, N+1 detection, migration safety (Prisma, Drizzle, TypeORM, Kysely, SQLAlchemy, Django ORM, Hibernate, Diesel, SeaORM)
- [review-protocol.md](workflows/review-protocol.md) -- Database review workflow for auditing existing database layers
