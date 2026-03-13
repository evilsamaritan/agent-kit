# Engine-Specific Features

Syntax and features that vary across database engines. Consult when working with a specific engine.

## Contents

- [PostgreSQL](#postgresql)
- [MySQL / MariaDB](#mysql--mariadb)
- [SQLite](#sqlite)
- [MongoDB](#mongodb)
- [Redis / KeyDB](#redis--keydb)
- [Time-Series Extensions](#time-series-extensions)
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

## Engine Selection Guide

| Requirement | Recommended Engine | Rationale |
|------------|-------------------|-----------|
| General-purpose OLTP | PostgreSQL | Richest feature set, strong consistency |
| High read throughput, simple schema | MySQL | Mature replication, wide support |
| Embedded / edge / mobile | SQLite | Zero-config, single-file, no server |
| Flexible schema, horizontal scale | MongoDB | Document model, built-in sharding |
| Caching, sessions, real-time | Redis | In-memory speed, rich data structures |
| Time-series, IoT, metrics | TimescaleDB / InfluxDB | Time-partitioning, retention policies |
| Analytics, OLAP | ClickHouse / DuckDB | Columnar storage, fast aggregations |
| Multi-model (graph + document) | ArangoDB / SurrealDB | When data has complex relationships |
