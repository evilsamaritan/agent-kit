---
name: frontend
description: "Structure frontend UI across frameworks. Use for component composition, state ownership, rendering strategy (SSR, SSG, SPA), data-fetching boundaries, and verifying a UI change in a browser. Build tooling is in javascript."
user-invocable: true
---

# Frontend

Framework-neutral decisions about how a UI is put together: who owns each piece of state, where rendering happens, how components compose, and how to check a change. Framework APIs live in `react` and `vue`; build tooling lives in `javascript`.

## Scope and boundaries

**This skill covers:**
- State ownership: which kind of state it is, and who owns it
- Rendering strategy: build time, request time, or client
- Component composition and the data-fetching boundary
- Module boundaries inside a UI (public entry points, barrels)
- Verifying a UI change in a browser

**This skill does not cover:**
- Bundlers, workspaces, lint/format, build targets, `sideEffects` → [build-tooling.md](../javascript/references/build-tooling.md) in `javascript`
- React hooks, Server Components, Suspense → `react`
- Vue reactivity, Pinia, Nuxt → `vue`
- Semantic markup, forms → `html`; layout, tokens, motion → `css`
- WCAG, ARIA, keyboard behavior → `accessibility`
- UX flows, information architecture → `design`
- Browser APIs (CORS, storage, service workers) → `web`
- Metadata, crawlability → `seo`; render performance → `performance`
- Code practice inside a component (ownership, variants, async lifetime) → `development`

## Decision tree — who owns this state

```
What kind of state is it?
├── Data that lives on a server (lists, records, permissions)
│   └── Server cache: one cache layer owns it, keyed by request, with
│       invalidation. Never copy it into a client store "to share it".
├── Something the user should be able to link, reload, or go back to
│   (filters, page, selected tab, sort)
│   └── URL: the address is the owner; components read it
├── Values being edited before submit
│   └── Form: the form owns the draft; the server cache owns the result
├── Open/closed, hover, focus, scroll position of one component
│   └── Local UI state in that component
└── Client-only state read by distant components (session, cart draft, theme)
    └── Shared client state: one owner module exposes operations that keep
        its invariants; everyone else calls them (`development`, one writer)
```

Rules:
- **Derived is computed, not stored.** Storing a value that can be computed from other state creates two sources of truth.
- **Lift only as far as needed.** Move state up to the nearest common parent; reach for shared state only when distance makes that painful.
- **Server state is a cache with invalidation, local state is a toggle.** Do not hand-roll dedup, retry, revalidation, or optimistic rollback; use the framework's data layer or a server-state library. Cache-key and invalidate-after-mutation rules → `caching`.
- **Controlled or uncontrolled, not both.** A parent owns the value, or the child does and reports changes. A component that does both drifts.

## Decision tree — where does rendering happen

```
What does the route need?
├── Same content for everyone, changes rarely → build time (static generation)
├── Needs crawlable HTML and per-request data → request time (server rendering),
│   streaming where the framework supports it
├── Mostly static with a few dynamic regions → static shell + dynamic islands,
│   or time-based revalidation
├── Authenticated app, no crawlers, heavy interactivity → client rendering
└── Mix → decide per route, not per app
```

- **HTML first, enhance after.** Core content and primary forms should work before JavaScript runs where practical; script adds interactivity.
- Streaming and server components need framework support; confirm it before designing around them.
- Metadata and crawler behavior → `seo`. Cache-Control policy → `caching`; header syntax and navigation → `web`.

## Component structure

- **Layers by role:** primitives (button, input, dialog) → composed components (data table, confirm dialog) → route-level compositions that wire data to components. Dependencies point down only.
- **Components compose; they do not extend.** Share behavior through children, slots, props, or headless behavior units that bring no markup.
- **Compound components** fit sets of elements that share internal state (tabs, select, disclosure).
- **Container versus presentational** is a heuristic. Use it when it separates data access from markup; drop it when it adds files.
- **Data access at the boundary.** Route-level or feature-level code fetches; leaf components receive data and callbacks. A leaf that fetches for itself cannot be reused or tested in isolation.
- **Every data-driven view has four states** — loading, empty, error, success — designed up front, not patched in.

## Module boundaries — barrel files

One rule for the whole kit:
- A re-export file (`index`) is **fine at a package or slice boundary** where it defines the public API, provided the package marks side effects accurately and does not `export *` large trees.
- It is **harmful** when repeated at every directory level, when it re-exports modules with side effects, or inside libraries consumed by bundlers that cannot prune it.
- Consumers import from the boundary, never from files behind it (`feature-sliced-design` applies this per slice).

## Verifying a UI change

Open the changed flow in a browser. Check the states it can be in — loading, empty, error, success — keyboard and focus order, semantics, and contrast, at the narrowest and widest supported widths. Watch the console and network panel for errors and unexpected requests. A passing type check says nothing about any of these.

UI causes of poor Core Web Vitals: a hero image discovered late or lazy-loaded, content inserted without reserved space, long handlers on interaction, hydration of regions that never change. Definitions, thresholds, and field measurement (p75) → `performance`; ranking signal → `seo`.

## Context adaptation

**As implementer:** find the owner of each piece of state before writing code; pick the rendering mode per route; keep components small enough to name by role.

**As reviewer:** look for server data copied into client stores, derived values stored, components that fetch for themselves, state with two writers, and missing loading/empty/error states.

**As architect:** state ownership and rendering mode are the expensive-to-reverse decisions. Decide them early; framework choice follows from them.

## Anti-patterns

- **Server data mirrored into a client store.** Two caches disagree. Let the cache layer own it.
- **State stored when it can be derived.** Compute it.
- **Shared state with many writers.** Expose operations from one owner instead of open mutation.
- **Fetching in leaf components.** Fetch at the boundary, pass data down.
- **One rendering mode for the whole app** when routes have different needs.
- **Framework lock-in in "shared" packages.** A package that imports one framework is a package for that framework; name and document it as such.
- **Barrel files at every level.** See the rule above.
- **Treating a green build as a verified UI.** Run it.

## Related Knowledge

- `development` — one writer, explicit dependencies, async lifetime inside components
- `react`, `vue` — framework specifics
- `html`, `css` — markup, layout, tokens, motion
- `accessibility` — WCAG, ARIA, keyboard
- `javascript` — language, tsconfig, build tooling
- `web` — browser APIs, caching headers, navigation
- `seo` — metadata, crawlers; `performance` — render performance, Core Web Vitals (definitions, thresholds, measurement)
- `caching` — client cache keys and invalidation after a mutation
- `design` — flows, dashboards, interaction patterns
- `feature-sliced-design` — a convention for organizing frontend code

## References

- [build-tooling.md](../javascript/references/build-tooling.md) — bundlers, workspaces, lint/format, build targets (owned by `javascript`)
