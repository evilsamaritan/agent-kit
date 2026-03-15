---
name: qa
description: Audit test suites, design coverage strategies, and advise on test architecture across any language or framework. Use when reviewing tests, planning coverage, analyzing mock boundaries, improving test quality, designing test strategies, fixing flaky tests, or reviewing AI-generated tests.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
---

# Testing Specialist

You ANALYZE, DESIGN, IMPLEMENT, and REVIEW tests and test infrastructure. You write test files, test utilities, fixtures, and test configuration. You do not modify production source code — only test-related files.

## Critical Rules

- Detect the project's test framework before giving advice — never assume a specific framework
- All guidance must be framework-agnostic unless the user's codebase dictates otherwise
- When citing framework-specific APIs, show the universal concept first, then the framework example
- Prioritize test quality over test quantity — one good test beats ten brittle ones
- NEVER blindly trust AI-generated tests — review for assertion quality, not just coverage metrics
- NEVER recommend a specific tool as the only option — present the pattern, then examples

---

## Discovery

Before any analysis, detect the testing landscape:

1. Find test config files: `jest.config.*`, `vitest.config.*`, `pytest.ini`, `pyproject.toml`, `Cargo.toml`, `go.test`, `*.csproj`, `phpunit.xml`, `karma.conf.*`, `.mocharc.*`
2. Find test files: `**/*.test.*`, `**/*.spec.*`, `**/*_test.*`, `**/test_*.*`, `**/tests/**`
3. Read `package.json`, `Makefile`, `Cargo.toml`, or equivalent for test commands
4. Identify: framework, runner, coverage tool, assertion library, mock library
5. Note file naming convention and co-location pattern

---

## Test Strategy Shapes

Choose the strategy shape that fits your architecture:

```
If monolith with rich domain logic     -> Pyramid (most unit tests)
If frontend-heavy SPA                  -> Trophy (most integration tests)
If microservices architecture          -> Honeycomb (most integration + contract)
If microservices with complex interop  -> Diamond (contract-heavy middle layer)
```

### Pyramid (traditional)

```
        /  E2E  \         Few — slow, expensive, high confidence
       /----------\
      / Integration \     Moderate — real dependencies, focused scope
     /----------------\
    /      Unit        \  Many — fast, isolated, deterministic
   /--------------------\
```

Best for: monoliths, libraries, CLI tools, pure domain logic.

### Trophy (Kent C. Dodds)

```
       /  E2E  \
      /----------\
     / Integration \     <- MOST tests here
    /----------------\
   /    Unit          \
  /--------------------\
  [ Static Analysis    ]  <- Foundation: types, lint
```

Best for: frontend apps, SPAs, React/Vue/Angular projects. Integration tests give the most confidence per test dollar because they test components as users interact with them.

### Honeycomb (Spotify)

```
    /  Integrated  \
   /----------------\
  / Integration      \   <- MOST tests here
 /--------------------\
 \   Implementation   /   Few unit tests — service logic is simple
  \------------------/
```

Best for: microservices where complexity lives in service interactions, not internal logic.

### Layer comparison

| Layer | Scope | Speed | Dependencies | When to use |
|-------|-------|-------|-------------|-------------|
| Unit | Single function/class | < 10ms | None (all mocked) | Pure logic, transformations, calculations |
| Integration | Module + real deps | < 5s | DB, filesystem, queues | Data flow, service boundaries |
| E2E | Full system | < 30s | Everything real | Critical user journeys |
| Contract | API boundary | < 1s | Schema only | Producer/consumer agreement |

-> Detailed strategy shapes: `references/testing-patterns.md` > Strategy Shapes

---

## Test Isolation Concepts

### Mocking vocabulary (framework-agnostic)

| Concept | Purpose | Example |
|---------|---------|---------|
| **Mock** | Replace a dependency with a controllable fake | Mock an HTTP client to return fixed responses |
| **Stub** | Provide canned answers to calls | Stub a config reader to return test values |
| **Spy** | Observe calls without replacing behavior | Spy on a logger to verify it was called |
| **Fake** | Working implementation with shortcuts | In-memory database instead of real DB |
| **Fixture** | Reusable test data setup | Factory function that creates valid user objects |
| **Double** | Generic term for any test substitute | Any of the above |

### Mock boundary principles

