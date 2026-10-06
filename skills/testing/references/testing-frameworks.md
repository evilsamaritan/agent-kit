# Test Runner and Tool Selection

Selection guidance per ecosystem. Names are examples of established options, not endorsements. Before writing configuration, read the installed version from the project's manifest or lockfile and follow that major's documentation and migration guide; runner configuration changes shape between majors.

## Contents

- [Start from what exists](#start-from-what-exists)
- [Unit and integration runners](#unit-and-integration-runners)
- [Browser end-to-end](#browser-end-to-end)
- [Mobile UI](#mobile-ui)
- [Component tests](#component-tests)
- [Visual regression](#visual-regression)
- [Real dependencies](#real-dependencies)
- [Fuzzing, property, and mutation tools](#fuzzing-property-and-mutation-tools)
- [Anti-patterns](#anti-patterns)

---

## Start from what exists

```
Does the project already run tests?
├── yes → keep its runner; add tests in its style. Migrate only for a named,
│         measured problem (config duplication, ESM friction, speed), as its own change
└── no  → use the ecosystem default below; prefer the runner the build tool
          or language ships with
```

## Unit and integration runners

| Ecosystem | Default | Alternatives and when |
|---|---|---|
| JavaScript / TypeScript | the runner that shares the build tool's config (Vitest in Vite projects) | Jest for existing suites; `node:test` for zero-dependency Node libraries; `bun test` on Bun |
| Python | pytest | `unittest` only when a framework requires it; pytest runs those tests too |
| Go | `go test` with table-driven subtests | assertion helpers (testify) are optional; `httptest` ships with the standard library |
| Rust | `cargo test` | cargo-nextest for faster, isolated execution of large suites |
| JVM (Java, Kotlin) | JUnit Jupiter | Kotest or kotlin.test for Kotlin-first projects; AssertJ for fluent assertions |
| .NET | xUnit | NUnit or MSTest when the solution already uses them |
| Apple (Swift) | Swift Testing for new tests | XCTest for existing suites and for test kinds the installed toolchain's Swift Testing does not cover (check UI automation and performance tests against its docs); both can live in one target and one file |

Parameterized syntax per runner: [testing-patterns.md](testing-patterns.md#parameterized-tests).

## Browser end-to-end

```
Browser e2e runner?
├── new suite, several engines (Chromium, Firefox, WebKit) → Playwright
├── existing Cypress suite that works → keep Cypress
├── must drive real vendor browsers through the W3C standard,
│   or the team's language has no Playwright binding → WebDriver (Selenium, WebdriverIO)
└── API-only smoke checks → the e2e runner's HTTP client or a plain HTTP test, no browser
```

Prefer web-first assertions that wait for a state over fixed sleeps, and capture traces on retry for diagnosis.

## Mobile UI

```
Mobile UI tests?
├── one native platform, tests owned by the app team → the platform framework
│   (XCUITest on iOS, Espresso or Compose UI tests on Android)
├── one suite for both platforms, black-box flows → a cross-platform driver (Appium, Maestro)
└── logic below the UI → unit tests; keep UI tests to critical flows
```

## Component tests

Query the rendered component the way a user finds things: role, label, text; a test id only as a last resort. Testing Library adapters exist for the major UI frameworks.

```
Component environment?
├── behavior only, no layout or real browser APIs → DOM emulation (jsdom, happy-dom)
├── CSS layout, canvas, observers, or real browser APIs matter → browser mode of the
│   unit runner, or the e2e runner's component testing
└── visual appearance is the assertion → visual regression (below)
```

## Visual regression

```
Visual regression tool?
├── already using a browser e2e runner with screenshot assertions → use them
├── component library documented in a story tool → a hosted or self-hosted
│   snapshot service integrated with the stories
└── many browsers or devices at scale → a hosted cross-browser service
```

Capture rules and threshold: [testing-patterns.md](testing-patterns.md#visual-regression-testing).

Accessibility scanners and their limits belong to the `accessibility` skill.

## Real dependencies

Testcontainers libraries exist for most ecosystems (Java, .NET, Go, Node.js, Python, Rust) and start databases, brokers, and caches per suite. Local emulators or vendor sandboxes cover third-party services that cannot run in a container. HTTP stub servers (WireMock and equivalents) verify your adapter against recorded responses.

## Fuzzing, property, and mutation tools

| Ecosystem | Fuzzing | Property-based | Mutation |
|---|---|---|---|
| C / C++ | libFuzzer, AFL++ | RapidCheck | Mull |
| Go | native `go test -fuzz` | rapid, `testing/quick` | — |
| Rust | cargo-fuzz (libFuzzer) | proptest, quickcheck | cargo-mutants |
| Python | Atheris | Hypothesis | mutmut |
| JVM | Jazzer | jqwik, Kotest property | PIT |
| JavaScript / TypeScript | Jazzer.js | fast-check | Stryker |
| .NET | SharpFuzz | FsCheck, CsCheck | Stryker.NET |

Fuzzers come and go faster than runners: check the tool's maintenance status before adopting it. Continuous fuzzing services (OSS-Fuzz for open source) run harnesses long-term. Mutation testing is slow: target critical modules, not the whole codebase.

## Anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Migrating runners as a side quest | Large diff, no behavior gained | Keep the runner; migrate as its own change with a named reason |
| Copying configuration from another major version | Silent misconfiguration or startup failure | Read the installed version first; follow its docs |
| DOM emulation for layout-dependent tests | Layout and computed styles are not real | Browser mode or e2e component testing |
| Testing implementation details | Tests break on refactor without behavior change | Query by role and text; assert outcomes |
| No e2e for critical journeys | Regressions found in production | A few stable smoke tests for sign-in, payment, the core flow |
