# Placement Rules: Edge Cases

Advisory reference for contested placement decisions. When the decision tree in SKILL.md is insufficient, consult this table.

---

## Placement Decision Table

| Scenario | Layer | Segment | Rationale |
|----------|-------|---------|-----------|
| Component reusable but domain-specific (e.g., `UserAvatar`) | `entities/<name>` | `ui/` | Domain-specific = not shared. Belongs to the entity it represents. |
| Code used in two or more features | `entities/` or `shared/` | `model/` or `lib/` | Never duplicate across features. Extract upward: `entities/` if domain-aware, `shared/` if domain-free. |
| Authorization / permissions logic | `entities/` | `model/` | Permissions are a domain concern tied to the User/Role entity, not a feature action. |
| Third-party SDK wrapper (e.g., Stripe, Sentry) | `shared/` | `api/` or `lib/` | Wrappers have no domain knowledge — they belong in `shared/`. `api/` for network calls, `lib/` for pure adapters. |
| Global state / store root | `entities/` (domain state) or `shared/` (domain-free) | `model/` | Store slices that describe domain objects belong in the owning entity. App-level state (UI theme, locale) belongs in `shared/config/` or `app/`. |
| Form validation schemas | Same layer as the form | `model/` | A schema follows its form. If the schema is reused across features, move to `entities/model/` (if domain-specific) or `shared/lib/` (if generic). |
| TypeScript types and interfaces | Same layer as the owning concept | `model/` | Types are not special — they belong to the slice that owns the concept. Don't create a `types/` layer. |
| Test utilities and test helpers | `shared/lib/` (shared helpers) or co-located | `lib/` | Generic test helpers (factories, matchers) → `shared/lib/`. Slice-specific test helpers → co-locate in the slice next to the code under test. |
| Environment constants and feature flags | `shared/config/` (app-wide) or `entities/<name>/config/` (domain-specific) | `config/` | `API_BASE_URL` → `shared/config/`. `MAX_CART_ITEMS` → `entities/cart/config/`. |
| React hooks with no UI (data-fetching, state) | Same layer as the feature or entity they serve | `model/` | Hooks are not special — classify by domain, not syntax. A hook that fetches users belongs in `entities/user/model/`. |
| React hooks shared across slices | Same rule as "used in two features" | `model/` | Extract to `entities/` or `shared/lib/` depending on domain awareness. |
| Error boundary components | `app/` (global) or `pages/<name>/ui/` (route-specific) | `ui/` | Global error boundaries belong in `app/`. Per-route error UIs belong in the page slice. |
| i18n / translation strings | `shared/config/` or `entities/<name>/config/` | `config/` | Shared strings → `shared/config/`. Entity-specific labels (e.g., order status labels) → `entities/order/config/`. |
| Router configuration | `app/` | direct (no segment) | Routing is app-level bootstrap. Not a feature, not an entity. |
| Global CSS / design tokens | `shared/` | `ui/` | Design tokens and global stylesheets are domain-free shared resources. |

---

## Rules That Override the Table

1. **"Reusable" does not mean `shared/`** — if it's reusable AND domain-specific, it belongs in `entities/`. `shared/` is for domain-free code only.
2. **Two features sharing code is a signal** — do not duplicate. The shared code almost always belongs in `entities/` (if domain) or `shared/` (if not).
3. **The owning layer is the lowest layer that can hold it** — if `shared/` can hold it (no domain knowledge required), it goes there. If it needs domain knowledge, it goes to `entities/`. If it needs business logic, it goes to `features/`.
4. **Types follow the concept, not the file type** — TypeScript interfaces describing a `Product` belong in `entities/product/model/`, not in a global `types/` directory.
