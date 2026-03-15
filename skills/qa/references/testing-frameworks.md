# Testing Frameworks

Reference for framework selection across E2E, unit/integration, component, visual regression, and accessibility testing. Covers current versions as of early 2026.

---

## E2E Testing

Ask: Multi-browser needed? What's the primary use case? Does the team already have an investment in a specific tool?

### Decision Tree

```
E2E framework?
├── Multi-browser, modern API, starting fresh → Playwright (recommended default)
├── Component testing focus + visual interactive dashboard → Cypress
├── Already using Cypress, working well → Keep Cypress (no migration pressure)
├── Minimal E2E, API-only testing → Playwright request context or supertest
└── .NET / Java / Python stack → look at framework-native options (Selenium, Puppeteer wrappers)
```

### Playwright (recommended default for new projects)

Current stable: v1.49+ (late 2025). Active development, frequent releases.

**Capabilities:**
- Multi-browser: Chromium, Firefox, WebKit (Safari engine) — same test runs all three
- Auto-waiting: web-first assertions wait for elements to reach expected state before failing
- Codegen: record interactions and generate test code (`npx playwright codegen`)
- Trace viewer: full trace of network, DOM snapshots, console for debugging
- UI mode: interactive test runner with time-travel debugging
- Component testing: `@playwright/experimental-ct-react`, `ct-vue`, `ct-svelte` — renders components in real browser
- Visual regression: `toMatchSnapshot()`, `toHaveScreenshot()` — pixel-level diffing built in
- API testing: `request` context — no browser launched, useful for API smoke tests
- Accessibility: `@axe-core/playwright` integration for axe rule violations
- Fixtures system: scoped setup/teardown, composable, first-class parallelism support
- Sharding: `--shard=1/4` for CI parallelism across machines
- Reporters: built-in HTML report, JUnit, JSON; integrations with CI tools

