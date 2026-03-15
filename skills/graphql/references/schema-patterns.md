# GraphQL Schema Patterns

Advanced schema design, custom scalars, directives, error handling, and schema evolution.

---

## Schema Design Patterns

### Mutation Response Pattern

Always return a payload type from mutations — never return the entity directly.

```graphql
# Pattern: Mutation → Payload { entity + errors }
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

type CreateUserPayload {
  user: User               # null if errors
  errors: [UserError!]!    # empty if success
}

type DeleteUserPayload {
  deletedId: ID            # ID of deleted resource
  errors: [UserError!]!
}

# Typed business errors (not GraphQL errors)
type UserError {
  field: String             # Which input field caused the error
  code: UserErrorCode!      # Machine-readable code
  message: String!          # Human-readable message
}

enum UserErrorCode {
  EMAIL_TAKEN
  INVALID_EMAIL
  NAME_TOO_SHORT
  NOT_FOUND
  UNAUTHORIZED
}
```

**Why not throw GraphQL errors?**
- GraphQL errors are for system/transport failures
- Business errors belong in the response (predictable, typed, queryable)
- Clients can handle errors without try/catch

### Input Coercion Pattern

```graphql
# Separate create vs update inputs
input CreateUserInput {
  email: String!      # Required on create
  name: String!       # Required on create
  role: UserRole      # Optional, defaults server-side
}

input UpdateUserInput {
  email: String       # Optional on update
  name: String        # Optional on update
  role: UserRole      # Optional on update
}

# Never reuse output types as inputs
# Never make all fields optional on create input
```

### Nullable vs Non-Nullable

```graphql
type User {
  id: ID!              # Always present
  email: String!       # Always present
  name: String!        # Always present
  bio: String          # Nullable — user may not have set it
  avatar: URL          # Nullable — may not exist
  orders: [Order!]!    # Non-null list of non-null items (may be empty [])
  latestOrder: Order   # Nullable — user may have no orders
}
```

**Rules:**
- `[Item!]!` — list is never null, items are never null (can be empty `[]`)
- `[Item!]` — list can be null (prefer `[Item!]!` instead)
- `String!` — field is always present
- `String` — field may be null (legitimate absence)

---

## Custom Scalars

```graphql
scalar DateTime    # ISO 8601: "2024-01-15T12:00:00Z"
scalar Date        # ISO 8601: "2024-01-15"
scalar URL         # Valid URL string
scalar EmailAddress # Valid email format
scalar JSON        # Arbitrary JSON (use sparingly)
scalar BigInt      # Numbers > 2^53
scalar UUID        # UUID v4 format
scalar Money       # Decimal monetary value
```

**Implementation (graphql-scalars library):**
```typescript
import { DateTimeResolver, URLResolver, EmailAddressResolver } from 'graphql-scalars'

const resolvers = {
  DateTime: DateTimeResolver,
  URL: URLResolver,
  EmailAddress: EmailAddressResolver,
}
```

Use custom scalars instead of `String` for: dates, URLs, emails, money. Provides validation at the schema level.

---

## Directives

### Schema Directives

```graphql
# Auth directive
directive @auth(requires: Role!) on FIELD_DEFINITION
directive @deprecated(reason: String) on FIELD_DEFINITION

type Query {
  me: User @auth(requires: USER)
  adminDashboard: Dashboard @auth(requires: ADMIN)
  oldEndpoint: String @deprecated(reason: "Use newEndpoint instead")
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

### Directive Implementation

```typescript
function authDirective(directiveName: string) {
  return {
    authDirectiveTypeDefs: `directive @${directiveName}(requires: Role!) on FIELD_DEFINITION`,
    authDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directive = getDirective(schema, fieldConfig, directiveName)?.[0]
          if (directive) {
            const { requires } = directive
            const { resolve } = fieldConfig
            fieldConfig.resolve = async (source, args, context, info) => {
              if (!context.user) throw new AuthenticationError('Not authenticated')
              if (context.user.role !== requires) throw new ForbiddenError('Insufficient permissions')
              return resolve(source, args, context, info)
            }
          }
          return fieldConfig
        },
      }),
  }
}
```

---

## Pagination — Full Relay Implementation

```graphql
# Generic connection types
interface Connection {
  pageInfo: PageInfo!
  totalCount: Int
}

