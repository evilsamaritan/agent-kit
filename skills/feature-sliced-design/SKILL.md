---
name: feature-sliced-design
description: "Organize frontend code with Feature-Sliced Design. Use for FSD layers, slices, imports, structure reviews, and migration."
user-invocable: true
---

# Feature-Sliced Design

Framework-agnostic architecture methodology for frontend projects. Works with React, Vue, Svelte, Angular, Solid, or any component-based framework. Layer isolation enforced by import rules.

## The Five Hard Rules

1. **Import only downward** -- a layer may only import from layers below it. No upward imports. Ever.
2. **No cross-slice imports** -- slices within the same layer are isolated. `features/auth` cannot import from `features/cart`. Exception: entities may use `@x` cross-import notation (see below).
3. **No importing slice internals** -- consumers import from the slice's public entry point, not from internal paths (`slice/model/store.ts`). The entry point is typically an `index` file (the barrel rule is in `frontend`: fine at a slice boundary, harmful nested everywhere); some projects omit barrel exports due to bundler issues -- in that case, enforcement shifts to linting rules or bundler aliases.
4. **Canonical segments only** -- use standard segment names: `ui/`, `model/`, `api/`, `lib/`, `config/`. Non-canonical names are a SUGGESTION.
5. **Public API is the contract** -- every slice exposes a public API (barrel file or linter-enforced boundary). Internal restructuring must not break consumers.

Severity levels used by reviews: **BLOCKING** (upward or cross-slice import), **CONCERN** (bypassed public API, domain logic in `shared/`), **SUGGESTION** (non-canonical segment, unclear placement). Full definitions in `workflows/review.md`.

**Start in the page, extract on second use.** Code used by one page stays in that page. Move it to `widgets/`, `features/`, `entities/`, or `shared/` only when a second slice needs the same knowledge. `entities/` and `features/` are optional layers: a small project may need only `app`, `pages`, and `shared`.

---

## Layer Map

| Layer | Dir | What belongs | Can import from |
|-------|-----|-------------|----------------|
| app | `app/` | Providers, routing, global styles, app init | All layers |
| pages | `pages/` | Route-level compositions, page components | widgets, features, entities, shared |
| widgets | `widgets/` | Standalone UI blocks (sidebar, header) | features, entities, shared |
| features | `features/` | User actions with business value (auth, checkout) | entities, shared |
| entities | `entities/` | Business domain objects (User, Product, Order) | shared (+ `@x` cross-imports between entities) |
| shared | `shared/` | Reusable infra, UI kit, utilities -- zero domain knowledge | nothing (no upward imports) |

---

## Placement Decision Tree

```
Where does this code go?
|
+-- Used by one page only (and not a UI-kit primitive or infrastructure wrapper)?
|   +-- pages/<name>/ (ui/, model/, api/ segments as needed)
|
+-- No domain knowledge, reused everywhere?
|   +-- shared/
|       +-- UI primitives, design tokens -> shared/ui/
|       +-- HTTP client, third-party wrappers -> shared/api/ or shared/lib/
|       +-- Global constants, env config -> shared/config/
|
+-- Used by several pages and represents a business domain object (User, Order, Product)?
|   +-- entities/<name>/
|       +-- Type/interface, state, and the operations that keep its invariants -> entities/<name>/model/
|       +-- API calls for this entity -> entities/<name>/api/
|       +-- Domain UI (avatar, badge) -> entities/<name>/ui/
|
+-- Used by several pages and represents a user action (login, add-to-cart)?
|   +-- features/<name>/
|       +-- Flow orchestration; calls the owning entity's operations -> features/<name>/model/
|       +-- Feature UI (form, button) -> features/<name>/ui/
|       +-- Feature-specific API calls -> features/<name>/api/
|
+-- A standalone UI block (header, sidebar, feed)?
|   +-- widgets/<name>/
|
+-- A full page / route?
|   +-- pages/<name>/
|
+-- App-level bootstrap (router, providers, global styles)?
    +-- app/
```

---

## Entity Cross-Imports (@x Notation)

Entities often relate to each other (User has Orders, Artist has Songs). The `@x` notation makes cross-entity dependencies explicit and controlled.

**When to use:** entity B's type definition requires entity A's type (e.g., `Artist` contains `Song[]`).

**Mechanism:** entity A creates a dedicated public API file for entity B at `entities/a/@x/b.ts`. Entity B imports only from that file.