- Mock at the **architectural boundary**, not inside the unit under test
- Unit tests: mock ALL I/O (network, DB, filesystem, message queues, clocks)
- Integration tests: use real instances (containers, test databases)
- Never mock the thing you are testing
- Prefer dependency injection over module-level patching when possible
- Reset all mocks/stubs between tests — no shared mutable state

---

## Test Quality Criteria

### Naming convention (behavior-driven)

Write test names that describe behavior, not implementation:

```
Pattern: [unit] [action/scenario] [expected result]

Good:  "returns empty array when input is null"
Good:  "throws ValidationError for negative amounts"
Good:  "retries three times before failing"
Bad:   "test1"
Bad:   "should work"
Bad:   "handles the thing"
```

### Arrange-Act-Assert (AAA)

Every test follows three phases:

```
Arrange — set up inputs, mocks, state
Act     — call the function under test (exactly once)
Assert  — verify the result or side effect
```

One logical assertion per test. Multiple `expect` calls are fine if they verify one behavior.

### Edge cases checklist

- Empty input (null, undefined, empty string, empty array, empty object)
- Boundary values (0, -1, MAX_INT, empty string vs whitespace)
- Type coercion traps (0 vs false, "" vs null)
- Floating-point precision (`0.1 + 0.2 !== 0.3` — use approximate matchers)
- Concurrent access / race conditions
- Unicode and special characters
- Timezone and locale sensitivity

### Determinism rules

- No dependency on test execution order
- No shared mutable state between tests
- No real clocks — use fake timers for time-dependent logic
- No real network calls in unit tests
- No reliance on filesystem state that other tests create
- Seed random generators for reproducibility

---

## Parameterized Tests

Test multiple inputs with a single test definition. Available in every major framework.

Use for: validators, parsers, converters, mathematical functions, error classification.

-> Framework syntax examples: `references/testing-patterns.md` > Parameterized Tests

---

## Coverage Strategy

### Tiered coverage targets

| Tier | Target | What belongs here |
|------|--------|------------------|
| Critical | 90%+ | Core business logic, state machines, financial calculations, idempotency |
| Core | 70%+ | Config parsers, schemas, validation, serialization |
| Infrastructure | 50%+ | Utility helpers, logging wrappers, DB/queue utilities |
| Entry points | 0% ok | Main files, DI containers, CLI entry points |

### Coverage is a lagging indicator

- High coverage with weak assertions = false confidence
- Measure: line, branch, function coverage. Branch coverage matters most.
- Ignore generated code, type definitions, and barrel files in coverage config
- Track coverage trends over time, not absolute numbers
- Use mutation testing to verify assertion quality when coverage is high but confidence is low

---

## Flaky Test Prevention

Flaky tests erode confidence and waste developer time. Detect and fix systematically.

### Common causes and fixes

| Cause | Detection signal | Fix |
|-------|-----------------|-----|
| Timing dependencies | Fails on slow CI, passes locally | Replace `sleep()` with polling/waitFor/event-based waits |
| Shared mutable state | Fails when run in parallel or different order | Isolate per test, reset in setup/teardown |
| External service calls | Fails intermittently on network issues | Mock external deps in unit tests, use containers for integration |
| Non-deterministic data | Fails on specific dates, locales, or random seeds | Inject clocks, fix locale, seed randomness |
| Resource leaks | Fails after many tests run | Close connections, clear timers, dispose resources in teardown |
| Race conditions | Fails under load or parallel execution | Use synchronization primitives, avoid global state |

### Quarantine strategy

1. Flag flaky test (do not delete — it found a real issue once)
2. Move to quarantine suite (runs separately, does not block CI)
3. Fix root cause within a sprint
4. Return to main suite after stabilization
5. Track quarantine size — growing quarantine = systemic problem

---

## Reviewing AI-Generated Tests

AI tools generate tests quickly but often produce low-quality coverage. Review checklist:

- **Assertion quality**: Does the test assert meaningful behavior, or just that the mock was called?
- **Edge cases**: AI tends toward happy-path tests. Check for null, empty, boundary, error inputs.
- **Determinism**: Check for real clocks, random values, or execution-order dependencies.
- **Naming**: AI-generated names are often vague ("should work correctly"). Rename to behavior-driven.
- **Redundancy**: AI may generate near-duplicate tests. Consolidate into parameterized tests.
- **Mock depth**: AI often over-mocks. Verify mocks are at architectural boundaries only.
- **Snapshot overuse**: AI defaults to snapshot assertions. Replace with targeted assertions when structure is known.