**Configuration:**
```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

**Fixture pattern (test isolation):**
```ts
// fixtures.ts
import { test as base } from '@playwright/test';
export const test = base.extend<{ todoPage: TodoPage }>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await use(todoPage);
  },
});
```

**API testing (no browser):**
```ts
test('creates a user via API', async ({ request }) => {
  const response = await request.post('/api/users', {
    data: { name: 'Alice', email: 'alice@example.com' },
  });
  expect(response.ok()).toBeTruthy();
  const user = await response.json();
  expect(user.id).toBeDefined();
});
```

### Cypress

Current stable: v13+ (2024-2025). Maintained actively.

**Capabilities:**
- Chromium (full support) + limited Firefox + experimental WebKit
- Component testing: stable, integrated in same tool
- Interactive Test Runner: time-travel debugging, live reload
- Cypress Cloud: paid dashboard, parallelization, flaky test detection, analytics
- Network stubbing: `cy.intercept()` for mocking HTTP requests

**Limitations (understand before choosing):**
- No multi-tab support
- No native OS-level keyboard events (workarounds exist)
- Same-origin by default (cross-origin requires config flags)
- Slower startup than Playwright
- Paid Cloud required for full parallelization + dashboards

**When to choose Cypress:**
- Team is already invested in Cypress with existing test suite
- Visual/interactive dashboard is a hard requirement and team doesn't want separate tooling
- Component testing in isolation with the same tool as E2E is a priority

---

## Unit / Integration Testing

Ask: What's your build tool? What runtime? Do you need browser-mode accuracy or is Node/jsdom sufficient?

### Decision Tree

```
Unit/integration framework?
├── Vite project (any frontend framework) → Vitest (shares config, fastest HMR)
├── Bun project → bun test (native, zero install, Jest-compatible)
├── Node.js, no bundler, want zero deps → node:test (built-in, Node 18+)
├── Legacy webpack / Create React App / existing Jest setup → Jest (no migration cost)
├── New JS/TS project without Vite → Vitest (still works, better DX than Jest)
├── Python → pytest (de facto standard)
├── Rust → cargo test (built-in)
└── Go → go test (built-in)
```

### Vitest (recommended for JS/TS)

Current stable: v3+ (2025); v4 in development with browser mode stabilization.

**Why Vitest over Jest for new projects:**
- Shares `vite.config.ts` — no duplicate config for transforms, aliases, env vars
- Native ESM support — no transform hacks
- HMR-aware watch mode — re-runs only affected tests
- Jest-compatible API (`describe`, `it`, `expect`, `vi.*`) — low migration cost

**Key features:**
- Browser mode: run tests in real browser (Chromium, Firefox, WebKit via Playwright or WebDriverIO provider) — stable in v3+, significantly improved in v4
- In-source testing: tests co-located inside source files using `if (import.meta.vitest)` guard — useful for utility functions
- Coverage: `@vitest/coverage-v8` (fast, native) or `@vitest/coverage-istanbul` (accurate, supports more edge cases)
- Workspace: monorepo support via `vitest.workspace.ts`
- Benchmark mode: `bench()` blocks for performance testing
- Snapshot testing: compatible with Jest snapshot format

**Minimal config:**
```ts
// vitest.config.ts (or add to vite.config.ts)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',          // 'node' | 'jsdom' | 'happy-dom' | 'browser'
    globals: true,                 // optional: skip importing describe/it/expect
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.d.ts', '**/index.ts'],
    },
  },
});
```

**Browser mode (real DOM, accurate CSS):**
```ts
// vitest.config.ts
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
  },
});
```

**In-source testing:**
```ts
// math.ts
export function add(a: number, b: number) { return a + b; }

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;
  it('adds two numbers', () => { expect(add(1, 2)).toBe(3); });
}
```

### Jest

Current: v29+ (2023-2025). In broad maintenance mode — receives bug fixes, not major new features.

**Status:** Mature, stable. The Jest team has acknowledged Vitest as the modern alternative for Vite projects. Jest v30 is in development (ESM improvements, performance), but momentum has shifted toward Vitest in the Vite ecosystem.

**Still valid when:**
- Legacy project with existing Jest config and test suite (migration cost > benefit)
- Specific Jest plugins with no Vitest equivalent
- Non-Vite projects where config duplication is not a concern
- Team is deeply familiar and framework-agnostic testing is the priority

**Not recommended for:**
- New Vite/Next.js/Nuxt projects — config duplication and slower startup
- Projects requiring native ESM without transform workarounds

### bun test

Current: built into Bun 1.x (stable, actively developed 2024-2025).

**Capabilities:**
- Zero install — part of the Bun runtime
- Jest-compatible API: `describe`, `it`, `test`, `expect`, `mock`, `spyOn`
- Fastest startup time of any JS test runner (native binary, no Node.js overhead)
- TypeScript natively (no ts-jest or transform config needed)
- `--watch` mode
- Coverage via `bun test --coverage`

**Limitations:**
- Bun runtime only — not portable to Node.js environments
- Ecosystem compatibility: some Node.js-specific modules may behave differently
- Smaller plugin ecosystem than Jest/Vitest

**When to use:** Bun-native projects, tools built to run on Bun, maximum startup speed for unit tests.

### node:test

Built into Node.js since Node 18 (stable), improved significantly in Node 20+.

**Capabilities:**
- Zero dependencies — no install, no config
- `describe` / `it` / `test` API
- Built-in assertions via `node:assert`
- Built-in mocking: `mock.fn()`, `mock.method()`, `mock.timers`
- TAP reporter by default; spec reporter available
- `--test` flag to discover and run test files
- Coverage via `--experimental-test-coverage` (Node 22+)

**Limitations:**
- Fewer matchers than Jest/Vitest `expect` (no `.toMatchObject`, `.toMatchSnapshot` built-in)
- No watch mode built-in (use `nodemon` or `--watch` added in Node 22)
- No browser environment simulation (jsdom not included)
- Smaller ecosystem of utilities

**When to use:**
- Node.js CLI tools and libraries that want zero test dependencies
- Publishing packages where the test runner is not bundled with the package
- Projects where Bun/Deno/Node portability matters

---

## Component Testing

Ask: Do you need real browser rendering? Are you testing visual appearance or logical behavior? What framework renders the component?

### Testing Library (@testing-library/*)

The standard approach for component behavior testing. Framework-agnostic philosophy.

**Available adapters:** `@testing-library/react`, `@testing-library/vue`, `@testing-library/svelte`, `@testing-library/angular`, `@testing-library/user-event`

**Core principle:** query the DOM as a user would — by role, label, text. Not by CSS class or implementation detail.

**Query priority (use in this order):**
1. `getByRole` — most accessible, tests what screen readers see
2. `getByLabelText` — for form inputs
3. `getByPlaceholderText` — fallback for inputs
4. `getByText` — for non-interactive elements
5. `getByTestId` — last resort (use `data-testid` sparingly)

**Async queries:**
- `getBy*` — throws immediately if not found (synchronous)
- `findBy*` — waits for element to appear (async, returns Promise)
- `queryBy*` — returns null if not found (use for asserting absence)

**Works with:** Vitest (recommended) and Jest. Renders into jsdom by default.

**Example (React + Vitest):**
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

test('submits credentials when form is filled', async () => {
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'secret');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(onSubmit).toHaveBeenCalledWith({
    email: 'alice@example.com',
    password: 'secret',
  });
});
```

