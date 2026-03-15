# Build Tools & Bundlers

Universal reference for build tool selection, configuration patterns, and optimization. Loaded on demand from the frontend skill.

---

## Build Tool Selection

Ask about constraints before recommending:

- **Framework?** — Next.js locks Turbopack; Nuxt, SvelteKit, Astro, Remix default to Vite; custom SPA → open choice
- **Existing tooling?** — webpack migration → Rspack is the low-friction path
- **Scale?** — startup or small SPA vs. enterprise monorepo with Module Federation
- **Target environments?** — browser-only vs. SSR vs. edge (Cloudflare Workers, Deno Deploy)
- **Test strategy?** — co-located tests benefit from Vitest sharing Vite config

---

## Decision Tree

```
What framework are you using?
├── Next.js
│   └── Turbopack (bundled, no choice — default dev since 15, production beta since 15.5)
│
├── Nuxt / SvelteKit / Astro / Qwik City
│   └── Vite (framework default — do not override)
│
├── Remix / React Router v7
│   └── Vite (official bundler since v2.7 / v7)
│
├── No framework (custom SPA, library, tool)
│   ├── New project → Vite + Rolldown
│   ├── Existing webpack project
│   │   ├── Want near-zero migration cost → Rspack
│   │   └── Willing to rewrite config → Vite
│   └── Build-only script (no dev server, no HMR)
│       └── esbuild (transforms only — see caveats)
│
└── Monorepo with Module Federation
    ├── ByteDance/large org already on webpack → Rspack
    └── Greenfield → Vite + @originjs/vite-plugin-federation
```

---

## Comparison (2026)

| Tool | Dev server | Production build | Testing | SSR / Edge | Ecosystem |
|------|-----------|-----------------|---------|-----------|-----------|
| **Vite + Rolldown** | Fast HMR, ESM native, Environment API | Rolldown (Rust, 10-30x vs Rollup) | Vitest (shared config) | Environment API for any runtime | Largest non-webpack ecosystem |
| **Turbopack** | Fastest startup in Next.js (57% vs webpack), file-system cache | Beta (15.5+), passes all integration tests | Jest / Vitest (separate config) | Node.js + Vercel Edge via Next.js | Next.js only |
| **Rspack** | Fast (Rust core), webpack-compatible plugins | 23x faster than webpack, multithreaded | Jest or Vitest (separate config) | SSR via Node.js | Top 40+ webpack plugins compatible |
| **esbuild** | No built-in dev server | Extremely fast transforms, limited code splitting | No bundled test runner | No native SSR orchestration | API-focused, minimal plugins |
| **webpack 5** | Slow HMR, but stable | Slow, mature | Jest (standard) | SSR support | Largest plugin ecosystem |

---

## Vite + Rolldown

Recommended default for new projects not locked to a framework bundler.

### Architecture

Vite 8 (released March 2026) ships Rolldown as its single unified bundler, replacing the previous split between esbuild (dev transforms) and Rollup (production builds). The same bundler runs in both dev and production, eliminating a class of dev/prod discrepancies.

- **Rolldown** — Rust bundler with Rollup-compatible API. Powered by OXC for parsing, resolving, transforming, and minifying. In official benchmarks: 1.61s vs Rollup's 40.10s on 19,000 modules (25x). Real-world gains: 5-30x depending on project size; small SPAs see 2-5x, large codebases (500+ modules) see 10-30x.
- **OXC** — Rust-native compiler and minifier used by Rolldown internally. The `@vitejs/plugin-react-oxc` package is deprecated as of Vite 8; OXC is now integrated directly.
- **Plugin compatibility** — Rolldown supports the Rollup plugin API. Most existing Vite and Rollup plugins work without changes.

### Environment API

Introduced in Vite 6, the Environment API allows a single Vite dev server to manage multiple independent environments (browser, SSR, edge) concurrently:

- Each environment has its own module graph, HMR, and runtime
- When a file changes, HMR runs for each environment independently via the `hotUpdate` hook
- Key benefit: develop directly against edge runtimes (Cloudflare Workers, Deno Deploy, Vercel Edge) with full HMR, not just Node.js simulation
- Status: stable in Vite 6+, some advanced APIs still marked experimental; stabilization ongoing in downstream ecosystem

### RSC support

`@vitejs/plugin-rsc` (in `vite-plugin-react` monorepo) provides React Server Components support via the Environment API:

- Three environments: `client`, `ssr`, and `rsc`
- Framework-agnostic low-level primitives — not tied to Next.js
- Used by Waku, React Router v7 RSC preview, and Cloudflare Vite plugin
- Status: experimental/preview; adoption growing through 2025-2026

