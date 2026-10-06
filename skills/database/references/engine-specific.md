# Engine-Specific Features

Syntax and features that vary across database engines. Consult when working with a specific engine.

## Contents

- [PostgreSQL](#postgresql)
- [MySQL / MariaDB](#mysql--mariadb)
- [SQLite](#sqlite)
- [MongoDB](#mongodb)
- [Key-Value Stores](#key-value-stores)
- [Time-Series Extensions](#time-series-extensions)
- [Vector Search Extensions](#vector-search-extensions)
- [Edge Databases](#edge-databases-sqlite-based)
- [Engine Selection Guide](#engine-selection-guide)

---

## PostgreSQL

### Strengths
- Rich type system (JSONB, arrays, hstore, UUID, INET, ranges)
- Row-level security for multi-tenancy
- Materialized views with REFRESH CONCURRENTLY
- Partial and expression indexes
- Advisory locks for application-level coordination
- Full ACID with serializable isolation

### Key Syntax

```sql
-- Idempotent claim (return stored result on conflict; see schema-patterns.md)
INSERT INTO shipments (client_id, idempotency_key, request_hash)
VALUES ($1, $2, $3)
ON CONFLICT (client_id, idempotency_key) DO NOTHING
RETURNING shipment_id;

-- Last-writer-wins upsert, guarded so an older write cannot win
INSERT INTO device_state (device_id, state, version)
VALUES ($1, $2, $3)
ON CONFLICT (device_id) DO UPDATE
  SET state = EXCLUDED.state, version = EXCLUDED.version
  WHERE device_state.version < EXCLUDED.version;

-- Timezone-aware timestamps
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- JSONB indexing
CREATE INDEX idx_events_payload ON events USING GIN (payload);

-- Partial index, built without blocking writes (not inside a transaction block)
CREATE INDEX CONCURRENTLY idx_orders_open ON orders (created_at) WHERE status = 'open';

-- Transaction-scoped advisory lock
SELECT pg_advisory_xact_lock(hashtext('nightly-rollup'));

-- Migration session guard: fail fast instead of queueing behind a long transaction
SET lock_timeout = '3s';

-- Two-step constraint on a large table
ALTER TABLE orders ADD CONSTRAINT orders_total_positive CHECK (total_minor > 0) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_total_positive;
```

### Recent PostgreSQL Features Worth Checking

Check the server version (`SHOW server_version`) before using any of these.

| Capability | Minimum version |
|---|---|
| `MERGE`, `UNIQUE NULLS NOT DISTINCT` | 15 |
| `JSON_TABLE`, `EXPLAIN (SERIALIZE, MEMORY)`, incremental base backups, logical replication failover slots | 17 |
| `uuidv7()` built in | 18 |
| Virtual generated columns (computed on read) | 18 |
| Temporal keys: `PRIMARY KEY (room_id, booked_during WITHOUT OVERLAPS)` | 18 |
| `RETURNING OLD.col, NEW.col` | 18 |
| B-tree skip scan on multi-column indexes, asynchronous I/O | 18 |

### Declarative Partitioning

```sql
-- Range partitioning by time; partitions created ahead by a scheduled job, named events_YYYYMM
CREATE TABLE events (
  id         UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL,
  payload    JSONB,
  PRIMARY KEY (id, created_at)               -- unique keys must include the partition key
) PARTITION BY RANGE (created_at);

CREATE TABLE events_default PARTITION OF events DEFAULT;   -- catches rows with no partition

-- Hash partitioning by tenant
CREATE TABLE orders (
  tenant_id UUID NOT NULL,
  order_id  UUID NOT NULL
) PARTITION BY HASH (tenant_id);

CREATE TABLE orders_p0 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE orders_p1 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 1);
-- ...
```

### Connection Pooling
- External pooler (PgBouncer-class) in transaction mode for many short connections; session mode when the app depends on session state.
- Transaction mode breaks session-level `SET`, session advisory locks, `LISTEN`, and (depending on the pooler version) prepared statements. Use transaction-scoped settings.
- Size pools from measurement; the sum across instances must stay under `max_connections` with headroom for maintenance.

---

## MySQL / MariaDB

### Strengths
- Mature replication (primary-replica, group replication)
- InnoDB: ACID-compliant, row-level locking
- Wide hosting availability, low operational overhead
- Good read-heavy workload performance

### Key Syntax

```sql
-- Upsert with a row alias (MySQL 8.0.19+, where VALUES() in this clause is deprecated;
-- MariaDB still uses VALUES(col))
INSERT INTO device_state (device_id, state, version)
VALUES (?, ?, ?) AS new
ON DUPLICATE KEY UPDATE
  state   = IF(new.version > device_state.version, new.state, device_state.state),
  version = GREATEST(device_state.version, new.version);

-- UUID generation (MySQL 8.0+)
UUID() -- returns CHAR(36), store as BINARY(16) for performance
-- Or use UUID_TO_BIN(UUID(), 1) for ordered binary storage

-- Timestamps (no native TIMESTAMPTZ -- use DATETIME with UTC convention)
DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

-- JSON indexing (MySQL 8.0+)
ALTER TABLE events ADD COLUMN event_type_virtual VARCHAR(100)
  GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.type'))) STORED;
CREATE INDEX idx_event_type ON events (event_type_virtual);

-- Full-text search
ALTER TABLE articles ADD FULLTEXT INDEX idx_ft_content (title, body);
SELECT * FROM articles WHERE MATCH(title, body) AGAINST('search term' IN BOOLEAN MODE);
```

### Differences from PostgreSQL
- No partial indexes (use generated columns + index as workaround)
- Online DDL: request `ALGORITHM=INSTANT` or `ALGORITHM=INPLACE, LOCK=NONE` explicitly so the statement fails instead of silently copying the table
- No advisory locks (use `GET_LOCK()` / `RELEASE_LOCK()` -- session-scoped, not transaction-scoped)
- No native array or range types
- ENUM is a column type (not a separate type definition)
- No transactional DDL (ALTER TABLE commits implicitly)

---

## SQLite

### Strengths
- Zero-config embedded database
- Single-file storage, easy backup and replication
- WAL mode for concurrent reads during writes
- Ideal for: local apps, edge computing, testing, prototypes

### Key Syntax

```sql
-- Idempotent claim (3.24+; RETURNING needs 3.35+)
INSERT INTO shipments (client_id, idempotency_key, request_hash)
VALUES (?, ?, ?)
ON CONFLICT (client_id, idempotency_key) DO NOTHING
RETURNING shipment_id;

-- No native UUID -- generate in application layer, store as TEXT or BLOB
-- No TIMESTAMPTZ -- store as TEXT (ISO 8601) or INTEGER (Unix epoch)

-- WAL mode for concurrency
PRAGMA journal_mode=WAL;

-- Foreign key enforcement (off by default)
PRAGMA foreign_keys = ON;
```

### Limitations
- No concurrent writers (single-writer, multi-reader)
- Limited ALTER TABLE: rename table or column, add and drop column, and set or drop NOT NULL (from 3.53.0); changing a column type or other constraints means recreating the table
- No native DECIMAL type (use INTEGER with implied decimals for money)
- No built-in JSON indexing (use generated columns)
- Limited data types: NULL, INTEGER, REAL, TEXT, BLOB

---

## MongoDB

### When to Choose Over Relational
- Schema evolves frequently and unpredictably
- Data is naturally hierarchical or document-shaped
- Horizontal scaling (sharding) is a primary requirement
- Read patterns favor fetching a whole document, not joining tables

### Collection Design

```javascript
// Embedding (denormalized) -- when child data is always accessed with parent
{
  _id: ObjectId("..."),
  orderId: "ord-123",
  account: { id: "acc-456", name: "Example Corp" },  // embedded
  items: [
    { sku: "WIDGET-A", qty: 10, price: NumberDecimal("9.99") },   // Decimal128, never double, for money
    { sku: "WIDGET-B", qty: 5, price: NumberDecimal("14.99") }
  ],
  status: "confirmed",
  createdAt: new Date()
}

// Referencing (normalized) -- when child data is large, shared, or updated independently
{
  _id: ObjectId("..."),
  orderId: "ord-123",
  accountId: ObjectId("..."),  // reference to accounts collection
  status: "confirmed"
}
```

### Indexing

```javascript
// Compound index (order matters: equality fields first, sort fields last)
db.orders.createIndex({ accountId: 1, createdAt: -1 });

// Partial index
db.orders.createIndex(
  { accountId: 1 },
  { partialFilterExpression: { status: "active" } }
);

// TTL index for auto-expiry
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });

// Text search index
db.articles.createIndex({ title: "text", body: "text" });
```

### Transactions
- Multi-document transactions work on replica sets and sharded clusters, not on a standalone server
- Prefer single-document operations where possible (atomic by default)
- Transactions have performance overhead -- design documents to minimize cross-document writes

---

## Key-Value Stores

In-memory key-value stores used as caches, session stores, rate limiters, and lock services are covered by `caching` ([redis-patterns.md](../../caching/references/redis-patterns.md)), including the owner-checked distributed lock. Use one as a primary store only with a persistence and recovery strategy you have tested.

---

## Time-Series Extensions

### Time-Series Extension on PostgreSQL (e.g., TimescaleDB)
- Hypertables: automatic time-based partitioning
- Continuous aggregates: incrementally refreshed rollups
- Retention policies: drop old chunks on a schedule
- Columnar compression for historical chunks

Function names and signatures for these have changed across releases; read the documentation for the installed extension version before writing setup SQL.

### Dedicated Time-Series and Analytical Engines
- Purpose-built engines (InfluxDB, QuestDB, ClickHouse) fit when write volume, retention-based lifecycle, or time-range aggregation dominates and the relational database becomes the bottleneck.

---

## Vector Search Extensions

### pgvector (PostgreSQL)

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column
ALTER TABLE documents ADD COLUMN embedding vector(1536);

-- HNSW index (better recall, recommended for most use cases)
CREATE INDEX idx_documents_embedding ON documents
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- IVFFlat index (faster build, good for large datasets)
CREATE INDEX idx_documents_embedding_ivf ON documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Similarity search with relational filter
SELECT id, title, embedding <=> $1::vector AS distance
FROM documents
WHERE category = 'technical'
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- The ANN index returns candidates before the filter applies, so a selective filter can
-- return fewer than 10 rows. Options: iterative index scans (pgvector 0.8+),
-- a partial index per hot filter value, or partitioning by the filter column.
SET hnsw.iterative_scan = relaxed_order;
CREATE INDEX idx_documents_embedding_technical ON documents
  USING hnsw (embedding vector_cosine_ops) WHERE category = 'technical';
```

Record the embedding model and version in a column next to the vector; vectors from different models must not share an index.

### MongoDB Atlas Vector Search

```javascript
// Vector search index (created via Atlas UI or API); filter fields must be declared as filter fields in the index
// Search query with vector + filter
db.documents.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 100,
      limit: 10,
      filter: { category: "technical" }
    }
  }
]);
```

---

## Edge Databases (SQLite-Based)

SQLite-based distributed databases for edge and local-first architectures.

**When to consider**: read-heavy workloads, per-tenant isolation, low-latency edge reads, local-first apps.

**Key properties**:
- Single-writer, multi-reader model (reads scale horizontally)
- Low-latency reads for requests co-located with a replica
- Per-tenant database isolation is natural (one SQLite file per tenant)
- Embedded replicas sync automatically with primary

**Limitations**:
- Single writer -- not suitable for write-heavy concurrent workloads
- Limited SQL dialect compared to PostgreSQL/MySQL
- Ecosystem tooling is younger

Popular choices include: Turso/LibSQL, Cloudflare D1, LiteFS (SQLite replication; beta). Postgres sync engines such as Electric are a different model: they sync from PostgreSQL to clients.

---

## Engine Selection Guide

Use the decision tree in SKILL.md to choose a database type first. This table maps requirements to popular engines within each category.

| Requirement | Popular Choices | Key Differentiator |
|------------|----------------|-------------------|
| General-purpose OLTP | PostgreSQL, MySQL, MariaDB, CockroachDB | PostgreSQL: richest type system. MySQL: widest hosting. CockroachDB: distributed SQL. |
| Embedded / edge / mobile | SQLite, Turso/LibSQL, Cloudflare D1 | SQLite: zero-config. Turso: distributed edge replicas. D1: Cloudflare-native. |
| Flexible schema, horizontal scale | MongoDB, CouchDB, FerretDB | MongoDB: mature sharding. FerretDB: MongoDB-compatible on PostgreSQL. |
| Caching, sessions, real-time | see `caching` | |
| Time-series, IoT, metrics | TimescaleDB, InfluxDB, QuestDB | TimescaleDB: PostgreSQL extension. InfluxDB: purpose-built. |
| Analytics, OLAP | ClickHouse, DuckDB, StarRocks | ClickHouse: distributed. DuckDB: embedded analytical. |
| Vector search | pgvector, Qdrant, Weaviate, Milvus, Pinecone | pgvector: use if already on PostgreSQL. Specialized: higher scale/recall. |
| Multi-model | SurrealDB, ArangoDB | When data has graph + document + relational needs. |
