# Schema Design Patterns

Reusable database design patterns. Examples use PostgreSQL syntax; adapt for your engine.

## Contents

- [Idempotent Command Table](#idempotent-command-table)
- [Double-Entry Ledger](#double-entry-ledger)
- [Aggregate View](#aggregate-view)
- [Event Log and Snapshots](#event-log-and-snapshots)
- [Projection Table](#projection-table)
- [Soft Delete](#soft-delete)
- [Optimistic Concurrency](#optimistic-concurrency)
- [Multi-Tenant Row-Level Security](#multi-tenant-row-level-security)
- [Audit Log](#audit-log)
- [Temporal Table (Slowly Changing Dimension)](#temporal-table-slowly-changing-dimension)

---

## Idempotent Command Table

When to use: a table that receives commands which may be retried or replayed. The general pattern (claim first, keys from intent, external side effects) is owned by `message-queues` → [idempotency-patterns.md](../../message-queues/references/idempotency-patterns.md); this is the table shape.

```sql
-- PostgreSQL syntax
CREATE TABLE shipments (
  shipment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(client_id),
  idempotency_key TEXT NOT NULL,                -- chosen by the caller, once per intent
  request_hash    TEXT NOT NULL,                -- detects key reuse with a different payload
  external_ref    TEXT UNIQUE,                  -- id in an external system
  weight_grams    INTEGER NOT NULL CHECK (weight_grams > 0),
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, idempotency_key)           -- key is scoped per client
);

-- Claim: insert only if this (client, key) is new
INSERT INTO shipments (client_id, idempotency_key, request_hash, weight_grams)
VALUES ($1, $2, $3, $4)
ON CONFLICT (client_id, idempotency_key) DO NOTHING
RETURNING shipment_id, status;

-- No row returned: a previous attempt exists. Read it and return its stored result;
-- reject with a conflict error if request_hash differs.
SELECT shipment_id, status, request_hash
FROM shipments
WHERE client_id = $1 AND idempotency_key = $2;
```

Key principles:
- The replay returns what the first attempt produced; it never overwrites newer state. Keep `ON CONFLICT ... DO UPDATE` for last-writer-wins data with a version guard in its `WHERE` clause.
- `external_ref` tracks the id from an external system, separate from the internal key.
- CHECK constraints enforce domain invariants at the database level.

MySQL: use a plain `INSERT` and treat the duplicate-key error (`ER_DUP_ENTRY`, 1062) as "already claimed", then read the stored row and compare `request_hash`. Do not infer the claim from the affected-row count of `ON DUPLICATE KEY UPDATE`: with the `CLIENT_FOUND_ROWS` flag (the MySQL Connector/J default) a no-op update also reports 1. Avoid `INSERT IGNORE`, which also hides other errors. SQLite: `INSERT ... ON CONFLICT DO NOTHING`; `INSERT OR REPLACE` deletes and reinserts the row, so it is not an idempotent claim.

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

## Event Log and Snapshots

Table shapes for an append-only event log. Whether to use event sourcing at all is an `architecture` decision.

```sql
CREATE TABLE events (
  event_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id   UUID NOT NULL,
  aggregate_type TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  version        INTEGER NOT NULL,
  payload        JSONB NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (aggregate_id, version)   -- rejects a second writer at the same version; its index serves reads by aggregate
);

CREATE TABLE snapshots (
  aggregate_id   UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  version        INTEGER NOT NULL,
  state          JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Appending: insert with `version = expected + 1`; a unique violation means a concurrent writer won. Rebuild: load the snapshot, replay events after its version.

---

## Projection Table

A denormalized table derived from authoritative tables or events, eventually consistent with them. When a separate query model is justified is an `architecture` decision.

```sql
CREATE TABLE order_summaries (
  order_id      UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,          -- denormalized from customers
  status        TEXT NOT NULL,
  item_count    INTEGER NOT NULL,
  total_minor   BIGINT NOT NULL,        -- amount in minor units
  currency      CHAR(3) NOT NULL,
  source_version BIGINT NOT NULL,       -- last applied change; ignore older updates
  updated_at    TIMESTAMPTZ NOT NULL
);
```

Rebuild without downtime:
1. Build a new table (`order_summaries_next`) beside the live one from events or the source tables.
2. Apply changes that arrived during the build, up to the current position.
3. Swap in one transaction (rename or repoint a view), then drop the old table.

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

When to use: shared tables serving multiple tenants, as defense in depth behind tenant filters in the application.

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;   -- applies to the table owner too

-- missing_ok = true: an unset tenant yields NULL, which matches no rows
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Per request, inside the transaction (transaction-scoped, safe with poolers)
BEGIN;
SELECT set_config('app.current_tenant', $1, true);   -- or SET LOCAL app.current_tenant = '...'
-- ... queries ...
COMMIT;
```

- Never use a session-level `SET` on pooled connections: the next request on that connection inherits the tenant.
- The application role must not own the tables and must not have `BYPASSRLS` or superuser rights; migrations run as a separate role.
- Test it: run two requests for different tenants on the same reused connection and assert neither sees the other's rows, and that a request with no tenant set sees nothing.

For engines without RLS: enforce `tenant_id` in every query through one data-access layer, and lead composite indexes with `tenant_id`. Document stores: include `tenant_id` in every filter and as the index prefix.

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

When to use: track historical values of a record over time (price history, address changes).

```sql
CREATE TABLE product_prices (
  product_id   UUID NOT NULL REFERENCES products(product_id),
  price_minor  BIGINT NOT NULL CHECK (price_minor >= 0),
  currency     CHAR(3) NOT NULL,
  valid_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to     TIMESTAMPTZ,                     -- NULL = current
  PRIMARY KEY (product_id, valid_from)
);

-- Current price
SELECT * FROM product_prices
WHERE product_id = $1 AND valid_to IS NULL;

-- Price at a point in time
SELECT * FROM product_prices
WHERE product_id = $1 AND valid_from <= $2 AND (valid_to IS NULL OR valid_to > $2);
```

Nothing above prevents two overlapping periods for one product. Enforce it with an exclusion constraint over a range (`EXCLUDE USING gist (product_id WITH =, tstzrange(valid_from, valid_to) WITH &&)`, needs `btree_gist`) or, where supported, a temporal key (`PRIMARY KEY (product_id, valid_during WITHOUT OVERLAPS)`; see engine-specific.md).