### Configuration

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Rolldown is the default bundler in Vite 8
    // No opt-in required
    rollupOptions: {
      output: {
        // Route-based code splitting
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
```

### SSR mode

```ts
export default defineConfig({
  build: {
    ssr: true,
    rollupOptions: {
      input: 'src/entry-server.ts',
    },
  },
})
```

### Library mode

```ts
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
})
```

### Framework plugins

| Framework | Plugin |
|-----------|--------|
| React | `@vitejs/plugin-react` (Babel) or `@vitejs/plugin-react-swc` (SWC) |
| Vue 3 | `@vitejs/plugin-vue` |
| Svelte | `@sveltejs/vite-plugin-svelte` |
| Solid | `vite-plugin-solid` |
| Preact | `@preact/preset-vite` |

---

## Vitest

Test runner designed for the Vite ecosystem. Shares `vite.config.ts` — zero separate test configuration required.

### Key features

- **Shared config** — picks up aliases, environment variables, and plugins from `vite.config.ts` automatically
- **Browser mode** — run tests in a real browser (Chromium via Playwright or WebdriverIO) instead of jsdom; graduated to stable in Vitest 4.0 (late 2025)
- **Visual regression** — `toMatchScreenshot()` built-in since Vitest 4.0; Playwright Traces integration for debugging
- **In-source testing** — place `if (import.meta.vitest)` blocks inside source files for co-located unit tests
- **Jest-compatible API** — `describe`, `it`, `expect`, `vi.*` mocks; most Jest tests migrate without changes
- **Component testing** — mount components directly in browser mode with `@vitest/browser/context`
- **Instance-based parallelism** — single Vite server serves all browser test instances, processed once (Vitest 3+)
- **Line-number filtering** — run a specific test by file path and line number

### When to use browser mode vs jsdom

Ask: does the test need real browser APIs (ResizeObserver, CSS custom properties, Web Animations, real layout)?

- jsdom: unit tests for logic, hooks, and components without layout dependencies — faster, simpler CI setup
- Browser mode: component tests that depend on real DOM APIs, CSS behavior, or visual correctness

### Configuration example

```ts
// vite.config.ts — Vitest config co-located
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',          // or 'happy-dom'
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Browser mode
    browser: {
      enabled: false,              // opt-in per project
      provider: 'playwright',
      name: 'chromium',
    },
  },
})
```

For testing strategy beyond configuration, see the `qa` skill.

---

## Turbopack

Rust-based bundler built by Vercel, integrated into Next.js.

### Status (2026)

- **Development**: stable and default in Next.js 15+; 57% faster startup than webpack, 30% less memory
- **Production**: beta as of Next.js 15.5; passes all 8,298 integration tests; powering vercel.com in production
- **Next.js 16**: Turbopack became the default bundler for all new applications (October 2025)
- **Standalone**: not available outside Next.js; architecture is designed with standalone extraction as a future goal, but Vercel is prioritizing Next.js integration first

### When to use

Use Turbopack when you are using Next.js. It is not a choice to make — it is the framework default. For any project not on Next.js, use Vite.

### Configuration

Turbopack configuration lives in `next.config.ts` under the `turbopack` key, not in a separate `turbopack.config.ts`. Supported options include custom loaders, aliases, and resolve extensions. Not all webpack loaders have Turbopack equivalents — check the Next.js documentation for the current compatibility list.

---

## Rspack

Rust-based bundler offering near drop-in webpack API compatibility.

### When to use

- Existing large webpack codebase where rewriting config and plugins is not feasible
- Projects requiring Module Federation (webpack 5 API supported)
- Teams that need webpack plugin compatibility (1.0 supports 40+ of the top 50 webpack plugins)
- Organizations (ByteDance origin) already standardized on webpack tooling patterns

Ask: how much webpack-specific code does the project have? If the answer is "a lot" (custom loaders, plugins, complex config), Rspack removes risk. If it is minimal, migrating to Vite is worth considering for the broader ecosystem.

### Performance

23x faster than webpack in benchmarks; real-world migration reports show 38-80% build time reduction. Multithreaded code splitting by default.

### Configuration

Rspack accepts a `rspack.config.js` that mirrors `webpack.config.js`. The migration path is:

1. Replace `webpack` import with `@rspack/core`
2. Replace `webpack-dev-server` with `@rspack/dev-server`
3. Replace unsupported loaders/plugins with Rspack equivalents
4. Run — most configs work without further changes

```js
// rspack.config.js
const { rspack } = require('@rspack/core')

