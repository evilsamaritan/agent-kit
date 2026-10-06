# Federation Patterns

Subgraph design, entity resolution, migration patterns, and production architecture. Examples use Apollo Federation v2 directives as the worked example; several other routers implement the same directive syntax. Check the project's router and subgraph library versions before copying configuration.

---

## Federation Architecture

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Router    │  ← Supergraph schema
                    └──────┬──────┘
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐  ┌─▼────┐  ┌───▼─────┐
       │ Users Subgraph│ │Orders│  │Products │
       └──────────────┘  └──────┘  └─────────┘
```

Router composes subgraph schemas into a supergraph. Each subgraph owns its domain and can be deployed independently.

---

## Subgraph Design

### Users Subgraph

```graphql
# schema.graphql (users subgraph)
extend schema @link(url: "https://specs.apollo.dev/federation/v2.5",
  import: ["@key", "@shareable", "@external", "@provides"])

type Query {
  me: User
  user(id: ID!): User
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}

# Entity — resolvable by other subgraphs via @key
type User @key(fields: "id") {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  createdAt: DateTime!
}

enum UserRole {
  USER
  ADMIN
}

input CreateUserInput {
  email: String!
  name: String!
}

type CreateUserPayload {
  user: User
  errors: [UserError!]!
}
```

### Orders Subgraph (Extends User)

```graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.5",
  import: ["@key", "@external", "@requires"])

# Money, DateTime, OrderItem, and OrderConnection are defined in this subgraph (omitted here)

type Query {
  order(id: ID!): Order
  orders(userId: ID!, first: Int, after: String): OrderConnection!
}

type Order @key(fields: "id") {
  id: ID!
  user: User!
  items: [OrderItem!]!
  total: Money!
  status: OrderStatus!
  createdAt: DateTime!
}

# Stub type — resolved by Users subgraph
type User @key(fields: "id") {
  id: ID!
  # Extend User with orders (owned by this subgraph)
  orders(first: Int, after: String): OrderConnection!
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}
```

---

## Key Concepts

### @key — Entity Definition

```graphql
# Single key
type User @key(fields: "id") {
  id: ID!
}

# Multiple keys (resolve by either)
type Product @key(fields: "id") @key(fields: "sku") {
  id: ID!
  sku: String!
}

# Compound key
type OrderItem @key(fields: "orderId itemId") {
  orderId: ID!
  itemId: ID!
}
```

### @shareable — Shared Fields

```graphql
# Both subgraphs can resolve this field
type Product @key(fields: "id") {
  id: ID!
  name: String! @shareable    # Multiple subgraphs can return this
  price: Money!               # Only this subgraph resolves price
}
```

### @external + @requires — Computed Fields

```graphql
# Shipping subgraph needs product weight from Products subgraph
type Product @key(fields: "id") {
  id: ID!
  weight: Float @external           # Defined in Products subgraph
  shippingCost: Money @requires(fields: "weight")  # Computed here
}
```

The router fetches `weight` from Products subgraph, then passes it to Shipping subgraph to compute `shippingCost`.

### @provides — Field Hints

```graphql
# Reviews subgraph can provide User.name when returning reviews
type Review @key(fields: "id") {
  id: ID!
  author: User @provides(fields: "name")
  body: String!
}

type User @key(fields: "id") {
  id: ID!
  name: String! @external
}
```

Tells the router: "When you fetch this Review, I can also give you the author's name — no need to call Users subgraph."

---

## Entity Resolution

### Reference Resolver Pattern

```typescript
// Users subgraph — resolve a User entity from its key fields
const resolvers = {
  User: {
    __resolveReference(ref: { id: string }, ctx) {
      // ref contains only the @key fields; called once per representation
      return ctx.loaders.user.load(ref.id)   // batched by the per-request loader below
    },
  },
}
```

The portable way to batch entity resolution is a per-request loader behind the per-entity resolver. Some subgraph libraries also accept a list-based reference resolver; use it only if the project's library documents it.

### Per-Request Loader for Entities

```typescript
function createContext({ req }) {
  return {
    viewer: authenticate(req),
    loaders: {
      user: new DataLoader(async (ids: readonly string[]) => {
        const users = await db.users.findMany({ where: { id: { in: [...ids] } } })
        const byId = new Map(users.map(u => [u.id, u]))
        return ids.map(id => byId.get(id) ?? null)
      }),
    },
  }
}
```

Entity resolution is an access path: apply the same authorization as the subgraph's own root fields.

---

## Subgraph Design Principles

### Domain Ownership Rules

| Principle | Example |
|-----------|---------|
| Each entity has one owning subgraph | User is owned by Users subgraph |
| Fields belong to the subgraph that has the data | `User.orders` belongs to Orders subgraph |
| Shared fields use `@shareable` | `Product.name` can be in multiple subgraphs |
| Cross-subgraph data uses `@external` + `@requires` | Computed fields needing foreign data |

### When to Split Subgraphs

| Signal | Action |
|--------|--------|
| Different team owns the domain | Separate subgraph |
| Different deployment cadence | Separate subgraph |
| Independent scaling needs | Separate subgraph |
| Tightly coupled data | Keep in same subgraph |
| Shared database | Consider keeping together |

---

## Router Configuration

### Apollo Router Configuration

```yaml
# router.yaml
supergraph:
  listen: 0.0.0.0:4000

headers:
  all:
    request:
      - propagate:
          matching: "x-.*"      # Forward custom headers
      - propagate:
          named: "authorization"

cors:
  policies:
    - origins:
        - https://app.example.com

limits:
  router:
    max_depth: 15
    max_height: 200
    max_aliases: 30
    max_root_fields: 20

traffic_shaping:
  all:
    timeout: 30s
  subgraphs:
    users:
      timeout: 10s
    orders:
      timeout: 20s

telemetry:
  exporters:
    tracing:
      otlp:
        enabled: true
        endpoint: http://otel-collector:4317
```

---

## Migration: Monolith to Federation

### Migration Phases

```
Phase 1: Identify entity boundaries and @key fields
Phase 2: Extract lowest-risk subgraph (e.g., Users — few dependencies)
Phase 3: Extract independent domains (Products)
Phase 4: Extract dependent domains (Orders → depends on Users + Products)
Phase 5: Retire monolith
```

Each phase: add @key directives, implement reference resolvers, compose supergraph (`rover supergraph compose`), deploy router alongside monolith, migrate traffic gradually (canary), monitor query latency and error rates.

---

## Testing Federation

```bash
# Validate subgraph schema
rover subgraph check my-graph@production \
  --schema ./schema.graphql --name users

# Compose supergraph locally
rover supergraph compose --config supergraph.yaml
```

Test reference resolvers via `_entities` query with `__typename` + key fields. Verify entity resolution returns expected data for cross-subgraph references.
