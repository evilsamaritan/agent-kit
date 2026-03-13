# Schema Design Patterns

Reusable database design patterns. Examples use PostgreSQL syntax; adapt for your engine.

## Contents

- [Idempotent Command Table](#idempotent-command-table)
- [Double-Entry Ledger](#double-entry-ledger)
- [Aggregate View](#aggregate-view)
- [Event Sourcing Storage](#event-sourcing-storage)
- [CQRS Read Model](#cqrs-read-model)
- [Soft Delete](#soft-delete)
- [Optimistic Concurrency](#optimistic-concurrency)
- [Multi-Tenant Row-Level Security](#multi-tenant-row-level-security)
- [Audit Log](#audit-log)
- [Temporal Table (Slowly Changing Dimension)](#temporal-table-slowly-changing-dimension)

---

## Idempotent Command Table

When to use: any table that receives commands/requests that may be retried or replayed.

```sql
-- PostgreSQL syntax
CREATE TABLE orders (
  order_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL UNIQUE,         -- stable business key for dedup
  external_ref    TEXT UNIQUE,                   -- external system reference
  account_id      UUID NOT NULL REFERENCES accounts(account_id),
  order_type      TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
  quantity        NUMERIC NOT NULL CHECK (quantity > 0),
  price           NUMERIC CHECK (price > 0),     -- NULL for market orders
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Key principles:
- `idempotency_key` is the dedup key -- upsert with `ON CONFLICT (idempotency_key) DO UPDATE`
- `external_ref` tracks the ID from an external system (separate from internal PK)
- CHECK constraints enforce domain invariants at the DB level
- NUMERIC for monetary values, never FLOAT

MySQL equivalent for upsert: `INSERT ... ON DUPLICATE KEY UPDATE`
SQLite equivalent: `INSERT OR REPLACE` or `ON CONFLICT DO UPDATE`

---

## Double-Entry Ledger

When to use: financial tracking where every credit must have a matching debit (balance = SUM(credits) - SUM(debits)).

```sql
CREATE TABLE ledger_entries (
  entry_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL,            -- source event (payment, refund, fee)
  account_id  UUID NOT NULL REFERENCES accounts(account_id),
  asset       TEXT NOT NULL,            -- currency or asset type
  debit       NUMERIC NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      NUMERIC NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK (debit = 0 OR credit = 0),     -- exactly one non-zero
  CHECK (debit > 0 OR credit > 0),     -- at least one non-zero
  memo        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable: no UPDATE or DELETE on this table
-- Balance = SUM(credit) - SUM(debit) GROUP BY (account_id, asset)
-- Invariant: total debits = total credits across all accounts
```

---

## Aggregate View

When to use: derive computed state from underlying records instead of storing mutable totals.

```sql
CREATE VIEW account_balances AS
SELECT
  account_id,
  asset,
  SUM(credit) - SUM(debit) AS balance,
  COUNT(*) AS entry_count,
  MAX(created_at) AS last_activity
FROM ledger_entries
GROUP BY account_id, asset;
```

For performance on large datasets, use materialized views (PostgreSQL) or scheduled summary tables refreshed via background jobs.

---

## Event Sourcing Storage

When to use: systems where the full history of state changes is the source of truth.

```sql
-- Append-only event log
CREATE TABLE events (
  event_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id  UUID NOT NULL,
  aggregate_type TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  version       INTEGER NOT NULL,
  payload       JSONB NOT NULL,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (aggregate_id, version)        -- enforce ordering, prevent gaps
);

CREATE INDEX idx_events_aggregate ON events (aggregate_id, version);

-- Snapshot for fast aggregate rebuild
CREATE TABLE snapshots (
  aggregate_id   UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  version        INTEGER NOT NULL,
  state          JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Rebuild flow: load snapshot, replay events after snapshot version, apply to in-memory model.

---

## CQRS Read Model

When to use: separate the write model (normalized, optimized for consistency) from the read model (denormalized, optimized for queries).

```sql
-- Write side: normalized tables (orders, ledger_entries, events)
-- Read side: denormalized projections

CREATE TABLE order_summaries (
  order_id        UUID PRIMARY KEY,
  account_name    TEXT NOT NULL,          -- denormalized from accounts table
  order_type      TEXT NOT NULL,
  status          TEXT NOT NULL,
  quantity        NUMERIC NOT NULL,
  filled_quantity NUMERIC NOT NULL DEFAULT 0,
  total_value     NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL
);

-- Rebuilt from events or updated via change data capture (CDC)
-- Acceptable to be eventually consistent with write side
```

Projection rebuild strategy:
1. Truncate read model table
2. Replay all events (or read from write model)
3. Rebuild indexes after bulk insert

---

## Soft Delete

When to use: data must be recoverable, or foreign keys prevent hard deletes.

```sql
ALTER TABLE accounts ADD COLUMN deleted_at TIMESTAMPTZ;

-- Query active records
CREATE VIEW active_accounts AS
SELECT * FROM accounts WHERE deleted_at IS NULL;

-- Partial index for active records only
CREATE INDEX idx_accounts_active_email ON accounts (email) WHERE deleted_at IS NULL;
```

Alternative: archive table pattern -- move deleted rows to a separate `accounts_archive` table.

---

## Optimistic Concurrency

When to use: multiple writers may update the same row concurrently.

```sql
ALTER TABLE orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Update with version guard
UPDATE orders
SET status = 'confirmed', version = version + 1, updated_at = NOW()
WHERE order_id = $1 AND version = $2;

-- If rows_affected = 0, the row was modified since last read -- retry or fail
```

Alternative: timestamp guard (`WHERE updated_at = $last_seen_updated_at`).

---

## Multi-Tenant Row-Level Security

When to use: shared tables serving multiple tenants.

```sql
-- PostgreSQL row-level security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Set tenant context per connection/transaction
SET app.current_tenant = 'tenant-uuid-here';
```

For MySQL/SQLite: enforce tenant_id in application WHERE clauses.
For MongoDB: include tenant_id in every query filter and create compound indexes with tenant_id as prefix.

---

## Audit Log

When to use: track who changed what and when for compliance or debugging.

```sql
CREATE TABLE audit_log (
  log_id       BIGSERIAL PRIMARY KEY,
  table_name   TEXT NOT NULL,
  record_id    TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by   TEXT,
  old_values   JSONB,
  new_values   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_time ON audit_log (created_at);
```

Populate via application layer (preferred) or database triggers (less portable).

---

## Temporal Table (Slowly Changing Dimension)

When to use: track historical values of a record over time (e.g., price history, address changes).

```sql
CREATE TABLE product_prices (
  product_id   UUID NOT NULL REFERENCES products(product_id),
  price        NUMERIC NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'USD',
  valid_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to     TIMESTAMPTZ,                     -- NULL = current
  PRIMARY KEY (product_id, valid_from)
);

-- Get current price
SELECT * FROM product_prices
WHERE product_id = $1 AND valid_to IS NULL;

-- Get price at a point in time
SELECT * FROM product_prices
WHERE product_id = $1 AND valid_from <= $2 AND (valid_to IS NULL OR valid_to > $2);
```