### Vitest Browser Mode (real browser rendering)

When jsdom is not accurate enough — CSS-dependent behavior, canvas, Web APIs.

**Providers:** Playwright (recommended) or WebDriverIO.

**When to prefer over jsdom:**
- CSS layout or computed styles affect behavior
- Web APIs not available in jsdom (ResizeObserver, IntersectionObserver, canvas)
- Testing third-party components that rely on real DOM specifics
- Higher confidence needed before shipping UI changes

**Trade-off:** slower than jsdom (real browser launch overhead), but more accurate.

### Playwright Component Testing (@playwright/experimental-ct-*)

Renders components in a real browser using the Playwright API.

**Adapters:** `@playwright/experimental-ct-react`, `ct-vue`, `ct-svelte`

**When to use:**
- Already using Playwright for E2E and want one consistent API
- Component needs Playwright-level interaction (drag, hover, multi-touch)
- Visual regression for components alongside E2E visual tests

**Note:** "experimental" label reflects API stability, not production-readiness — used in production by many teams. Monitor changelog for graduation to stable.

---

## Visual Regression Testing

Ask: Is the project design-system-driven? How often does CSS change? Is Storybook already in use?

### Tool Decision

```
Visual regression tool?
├── Already using Playwright → toHaveScreenshot() (built-in, free)
├── Storybook-based design system → Chromatic (paid, tight Storybook integration)
├── Open-source budget, CI-friendly → Argos (free tier, GitHub integration)
├── Self-hosted, full control → BackstopJS (Docker-based, open source)
└── Need cross-browser visual testing at scale → Percy (BrowserStack, paid)
```

### Playwright Built-in (`toHaveScreenshot`)

```ts
test('product card renders correctly', async ({ page }) => {
  await page.goto('/components/product-card');
  await expect(page.locator('.product-card')).toHaveScreenshot('product-card.png', {
    maxDiffPixelRatio: 0.02, // allow 2% difference for antialiasing
  });
});
```

- First run creates baseline (stored in `__screenshots__`)
- Subsequent runs diff against baseline
- `--update-snapshots` flag to update baselines
- CI requires deterministic rendering (disable animations, fix fonts)

### Chromatic

- Tight Storybook integration — captures every story automatically
- Paid service (free tier for open source)
- Visual change review workflow (approve/deny UI changes)
- TurboSnap: only captures changed stories based on git diff

### Argos

- Open source friendly, GitHub Actions integration
- Works with Playwright, Cypress, or any screenshot tool
- Per-screenshot diffing with visual review UI
- Free tier for open source projects

### BackstopJS

- Self-hosted, open source
- Docker-based for consistent rendering
- Config-driven: define scenarios with URLs and selectors
- No vendor lock-in

### When to invest in visual regression:
- Design system with many shared components
- Marketing / landing pages that change infrequently but matter visually
- After major CSS refactoring or framework migrations
- Team is regularly breaking visual appearance without functional test failure

---

## Accessibility Testing in CI

Ask: What WCAG level is required? Is this E2E, component, or both?

### Tool Decision

```
Accessibility testing?
├── Playwright E2E tests → @axe-core/playwright (most coverage, real rendering)
├── Component tests (Vitest/Jest) → vitest-axe or jest-axe (fast, unit-level)
├── Automated audit pipeline → Lighthouse CI (scores + WCAG violations)
├── CI-friendly CLI scanning → pa11y (URL-based, configurable rules)
└── Full manual + automated → combine axe-core + manual screen reader testing
```

### @axe-core/playwright

```ts
import { checkA11y } from 'axe-playwright'; // or use @axe-core/playwright directly

test('product page has no critical a11y violations', async ({ page }) => {
  await page.goto('/products/123');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

**Coverage:** color contrast, missing labels, keyboard focus, ARIA misuse, heading structure.

**Limitation:** Automated tools catch ~30-40% of WCAG issues. Always supplement with manual keyboard navigation and screen reader testing.

### vitest-axe / jest-axe

```ts
import { axe, toHaveNoViolations } from 'vitest-axe'; // or jest-axe
expect.extend(toHaveNoViolations);

