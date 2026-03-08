---
name: fsd
description: Apply Feature-Sliced Design (FSD) architecture. Use when organizing project structure, deciding where code belongs, auditing imports, setting up an FSD project from scratch, migrating existing code to FSD, or reviewing FSD compliance. Triggers on "where does this code go", "FSD structure", "feature-sliced", "cross-slice import", "layer violation".
allowed-tools: Read, Glob, Grep, Bash
---

# Feature-Sliced Design

Framework-agnostic architecture methodology. Layer isolation enforced by import rules.

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

## The Four Hard Rules

1. **Import only downward** — a layer may only import from layers below it. No upward imports. Ever.
2. **No cross-slice imports** — slices within the same layer are isolated. `features/auth` cannot import from `features/cart`.
3. **No importing slice internals** — consumers import from the slice's public entry point, not from internal paths (`slice/model/store.ts`). The entry point is typically an `index` file, but some projects omit barrel exports due to bundler issues — in that case, enforcement shifts to linting rules (e.g., `@feature-sliced/eslint-plugin`).
4. **Canonical segments only** — use standard segment names: `ui/`, `model/`, `api/`, `lib/`, `config/`. Non-canonical names are a CONCERN.

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
| `ui/` | React/Vue/Svelte components, styled elements |
| `model/` | State, stores, selectors, domain types/interfaces |
| `api/` | API request functions, data-fetching hooks |
| `lib/` | Pure utilities, helpers, formatters |
| `config/` | Constants, feature flags, environment bindings |

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

## References

- `references/placement-rules.md` — edge case placement decisions (reusable-but-domain-specific, auth/permissions, global state, types, test utilities)