module.exports = {
  entry: './src/index.ts',
  output: { path: './dist' },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'builtin:swc-loader' }, // built-in, no install
    ],
  },
  plugins: [new rspack.HtmlRspackPlugin({ template: './index.html' })],
}
```

### Module Federation

Rspack supports webpack 5 Module Federation API. For greenfield projects needing Module Federation, weigh Rspack's webpack compatibility against Vite's `@originjs/vite-plugin-federation`.

---

## esbuild

Extremely fast Go-based bundler focused on transforms. Used internally by older versions of Vite (dev server, being phased out by Rolldown in Vite 8).

### When to use

- Build tooling scripts: compile TS → JS for Node.js CLIs, Lambda handlers, server scripts
- JS/TS transform pipelines inside a larger build system (not the primary bundler)
- Programmatic API use from within other tools

### When not to use

- As the sole production bundler for browser applications: code splitting is limited and still a work in progress; dynamic `import()` splitting creates many small chunks without intelligent deduplication heuristics
- Projects needing HMR and a dev server (no built-in dev server)
- CSS Modules, Vue SFCs, or complex asset pipelines (limited loader ecosystem)

### Key limitations

- Code splitting: enabled via `{ splitting: true, format: 'esm' }` but does not deduplicate shared modules optimally; can produce many small chunks
- No built-in dev server or HMR
- Plugin API is intentionally minimal — intentional design, not a bug to be worked around
- CSS: basic support; no CSS Modules out of the box

---

## Build Optimization (any bundler)

### Code splitting

```js
// Route-based splitting (React, lazy + Suspense)
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

// Feature splitting: keep heavy libraries out of initial bundle
const { Chart } = await import('chart.js')
```

Rules:
- Split at route boundaries first — natural loading unit
- Split genuinely large, lazily-needed dependencies (charting, PDF rendering, rich text editors)
- Avoid splitting too granularly — each chunk requires a network request; aim for chunks > ~20 KB

### Tree shaking

Tree shaking removes unused exports. Requirements:
- Modules must use ESM (`import`/`export`), not CommonJS (`require`)
- Mark side-effect-free packages: `"sideEffects": false` in `package.json`
- Avoid barrel re-exports for large modules

```json
// package.json — enables full tree shaking of your library
{
  "sideEffects": false
}
```

```ts
// Anti-pattern: barrel re-export pulls in entire module graph
export * from './components'   // avoid for large component libraries

// Preferred: direct imports
import { Button } from './components/Button'
```

### Bundle analysis

```bash
# Vite — rollup-plugin-visualizer
npm add -D rollup-plugin-visualizer
```

```ts
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [visualizer({ open: true, gzipSize: true })],
})
```

For Rspack and webpack: `webpack-bundle-analyzer` or `rsdoctor` (built-in Rspack plugin).

Ask when reviewing a bundle: what is the largest dependency? Is it used on every page? Can it be lazy-loaded or replaced with a smaller alternative?

### Asset optimization

- **Images**: use WebP or AVIF; serve via `<picture>` with fallback; use `loading="lazy"` for below-fold images; `width`/`height` attributes prevent CLS
- **Fonts**: `font-display: swap`; preload critical font files; subset fonts to used character ranges
- **CSS**: Vite extracts CSS to separate files by default; prefer CSS Modules or utility classes over large runtime CSS-in-JS libraries that ship style computation to the browser

### Caching strategy

- All bundlers with content hashing produce cache-busting filenames automatically — keep this enabled
- Separate vendor chunks from application code; vendor code changes less frequently and stays cached longer
- Enable persistent build cache (Turbopack has it by default; Vite caches in `node_modules/.vite`)

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Barrel files with `export *` | Prevents tree shaking; imports entire module graph | Use direct named imports; limit barrel files to small, related sets |
| Over-splitting (micro-chunks) | Waterfall of network requests; HTTP/1.1 head-of-line blocking | Merge small chunks; aim for chunks > 20 KB gzipped |
| Dev-only dependencies in production bundle | Bloated bundle; potential security exposure | Check `devDependencies` vs `dependencies`; use `import.meta.env.DEV` guards |
| Separate test config when bundler has integration | Config drift between build and test environments | Use Vitest with shared `vite.config.ts` |
| Manual polyfills | Duplicate polyfills already injected by bundler | Configure `build.target` / `browserslist`; let the bundler handle it |
| Using esbuild as the sole production bundler for SPAs | Immature code splitting; no HMR; limited plugin ecosystem | Use Vite for SPAs; esbuild for transforms only |
| Not setting `"sideEffects"` in library `package.json` | Consumers cannot tree-shake the library | Add `"sideEffects": false` (or a list of side-effectful files) |
| Importing from `lodash` instead of `lodash-es` | CommonJS import pulls entire library | Use `lodash-es` or individual function imports |
| Committing build output (`dist/`) for apps | Stale artifacts in repo; CI/CD should produce them | Add `dist/` to `.gitignore` (except for published packages) |
