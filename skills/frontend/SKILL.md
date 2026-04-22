---
name: frontend
description: Apply frontend engineering patterns — bundlers, workspaces, code quality tooling, component patterns, state management choices, build configuration. Framework-agnostic. Use when configuring bundlers, structuring a monorepo frontend, auditing code-quality tooling, or picking state/data-fetching patterns. Do NOT use for framework specifics (use react/vue), HTML/CSS depth (use html/css), accessibility (use accessibility), or UX design (use design).
allowed-tools: Read, Grep, Glob
user-invocable: true
---

# Frontend Engineering Patterns

Frontend infrastructure and patterns that cut across frameworks — build tooling, module systems, workspace organization, code-quality stacks, and framework-agnostic component patterns.

## Scope and boundaries

**This skill covers:**
- Bundler choice and config (Vite, webpack, esbuild, Rspack, Rolldown, Turbopack, Parcel)
- Workspace and monorepo structure (npm/pnpm/yarn workspaces, Turborepo, Nx)
- Code-quality tooling stack (ESLint, Biome, Prettier, TypeScript project references)
- Framework-agnostic component patterns (composition, compound components, render props, slots)
- Data-fetching / server-state patterns at a conceptual level
- Build output: tree-shaking, code-splitting, differential serving

**This skill does not cover:**
- React-specific hooks, RSC, Suspense → `react`
- Vue-specific composition API, reactivity → `vue`
- HTML semantics, CSS layout → `html/css`
- ARIA, keyboard nav, WCAG → `accessibility`
- UX/IA/interaction design → `design`
- i18n/l10n → `i18n`
- JS/TS language patterns → `javascript`
- Web platform APIs (CORS, service workers) → `web`
- SEO → `seo`

## Decision tree — picking a bundler

```
Are you building an app (not a lib)?
├─ yes →
│  Need SSR/SSG/RSC?
│  ├─ yes → use the framework's bundler (Next/Nuxt/SvelteKit) — don't roll your own
│  └─ no → Vite (SPA default; fast, sensible)
└─ no (you're building a library) →
   Is it pure JS/TS?
   ├─ yes → tsup / unbuild / pkgroll — simple, declarative
   └─ no (styles, assets) → Vite in library mode, or Rollup directly

Migrating off webpack?
  Rspack (webpack-compatible config, much faster)
  or Turbopack (Next.js path)
```

**Rolldown** — Rust-based Rollup-compatible bundler, planned as Vite's native default bundler (replacing esbuild + Rollup). Expect mention in Vite 7+.

Don't change bundler for speed alone — dev-time speed matters, prod bundle size matters more.

## Decision tree — picking a workspace manager

```
Single team, < 5 packages?
  pnpm workspaces (simple, fast, low memory)

Multi-team, many packages, cross-package dependency graph?
  pnpm + Turborepo (for caching) — most common modern stack
  Nx if you need strong plugin ecosystem + codegen

Polyglot monorepo (JS + Go + Python)?
  Bazel (if you can afford the ramp) or Pants
```

## Code-quality stack — defaults

Pick one per axis. Don't install two linters.

| axis | default | alt |
|------|---------|-----|
| linter | ESLint (flat config) | Biome (single binary, faster, fewer plugins) |
| formatter | Prettier | Biome |
| type checker | `tsc --noEmit` in CI + project references | — |
| pre-commit | lint-staged + husky (or simple-git-hooks) | — |

**Rules:**
- Linter stops at correctness; formatter stops at style. They are different jobs.
- One source of truth for config — root `eslint.config.js`, not per-package.
- Fast feedback over thorough: type check on save in IDE, full lint in CI.

## Component patterns — framework-agnostic

- **Composition over inheritance.** No component extends another; it composes children, slots, or props.
- **Compound components** — when a set of elements share internal state (`Select`, `Tabs`, `Disclosure`).
- **Headless / render-prop / slot patterns** — separate behavior (state machine) from presentation (markup). Same state, many skins.
- **Container vs presentational** is a heuristic, not a rule. Modern frameworks blur the line — use it when it simplifies, drop it when it adds boilerplate.
- **Controlled vs uncontrolled.** Controlled = parent owns state. Uncontrolled = child owns it, parent reads via ref/event. Both valid. Don't mix.

## Data-fetching / server-state — concepts

- **Local state ≠ server state.** Server state is cache with invalidation; local state is UI toggles. Different tools.
- **Server-state library** (TanStack Query / SWR / Apollo) handles: caching, dedup, revalidation, retry, optimistic updates. Never hand-roll these.
- **Suspense / streaming** lets you render shells before data. Requires framework support.

Framework specifics in `react` / `vue`.

## Build output — what matters

- **Tree-shaking** requires ESM + side-effect-free packages. Mark `"sideEffects": false` in package.json where true.
- **Code-splitting** by route is default. By component only when the component is large and optional.
- **Ship modern JS to modern browsers.** Differential serving via `<script type="module">` + `<script nomodule>` if legacy matters; otherwise just ship modern JS (ES2022+).
- **Bundle analysis.** `vite-bundle-visualizer` / `source-map-explorer` / `bundle-analyzer`. Check what you ship — regressions creep.

## Context adaptation

**As implementer:** pick the simplest stack that matches scale. Default: Vite + pnpm + ESLint + Prettier + TypeScript. Don't pre-optimize.

**As reviewer:** check for mismatched tooling (lint + format overlap), stale deps with security issues, missing tree-shaking markers, missing bundle analysis in CI.

**As architect:** frontend architecture is 70% workspace structure + 30% framework choice. Decide both early; migrations are painful.

## Anti-patterns

- **Tooling sprawl** — two linters, two formatters, three CI workflows for the same thing.
- **Custom bundler config from scratch** — 95% of cases are covered by defaults. Reach for custom only when the generic path fails.
- **Framework lock-in in "shared" packages.** A package that imports React is not shared — it's a React package. Own the naming.
- **Monorepo cargo-cult.** A single-team, single-app codebase doesn't need Turborepo.
- **Barrel-file everything.** `index.ts` re-exports kill tree-shaking and slow the TS compiler.
- **Pre-commit hooks that run the full test suite.** Commits will get skipped. Run tests in CI, not on commit.

## Related Knowledge

- `react`, `vue` — framework specifics
- `html/css` — markup and layout depth
- `accessibility` — WCAG, ARIA, keyboard
- `javascript` — language and tsconfig depth
- `web` — browser APIs
- `feature-sliced-design` — an architectural convention for organizing frontend code
- `performance` — render performance, Core Web Vitals

## References

- [bundlers.md](references/bundlers.md) — bundler decision tree with configs
- [workspaces.md](references/workspaces.md) — monorepo patterns
- [code-quality.md](references/code-quality.md) — lint / format / types / hooks stack
- [patterns.md](references/patterns.md) — framework-agnostic component patterns
