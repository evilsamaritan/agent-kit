---
name: testing
description: "Design or review tests. Use for unit/integration/e2e/contract strategy, fixtures, mocks, flake diagnosis, coverage, property-based and fuzz testing, and regression cases."
user-invocable: true
---

# Testing

Test strategy, patterns, and audit rubric for quality engineering. Applies across languages and frameworks; language skills own each runner's idioms, and `development` owns the code practice that makes code testable (explicit dependencies, one writer per state).

## Scope and boundaries

**This skill covers:**
- Test portfolio shape — unit / integration / contract / e2e — what each earns
- Mock boundaries — where to mock, where to use real components
- Fixtures and test data — golden files, factories, builders
- Flakiness — diagnosis and remediation
- Coverage — what it measures, what it doesn't
- Property-based testing and fuzzing — when they pay off
- Snapshot testing — when it's a crutch
- AI-generated tests — risks and review patterns
- Test architecture — shared helpers, test doubles, naming

**This skill does not cover:**
- CI/CD pipeline structure → `ci-cd`
- Performance profiling → `performance`
- Language-specific test idioms (Go table tests, Rust doctest) → language skills
- Accessibility testing and scanners → `accessibility`
- Static and dynamic security scanning (SAST, DAST, dependency audit) → `security`

## Test layers — what each earns

| layer | cost | catches |
|-------|------|---------|
| unit | cheapest, fastest | logic errors, edge cases |
| integration | moderate | wiring errors, real-dependency behavior |
| contract | moderate, per boundary | upstream/downstream drift |
| e2e | expensive, slow | golden path and critical flows |

**Shape follows where the complexity sits**, decided per module, not per repository:

```
Complexity in domain logic (calculations, rules, state machines)?
  many unit tests, few integration tests (pyramid)
Complexity in interactions between components (UI, request handlers)?
  integration tests dominate, units for pure helpers (trophy)
Complexity at service boundaries (many small services)?
  contract tests replace most cross-service e2e (honeycomb / diamond)
Always: few e2e tests, on journeys whose failure is expensive
```

