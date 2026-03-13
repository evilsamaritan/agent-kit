---
name: fsd
description: Apply Feature-Sliced Design (FSD) architecture. Use when organizing project structure, deciding where code belongs, auditing imports, setting up FSD, migrating to FSD, or reviewing FSD compliance. Triggers on "where does this code go", "FSD structure", "feature-sliced", "cross-slice import", "layer violation".
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, WebSearch, WebFetch
---

# Feature-Sliced Design

You ANALYZE, DESIGN, IMPLEMENT, and REVIEW Feature-Sliced Design project structures. You write and modify code to set up, migrate, and enforce FSD architecture.

Framework-agnostic architecture methodology for frontend projects. Works with React, Vue, Svelte, Angular, Solid, or any component-based framework. Layer isolation enforced by import rules.

## The Four Hard Rules

1. **Import only downward** — a layer may only import from layers below it. No upward imports. Ever.
2. **No cross-slice imports** — slices within the same layer are isolated. `features/auth` cannot import from `features/cart`.
3. **No importing slice internals** — consumers import from the slice's public entry point, not from internal paths (`slice/model/store.ts`). The entry point is typically an `index` file, but some projects omit barrel exports due to bundler issues — in that case, enforcement shifts to linting rules or bundler aliases.
4. **Canonical segments only** — use standard segment names: `ui/`, `model/`, `api/`, `lib/`, `config/`. Non-canonical names are a CONCERN.

---

## Layer Map

| Layer | Dir | What belongs | Can import from |
|-------|-----|-------------|----------------|
| app | `app/` | Providers, routing, global styles, app init | All layers |
| pages | `pages/` | Route-level compositions, page components | widgets, features, entities, shared |
| widgets | `widgets/` | Standalone UI blocks (sidebar, header) | features, entities, shared |
| features | `features/` | User actions with business value (auth, checkout) | entities, shared |
| entities | `entities/` | Business domain objects (User, Product, Order) | shared |
| shared | `shared/` | Reusable infra, UI kit, utilities — zero domain knowledge | nothing (no upward imports) |

---

## Placement Decision Tree

```
Where does this code go?
│
├── No domain knowledge, reused everywhere?
│   └── shared/
│       ├── UI primitives, design tokens → shared/ui/
│       ├── HTTP client, third-party wrappers → shared/api/ or shared/lib/
│       └── Global constants, env config → shared/config/
│
├── Represents a business domain object (User, Order, Product)?
│   └── entities/<name>/
│       ├── Type/interface → entities/<name>/model/
│       ├── API calls for this entity → entities/<name>/api/
│       └── Domain UI (avatar, badge) → entities/<name>/ui/
│
├── Represents a user action / business feature (login, add-to-cart)?
│   └── features/<name>/
│       ├── Business logic, store slice → features/<name>/model/
│       ├── Feature UI (form, button) → features/<name>/ui/
│       └── Feature-specific API calls → features/<name>/api/
│
├── A standalone UI block (header, sidebar, feed)?
│   └── widgets/<name>/
│
├── A full page / route?
│   └── pages/<name>/
│
└── App-level bootstrap (router, providers, global styles)?
    └── app/
```

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

## Import Rule Enforcement

Enforce the four hard rules using one or more of these approaches (choose based on project tooling):

| Approach | Tool | When to use |
|----------|------|-------------|
| ESLint plugin | `@feature-sliced/eslint-config` | Standard choice for JS/TS projects with ESLint |
| Custom ESLint rule | `import/no-restricted-paths` or `import/no-internal-modules` | When `@feature-sliced/eslint-config` is unavailable |
| TypeScript paths | `tsconfig.json` `paths` + `baseUrl` | Enforce alias-based imports, prevent deep paths |
| Bundler aliases | Vite `resolve.alias`, webpack `resolve.alias` | Framework-level enforcement at build time |
| CI check | Grep-based script in CI pipeline | Last-resort enforcement for any project |

Use multiple approaches together for defense-in-depth. At minimum, configure path aliases so imports use `@/shared/ui` rather than relative paths.

---

## Common Violations

| Violation | Why it breaks | Fix |
|-----------|--------------|-----|
| `features/auth` imports `features/cart` | Cross-slice — creates coupling, breaks isolation | Extract shared data to `entities/` or `shared/` |
| `import { Button } from 'shared/ui/Button/Button'` | Bypasses public API | `import { Button } from 'shared/ui'` |
| `entities/user` imports `features/auth` | Upward import — entities can't know about features | Move auth logic up to `features/auth` |
| Business logic in `shared/` | Shared must be domain-free | Move to `entities/` or `features/` |
| `widgets/` in `features/` | Wrong layer — features are actions, not UI blocks | Move to `widgets/` if standalone, `pages/` if route-specific |
| Custom segment `helpers/` | Non-canonical name — reduces discoverability | Rename to `lib/` |

---

## Workflow Routing

| Task | Load |
|------|------|
| Set up a new FSD project | `workflows/setup.md` |
| Migrate existing codebase to FSD | `workflows/migrate.md` |
| Audit imports / check compliance | `workflows/review.md` |

---

## New Project?

FSD is framework-agnostic. When starting a new FSD project:

| Decision | Options | Recommendation |
|----------|---------|---------------|
| **Framework** | React, Vue, Svelte, Angular, Solid | Any component-based framework works |
| **Import enforcement** | @feature-sliced/eslint-config, custom ESLint, TS paths, bundler aliases | @feature-sliced/eslint-config for JS/TS |
| **Path aliases** | @/shared/*, @/entities/*, @/features/* | Configure via tsconfig paths + bundler |
| **Barrel exports** | Index files per slice | Use unless bundler has tree-shaking issues |

Read `workflows/setup.md` for the full scaffolding procedure.

---

## References

- `references/placement-rules.md` — edge case placement decisions (reusable-but-domain-specific, auth/permissions, global state, types, test utilities)
