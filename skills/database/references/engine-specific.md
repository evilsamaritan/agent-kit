# Engine-Specific Features

Syntax and features that vary across database engines. Consult when working with a specific engine.

## Contents

- [PostgreSQL](#postgresql)
- [MySQL / MariaDB](#mysql--mariadb)
- [SQLite](#sqlite)
- [MongoDB](#mongodb)
- [Redis / KeyDB](#redis--keydb)
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
-- Upsert
INSERT INTO orders (idempotency_key, status)
VALUES ($1, $2)
ON CONFLICT (idempotency_key) DO UPDATE SET status = EXCLUDED.status;

-- UUID generation
DEFAULT gen_random_uuid()

-- Timezone-aware timestamps
TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- JSONB indexing
CREATE INDEX idx_events_payload ON events USING GIN (payload);

-- Partial index
CREATE INDEX idx_orders_active ON orders (created_at) WHERE status = 'active';

-- Advisory lock
SELECT pg_advisory_xact_lock(hashtext('process-payments'));

-- CTE (Common Table Expression)
WITH recent_orders AS (
  SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '1 hour'
)
SELECT account_id, COUNT(*) FROM recent_orders GROUP BY account_id;
```

### PostgreSQL 17 Features

```sql
-- JSON_TABLE: transform JSON into relational rows
SELECT jt.*
FROM api_responses,
     JSON_TABLE(payload, '$.items[*]' COLUMNS (
       id TEXT PATH '$.id',
       name TEXT PATH '$.name',
       price NUMERIC PATH '$.price'
     )) AS jt;

-- EXPLAIN with SERIALIZE and MEMORY options
EXPLAIN (ANALYZE, BUFFERS, SERIALIZE, MEMORY) SELECT ...;

-- Incremental backups (pg_basebackup --incremental)
-- Logical replication failover slots for HA
```

### PostgreSQL 18 Features

```sql
-- UUIDv7: time-ordered UUIDs (no extension needed)
DEFAULT uuidv7()

-- Virtual generated columns (computed on read, no storage cost)
ALTER TABLE orders ADD COLUMN total_display TEXT
  GENERATED ALWAYS AS (quantity || ' x ' || price) VIRTUAL;

-- Temporal primary key (constraint over ranges)
CREATE TABLE room_bookings (
  room_id INT,
  booked_during TSTZRANGE,
  guest TEXT,
  PRIMARY KEY (room_id, booked_during WITHOUT OVERLAPS)
);

-- OLD/NEW in RETURNING clause
UPDATE orders SET status = 'shipped'
WHERE order_id = $1
RETURNING OLD.status AS previous_status, NEW.status AS current_status;
```

Key improvements: asynchronous I/O subsystem (up to 3x read performance), skip scan for multi-column B-tree indexes, OAuth authentication support.

### Declarative Partitioning

```sql
-- Range partitioning by time
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL,
  payload JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2025 PARTITION OF events
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE events_2026 PARTITION OF events
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Hash partitioning by tenant
CREATE TABLE orders (
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL
) PARTITION BY HASH (tenant_id);

CREATE TABLE orders_p0 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE orders_p1 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 1);
-- ...
```

### Connection Pooling
- PgBouncer (external pooler): transaction-mode or session-mode
- Application-level: `pg` pool (Node.js), HikariCP (Java), SQLAlchemy pool (Python)
- Pool sizing baseline: `connections = (core_count * 2) + effective_spindle_count`

---

## MySQL / MariaDB

### Strengths
- Mature replication (primary-replica, group replication)
- InnoDB: ACID-compliant, row-level locking
- Wide hosting availability, low operational overhead
- Good read-heavy workload performance

### Key Syntax

```sql
-- Upsert
INSERT INTO orders (idempotency_key, status)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE status = VALUES(status);

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
-- Upsert (SQLite 3.24+)
INSERT INTO orders (idempotency_key, status)
VALUES (?, ?)
ON CONFLICT (idempotency_key) DO UPDATE SET status = excluded.status;

-- No native UUID -- generate in application layer, store as TEXT or BLOB
-- No TIMESTAMPTZ -- store as TEXT (ISO 8601) or INTEGER (Unix epoch)

-- WAL mode for concurrency
PRAGMA journal_mode=WAL;

-- Foreign key enforcement (off by default)
PRAGMA foreign_keys = ON;
```

### Limitations
- No concurrent writers (single-writer, multi-reader)
- No ALTER COLUMN (must recreate table)
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
    { sku: "WIDGET-A", qty: 10, price: 9.99 },
    { sku: "WIDGET-B", qty: 5, price: 14.99 }
  ],
  status: "confirmed",
  createdAt: ISODate("2025-01-15T10:30:00Z")
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
- Multi-document transactions supported (4.0+ for replica sets, 4.2+ for sharded clusters)
- Prefer single-document operations where possible (atomic by default)
- Transactions have performance overhead -- design documents to minimize cross-document writes

---

## Redis / KeyDB

### Use Cases
- Caching (TTL-based expiry, cache-aside pattern)
- Session storage
- Rate limiting (sliding window with sorted sets)
- Pub/Sub for real-time notifications
- Distributed locks (Redlock algorithm)
- Leaderboards (sorted sets)

### Key Patterns

```
# Cache-aside pattern
GET user:123           -> cache hit? return
                       -> cache miss? query DB, SET user:123 <data> EX 300

# Rate limiting (sliding window)
ZADD ratelimit:user:123 <timestamp> <request-id>
ZREMRANGEBYSCORE ratelimit:user:123 0 <window-start>
ZCARD ratelimit:user:123  -> count in window

# Distributed lock
SET lock:process-payments <unique-id> NX EX 30   -> acquired if OK
DEL lock:process-payments                         -> release

# Sorted set leaderboard
ZADD leaderboard 1500 "player-A"
ZADD leaderboard 2300 "player-B"
ZREVRANGE leaderboard 0 9 WITHSCORES             -> top 10
```

### Anti-Patterns
- Using Redis as primary data store without persistence strategy
- Keys without TTL (unbounded memory growth)
- Large values (> 1MB) in a single key
- KEYS command in production (blocks server -- use SCAN instead)

---

## Time-Series Extensions

### TimescaleDB (PostgreSQL Extension)
- Hypertables: automatic time-based partitioning
- Continuous aggregates: materialized views that auto-refresh
- Retention policies: automated data lifecycle management
- Compression: columnar compression for historical data

```sql
-- Convert regular table to hypertable
SELECT create_hypertable('metrics', 'time');

-- Continuous aggregate
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket,
       sensor_id,
       AVG(value) AS avg_value,
       MAX(value) AS max_value
FROM metrics
GROUP BY bucket, sensor_id;

-- Retention policy
SELECT add_retention_policy('metrics', INTERVAL '90 days');

-- Compression policy
SELECT add_compression_policy('metrics', INTERVAL '7 days');
```

### InfluxDB, QuestDB, ClickHouse
- Purpose-built for time-series/analytics workloads
- Consider when: write volume > 100K rows/sec, retention-based lifecycle is critical, or queries are primarily time-range aggregations

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
```

### MongoDB Atlas Vector Search

```javascript
// Vector search index (created via Atlas UI or API)
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
- Sub-10ms reads for co-located requests
- Per-tenant database isolation is natural (one SQLite file per tenant)
- Embedded replicas sync automatically with primary

**Limitations**:
- Single writer -- not suitable for write-heavy concurrent workloads
- Limited SQL dialect compared to PostgreSQL/MySQL
- Ecosystem tooling is younger

Popular choices include: Turso/LibSQL, Cloudflare D1, LiteFS, electric-sql.

---

## Engine Selection Guide

Use the decision tree in SKILL.md to choose a database type first. This table maps requirements to popular engines within each category.

| Requirement | Popular Choices | Key Differentiator |
|------------|----------------|-------------------|
| General-purpose OLTP | PostgreSQL, MySQL, MariaDB, CockroachDB | PostgreSQL: richest type system. MySQL: widest hosting. CockroachDB: distributed SQL. |
| Embedded / edge / mobile | SQLite, Turso/LibSQL, Cloudflare D1 | SQLite: zero-config. Turso: distributed edge replicas. D1: Cloudflare-native. |
| Flexible schema, horizontal scale | MongoDB, CouchDB, FerretDB | MongoDB: mature sharding. FerretDB: MongoDB-compatible on PostgreSQL. |
| Caching, sessions, real-time | Redis, KeyDB, Valkey, DragonflyDB | Redis: ecosystem. Valkey: open-source fork. Dragonfly: multi-threaded. |
| Time-series, IoT, metrics | TimescaleDB, InfluxDB, QuestDB | TimescaleDB: PostgreSQL extension. InfluxDB: purpose-built. |
| Analytics, OLAP | ClickHouse, DuckDB, StarRocks | ClickHouse: distributed. DuckDB: embedded analytical. |
| Vector search | pgvector, Qdrant, Weaviate, Milvus, Pinecone | pgvector: use if already on PostgreSQL. Specialized: higher scale/recall. |
| Multi-model | SurrealDB, ArangoDB | When data has graph + document + relational needs. |
