---
name: feature-sliced-design
description: Apply Feature-Sliced Design (FSD) architecture. Use when organizing frontend structure, deciding where code belongs, auditing FSD imports, reviewing layer compliance, or migrating to FSD. Do NOT use for framework-specific patterns (use react or vue skill).
allowed-tools: Read, Grep, Glob
user-invocable: true
---

# Feature-Sliced Design

Framework-agnostic architecture methodology for frontend projects. Works with React, Vue, Svelte, Angular, Solid, or any component-based framework. Layer isolation enforced by import rules.

## The Five Hard Rules

1. **Import only downward** -- a layer may only import from layers below it. No upward imports. Ever.
2. **No cross-slice imports** -- slices within the same layer are isolated. `features/auth` cannot import from `features/cart`. Exception: entities may use `@x` cross-import notation (see below).
3. **No importing slice internals** -- consumers import from the slice's public entry point, not from internal paths (`slice/model/store.ts`). The entry point is typically an `index` file, but some projects omit barrel exports due to bundler issues -- in that case, enforcement shifts to linting rules or bundler aliases.
4. **Canonical segments only** -- use standard segment names: `ui/`, `model/`, `api/`, `lib/`, `config/`. Non-canonical names are a CONCERN.
5. **Public API is the contract** -- every slice exposes a public API (barrel file or linter-enforced boundary). Internal restructuring must not break consumers.

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
+-- No domain knowledge, reused everywhere?
|   +-- shared/
|       +-- UI primitives, design tokens -> shared/ui/
|       +-- HTTP client, third-party wrappers -> shared/api/ or shared/lib/
|       +-- Global constants, env config -> shared/config/
|
+-- Represents a business domain object (User, Order, Product)?
|   +-- entities/<name>/
|       +-- Type/interface -> entities/<name>/model/
|       +-- API calls for this entity -> entities/<name>/api/
|       +-- Domain UI (avatar, badge) -> entities/<name>/ui/
|
+-- Represents a user action / business feature (login, add-to-cart)?
|   +-- features/<name>/
|       +-- Business logic, store slice -> features/<name>/model/
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
| `import { Button } from 'shared/ui/Button/Button'` | Bypasses public API | `import { Button } from 'shared/ui'` |
| `entities/user` imports `features/auth` | Upward import -- entities can't know about features | Move auth logic up to `features/auth` |
| Business logic in `shared/` | Shared must be domain-free | Move to `entities/` or `features/` |
| `widgets/` in `features/` | Wrong layer -- features are actions, not UI blocks | Move to `widgets/` if standalone, `pages/` if route-specific |
| Custom segment `helpers/` | Non-canonical name -- reduces discoverability | Rename to `lib/` |
| Direct entity-to-entity import | Implicit coupling between domain objects | Use `@x` notation for explicit cross-imports |

---

## Import Rule Enforcement

Enforce the hard rules using one or more approaches. Decision tree:

```
What tooling does the project have?
|
+-- TypeScript project?
|   +-- Configure tsconfig.json paths + baseUrl for alias-based imports
|
+-- ESLint available?
|   +-- @feature-sliced/eslint-config available? -> use it (standard choice)
|   +-- Not available? -> import/no-restricted-paths + import/no-internal-modules
|
+-- Want file structure linting (beyond imports)?
|   +-- Use Steiger (dedicated FSD architecture linter, checks structure + naming)
|
+-- None of the above?
    +-- Grep-based CI script as safety net
```

Use multiple approaches for defense-in-depth. At minimum, configure path aliases so imports use `@/shared/ui` rather than relative paths.

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

- **frontend** -- component architecture, state management, styling that FSD organizes
- **react** / **vue** -- framework-specific patterns within FSD slices (RSC integration, App Router, Composition API)
- **javascript** -- path aliases, barrel file considerations, module resolution
- **architect** -- broader system design context when FSD is one part of a larger architecture

---

## References

- `references/placement-rules.md` -- edge case placement decisions (reusable-but-domain-specific, auth/permissions, global state, types, test utilities)
- `references/framework-integration.md` -- Next.js App Router, Nuxt, and framework-specific FSD adaptations
- `workflows/setup.md` -- step-by-step procedure for scaffolding a new FSD project
- `workflows/migration.md` -- incremental bottom-up migration from existing codebase to FSD
- `workflows/review.md` -- full compliance audit procedure with severity model and report template
