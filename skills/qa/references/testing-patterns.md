# Advanced Testing Patterns

## Contents

- [Contract Testing](#contract-testing)
- [Mutation Testing](#mutation-testing)
- [Property-Based Testing](#property-based-testing)
- [Visual Regression Testing](#visual-regression-testing)
- [Snapshot Testing Best Practices](#snapshot-testing-best-practices)
- [Test Architecture for Microservices](#test-architecture-for-microservices)
- [Fixture Patterns](#fixture-patterns)
- [Test Data Management](#test-data-management)

---

## Contract Testing

### What it solves

Services evolve independently. Without contract tests, a producer can break consumers silently. E2E tests are too slow and brittle to catch this reliably.

### Consumer-driven contracts

The consumer defines what it needs from the provider. The provider verifies it can satisfy those expectations.

```
Consumer A writes: "I expect GET /users/123 to return { id, name, email }"
Consumer B writes: "I expect GET /users/123 to return { id, name }"
Provider runs both contracts → verifies it satisfies both
```

**Workflow:**
1. Consumer writes a contract (expected request/response pairs)
2. Contract is shared (broker, repository, or artifact)
3. Provider runs contract verification in its CI pipeline
4. Breaking changes detected before deployment

### Schema-based contracts

Use a shared schema definition (OpenAPI, protobuf, Avro, JSON Schema) as the contract.

```
Shared schema defines: UserResponse { id: string, name: string, email: string }
Producer validates: output matches schema
Consumer validates: it handles all fields in schema
Schema change → both sides must update
```

### Tools by ecosystem

| Ecosystem | Tool | Approach |
|-----------|------|----------|
| Any (HTTP) | Pact | Consumer-driven, broker-based |
| Any (OpenAPI) | Schemathesis | Schema-based, auto-generates test cases |
| Any (gRPC) | buf | Schema-based, protobuf breaking change detection |
| Node.js | msw + zod | Mock service worker with schema validation |
| Python | hypothesis + schemathesis | Property-based contract fuzzing |

### What to test in contracts

- Required fields are present
- Field types match (string vs number vs boolean)
- Enum values are within allowed set
- Nullable fields handled correctly
- Array items match expected shape
- HTTP status codes for error cases
- Content-Type headers

### Anti-patterns

- Testing business logic in contract tests (contracts test shape, not behavior)
- Contracts that are too strict (asserting exact values instead of types/shapes)
- Not versioning contracts alongside code
- Running contract tests only in consumer CI (both sides must verify)

---

## Mutation Testing

### What it solves

Code coverage measures which lines execute during tests. Mutation testing measures whether tests actually detect bugs. 100% coverage with no assertions = 0% mutation kill rate.

### How it works

1. Tool creates a "mutant" — a small code change (e.g., `>` becomes `>=`, `true` becomes `false`)
2. Tool runs the test suite against the mutant
3. If a test fails → mutant is "killed" (good — tests caught the bug)
4. If all tests pass → mutant "survived" (bad — tests missed a real bug)
5. Mutation score = killed / total

### Common mutation operators

| Category | Original | Mutant | What it tests |
|----------|----------|--------|---------------|
| Comparison | `a > b` | `a >= b` | Boundary conditions |
| Arithmetic | `a + b` | `a - b` | Mathematical correctness |
| Boolean | `true` | `false` | Condition coverage |
| Return | `return x` | `return null` | Return value assertions |
| Negation | `if (condition)` | `if (!condition)` | Branch coverage |
| Remove | `doSomething()` | (deleted) | Side effect verification |

### Tools by ecosystem

| Language | Tool | Notes |
|----------|------|-------|
| JavaScript/TypeScript | Stryker | Supports Vitest, Jest, Mocha |
| Python | mutmut, cosmic-ray | mutmut is simpler, cosmic-ray more configurable |
| Java/Kotlin | PIT (pitest) | Most mature, well-integrated with Maven/Gradle |
| Rust | cargo-mutants | Built on cargo test |
| C# | Stryker.NET | .NET port of Stryker |
| Go | go-mutesting | Community-maintained |

### When to use

- Critical business logic (financial calculations, auth logic, state machines)
- After reaching high line coverage but suspecting weak assertions
- Code review: verify new tests actually detect the bugs they claim to prevent

### When NOT to use

- Full codebase (too slow) — target critical modules only
- UI code, configuration, boilerplate
- Generated code

### Interpreting results

- **90%+ kill rate** on critical paths = strong test suite
- **Surviving mutants** = test gaps. Each survivor points to a specific weakness.
- **Equivalent mutants** = mutations that don't change behavior (e.g., changing dead code). Ignore these.
- **Timeouts** = mutant caused infinite loop. Usually counts as killed.

---

## Property-Based Testing

### What it solves

Example-based tests verify specific inputs you thought of. Property-based tests verify invariants across thousands of randomly generated inputs — finding edge cases you never imagined.

### Core concepts

**Property**: a statement that must be true for all valid inputs.

```
Property: "For any list, sorting twice gives the same result as sorting once"
Property: "For any string, encoding then decoding returns the original"
Property: "For any valid user input, the function does not throw"
```

**Generator**: produces random inputs matching constraints (positive integers, valid emails, nested objects).

**Shrinking**: when a failing input is found, the framework reduces it to the minimal failing case.

### Tools by ecosystem

| Language | Library | Notes |
|----------|---------|-------|
| JavaScript/TypeScript | fast-check | Most popular, excellent shrinking |
| Python | Hypothesis | Gold standard, stateful testing support |
| Rust | proptest | Inspired by Hypothesis |
| Java | jqwik | JUnit 5 integration |
| Haskell | QuickCheck | The original |
| Go | gopter, rapid | Community libraries |
| Scala | ScalaCheck | Functional approach |

### Common property patterns

| Pattern | Example |
|---------|---------|
| **Round-trip** | encode(decode(x)) == x |
| **Idempotent** | f(f(x)) == f(x) |
| **Invariant** | sort(xs).length == xs.length |
| **Commutative** | f(a, b) == f(b, a) |
| **Oracle** | simple_impl(x) == optimized_impl(x) |
| **No crash** | for_any(x, () => f(x)) // just doesn't throw |

### When to use

- Serialization/deserialization (round-trip property)
- Parsers (valid input accepted, invalid input rejected cleanly)
- Mathematical operations (commutativity, associativity)
- Data structures (invariants hold after any sequence of operations)
- Sorting/filtering (output properties: length preserved, order correct)
- State machines (valid transitions never reach invalid state)

### Anti-patterns

- Testing trivial properties that don't catch real bugs
- Not constraining generators enough (generating truly random data for domain-specific logic)
- Ignoring shrunk failure output (the minimal case IS the bug report)
- Using property-based tests where a clear example test is sufficient

---

## Visual Regression Testing

### What it solves

CSS changes, dependency updates, and refactors can break UI appearance without breaking functionality. Visual regression tests catch pixel-level changes automatically.

### How it works

1. Capture baseline screenshots of UI components/pages
2. After code changes, capture new screenshots
3. Compare new against baseline using diff algorithm
4. Flag differences above threshold for human review
5. Accept or reject changes, update baselines

### Tools

| Tool | Type | Integration |
|------|------|-------------|
| Percy (BrowserStack) | Cloud service | CI, Storybook, Playwright |
| Chromatic | Cloud service | Storybook-native |
| BackstopJS | Self-hosted | Docker, CI |
| Playwright | Built-in | `toHaveScreenshot()` assertion |
| Cypress | Plugin | `cypress-image-snapshot` |
| reg-suit | Self-hosted | S3/GCS storage |

### Best practices

- Test components in isolation (Storybook) AND full pages
- Use consistent viewport sizes (define standard breakpoints)
- Disable animations and transitions during capture
- Use a consistent font rendering environment (Docker or CI)
- Set a sensible diff threshold (0.1% — too strict causes false positives)
- Review visual diffs in PR — never auto-approve
- Store baselines in version control or a dedicated storage service

### What to capture

- All component variants (sizes, states, themes)
- Responsive breakpoints (mobile, tablet, desktop)
- Dark/light mode
- Loading states, error states, empty states
- Focus and hover states (where feasible)

---

## Snapshot Testing Best Practices

### When snapshots help

- API response shape verification
- Rendered component output (HTML/DOM structure)
- Error message formatting
- Configuration serialization
- CLI output

### Rules

1. Keep snapshots small and focused — snapshot a specific field or subtree, not the entire object
2. Review every snapshot update — never run "update all" blindly
3. Name snapshot files clearly — reader should understand what it captures
4. Delete snapshots when the underlying code is removed
5. Prefer inline snapshots for small values (< 10 lines)
6. Use targeted assertions when you know the exact expected structure

### Anti-pattern: snapshot as a crutch

```
// Bad — snapshot entire API response (brittle, unreadable diffs)
expect(response).toMatchSnapshot()

// Good — assert specific fields that matter
expect(response.status).toBe(200)
expect(response.data.items).toHaveLength(3)
expect(response.data.items[0]).toHaveProperty("id")
```

---

## Test Architecture for Microservices

### Testing diamond (not pyramid)

In microservices, the test pyramid inverts at the service level:

```
        /  E2E  \          Minimal — only critical user journeys
       /----------\
      /  Contract   \      Many — verify all service boundaries
     /----------------\
    /   Integration     \   Moderate — real deps, containerized
   /----------------------\
  /        Unit            \  Foundation — business logic
 /--------------------------\
```

Contract tests replace the large integration test layer from monoliths.

### Service-level test strategy

| What to test | How | Layer |
|-------------|-----|-------|
| Business logic | Unit tests with mocks | Unit |
| Database operations | Testcontainers, migrations | Integration |
| Message handling | Test producer/consumer independently | Contract |
| API endpoints | Request/response shape | Contract |
| Cross-service flows | Narrow E2E on critical path | E2E |
| Configuration | Unit test config parsing | Unit |

### Testcontainers

Spin up real databases, message brokers, and caches in containers for integration tests:

- Deterministic — same container image, same behavior
- Isolated — each test run gets fresh containers
- Available for: PostgreSQL, MySQL, Redis, Kafka, RabbitMQ, MongoDB, Elasticsearch
- Libraries: Testcontainers (Java, Node.js, Go, Python, Rust, .NET)

### Event-driven testing

| Pattern | Test approach |
|---------|--------------|
| Producer publishes event | Unit test: verify event shape and content |
| Consumer handles event | Unit test: mock event, verify processing logic |
| Producer-consumer agreement | Contract test: shared event schema |
| Event ordering | Integration test: publish sequence, verify handling |
| Dead letter / retry | Unit test: verify retry classification logic |

---

## Fixture Patterns

### Factory functions

Create test data with sensible defaults that can be overridden:

```
// Concept (language-agnostic)
function createUser(overrides) {
  return merge({
    id: generateId(),
    name: "Test User",
    email: "test@example.com",
    role: "member",
    createdAt: fixedDate
  }, overrides)
}

// Usage
createUser()                          // valid default user
createUser({ role: "admin" })         // admin user
createUser({ email: null })           // edge case: missing email
```

### Builder pattern

For complex objects with many optional fields:

```
UserBuilder.new()
  .withName("Alice")
  .withRole("admin")
  .withPermissions(["read", "write"])
  .build()
```

### Rules

- Factories produce valid objects by default — override specific fields for edge cases
- Keep factories close to test files or in a shared `test-utils` / `fixtures` module
- Never use production data in fixtures — generate synthetic data
- Use deterministic IDs and timestamps in fixtures for reproducibility

---

## Test Data Management

### Strategies

| Strategy | When to use | Trade-offs |
|----------|------------|------------|
| In-memory factories | Unit tests | Fast, no cleanup needed |
| Database seeding | Integration tests | Realistic, requires cleanup |
| Docker volumes | Shared test state | Consistent, slower startup |
| Snapshot restore | Large datasets | Fast reset, storage cost |

### Cleanup patterns

- **Transaction rollback**: wrap each test in a transaction, rollback after
- **Truncate tables**: clear all tables between tests (fast for small datasets)
- **Drop and recreate**: fresh schema per test run (slow but thorough)
- **Container lifecycle**: new container per test suite

### Rules

- Each test must work in isolation — never depend on data from another test
- Use deterministic data (fixed IDs, timestamps) to make failures reproducible
- Clean up after integration tests — leaked data causes flaky subsequent runs
