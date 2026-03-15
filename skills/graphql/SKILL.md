---
name: graphql
description: Design GraphQL schemas, resolvers, DataLoader, federation, subscriptions, security, codegen. Use when designing schemas, solving N+1, setting up federation, implementing subscriptions, or codegen. Do NOT use for REST (use api-design) or real-time transport (use realtime).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# GraphQL

## Hard Rules

- Non-nullable by default (`String!`) — nullable only when field can legitimately be absent
- Input types for mutations — NEVER reuse output types as inputs
- Mutation payloads return object + typed errors — NEVER throw for business errors
- DataLoader per request — NEVER global (causes cross-request cache leaks)
- Resolvers are thin — delegate to data sources/services, no business logic
- No side effects in query resolvers — side effects belong in mutations only
- Disable introspection in production — use trusted documents instead
- `[Item!]!` for lists — non-null list of non-null items (can be empty `[]`)

---

## Schema Design Decision

### Schema-First vs Code-First

- **Multiple teams, schema governance, federation?** → Schema-first. Write `.graphql` files, generate types. Schema is the contract.
- **Single team, rapid iteration, TypeScript-native?** → Code-first (Pothos, Nexus, TypeGraphQL). Types derived from code, no schema drift.
- **Default** → Schema-first. Easier review, clearer contracts, better tooling support.

### Schema Patterns

```graphql
# Type-first: define your domain model
type User {
  id: ID!
  email: String!
  name: String!
  orders(first: Int = 10, after: String): OrderConnection!
  createdAt: DateTime!
}

# Input types for mutations (never reuse output types)
input CreateUserInput {
  email: String!
  name: String!
}

# Mutation response — always return the mutated object + errors
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type UserError {
  field: String!
  code: UserErrorCode!
  message: String!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}
```

Prefer specific scalar types (`DateTime`, `URL`, `EmailAddress`) over `String` — validates at schema level.

### Interfaces & Unions

| Type | When | Requires Shared Fields |
|------|------|----------------------|
| Interface | Shared fields + type-specific extensions (`Node`, `Timestamped`) | Yes |
| Union | Polymorphic results, no common fields (`SearchResult = User \| Post`) | No |

---

## Resolver Patterns

```typescript
const resolvers = {
  Query: {
    user: (_, { id }, ctx) => ctx.dataSources.users.findById(id),
  },
  User: {
    // Field resolver — runs only when field is requested
    orders: (user, args, ctx) =>
      ctx.dataSources.orders.findByUserId(user.id, args),
  },
  Mutation: {
    createUser: async (_, { input }, ctx) => {
      try {
        const user = await ctx.dataSources.users.create(input)
        return { user, errors: [] }
      } catch (e) {
        return { user: null, errors: [{ field: 'email', code: 'EMAIL_TAKEN', message: e.message }] }
      }
    },
  },
}
```

Context (`ctx`) carries auth, dataSources, DataLoader instances. Field resolvers enable lazy loading — only compute when requested.

---

## N+1 Problem & DataLoader

```
Query: users(first: 100)     → 1 DB query for users
  └── User.orders             → 100 DB queries (one per user) ← N+1!
```

**Solution — DataLoader (batching + caching per request):**

```typescript
// Create per-request — NEVER global
const ordersByUserLoader = new DataLoader(async (userIds: string[]) => {
  const orders = await db.orders.findMany({ where: { userId: { in: userIds } } })
  const map = groupBy(orders, 'userId')
  return userIds.map(id => map[id] || [])
})

// Resolver uses loader
User: {
  orders: (user, _, ctx) => ctx.loaders.ordersByUser.load(user.id)
}
```

DataLoader combines N `.load(id)` calls into 1 batched query per tick.

---

## Pagination (Relay Connection Spec)

Pattern: `Connection { edges: [Edge { node, cursor }], pageInfo }`. Args: `first/after` (forward), `last/before` (backward).

- Use Connections for: paginated lists, infinite scroll, relay compatibility
- Use simple lists `[Item!]!` for: small bounded collections (enum-like, user roles)

> Full Connection type definitions and resolver implementation in `references/schema-patterns.md`.

---

## Schema Composition Decision

When combining multiple GraphQL services or data sources:

- **Multiple teams, independent deploy cadence, domain boundaries?** → Federation (Apollo Federation, Cosmo). Each subgraph owns its domain, composed at runtime by a router.
- **Single team, non-GraphQL sources (REST, gRPC, DB)?** → GraphQL Mesh. Wraps non-GraphQL sources into a unified graph.
- **Single team, need fine-grained control over composition?** → Schema stitching (The Guild tools). Loosely coupled, manual setup, open-source.
- **Default for microservices** → Federation. Industry standard for distributed GraphQL.

> Federation architecture, subgraph design, entity resolution in `references/federation-patterns.md`.

---

## Subscriptions

Transport: `graphql-ws` (WebSocket) or SSE for simpler setups.

```graphql
type Subscription {
  orderStatusChanged(orderId: ID!): Order!
  newMessage(channelId: ID!): Message!
}
```

Rules:
- Filter subscriptions server-side — do not push everything to the client
- Use for high-frequency incremental updates (chat, status, dashboards)
- For infrequent updates, prefer polling or SSE over WebSocket subscriptions
- Clean up subscriptions on disconnect — memory leaks are the primary failure mode

---

## Security Controls

| Control | Purpose |
|---------|---------|
| Depth limiting | Prevent deeply nested queries (max 10-15 levels) |
| Cost analysis | Assign cost per field, reject over budget |
| Trusted documents | Allowlisted queries in production (replaces open introspection) |
| Introspection | Disable in production |
| Field-level auth | `@auth(requires: ADMIN)` or resolver-level checks |
| Input validation | Validate at custom scalar level + resolver level |
| Rate limiting | Per-client query cost budgets, not just request count |

**Trusted documents** (previously called "persisted queries"): clients send a hash instead of full query text. Build-time extraction from client code. Blocks arbitrary queries in production. GraphQL Foundation is standardizing this via the GraphQL-over-HTTP specification.

---

## Codegen

Generate typed queries, mutations, subscriptions, and resolver types from schema. Schema-first: write `.graphql` files, generate TypeScript types.

Client-side: typed hooks/functions for queries and mutations. Server-side: typed resolver signatures matching the schema.

---

## @defer and @stream (Experimental)

`@defer` delays resolution of a fragment — useful when some fields are slow. `@stream` delivers list items incrementally. Both are draft spec (not yet ratified). Server support varies — check your server implementation before relying on these.

---

## Context Adaptation

### Frontend
- Client-side schema types via codegen
- Cache normalization, optimistic updates
- Fragment colocation — component-level data requirements

### Backend
- Resolver implementation, DataLoader for N+1, field-level authorization
- Schema composition for multi-service architectures
- Trusted documents for production, introspection disabled

### Architect
- Schema-first vs code-first, schema governance across teams
- Federation boundary decisions: when to split a subgraph
- Query cost analysis for capacity planning

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| God queries (deeply nested, wide) | Unbounded server load, timeouts | Depth + cost limiting |
| N+1 without DataLoader | Linear DB queries per parent | DataLoader batching per request |
| Side effects in query resolvers | Violates GraphQL semantics, breaks caching | Side effects in mutations only |
| Schema-last design | Schema diverges from implementation | Schema-first, then implement resolvers |
| `select *` in resolvers | Fetches unused columns from DB | Field selection or projections |
| Global DataLoader | Cross-request cache leaks | Create DataLoader per request |
| Throwing for business errors | Clients use try/catch, untyped errors | Mutation payload with typed errors |
| Auto-generated schema from DB | Exposes internals, CRUD-guessable | Demand-oriented schema design |
| Open introspection in production | Schema exposed to attackers | Disable introspection, use trusted documents |

---

## Related Knowledge

- **api-design** — protocol selection (REST vs GraphQL vs gRPC), API versioning, error contracts
- **realtime** — WebSocket/SSE transport for GraphQL subscriptions
- **security** — OWASP API security, input validation patterns
- **auth** — field-level authorization, JWT/OAuth2 in GraphQL context
- **performance** — query cost analysis, caching strategies

## References

- [schema-patterns.md](references/schema-patterns.md) — Custom scalars, directives, Relay Connection implementation, error handling, schema evolution
- [federation-patterns.md](references/federation-patterns.md) — Federation subgraph design, entity resolution, router configuration, migration patterns

Load references when you need detailed schema design guidance or federation architecture patterns.