Shapes and their trade-offs: [Strategy Shapes](references/testing-patterns.md#strategy-shapes).

## Decision tree — what kind of test

```
Pure function, no I/O?
  unit test

Code wires multiple units together via a contract?
  integration test (or contract test if the contract is cross-service)

Code depends on infrastructure you can run locally (database, broker, cache)?
  real instance in a disposable container — not a mock

Code depends on a third-party service you do not control?
  your own adapter, replaced in unit tests; the adapter itself verified
  against a sandbox, a recorded contract, or a local emulator

Testing a user-visible flow end-to-end?
  e2e test — keep few, keep stable, keep non-flaky

Consumer depends on a producer's contract?
  contract test on both sides (Pact-style)
```

## Mock boundaries — rules

- **Do not mock types you do not own.** Wrap a driver, SDK, or HTTP client in your own adapter and replace that adapter in unit tests. A mock of a third-party API encodes your guess about it.
- **Verify the adapter against the real thing** in integration or contract tests: a disposable container for infrastructure you can run (database, broker), a sandbox or recorded contract for services you cannot. Never point automated tests at a production third-party account.
- **Never mock the database in integration tests.** Mocks drift from the real engine's constraints, locking, and query semantics.
- **Never mock the code under test.** Shared mocks that replicate production logic prove nothing.
- **Replace dependencies only at the edge.** A fake inside business logic hides bugs; explicit dependencies (`development`) make the edge easy to reach.

## Fixtures and test data

- **Builders > literals.** `userBuilder().withRole("admin").build()` scales better than 50 inline user objects.
- **Factories produce valid defaults; tests specify only what matters.** Don't restate the whole object in every test.
- **Golden files for serialization tests.** Check the serialized form into the repo; diffing a golden file in review is easier than asserting field-by-field.
- **Test data isolation.** Each test creates its own data; no shared mutable state between tests.

## Flakiness — diagnosis first

Flake symptoms → likely cause:

| symptom | cause |
|---------|-------|
| passes locally, fails in CI | env-dependent: timezone, locale, filesystem order |
| passes when run alone, fails in suite | shared mutable state between tests |
| passes on retry | async race, missing await, timeout too short |
| passes on macOS, fails on Linux | case-sensitivity, line endings, file permissions |
| random failure | unseeded randomness, clock dependency, network call |

**Rule:** never retry a flaky test as a policy. Fix or quarantine. Retries hide information.

## Coverage — what it measures

- **Line coverage** — did this line execute? Doesn't prove it was asserted.
- **Branch coverage** — were both paths taken? Still doesn't prove assertions.
- **Mutation coverage** — does the test fail when the production code is broken? The one that actually measures test quality.

**Rule:** coverage numbers are useful for direction ("we went from 40% → 70%"), not as acceptance gates at arbitrary thresholds (80% is a common religion).

## Property-based testing

Use when:
- The input space is large (numbers, strings, nested structures).
- The invariant is clearer than any specific example.
- You want to find edge cases you wouldn't think of.

Don't use:
- For integration tests with side effects.
- When assertions are effectively random ("the output should be … something").

A failing generated case is shrunk to a minimal input; commit it as an explicit regression example.

## Fuzzing

Coverage-guided fuzzing mutates raw inputs, keeps the ones that reach new code, and runs for minutes to days. It finds crashes, hangs, memory errors, and broken invariants in code that reads untrusted input.

- **Targets:** parsers, decoders, deserializers, protocol and file-format handlers — anything behind a trust boundary.
- **Harness:** one entry point that turns bytes into input, calls the target, and asserts invariants (no crash, round-trip holds, output valid).
- **Corpus:** seed with real valid inputs; commit every crashing input as a regression test.
- **Cadence:** short runs on changed targets in CI, long runs on a schedule. Enable sanitizers where the language has them.

Property tests check stated invariants on structured values inside the normal test run; fuzzing explores the raw input space over long runs. One harness often serves both. Tools per ecosystem: [testing-frameworks.md](references/testing-frameworks.md#fuzzing-property-and-mutation-tools).

## Snapshot testing

Healthy use: regression detection for non-trivial serialized output (rendered HTML, generated code, ADR markdown).

Unhealthy use:
- Any time accepting the new snapshot is how failures are "fixed".
- For UI where the snapshot is a 10KB DOM blob nobody reads.
- As a substitute for explicit assertions.

## AI-generated tests — review rubric

Assume LLM-written tests have:
- **Assertions that mirror the code** (tautological: "function returns 2, so assert 2"). Look for tests that would pass even if the code was wrong.
- **Over-mocking** — mocking the code under test, mocking standard library functions.
- **Missing negative cases** — only the happy path is covered.
- **Stale fixtures** — made-up emails, placeholder dates, unrealistic edge values.

Review checklist:
- Does each test fail if the corresponding production code is broken? (If you can't articulate how, it's not a real test.)
- Is every mock necessary?
- Is there at least one failure-path test per function?

## Test architecture

- **Arrange / Act / Assert** — the default shape. Deviations need a reason.
- **One behavior per test.** Multiple asserts are fine if they all describe the same behavior. Multiple unrelated assertions = multiple tests.
- **Name tests for the behavior, not the function.** `returns_empty_list_when_filter_matches_nothing` beats `test_filter()`.
- **Shared helpers live in a test-support directory or module**, not in production code paths.

## Context adaptation

**As implementer:** write tests alongside the code. Failing test first if you can, otherwise immediately after. Don't let a PR land without them.

**As reviewer:** check that tests would fail if the code were broken. That's the only meaningful test review.

**As auditor (reviewer scoping to whole suite):** look for flake patterns, over-mocking, coverage concentrated in trivial code while critical paths are thin.

**As architect:** test strategy is an architectural decision. Contract test positioning (which side owns which contract) is part of service boundary design.

## Anti-patterns

- **Test coverage religion** — chasing % without asking what the tests actually prove.
- **Mock everything** — a "unit" test that mocks all its dependencies tests nothing but the call graph.
- **Snapshot addiction** — accepting new snapshots as a workflow instead of reading the diff.
- **Parallel-unsafe tests** — shared DB / file / global that forces serial execution.
- **Slow unit tests** — unit tests that take > 100ms aren't unit tests, they're integration tests in disguise.
- **Ignored tests that never get fixed** — a skipped or disabled test with no ticket is permanent dead weight.
- **"Tests pass" = good** — tests that pass on broken code are worse than no tests.

## Related Knowledge

- `development` — code practice this skill tests against: ownership, explicit dependencies, async lifetime, errors
- `architecture` — contract and fitness tests follow the boundaries it sets
- `ci-cd` — where tests run, in what stage, with what parallelism
- `performance` — when tests measure latency / throughput
- `security` — SAST, DAST, and dependency scanning in CI
- `accessibility` — automated scanners and manual assistive-technology checks
- `reliability` — chaos testing, failure injection
- Language skills (`go`, `rust`, `kotlin`, `javascript`, `python`) — idiomatic test patterns

## References

- [testing-patterns.md](references/testing-patterns.md) — strategy shapes, contract, mutation, property, visual, snapshot, flaky, service-level, fixture, and test-data patterns
- [testing-frameworks.md](references/testing-frameworks.md) — runner and tool selection per ecosystem: browser e2e, unit, component, visual, fuzzing, property, mutation