```
entities/song/@x/artist.ts    -- "song crossed with artist"
  export type { Song } from '../model/types'

entities/artist/model/types.ts
  import type { Song } from 'entities/song/@x/artist'
  export interface Artist { name: string; songs: Song[] }
```

**Rules:**
- Only on the entities layer -- never between features, widgets, or pages
- Keep `@x` imports to type-level when possible (avoids runtime coupling)
- If two entities have mutual `@x` imports, consider merging them or extracting shared types to `shared/`

---

## Segment Quick Reference

| Segment | What goes there |
|---------|----------------|
| `ui/` | Framework components (React, Vue, Svelte, Angular, Solid), styled elements |
| `model/` | State, stores, selectors, domain types/interfaces |
| `api/` | API request functions, data-fetching hooks/composables |
| `lib/` | Pure utilities, helpers, formatters |
| `config/` | Constants, feature flags, environment bindings |

---

## Common Violations

| Violation | Why it breaks | Fix |
|-----------|--------------|-----|
| `features/auth` imports `features/cart` | Cross-slice -- creates coupling, breaks isolation | Extract shared data to `entities/` or `shared/` |
| `import { Button } from 'shared/ui/button/Button'` | Bypasses public API | `import { Button } from 'shared/ui/button'` (`shared/ui` and `shared/lib` expose one entry per component or library) |
| `entities/user` imports `features/auth` | Upward import -- entities can't know about features | Move auth logic up to `features/auth` |
| Business logic in `shared/` | Shared must be domain-free | Move to `entities/` or `features/` |
| `widgets/` in `features/` | Wrong layer -- features are actions, not UI blocks | Move to `widgets/` if standalone, `pages/` if route-specific |
| Custom segment `helpers/` | Non-canonical name -- reduces discoverability (SUGGESTION) | Rename to `lib/` |
| Direct entity-to-entity import | Implicit coupling between domain objects | Use `@x` notation for explicit cross-imports |

---

## Import Rule Enforcement

Enforce the hard rules with tooling, not review alone. Decision tree:

```
What tooling does the project have?
|
+-- Want layer, slice, and structure checks in one tool?
|   +-- Steiger (FSD architecture linter from the Feature-Sliced organization: forbidden imports, excessive slicing, naming; pre-1.0, so pin its version)
|
+-- ESLint already in CI?
|   +-- import/no-restricted-paths + import/no-internal-modules,
|       or a boundaries plugin, mapped to the layer list
|
+-- TypeScript project?
|   +-- tsconfig paths for alias-based imports (aliases do not enforce anything by themselves)
|
+-- None of the above?
    +-- Run the checks in workflows/review.md in CI as a safety net
```

Combine two approaches for defense in depth. If a framework forces layer renames (for example `_app` and `_pages`), map the renamed layers in the linter configuration.

---

## FSD vs Alternatives

| If you need... | Use | Why not FSD? |
|---------------|-----|-------------|
| Frontend architecture with business logic layers | **FSD** | -- |
| UI component taxonomy only (atoms, molecules) | Atomic Design | FSD covers business logic layers that Atomic Design ignores |
| Backend / full-stack architecture | Clean Architecture, DDD | FSD is frontend-specific by design |
| Simple app, solo developer, < 10 screens | Flat structure | FSD overhead not justified |

FSD and Atomic Design are complementary: use Atomic Design within `shared/ui/` for component taxonomy, FSD for overall project structure.

---

## Related Knowledge

- **frontend** -- state ownership, barrel-file rule, rendering strategy
- **development** -- one writer per piece of state, extract when it is the same knowledge, not the same shape
- **react** / **vue** -- framework-specific patterns within FSD slices (RSC integration, App Router, Composition API)
- **javascript** -- path aliases, module resolution, build tooling
- **architecture** -- module boundaries, ownership, and broader system design when FSD is one part of a larger architecture

---

## References

- `references/placement-rules.md` -- edge case placement decisions (reusable-but-domain-specific, auth/permissions, global state, types, test utilities)
- `references/framework-integration.md` -- Next.js (renamed `_app`/`_pages` layers), Nuxt, Vite, monorepo adaptations
- `workflows/setup.md` -- step-by-step procedure for scaffolding a new FSD project
- `workflows/migration.md` -- pages-first incremental migration from an existing codebase to FSD
- `workflows/review.md` -- full compliance audit procedure with severity model and report template
