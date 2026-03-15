# ORM & Data Access Patterns

Reference for ORM selection, architectural patterns, and data access strategies across languages. Examples show concrete code; adapt to your stack.

## Contents

- [ORM vs Query Builder vs Raw SQL](#orm-vs-query-builder-vs-raw-sql)
- [Architecture Patterns](#architecture-patterns)
- [JavaScript / TypeScript ORMs](#javascript--typescript-orms)
- [Python ORMs](#python-orms)
- [Java / Kotlin ORMs](#java--kotlin-orms)
- [Rust Data Access](#rust-data-access)
- [N+1 Query Detection and Prevention](#n1-query-detection-and-prevention)
- [Lazy vs Eager Loading](#lazy-vs-eager-loading)
- [Migration Strategies with ORMs](#migration-strategies-with-orms)
- [Anti-Patterns](#anti-patterns)

---

## ORM vs Query Builder vs Raw SQL

Ask: What is your primary constraint — developer speed, type safety, query control, or runtime performance?

```
Data access approach?
├── Rapid prototyping, schema-first, strong DX → ORM (Prisma, TypeORM, Django ORM)
├── SQL control + compile-time type safety → Query builder (Drizzle, Kysely)
├── Complex analytics, max performance → Raw SQL + type generation (TypedSQL, sqlc)
├── Python ecosystem → SQLAlchemy 2.0 (ORM layer or Core)
├── Java / Kotlin → Hibernate / jOOQ / Exposed
├── Rust, compile-time verification → Diesel
├── Rust, async-first, dynamic queries → SeaORM / sqlx
└── Simple CRUD, small team, fast iteration → Active Record pattern ORM
```

Ask: Are you deploying to edge or serverless? → Favor lightweight/no-binary ORMs (Drizzle, Kysely, Prisma 7+ Query Compiler).

Ask: Do you need connection pooling at the infrastructure level? → Add PgBouncer, RDS Proxy, or Prisma Accelerate instead of relying on ORM pooling.

---

## Architecture Patterns

### Active Record

The domain object wraps a table row and owns its own persistence methods (`save()`, `delete()`, `find()`). Tight coupling between domain model and persistence layer.

- Simple to use, minimal boilerplate
- Works well for CRUD-heavy apps with thin business logic
- Becomes problematic when domain models grow complex
- Examples: TypeORM (Active Record mode), Django ORM, Eloquent (Laravel), Rails ActiveRecord

```typescript
// TypeORM Active Record
@Entity()
class User extends BaseEntity {
  @PrimaryGeneratedColumn() id: number
  @Column() name: string
}

const user = new User()
user.name = "Alice"
await user.save()

const found = await User.findOneBy({ id: 1 })
```

### Data Mapper

Persistence logic lives in separate repository classes. Domain objects have no knowledge of the database. Cleaner domain model, easier to test in isolation.

- More boilerplate, but separation pays off in large codebases
- Enables Domain-Driven Design (DDD) patterns
- Repository can be mocked without touching the DB
- Examples: TypeORM (Data Mapper mode), Hibernate, SQLAlchemy, MikroORM

```typescript
// TypeORM Data Mapper
@Injectable()
class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) {}

  async create(name: string): Promise<User> {
    const user = this.userRepo.create({ name })
    return this.userRepo.save(user)
  }
}
```

### Query Builder

Composable SQL construction with type checking at the query level. No entity mapping overhead. You think in SQL; the library ensures correctness.

- Zero abstraction cost over raw SQL
- Full expressiveness for complex joins, CTEs, window functions
- No lazy loading footguns
- Examples: Drizzle, Kysely, Knex, jOOQ

---

## JavaScript / TypeScript ORMs

### Prisma (v6 / v7)

Schema-first ORM with generated type-safe client. Prisma 6 introduced TypedSQL for raw query type safety. Prisma 7 ships a Rust-free architecture (Query Compiler) that eliminates native binary dependencies — up to 3.4x faster queries, ~90% smaller bundle (~1.6 MB vs ~14 MB), and first-class support for edge runtimes (Cloudflare Workers, Deno, Vercel Edge).

**Key components:**

| Component | Purpose |
|-----------|---------|
| Prisma Client | Generated type-safe query client |
| Prisma Migrate | Schema-driven migration tooling |
| Prisma Accelerate | Managed global connection pool + query-level cache (300+ PoP locations) |
| TypedSQL | Raw SQL files with generated TypeScript types |
| Prisma Studio | Visual DB browser |

**Basic usage:**

```typescript
// schema.prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[]
}

// Query
const users = await prisma.user.findMany({
  where: { email: { endsWith: "@example.com" } },
  include: { posts: true },
  take: 20,
  skip: 0,
})
```

**TypedSQL (raw queries with generated types):**

```sql
-- prisma/sql/getUsersWithPostCount.sql
SELECT u.id, u.email, COUNT(p.id)::int AS post_count
FROM "User" u
LEFT JOIN "Post" p ON p."authorId" = u.id
GROUP BY u.id, u.email
```

```typescript
import { getUsersWithPostCount } from "@prisma/client/sql"

const result = await prisma.$queryRawTyped(getUsersWithPostCount())
// result is fully typed: { id: number, email: string, post_count: number }[]
```

**Prisma Accelerate (connection pooling + edge cache):**

```typescript
import { PrismaClient } from "@prisma/client/edge"
import { withAccelerate } from "@prisma/extension-accelerate"

const prisma = new PrismaClient().$extends(withAccelerate())

const user = await prisma.user.findUnique({
  where: { id: 1 },
  cacheStrategy: { ttl: 60, swr: 30 }, // cache for 60s, stale-while-revalidate 30s
})
```

Trade-offs: custom `.prisma` schema language (not TypeScript), generated client adds build step. Prisma 7 removes the binary engine dependency entirely.

### Drizzle ORM

TypeScript-first, SQL-like API. No code generation required — schema is plain TypeScript. Relational Queries v2 (2025) added first-class many-to-many support, AND/OR/NOT/RAW filter operators, and custom computed fields.

```typescript
// Schema definition (TypeScript, no code gen)
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
})

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull().references(() => users.id),
})

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))
```

```typescript
// Relational Queries v2 — eager loading with filter on related table
const result = await db.query.users.findMany({
  where: (users, { gt }) => gt(users.id, 10),
  with: {
    posts: {
      where: (posts, { like }) => like(posts.content, "M%"),
    },
  },
})

// SQL-like query builder API
const activeUsers = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(gt(users.id, 0))
  .limit(20)
  .offset(0)
```

Drizzle Kit handles migrations. No runtime overhead — generates SQL strings. Supports PostgreSQL, MySQL, SQLite, and MSSQL (MSSQL excludes RQBv2 as of early 2026).

Trade-offs: more manual schema definition than Prisma; no GUI tooling built-in.

### TypeORM

Decorator-based ORM supporting both Active Record and Data Mapper. Mature ecosystem, wide database support. Development pace has slowed relative to Drizzle and Prisma.

```typescript
@Entity()
@Index(["email"], { unique: true })
class User {
  @PrimaryGeneratedColumn("uuid") id: string
  @Column() email: string
  @OneToMany(() => Post, (post) => post.author) posts: Post[]
  @CreateDateColumn() createdAt: Date
}

// Data Mapper with QueryBuilder for complex joins
const users = await dataSource
  .getRepository(User)
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post")
  .where("user.email LIKE :pattern", { pattern: "%@example.com" })
  .take(20)
  .skip(0)
  .getMany()
```

Trade-offs: TypeScript support has gaps (decorators require `experimentalDecorators`); slower iteration on new features; complex types in query builder can become unwieldy.

### Kysely

Type-safe SQL query builder, not a full ORM. Zero runtime overhead — generates SQL strings with TypeScript inferring column types, aliases, and join results.

```typescript
import { Kysely, PostgresDialect } from "kysely"

// Define your database schema as types
interface Database {
  user: { id: number; email: string; created_at: Date }
  post: { id: number; author_id: number; content: string }
}

const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })

// TypeScript catches invalid column references at compile time
const users = await db
  .selectFrom("user")
  .innerJoin("post", "post.author_id", "user.id")
  .select(["user.id", "user.email", "post.content as post_content"])
  .where("user.id", ">", 10)
  .limit(20)
  .offset(0)
  .execute()
// result type: { id: number, email: string, post_content: string }[]
```

Best paired with a dedicated migration tool (e.g., Kysely Migrations, Liquibase, or raw SQL files). Supports Node.js, Deno, Bun, Cloudflare Workers, and browsers.

Trade-off: no entity mapping or relationship management — you manage joins manually.

---

## Python ORMs

### SQLAlchemy 2.0

The standard Python data access library. Offers both ORM (entity mapping) and Core (SQL expression language) layers. The 2.0 series enforces typed `Mapped` annotations and first-class async support via `AsyncSession`.

**Async setup:**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import select

engine = create_async_engine("postgresql+asyncpg://user:pass@host/db")
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    posts: Mapped[list["Post"]] = relationship(back_populates="author")
```

**Querying (2.0 style — use `select()` everywhere):**

```python
async with SessionLocal() as session:
    # Eager load to prevent lazy I/O in async context
    stmt = (
        select(User)
        .options(selectinload(User.posts))  # 2 queries: users + posts IN (...)
        .where(User.id > 10)
        .limit(20)
        .offset(0)
    )
    result = await session.scalars(stmt)
    users = result.all()
```

Async rule: never rely on lazy loading in async code. Lazy loads trigger implicit I/O which raises `MissingGreenlet` in async context. Always use `selectinload()` or `joinedload()` explicitly.

Migrations: Alembic (official, works seamlessly with SQLAlchemy models).

### Django ORM

QuerySet-based ORM tightly integrated with Django's ecosystem (admin, forms, signals, migrations). As of Django 4.1+, most QuerySet operations have async variants prefixed with `a` (`afilter`, `aall`, `aget`, `acreate`, etc.). Django 5.2 (2025) added async support for user model methods, permissions, and auth backends.

Current limitation: database transactions do not yet work in async mode as of early 2026. Use `sync_to_async` as a bridge when needed.

```python
# Sync (still the primary path for most apps)
from django.db.models import Prefetch

users = (
    User.objects
    .select_related("profile")          # JOIN for FK / one-to-one
    .prefetch_related(
        Prefetch("posts", queryset=Post.objects.filter(published=True))
    )
    .filter(id__gt=10)[:20]
)

# Async variant (Django 4.1+)
async def get_users():
    return [u async for u in User.objects.filter(id__gt=10).aiterator()]
```

Migrations: Django's built-in migration system (`makemigrations` / `migrate`). Review generated SQL with `sqlmigrate` before applying.

---

## Java / Kotlin ORMs

### Hibernate 6 / Jakarta Persistence

Standard JPA implementation for Java and Kotlin. Hibernate 6.x delivers improved SQL generation, better support for JSON column types, and enhanced batch operations.

```kotlin
// Kotlin + Hibernate / Spring Data JPA
@Entity
@Table(name = "users")
data class User(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(unique = true) val email: String,
    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY)
    val posts: List<Post> = emptyList()
)

// Repository
interface UserRepository : JpaRepository<User, Long> {
    @EntityGraph(attributePaths = ["posts"])  // eager load for this query
    fun findAllByEmailEndingWith(domain: String, pageable: Pageable): Page<User>
}
```

Ask: Is Hibernate too heavy for your Kotlin service? Alternatives: Exposed (JetBrains' Kotlin-idiomatic DSL), jOOQ (type-safe SQL, generates from schema), JDBI (lightweight SQL mapper).

---

## Rust Data Access

### Diesel

Compile-time verified SQL. Diesel generates Rust types from your schema and validates every query at compile time. Schema drift between code and DB is a compile error.

```rust
// Schema is generated from DB (diesel print-schema)
diesel::table! {
    users (id) {
        id -> Int4,
        email -> Text,
        created_at -> Timestamptz,
    }
}

// Query
use diesel::prelude::*;

fn get_users(conn: &mut PgConnection, limit: i64) -> QueryResult<Vec<User>> {
    users::table
        .filter(users::id.gt(10))
        .limit(limit)
        .load::<User>(conn)
}
```

Trade-off: dynamic queries (optional filters, runtime-determined columns) require significant boilerplate. Diesel is synchronous by default; use with a thread pool or `diesel-async` crate for async support.

### SeaORM

Async-first ORM for Rust built on `sqlx`. SeaORM 2.0 (January 2026) brings a more dynamic approach with an active-record-inspired API and runtime query construction.

```rust
use sea_orm::*;

// Find with related models (eager load)
let users_with_posts: Vec<(user::Model, Vec<post::Model>)> = User::find()
    .filter(user::Column::Id.gt(10))
    .find_with_related(Post)
    .all(db)
    .await?;
```

Ask: Compile-time query validation matters most → Diesel. Async-first with dynamic query patterns → SeaORM. Just want raw SQL with type binding → `sqlx` directly.

---

## N+1 Query Detection and Prevention

### The Problem

```python
# Python example — N+1: 1 query for users, then N queries for posts
users = await session.scalars(select(User))
for user in users:
    posts = user.posts  # triggers N lazy loads in sync; MissingGreenlet in async
```

```typescript
// TypeScript example — N+1 with ORM
const users = await prisma.user.findMany()
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } }) // N queries
}
```

### Solutions by ORM

| ORM | Solution | Notes |
|-----|---------|-------|
| Prisma | `include: { posts: true }` | Single JOIN or batched IN query depending on relation type |
| Drizzle RQB | `with: { posts: true }` | RQBv2 generates optimized SQL |
| Drizzle SQL | `.leftJoin(posts, eq(posts.authorId, users.id))` | Manual join |
| TypeORM | `.leftJoinAndSelect("user.posts", "post")` | QueryBuilder eager join |
| TypeORM | `relations: ["posts"]` in `find()` | Auto JOIN |
| SQLAlchemy | `selectinload(User.posts)` | 2 queries: parent + IN clause for children |
| SQLAlchemy | `joinedload(User.posts)` | Single JOIN, may produce duplicate rows for collections |
| Django | `prefetch_related("posts")` | 2 queries |
| Django | `select_related("profile")` | Single JOIN (FK / one-to-one only) |
| Hibernate | `@EntityGraph` or `JOIN FETCH` | Controls fetch plan per query |
| SeaORM | `.find_with_related(Post)` | Async batch load |

Rule: `select_related` (Django) and `joinedload` (SQLAlchemy) use SQL JOINs — can inflate result set for one-to-many. `prefetch_related` (Django) and `selectinload` (SQLAlchemy) use a second query with `IN` — safer for large collections.

### Detection Tools

| Tool | Ecosystem | How |
|------|----------|-----|
| Django Debug Toolbar | Django | Shows all queries per request with stack traces |
| nplusone | Python (Django, SQLAlchemy) | Raises error/warning on lazy load detection |
| SQLAlchemy `echo=True` | SQLAlchemy | Logs all emitted SQL to stdout |
| Prisma query logging | Prisma | `log: ["query"]` in client config; Prisma Studio shows query counts |
| Hibernate `show_sql` | Hibernate | Logs all SQL; pair with a query counter in tests |
| Sentry Performance | All | Detects N+1 patterns in production traces |
| Datadog APM | All | Automatic N+1 detection with DB span analysis |
| Custom logging middleware | Any | Count queries per request; fail tests over threshold |

**Dev discipline:** write a test that asserts the query count for each critical endpoint. Any ORM lets you intercept queries; fail the test if count exceeds the expected number.

---

## Lazy vs Eager Loading

| Strategy | When to use | Trade-off |
|----------|------------|-----------|
| Eager (JOIN) | Related data always needed in the response | Over-fetches if the relation is not used in all code paths |
| Eager (batch / `selectinload`) | One-to-many collections always needed | 2 queries instead of N+1; avoids JOIN row duplication |
| Lazy (on first access) | Relation rarely needed, sync context only | N+1 risk; crashes in async context (SQLAlchemy, Hibernate) |
| Explicit (per-query) | Access pattern varies across endpoints | Most flexible; more code but full control |

Default rule: use explicit (per-query) loading. Opt into eager loading only for relations you know are always needed for a given handler. Never configure global lazy loading as the default in async services.

---

## Migration Strategies with ORMs

1. Always use the ORM's own migration tool — do not hand-edit migration tables.
2. Review generated SQL before applying in any environment:
   - Prisma: `prisma migrate dev --create-only` then inspect the file
   - Alembic: `alembic upgrade --sql head` to preview
   - Django: `manage.py sqlmigrate app 0001`
   - TypeORM: `migration:generate` then review
3. Apply expand-contract for zero-downtime schema changes:
   - Expand: add new column (nullable or with default)
   - Backfill: populate existing rows
   - Switch: deploy code reading from new column
   - Contract: drop old column in a subsequent migration
4. Never run `synchronize: true` (TypeORM) or `prisma db push` in production — both can silently drop data.
5. Test migrations against a production-like data volume before promoting.
6. Keep migration files in version control alongside application code.
7. Run migrations in CI before tests to catch schema drift early.

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| N+1 queries | Linear DB round-trips per parent row | Eager load or batch with `include` / `prefetch_related` / `selectinload` |
| Lazy loading in async handlers | `MissingGreenlet`, `LazyInitializationException`, or silent extra queries | Explicit joins or eager loading at query time |
| `synchronize: true` in production | Silent table drops/modifications on startup | Explicit migration files only |
| `prisma db push` on production | Bypasses migration history; data loss risk | Use `prisma migrate deploy` |
| Fat entities with business logic | ORM entity becomes a god object | Separate domain services; entity holds only data |
| Returning raw ORM objects from API | Leaks DB column names, internal fields | Map to explicit response DTOs |
| ORM for analytics / OLAP queries | ORMs optimize for CRUD, not aggregations | Raw SQL, query builder, or dedicated analytics layer |
| No query count assertions in tests | N+1 regressions go undetected | Assert query count per endpoint in integration tests |
| One session/connection for all concurrent async tasks | Thread-safety violations, stale state | One session per request; separate sessions per concurrent task |
| Ignoring slow query logs | Performance regressions silently accumulate | Enable query logging in dev; set slow-query thresholds |
| Skipping migration review | Destructive migrations promoted to production | Always inspect generated SQL before applying |
