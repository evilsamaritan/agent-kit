# Database Review Protocol

Use this protocol when auditing or reviewing an existing database layer.

---

## Phase 1: Discovery

Scan the codebase for data-related code:
- Migration files, their order and contents
- Repository classes / data access layer (ORM or raw queries)
- Database connection setup (pool config, timeouts, replicas)
- Schema definitions (migrations, ORM models, or DDL files)
- Indexes, constraints, foreign keys
- How idempotent writes are implemented
- Transaction boundaries (what is atomic?)

## Phase 2: Analysis

**Schema Quality**
- [ ] Primary keys are appropriate (meaningful business keys or well-chosen surrogates)
- [ ] Foreign keys enforce referential integrity where needed
- [ ] NOT NULL on fields that must always have values
- [ ] CHECK constraints for valid ranges and enums
- [ ] Timestamps include timezone (TIMESTAMPTZ in PostgreSQL, DATETIME with UTC convention in MySQL)
- [ ] Exact numeric types for money (DECIMAL/NUMERIC, not FLOAT/DOUBLE)
- [ ] Consistent naming convention (snake_case or camelCase -- pick one)

**Idempotency**
- [ ] Retried commands carry a key derived from intent, scoped per client
- [ ] Replays claim with `DO NOTHING` and return the stored result; `DO UPDATE` upserts are version-guarded
- [ ] Updates are conditional (version guard or timestamp guard)
- [ ] No auto-generated IDs used as deduplication keys
- [ ] Replay of events produces identical state

**Index Strategy**
- [ ] Primary access patterns have covering indexes
- [ ] No missing indexes on foreign key columns
- [ ] No redundant indexes (prefix of another composite index)
- [ ] Partial indexes where appropriate (e.g., `WHERE status = 'active'`)
- [ ] Composite index column order matches query patterns (equality before range)

**Migration Discipline**
- [ ] Migrations are sequential and versioned
- [ ] Each migration is a single logical change
- [ ] Destructive changes (DROP, ALTER TYPE) run last, after no deployed code reads the structure, with a forward-fix plan and a verified backup or point-in-time recovery
- [ ] Migrations run inside transactions where the engine supports transactional DDL, except steps that cannot (concurrent index builds)
- [ ] Migration sessions set a lock timeout; index builds on large tables are concurrent or online
- [ ] New constraints on large tables are added unvalidated, then validated; backfills are batched
- [ ] No manual schema changes outside migration files

**Connection Management**
- [ ] Total connections across all instances fit the server's limit; pool size comes from measurement
- [ ] Session state (tenant, settings) is transaction-scoped when a transaction-mode pooler is used
- [ ] Idle timeout prevents connection hoarding
- [ ] Connection timeout prevents hanging on startup
- [ ] Health check on connection checkout or periodic ping
- [ ] Graceful shutdown drains pool

**Data Integrity**
- [ ] No orphan records possible (FK constraints or application-level cleanup)
- [ ] Soft delete vs hard delete: consistent strategy across tables
- [ ] Audit fields: `created_at`, `updated_at` on all mutable entities
- [ ] Optimistic locking where concurrent updates are possible
- [ ] No business logic in database triggers

## Phase 3: Report

```
## Data Model Assessment

### Summary
[1-3 sentences on schema health and completeness]

### Entity-Relationship Diagram (ASCII)
[Current schema as ASCII ER diagram]

### Schema Inventory
| Table | Engine | Rows Est. | Indexes | Constraints | Issues |
|-------|--------|-----------|---------|-------------|--------|

### Findings
| # | Area | Severity | Finding | File:Line | Recommendation |
|---|------|----------|---------|-----------|----------------|

### Migration Health
[Timeline of migrations, gaps, or issues]

### Missing Entities
[What is needed but does not exist yet]

### Query Patterns
[Typical queries and whether they are well-indexed]

### Recommendations
1. [Priority order]
```
