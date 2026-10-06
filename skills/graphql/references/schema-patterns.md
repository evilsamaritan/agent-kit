# GraphQL Schema Patterns

Depth for the graphql skill: payloads, scalars, authorization, pagination, evolution, and limits. Code samples are TypeScript-flavoured pseudocode; the patterns apply to any server.

## Contents

- [Mutation Payloads](#mutation-payloads)
- [Input Types](#input-types)
- [Custom Scalars](#custom-scalars)
- [Authorization](#authorization)
- [Pagination — Relay Implementation](#pagination--relay-implementation)
- [Schema Evolution](#schema-evolution)
- [Cost and Depth Limits](#cost-and-depth-limits)
- [Trusted Documents](#trusted-documents)
- [Spec and Server Status](#spec-and-server-status)

---

## Mutation Payloads

```graphql
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

type CreateUserPayload {
  user: User                      # null when errors is non-empty
  errors: [CreateUserError!]!     # expected outcomes only
}

type DeleteUserPayload {
  deletedId: ID
  errors: [DeleteUserError!]!
}

type CreateUserError {
  field: String
  code: CreateUserErrorCode!
  message: String!
}

enum CreateUserErrorCode {
  EMAIL_TAKEN
  INVALID_EMAIL
  NAME_TOO_SHORT
}
```

- Error codes are per mutation, so each enum lists only outcomes that mutation can produce.
- Authentication and permission failures, outages, and bugs are not payload errors; they go to top-level `errors` with `extensions.code`.
- Clients must handle unknown enum values: a new code is an additive change only if clients have a fallback branch for it.

---

## Input Types

```graphql
input CreateUserInput {
  email: String!      # required on create
  name: String!
  role: UserRole      # optional, server default
}

input UpdateUserInput {
  email: String       # all optional on update
  name: String
  role: UserRole
}
```

Separate create and update inputs. For updates, distinguish "field omitted" from "explicitly null" when null means "clear the value".

---

## Custom Scalars

```graphql
scalar DateTime     # RFC 3339 timestamp with offset
scalar Date         # calendar date
scalar URL
scalar EmailAddress
scalar BigInt       # integers beyond 2^53
scalar Decimal      # exact decimal as string — money amounts
```

Each scalar has parse (input) and serialize (output) functions that validate; most ecosystems ship a scalar library. Avoid a free-form `JSON` scalar except at true extension points: it opts out of the type system.

---

## Authorization

Authorize in the domain or service layer; the resolver passes the viewer from context.

```typescript
// resolver: thin
Query: {
  invoice: (_, { id }, ctx) => ctx.services.invoices.getForViewer(ctx.viewer, id),
},
Invoice: {
  lineItems: (invoice, args, ctx) => ctx.services.invoices.lineItemsForViewer(ctx.viewer, invoice.id, args),
},

// service: owns the decision
getForViewer(viewer, id):
  invoice = repo.find(id)
  if invoice is null or not policy.canRead(viewer, invoice) → return null   // or a NotFound result; do not reveal existence
  return invoice
```

- **Object-level checks:** "can this viewer read this record?" (owner, tenant, relationship), not only "does the viewer have role X?".
- **Every access path:** root fields, nested fields that reach other objects, `node(id)`, and subscriptions all go through the same policy.
- **Directives as a coarse gate:** a declarative `@requiresScopes` or `@auth` directive can reject early, but it checks the operation, not the record. With roles, check permissions (role → permission set), not role equality, so higher roles are not locked out.
- **Failure mode to avoid:** checks only in resolvers or directives means each new field is unprotected until someone remembers it.

Authorization models (RBAC, ABAC, relationship-based): `auth`.

---

## Pagination — Relay Implementation

```graphql
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
}

type UserEdge {
  node: User!
  cursor: String!
}

type Query {
  users(first: Int, after: String, last: Int, before: String, filter: UserFilter): UserConnection!
}
```

```typescript
const MAX_PAGE = 100

async function resolveUsers(args, ctx) {
  if (args.first != null && args.last != null) throw userInputError('Use first or last, not both')
  const backward = args.last != null
  const limit = Math.min(Math.max(args.first ?? args.last ?? 20, 1), MAX_PAGE)

  const sort = ['createdAt', 'id']
  const raw = backward ? args.before : args.after
  const position = raw ? ctx.cursors.verify(raw, { sort, filter: args.filter }) : null  // throws on bad signature, expiry, or mismatch

  // forward: rows after position in sort order; backward: rows before it, in reverse order
  const rows = await ctx.services.users.page({ filter: args.filter, sort, position, limit: limit + 1, reverse: backward }, ctx.viewer)
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)
  if (backward) page.reverse()

  const edges = page.map(node => ({ node, cursor: ctx.cursors.sign({ key: [node.createdAt, node.id], sort, filter: args.filter }) }))
  return {
    edges,
    pageInfo: {
      hasNextPage: backward ? Boolean(args.before) : hasMore,
      hasPreviousPage: backward ? hasMore : Boolean(args.after),
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
  }
}
```

`hasNextPage` when paging backward (and `hasPreviousPage` when paging forward) may be approximated as shown; the Relay spec allows it. Cursor signing and binding: `api-design` ([rest-patterns.md](../../api-design/references/rest-patterns.md#pagination)).

---

## Schema Evolution

| Change | Breaking? | Notes |
|--------|-----------|-------|
| Add output field or type | No | Existing operations ignore it |
| Add optional argument or input field | No | Must not change behavior when omitted |
| Add enum value or union member | Only for clients without a fallback branch | Document that clients must tolerate unknown values |
| Remove or rename a field | Yes | Add the new field, deprecate the old, remove after usage stops |
| Change a field's type | Yes | Add a new field |
| Output field non-null → nullable | Yes | Clients assume a value |
| Output field nullable → non-null | No for readers, but failures now bubble further | Check error propagation |
| Argument or input field optional → required | Yes | Existing operations omit it |
| Remove an enum value | Yes | Stop returning it, deprecate, then remove |

```graphql
type User {
  fullName: String! @deprecated(reason: "Use `name`. Removal planned after usage reaches zero; see the changelog.")
  name: String!
}
```

1. Add the new field alongside the old one.
2. Deprecate the old field with a reason and a removal plan.
3. Track usage of the deprecated field per client (operation names or trusted-document ids).
4. Remove when usage is zero or the announced date passes.

Run a schema diff against the last released schema in CI and fail on breaking changes.

---

## Cost and Depth Limits

Analyze each document at validation time, before execution:

```
cost(field) = own weight × (list size from first/last argument, or a default cap for unbounded lists)
cost(document) = sum over the selection tree, including every alias
reject if depth > maxDepth, cost > maxCost, aliases > maxAliases, or operations per request > maxBatch
```

- Weights: scalars ≈ 0, objects ≈ 1, fields backed by a remote call higher.
- Lists without a size argument count with a pessimistic default.
- Return the computed cost in `extensions` so clients can see their budget use; rate-limit by cost per client.
- Example syntax: the GraphQL cost directives specification (`@cost(weight: ...)`, `@listSize(slicingArguments: [...])`) is supported by some servers and routers; others take a weights map in code. Check what the project's server supports.

---

## Trusted Documents

| | Automatic persisted queries (APQ) | Trusted documents (safelist) |
|-|-----------------------------------|------------------------------|
| Purpose | Bandwidth: send a hash instead of query text | Security: execute only known operations |
| Registration | At runtime, by any client (hash + text) | At build time, from client code, by the release pipeline |
| Unknown operation | Client resends with text; server caches it | Rejected |
| Protects against arbitrary queries | No | Yes |

Pattern:
1. Extract operations from client code at build time into a manifest (`id → document`).
2. Publish the manifest to the server or router with the client release.
3. In production, accept only `{ documentId, variables }` (or the hash) for first-party clients; reject raw `query` text and unknown ids.
4. Keep old manifest entries until old client versions are gone (mobile clients live long).

Server-specific configuration is named "trusted documents", "persisted documents", "operation safelisting", or "persisted queries" depending on the product; confirm the mode is an allowlist and not APQ.

---

## Spec and Server Status

Check the project's server and client versions before relying on any of these.

- **Spec editions:** the September 2025 edition is the newest published edition. `@defer`/`@stream` (incremental delivery) are not in it, nor in the working draft.
- **graphql-js v17** (17.0.0, June 2026) ships incremental delivery as experimental: a schema opts in to the directives (`GraphQLDeferDirective`/`GraphQLStreamDirective` are not in `specifiedDirectives`), and execution goes through `experimentalExecuteIncrementally()`; plain `execute()` stays single-result. Other servers implement earlier or different payload formats; client and server must agree.
- **GraphQL-over-HTTP** is a working-draft specification, not a release; the `application/graphql-response+json` media type and its status-code rules come from it. Many servers still default to `application/json` with status 200 for all executed requests.
