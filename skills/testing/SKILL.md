---
name: testing
description: Testing strategy and patterns — test pyramid, unit/integration/e2e/contract tests, mock boundaries, fixtures, flaky test diagnosis, coverage strategy, test data management, property-based and snapshot testing. Use when writing tests, auditing test suites, planning coverage, diagnosing flakiness, reviewing mock usage, or designing a test strategy. Do NOT use for CI/CD pipelines (use ci-cd), performance profiling (use performance), or production code review (use security or language skills).
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
---

# Testing

Test strategy, patterns, and audit rubric for quality engineering. Vendor-neutral — applies across languages and frameworks.

## Scope and boundaries

**This skill covers:**
- Test pyramid — unit / integration / e2e / contract — what each earns
- Mock boundaries — where to mock, where to use real components
- Fixtures and test data — golden files, factories, builders
- Flakiness — diagnosis and remediation
- Coverage — what it measures, what it doesn't
- Property-based testing — when it pays off
- Snapshot testing — when it's a crutch
- AI-generated tests — risks and review patterns
- Test architecture — shared helpers, test doubles, naming

**This skill does not cover:**
- CI/CD pipeline structure → `ci-cd`
- Performance profiling → `performance`
- Language-specific test idioms (Go table tests, Rust doctest) → language skills
- Accessibility testing → `accessibility`
- Security testing (fuzzing, SAST) → `security`

## Test pyramid — budget per layer

| layer | cost | volume | catches |
|-------|------|--------|---------|
| unit | cheapest, fastest | many | logic errors, edge cases |
| integration | moderate | fewer | wiring errors, contract mismatches |
| contract | moderate | per boundary | upstream/downstream drift |
| e2e | expensive, slow | few | golden path + critical flows |

**Rule:** cost per test grows 10× per layer up. Volume should shrink accordingly.

## Decision tree — what kind of test

```
Pure function, no I/O?
  unit test

Code wires multiple units together via a contract?
  integration test (or contract test if the contract is cross-service)

Code depends on a real external system whose behavior matters?
  use a real instance in a container (testcontainers) — not a mock

Testing a user-visible flow end-to-end?
  e2e test — keep few, keep stable, keep non-flaky

Consumer depends on a producer's contract?
  contract test on both sides (Pact-style)
```

## Mock boundaries — rules

- **Mock what you control; use real for what you don't.** Mock your *own* interfaces, not database drivers or HTTP clients of external services.
- **Never mock the database for integration tests.** Use a real DB in a container — mocks drift from reality.
- **Never mock the code under test.** Shared mocks that replicate production logic prove nothing.
- **Mock at the highest boundary that gives determinism.** A mock at the HTTP edge is fine; a mock inside the business logic often hides bugs.

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

## Snapshot testing

Healthy use: regression detection for non-trivial serialized output (rendered HTML, generated code, ADR markdown).

Unhealthy use:
- Any time `updateSnapshot()` is how failures are "fixed".
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
- **Shared helpers live in `testing/` or `__tests__/helpers/`**, not in production code paths.

## Context adaptation

**As implementer:** write tests alongside the code. Failing test first if you can, otherwise immediately after. Don't let a PR land without them.

**As reviewer:** check that tests would fail if the code were broken. That's the only meaningful test review.

**As auditor (reviewer scoping to whole suite):** look for flake patterns, over-mocking, coverage concentrated in trivial code while critical paths are thin.

**As architect:** test strategy is an architectural decision. Contract test positioning (which side owns which contract) is part of service boundary design.

## Anti-patterns

- **Test coverage religion** — chasing % without asking what the tests actually prove.
- **Mock everything** — a "unit" test that mocks all its dependencies tests nothing but the call graph.
- **Snapshot addiction** — using `updateSnapshot()` as a workflow instead of reading the diff.
- **Parallel-unsafe tests** — shared DB / file / global that forces serial execution.
- **Slow unit tests** — unit tests that take > 100ms aren't unit tests, they're integration tests in disguise.
- **Ignored tests that never get fixed** — `xit()` / `@Disabled` with no ticket is permanent dead weight.
- **"Tests pass" = good** — tests that pass on broken code are worse than no tests.

## Related Knowledge

- `ci-cd` — where tests run, in what stage, with what parallelism
- `performance` — when tests measure latency / throughput
- `security` — fuzzing, SAST integration
- `reliability` — chaos testing, failure injection
- Language skills (`go`, `rust`, `kotlin`, `javascript`) — idiomatic test patterns

## References

- [testing-patterns.md](references/testing-patterns.md) — unit / integration / contract / e2e patterns
- [testing-frameworks.md](references/testing-frameworks.md) — framework-specific notes
- [multi-pass-review.md](references/multi-pass-review.md) — multi-pass review protocol for test suites
