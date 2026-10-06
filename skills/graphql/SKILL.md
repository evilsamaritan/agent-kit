---
name: graphql
description: "Design GraphQL schemas and execution. Use for schema design, resolvers, DataLoader/N+1, pagination, errors and partial results, federation or composition, subscriptions, and GraphQL security (cost limits, trusted documents, authorization)."
---

# GraphQL

Determine the server library and version from the project's manifest or lockfile first: incremental delivery, trusted documents, cost directives, and error masking differ by server. Version-specific notes and spec status: [schema-patterns.md](references/schema-patterns.md#spec-and-server-status).

## Hard Rules

- **Input types for mutations** — never reuse output types as inputs.
- **Expected business failures are data; unexpected failures are errors.** Model known outcomes (email taken, insufficient stock) as typed results in the payload; let everything else propagate to the top-level `errors` with a masked message. Never catch-all into a business code (`development` rule 6).
- **Batch loaders are per request** — a global loader leaks cached data across callers.
- **Resolvers are thin** — they map arguments, call the domain or service layer, and shape the result. Business rules and authorization decisions live in that layer.
- **No side effects in query resolvers** — side effects belong in mutations.
- **Every list is bounded** — connections clamp `first`/`last` to a documented maximum; queries are limited by depth and cost.
- **`[Item!]!` for lists** — non-null list of non-null items (can be empty).

---

## Decision Points

### Nullability

```
Can this field fail or be missing independently of its parent?
├─ no (id, own scalar columns, computed from the parent) → non-null
└─ yes (remote service, separate store, permission-filtered, optional data) → nullable
```

A failed non-null field nulls its parent, and the null bubbles up to the nearest nullable ancestor — possibly the whole query. Nullable fields contain the damage. Output non-null → nullable is breaking for clients; plan it at design time.

### Schema-first vs code-first

- **Several teams, schema review as a governance step, or composition across services?** → Schema-first: `.graphql` files are the contract; generate types from them.
- **One team, schema shaped by the implementation language's types?** → Code-first: a builder library in the server language derives the schema; review the printed schema in CI.
- **Default** → schema-first; it makes contract changes visible in review.

### Composition

```
Do several teams own parts of the graph and deploy independently?
├─ yes → composed supergraph: each subgraph owns its types, a router plans queries
└─ no → Do you wrap non-GraphQL sources (REST, RPC, databases) for one team?
        ├─ yes → a gateway that generates a schema from those sources
        └─ no → one schema in one service
```

Federation design, entity resolution, and router configuration: [federation-patterns.md](references/federation-patterns.md).

### Introspection

- **Public or partner API** → keep introspection on; protect with authorization, depth and cost limits, and rate limits.
- **First-party clients only, with a trusted-document list enforced** → disable or restrict introspection in production; it adds little once ad-hoc queries are rejected.
- Disabling introspection is obscurity, never a substitute for authorization and cost limits.

---

## Schema Patterns

```graphql
type User implements Node {
  id: ID!
  email: String!
  name: String!
  orders(first: Int = 10, after: String): OrderConnection!
  createdAt: DateTime!
}

input CreateUserInput {
  email: String!
  name: String!
}

type CreateUserPayload {
  user: User
  errors: [CreateUserError!]!
}

type CreateUserError {
  field: String
  code: CreateUserErrorCode!
  message: String!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}
```

A union result (`union CreateUserResult = CreateUserSuccess | EmailTaken | InvalidInput`) is the alternative to an `errors` list; it makes each outcome a type the client switches on exhaustively. Choose one style per schema.

Prefer specific scalars (`DateTime`, `URL`, `EmailAddress`) over `String`; they validate at the schema boundary. Interfaces for shared fields plus type-specific extensions; unions for results with no common fields.

### Global object identification

`interface Node { id: ID! }` plus `Query.node(id: ID!): Node` lets clients refetch any object. Global ids are opaque (type + key, encoded) and stable. `node(id)` is an access path like any other: it must run the same authorization as the type's own query, or it exposes every object by id.

---

## Resolvers and Errors

```typescript
Mutation: {
  createUser: async (_, { input }, ctx) => {
    const result = await ctx.services.users.register(input, ctx.viewer)
    switch (result.kind) {          // closed set of expected outcomes, checked exhaustively
      case 'created':     return { user: result.user, errors: [] }
      case 'email_taken': return { user: null, errors: [{ field: 'email', code: 'EMAIL_TAKEN', message: 'Email already registered' }] }
    }
    // any thrown error is unexpected: it reaches `errors` and is masked by the server
  },
},
```

