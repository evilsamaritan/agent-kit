# Framework Integration

FSD is framework-agnostic, but specific frameworks require structural adaptations. This reference covers the most common integration patterns.

---

## Next.js

Next.js reserves `app/` (App Router) and `pages/` (Pages Router), in the project root or in `src/`, and FSD has layers with the same names. The official FSD guidance is to rename **both** FSD layers to `_app` and `_pages`, whichever router the project uses, and to keep the Next.js routing folder separate, with the Next.js routing folder in the project root and `src/` holding only FSD code (the root placement is the guide's suggestion, not a requirement).

### Recommended structure

```
project-root/
├── app/                          # Next.js App Router (routing only)
│   ├── layout.tsx                # Root layout -- imports from src/_app/
│   ├── page.tsx                  # Re-exports from src/_pages/home/
│   ├── dashboard/
│   │   └── page.tsx              # Re-exports from src/_pages/dashboard/
│   └── api/                      # Route handlers (not FSD)
└── src/                          # FSD lives here
    ├── _app/                     # FSD app layer: providers, global styles
    ├── _pages/                   # FSD pages layer: compositions for each route
    ├── widgets/
    ├── features/
    ├── entities/
    └── shared/
```

With the Pages Router the Next.js `pages/` folder stays in the project root with thin route files that re-export from `src/_pages/`.

### Key rules

- Next.js route files are thin wrappers that import and re-export FSD page compositions.
- The layer-order and import rules are unchanged; only the directory names differ. Map `_app` and `_pages` to the `app` and `pages` layers in the linter and in review checks (`workflows/review.md` commands use the plain names; substitute them).
- Server Components are the default in the App Router: use `'use client'` only where needed (interactive features, browser APIs).
- Server-side data fetching belongs in FSD `api/` segments; pass data down as props from server components.
- Cache boundaries align with slice boundaries: each slice's `api/` segment controls its own caching.
- Server functions in any slice are public endpoints that must authorize the caller (`react`).

### Server/client boundary in FSD

```
Layer     | Typically server     | Typically client
----------|---------------------|-----------------
_app/     | Layout, providers   | Theme toggle, auth context
_pages/   | Page shell, data    | Interactive sections
widgets/  | Static widgets      | Interactive widgets
features/ | Data mutations      | Forms, interactive UI
entities/ | Data types, API     | Entity UI components
shared/   | Utils, config       | UI kit components
```

The boundary is per-component, not per-layer. A feature slice may have both server and client components in its `ui/` segment.

---

## Nuxt

Nuxt reads routes from a `pages/` directory inside its source directory, which collides with the FSD `pages` layer. Nuxt 4 uses `app/` as the default source directory (Nuxt 3 used the project root). Keep Nuxt's routing separate from the FSD layers. The FSD Nuxt guide offers two ways: define routes in code with config-based routing, or point Nuxt's pages directory at a routes folder inside `src/app` (`dir.pages`). That guide was written for the Nuxt 3 layout, so adapt it to the `app/` source directory.

### Recommended structure

```
project-root/
├── app/                          # Nuxt 4 source directory
│   ├── pages/
│   │   ├── index.vue             # Thin route: renders the FSD page from src/pages/home/
│   │   └── dashboard.vue
│   └── app.vue
├── server/                       # Nuxt server routes
└── src/                          # FSD layers
    ├── app/
    ├── pages/
    ├── widgets/
    ├── features/
    ├── entities/
    └── shared/
```

Route files import the page component from `src/pages/<name>/` (import through the built-in root alias, for example `~~/src/pages/home`, or define a new alias such as `#fsd` in `nuxt.config.ts`; do not reassign `@` or `~`, which Nuxt points at the source directory; Nuxt does not auto-import from `src/`, so imports stay explicit). An alternative from the official guide points `dir.pages` at a routes folder inside the FSD app layer (`src/app/routes`). For a Nuxt 3 project with the root `pages/`, the same thin-route approach applies.

---

## Vite (React, Vue, Svelte, Solid)

No structural conflicts. Standard FSD structure under `src/`:

```
src/
├── app/
├── pages/
├── widgets/
├── features/
├── entities/
└── shared/
```

Configure `resolve.alias` in `vite.config.ts` for clean imports:

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

---

## Monorepo (Turborepo, Nx, pnpm workspaces)

FSD applies per-application within the monorepo. Shared packages map to `shared/`:

```
packages/
├── ui/                           # Maps to shared/ui across apps
├── config/                       # Maps to shared/config across apps
└── utils/                        # Maps to shared/lib across apps
apps/
├── web/
│   └── src/                      # Full FSD structure
│       ├── app/
│       ├── pages/
│       ├── features/
│       ├── entities/
│       └── shared/               # App-specific shared + imports from packages/
└── admin/
    └── src/                      # Separate FSD structure
```

Cross-app imports follow the same downward rule. Workspace packages act as external `shared/` -- they must remain domain-free.
