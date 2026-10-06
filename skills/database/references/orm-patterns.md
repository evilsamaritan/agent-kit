# ORM and Data Access Patterns

Choosing a data-access style, loading strategy, N+1 prevention, and migration discipline across languages. Product names are examples; check the project's library and version before relying on an API.

## Contents

- [ORM vs Query Builder vs Raw SQL](#orm-vs-query-builder-vs-raw-sql)
- [Active Record vs Data Mapper](#active-record-vs-data-mapper)
- [Product Notes](#product-notes)
- [N+1 Query Detection and Prevention](#n1-query-detection-and-prevention)
- [Lazy vs Eager Loading](#lazy-vs-eager-loading)
- [Sessions and Async Code](#sessions-and-async-code)
- [Migrations with ORMs](#migrations-with-orms)
- [Anti-Patterns](#anti-patterns)

---

## ORM vs Query Builder vs Raw SQL

```
Primary constraint?
├── CRUD-heavy domain, team wants entity mapping and generated migrations → ORM
├── SQL control with compile-time type checking → typed query builder
├── Complex analytics, reporting, hand-tuned queries → raw SQL with generated types (sqlc-style)
└── Edge or serverless runtime → a library without a native engine binary and with an HTTP or adapter driver
```

Mixing is normal: an ORM for writes and simple reads, raw SQL or a query builder for reporting queries. Pool connections at the infrastructure level (an external pooler) when many instances connect; an ORM's in-process pool does not bound the total.

---

## Active Record vs Data Mapper

- **Active Record** — the object wraps a row and persists itself (`save()`, `find()`). Little ceremony; fits CRUD with thin rules. The risk is persistence calls scattered through domain code and hard-to-see query patterns.
- **Data Mapper** — mapping and persistence live outside the domain object; the object carries no database knowledge. More setup; fits richer rules and isolated tests.

In either style, behavior and invariants stay with the entity or aggregate that owns them (`development`); what must not leak into the domain is persistence: lazy-loading proxies, session lifetime, framework annotations driving business decisions. Where to draw repository and unit-of-work boundaries is an `architecture` decision ([integration-patterns.md](../../architecture/references/integration-patterns.md)).

---

## Product Notes

| Ecosystem | Examples | Notes |
|---|---|---|
| TypeScript | Prisma | Schema-first, generated client, own migration tool. Prisma 7+: generated client goes to an explicit `output` path and connects through a driver adapter; older guides import from `@prisma/client` without an adapter |
| TypeScript | Drizzle, Kysely | Schema or types in TypeScript, SQL-shaped API, no code generation; pair Kysely with a separate migration tool |
| TypeScript | TypeORM, MikroORM | Decorator entities; TypeORM supports both Active Record and Data Mapper |
| Python | SQLAlchemy 2.x | `select()` style everywhere, typed `Mapped[]` columns, `AsyncSession`; migrations with Alembic |
| Python | Django ORM | `select_related` / `prefetch_related`; async query methods (`aget`, `async for`) exist, but transactions are not supported in async code (they raise `SynchronousOnlyOperation`): put transactional ORM code in a synchronous function and call it with `sync_to_async` |
| JVM | Hibernate / Jakarta Persistence, jOOQ, Exposed | Entity graphs or `JOIN FETCH` per query; jOOQ generates types from the schema |
| Go | `database/sql` with pgx, sqlc, GORM, ent | sqlc generates typed functions from SQL files; GORM is Active Record-like; pass `context.Context` to every query |
| .NET | EF Core, Dapper | EF Core: `Include` for eager loads, `AsNoTracking` for read-only queries, migrations bundles; Dapper maps raw SQL |
| Rust | Diesel, SeaORM, sqlx | Diesel checks queries at compile time (sync core, async via an extra crate); sqlx checks raw SQL against a database at build time |

---

## N+1 Query Detection and Prevention

```python
# N+1: one query for users, then one per user for posts
users = session.scalars(select(User)).all()
for user in users:
    posts = user.posts            # lazy load per user
```

| Library | Fix | Notes |
|-----|---------|-------|
| Prisma | `include: { posts: true }` | Join or batched IN query depending on relation |
| Drizzle | relational query `with: { posts: true }` or explicit join | |
| TypeORM | `leftJoinAndSelect` or `relations` in `find()` | |
| SQLAlchemy | `selectinload(User.posts)` | Two queries: parents, then children `IN (...)` |
| SQLAlchemy | `joinedload(User.posts)` | One join; duplicates parent rows for collections |
| Django | `prefetch_related("posts")` / `select_related("profile")` | Second query vs join (FK and one-to-one only) |
| Hibernate | `@EntityGraph` or `JOIN FETCH` | Per-query fetch plan |
| EF Core | `Include(u => u.Posts)`, `AsSplitQuery()` for large collections | |
| Go (sqlc / GORM) | one query with `WHERE id = ANY($1)` / `Preload("Posts")` | |

Joins inflate result sets for one-to-many; a second `IN` query is safer for large collections.

**Detection:** log SQL in development, use an N+1 detector for the ORM where one exists, and look for repeated identical query spans in traces. The durable guard is a test that asserts the query count for each critical endpoint.

---

## Lazy vs Eager Loading

| Strategy | When to use | Trade-off |
|----------|------------|-----------|
| Eager (join) | Related data always needed, one-to-one or small sets | Over-fetches when not used |
| Eager (batch / second query) | One-to-many collections always needed | Two queries instead of N+1 |
| Lazy (on access) | Relation rarely needed, synchronous code only | N+1 risk; fails in async contexts |
| Explicit per query | Access pattern varies across endpoints | Most control, more code |

Default: explicit loading per query. Never make lazy loading the default in async services.

---

## Sessions and Async Code

- One session (unit of work) per request or per job; never share a session across concurrent tasks.
- In async code, lazy loads trigger implicit I/O and fail (SQLAlchemy raises `MissingGreenlet`; JPA raises `LazyInitializationException` outside the session). Load what the handler needs at query time.
- Keep the session's lifetime inside the transaction; do not return attached entities past the point where the session closes.
- Map entities to response DTOs at the boundary instead of serializing ORM objects.

---

## Migrations with ORMs

1. Use the library's migration tool and keep migration files in version control; never edit the migration history table by hand.
2. Review the generated SQL before applying it anywhere:

| Tool | Preview command |
|---|---|
| Prisma | `prisma migrate dev --create-only`, then read the file |
| Alembic | `alembic upgrade head --sql` |
| Django | `manage.py sqlmigrate app 0001` |
| EF Core | `dotnet ef migrations script` |

3. Generated migrations are not lock-aware: rewrite index builds, constraint additions, and backfills following the safe-migration rules in [SKILL.md](../SKILL.md#safe-migrations).
4. Never run schema auto-sync (`synchronize: true`, `prisma db push`, `ddl-auto=update`) against production.
5. Run migrations in CI against a fresh database before tests, and rehearse on production-like data volume.

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| N+1 queries | One round trip per parent row | Eager load or batch per query |
| Lazy loading in async handlers | Runtime errors or hidden queries | Load explicitly at query time |
| Schema auto-sync in production | Silent drops and table rewrites | Reviewed migration files only |
| Persistence leaking into domain rules | Lazy proxies, session lifetime, and annotations decide behavior | Keep invariants with the owning entity or aggregate (`development`); keep loading and session control at the data-access edge |
| ORM entity reused as API DTO | Leaks columns, couples API to schema | Map to explicit response types |
| ORM for analytics queries | Inefficient aggregation SQL | Raw SQL, query builder, or analytics store |
| No query-count assertions | N+1 regressions slip in | Assert query counts per endpoint in integration tests |
| One session for concurrent tasks | Races, stale state | One session per request or task |
| Applying generated migrations unread | Destructive or locking DDL reaches production | Review the SQL; apply safe-migration rules |