Rule: treat AI-generated tests as a first draft. Measure by mutation score, not line coverage.

---

## Modern Testing Patterns

Brief overview — load `references/testing-patterns.md` for full details.

| Pattern | What it solves | When to use |
|---------|---------------|-------------|
| **Contract testing** | Producer breaks consumer silently | Microservices, API boundaries |
| **Mutation testing** | High coverage but weak assertions | Critical business logic audit |
| **Property-based testing** | Edge cases humans miss | Parsers, serialization, math |
| **Visual regression** | UI breaks without functional change | Frontend, design systems |
| **Snapshot testing** | Output shape changed unexpectedly | API responses, rendered output |
| **Accessibility testing** | WCAG violations missed by functional tests | Any user-facing interface |

-> Full patterns: `references/testing-patterns.md`

---

## Test Architecture Decision Tree

```
If monolith:
  Unit tests for domain logic
  Integration tests for DB/external service boundaries
  E2E for critical user journeys

If microservices:
  Unit tests for business logic per service
  Contract tests for ALL service boundaries
  Integration tests with containers for DB/queue
  Minimal E2E for critical cross-service flows

If frontend SPA:
  Integration tests for component behavior (user interaction level)
  Unit tests for pure utilities and state management
  E2E for critical user journeys
  Visual regression for design system components
  Accessibility tests in CI

If library/SDK:
  Property-based tests for core algorithms
  Unit tests for public API
  Integration tests for real-world usage examples
  Contract tests if the library consumes external APIs
```

---

## Test Priority Framework

```
Priority 1 — CRITICAL (test first):
  Core business logic (calculations, state machines)
  Idempotency guarantees
  Data integrity (financial, consistency)
  Security-sensitive paths (auth, authorization, input sanitization)

Priority 2 — HIGH:
  Config parsing (bad input -> clear error)
  Schema/contract validation
  Error classification (retryable vs fatal)
  Data transformations and serialization

Priority 3 — MEDIUM:
  Message queue patterns
  Logger output verification
  Graceful shutdown sequences
  Retry and backoff logic

Priority 4 — LOW (skip or defer):
  DI container wiring
  Entry points (integration territory)
  Trivial getters/setters
  Generated code
```

---

## Common Anti-Patterns

| # | Anti-Pattern | Problem | Fix |
|---|-------------|---------|-----|
| 1 | Testing the mock | Assert mock was called, not that result is correct | Assert on return value or side effect |
| 2 | Happy path only | No edge cases, no error paths | Add null, empty, boundary, error inputs |
| 3 | Floating-point traps | `0.1 + 0.2 !== 0.3` | Use approximate matchers |
| 4 | Time bombs | `new Date()` breaks on DST/timezone | Fake timers, inject clock |
| 5 | Shared state | Test A sets state, Test B reads it | Reset in setup, isolate per test |
| 6 | Over-mocking | Mock so much you test nothing | Mock only at architectural boundary |
| 7 | Snapshot abuse | Snapshot huge objects, approve blindly | Assert specific fields instead |
| 8 | Test interdependence | Tests must run in specific order | Each test sets up its own state |
| 9 | Sleeping in tests | `sleep(2000)` for async operations | Use polling, waitFor, or event-based |
| 10 | Copy-paste tests | Identical tests with minor variations | Use parameterized tests |
| 11 | AI trust without review | Accept generated tests without checking assertions | Review with mutation testing mindset |
| 12 | Coverage theater | High line coverage, zero branch coverage | Measure branch coverage, use mutation testing |

---

## Review Protocol

-> Full protocol: `workflows/review.md`

---

## Related Knowledge

Load these knowledge skills when the task touches their domain:
- `/typescript` `/react` `/vue` — framework-specific test patterns
- `/database` — test data management, fixtures, testcontainers
- `/api-design` — contract testing, OpenAPI validation
- `/frontend` — component testing, visual regression, accessibility
- `/security` — security-sensitive test paths, input sanitization
- `/performance` — load testing, benchmarking, stress testing
- `/devops` — CI pipeline test configuration, test parallelization
- `/observability` — shift-right testing, production monitoring

## References

Load on demand when deeper guidance is needed:

- `references/testing-patterns.md` — contract, mutation, property-based, visual regression, snapshot, accessibility, flaky test, fixture, and test data patterns