interface Edge {
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Concrete implementation
type UserConnection implements Connection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}

type UserEdge implements Edge {
  node: User!
  cursor: String!
}

type Query {
  users(
    first: Int
    after: String
    last: Int
    before: String
    filter: UserFilter
  ): UserConnection!
}

input UserFilter {
  role: UserRole
  search: String
  createdAfter: DateTime
}
```

### Resolver Implementation

```typescript
async function resolveConnection(args, queryFn) {
  const { first, after, last, before } = args
  const limit = first || last || 20
  const cursor = after || before

  // Decode cursor
  const decodedCursor = cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : null

  // Query with limit + 1 to detect hasMore
  const items = await queryFn({ cursor: decodedCursor, limit: limit + 1 })
  const hasMore = items.length > limit
  const sliced = items.slice(0, limit)

  return {
    edges: sliced.map(item => ({
      node: item,
      cursor: Buffer.from(JSON.stringify({ id: item.id })).toString('base64'),
    })),
    pageInfo: {
      hasNextPage: first ? hasMore : false,
      hasPreviousPage: last ? hasMore : false,
      startCursor: sliced[0] ? encodeCursor(sliced[0]) : null,
      endCursor: sliced.at(-1) ? encodeCursor(sliced.at(-1)) : null,
    },
  }
}
```

---

## Schema Evolution

### Non-Breaking Changes (Safe)

| Change | Safe? | Notes |
|--------|-------|-------|
| Add field | Yes | Existing queries ignore new fields |
| Add optional argument | Yes | Existing queries don't send it |
| Add enum value | Careful | Clients with exhaustive switches break |
| Add type to union | Careful | Clients with `__typename` switches may break |
| Deprecate field | Yes | Add `@deprecated`, remove later |

### Breaking Changes (Avoid)

| Change | Breaking? | Migration |
|--------|-----------|-----------|
| Remove field | Yes | Deprecate first, monitor usage, remove after N months |
| Rename field | Yes | Add new field, deprecate old, migrate clients |
| Change field type | Yes | Add new field with new type |
| Make nullable → non-null | Yes | May break clients expecting null |
| Make non-null → nullable | Usually safe | Clients already handle the value |
| Remove enum value | Yes | Deprecate, stop returning it, then remove |

### Deprecation Workflow

```graphql
type User {
  fullName: String! @deprecated(reason: "Use `name` instead. Will be removed 2026-07-01.")
  name: String!
}
```

1. Add new field alongside old
2. Deprecate old field with reason + removal date
3. Monitor usage of deprecated field (introspection query logging)
4. Remove after all clients migrate

---

## Security Patterns

### Query Complexity Analysis

```typescript
import { createComplexityLimitRule } from 'graphql-validation-complexity'

const complexityRule = createComplexityLimitRule(1000, {
  scalarCost: 1,
  objectCost: 10,
  listFactor: 20,
  introspectionListFactor: 2,
})

// Or field-level cost annotation
const typeDefs = `
  type Query {
    users(first: Int): [User!]! @cost(complexity: 10, multipliers: ["first"])
    user(id: ID!): User @cost(complexity: 1)
  }
`
```

### Depth Limiting

```typescript
import depthLimit from 'graphql-depth-limit'

const server = new ApolloServer({
  validationRules: [depthLimit(10)],
})
```

### Persisted Queries Implementation

```typescript
// Build-time: extract queries from client code
// queries.json
{
  "abc123": "query GetUser($id: ID!) { user(id: $id) { id name email } }",
  "def456": "mutation CreateOrder($input: CreateOrderInput!) { ... }"
}

// Runtime: only execute registered queries
const server = new ApolloServer({
  persistedQueries: {
    cache: new InMemoryLRUCache(),
  },
  // In production: reject non-persisted queries
  allowBatchedHttpRequests: false,
})
```