**Errors and partial results:**
- A response can carry both `data` and `errors`; clients handle partial data per field path.
- Put a machine-readable code in `errors[].extensions.code`; never put stack traces or upstream messages in `message`. Enable the server's error masking for unexpected errors and log the original with the request id.
- Over HTTP, parse and validation failures are request errors (4xx with the GraphQL-over-HTTP response media type); once execution starts, the status is 2xx and failures appear in `errors`. Check what the server and clients implement.
- Mutations a client may retry take a client-supplied idempotency key in the input (contract: `api-design`).

---

## N+1 and Batch Loading

```
Query: users(first: 100)     → 1 query for users
  └── User.orders             → 100 queries (one per user) ← N+1
```

Language-neutral pattern:

```
per request:
  loader = BatchLoader(keys → fetch all rows WHERE parentId IN keys; return results in key order, empty for missing)
resolver User.orders(user) → loader.load(user.id)
```

The loader collects keys requested in one execution tick and issues one query. For paginated child fields, key the loader by `(parentId, args)` or use a windowed query (`ROW_NUMBER() OVER (PARTITION BY parent_id ...)`) so `first`/`after` are honored per parent.

---

## Pagination

Relay connections (`edges { node cursor }`, `pageInfo`) for unbounded lists; plain `[Item!]!` for small bounded collections. Cursors follow `api-design`: opaque to clients, untrusted by the server — signed or validated, bound to the sort and filter. Implementation with clamping, cursor validation, and backward paging: [schema-patterns.md](references/schema-patterns.md#pagination--relay-implementation).

---

## Subscriptions

```graphql
type Subscription {
  orderStatusChanged(orderId: ID!): Order!
}
```

- Authorize at subscribe time against the resource, and again on each event when access can change; transport rules are in `realtime`.
- Filter server-side; never push everything and filter on the client.
- Use for frequent incremental updates; prefer polling or SSE for infrequent ones.
- Clean up on disconnect; leaked listeners are the main failure mode.

---

## Security Controls

| Control | Purpose |
|---------|---------|
| Authorization in the domain layer | Every field and `node(id)` path is protected by the service it calls, not by remembering to annotate the field |
| Object-level checks | "Can this viewer see this record?" — not only "does this viewer have role X?" |
| Depth and cost analysis at validation time | Reject expensive documents before execution; list fields multiply cost by `first` |
| Alias and batch limits | Aliases and batched operations multiply work inside one request; count them in cost and cap them |
| Trusted documents | Build-time manifest of allowed operations; server executes only known ids and rejects raw query text |
| Rate limiting by cost | Budgets per client in cost units, not request count |

**Trusted documents vs automatic persisted queries (APQ):** APQ is a bandwidth cache — any client can register any query by sending its hash and text. It is not an allowlist. Only a build-time manifest enforced at the server or router blocks arbitrary operations. Details: [schema-patterns.md](references/schema-patterns.md#trusted-documents).

Directive-based auth (`@auth`, `@requiresScopes`) is a coarse, declarative gate on top of domain checks, never the only check. Patterns: [schema-patterns.md](references/schema-patterns.md#authorization).

---

## Incremental Delivery

`@defer` and `@stream` are not part of a ratified spec edition. Use them only when both the server and the client library support the same response format.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Catch-all in mutations returning one business code | Outages look like user errors; internals leak | Typed expected outcomes; unexpected errors propagate, masked |
| Non-null everywhere | One failing remote field nulls the whole response | Nullable for independently fallible fields |
| Unbounded `first` | One query fetches the table | Clamp to a documented maximum |
| Trusting decoded cursors | Clients forge positions or inject values | Signed or validated cursors |
| APQ treated as an allowlist | Any client registers any query | Trusted-document manifest enforced at the server |
| Authorization only in directives or middleware | New fields and `node(id)` are unprotected by default | Domain-layer checks; directives as a coarse gate |
| N+1 without batching | One query per parent | Per-request batch loader |
| Global loader | Cross-request cache leaks | Loader per request |
| Side effects in query resolvers | Breaks caching and retries | Mutations only |
| Schema generated from database tables | Exposes internals | Demand-oriented schema |

---

## Related Knowledge

- `api-design` — protocol selection, cursor rules, error contracts, idempotency keys
- `realtime` — transport and authorization for subscriptions
- `auth` — authorization models and object-level checks
- `security` — input validation, API threat categories
- `performance` — measuring resolver and query cost

## References

- [schema-patterns.md](references/schema-patterns.md) — mutation payloads, scalars, authorization, Relay implementation, schema evolution, cost and depth limits, trusted documents, spec and server status
- [federation-patterns.md](references/federation-patterns.md) — subgraph design, entity resolution, router configuration, migration (Apollo Federation as the worked example)