test('button is accessible', async () => {
  const { container } = render(<Button>Submit</Button>);
  expect(await axe(container)).toHaveNoViolations();
});
```

### Lighthouse CI

- Full Lighthouse audit in CI pipeline
- Scores: Performance, Accessibility, Best Practices, SEO
- Threshold-based gates: fail CI if accessibility score < 90
- `@lhci/cli` npm package or official GitHub Action

### pa11y

- CLI-friendly, URL-based scanning
- WCAG 2.0/2.1 AA/AAA rules
- CI integration via `pa11y-ci` with config file
- Supports multiple URLs with one config

---

## Python Testing

Ask: Is this pure Python? Does it test Django/Flask/FastAPI? Integration or unit?

### Framework: pytest (de facto standard)

**Core features:**
- Simple `assert` statements (no `assertEqual`, `assertTrue` syntax)
- Fixtures: `@pytest.fixture` with scope (`function`, `class`, `module`, `session`)
- Parametrize: `@pytest.mark.parametrize`
- Plugins: `pytest-asyncio` (async tests), `pytest-cov` (coverage), `pytest-xdist` (parallel), `httpx` / `requests-mock` (HTTP mocking)

**When to use alternatives:**
- `unittest`: only when framework requires it (rare); pytest runs unittest tests anyway
- `hypothesis`: property-based testing — use alongside pytest

---

## Rust Testing

### Built-in: cargo test

- Tests in same file as source, annotated `#[test]`
- Integration tests in `tests/` directory
- `#[should_panic]` for error path testing
- `#[ignore]` for slow tests
- Parallel by default; `--test-threads=1` for sequential

**When to add external crates:**
- `proptest` or `quickcheck`: property-based testing
- `criterion`: benchmarking
- `mockall`: mock generation for traits
- `wiremock`: HTTP mock server for integration tests

---

## Go Testing

### Built-in: go test

- `_test.go` files in same package (white-box) or `_test` package suffix (black-box)
- `testing.T` for tests, `testing.B` for benchmarks
- Table-driven tests: slice of structs with `t.Run(tc.name, ...)`
- `testify/assert` and `testify/require`: popular assertion library

**When to add external packages:**
- `testcontainers-go`: real DB/service containers in integration tests
- `gomock` / `mockery`: mock generation from interfaces
- `httptest`: built-in, no external package needed for HTTP handler testing

---

## Framework Comparison Summary

| Framework | Language | Best for | Maintained? | Key differentiator |
|-----------|----------|----------|-------------|-------------------|
| Playwright | JS/TS | E2E, API, component | Active | Multi-browser, modern API |
| Cypress | JS/TS | E2E, component | Active | Interactive dashboard |
| Vitest | JS/TS | Unit, integration, component | Active | Vite integration, browser mode |
| Jest | JS/TS | Unit, integration | Maintenance | Largest ecosystem |
| bun test | JS/TS | Unit (Bun projects) | Active | Zero install, fastest startup |
| node:test | JS/TS | Unit (Node.js, zero deps) | Active (Node core) | No dependencies |
| pytest | Python | Unit, integration | Active | Fixture system, plugins |
| cargo test | Rust | All | Active (Rust core) | Zero config |
| go test | Go | All | Active (Go core) | Built-in, table-driven |

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Cypress for multi-browser | WebKit is experimental, Firefox limited | Use Playwright for cross-browser coverage |
| Jest in Vite project | Duplicate config, slower startup, ESM friction | Migrate to Vitest |
| Puppeteer for new projects | Chromium-only, less ergonomic API, lower-level | Use Playwright |
| jsdom for CSS-dependent tests | No real rendering, layout inaccurate | Vitest browser mode or Playwright CT |
| Testing implementation details | Tests break on refactor without behavior change | Query by role/text via Testing Library |
| No E2E for critical paths | Regressions in user journeys caught only in production | Playwright smoke tests for auth, checkout, core flows |
| Snapshot overuse | Approve blindly, misses semantic regressions | Targeted assertions; snapshots only for stable output |
| Screenshot without disabling animations | Flaky visual diffs | Disable CSS animations in test environment |
| Accessibility audit only at E2E level | Slow feedback, hard to attribute to component | Add `vitest-axe` at component level for fast feedback |
| Treating `node:test` as Jest replacement | Missing matchers, no watch mode in older Node | Know the limitations; add `@jest/expect` if needed |
