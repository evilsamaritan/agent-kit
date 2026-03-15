# Framework Integration

FSD is framework-agnostic, but specific frameworks require structural adaptations. This reference covers the most common integration patterns.

---

## Next.js App Router

Next.js App Router uses a file-based `app/` directory for routing, which conflicts with FSD's `app/` layer.

### Recommended structure

Keep FSD layers in `src/`. The Next.js `app/` directory lives at the project root and imports from FSD layers:

```
project-root/
├── app/                          # Next.js App Router (routing only)
│   ├── layout.tsx                # Root layout -- imports from src/app/
│   ├── page.tsx                  # Imports from src/pages/home/
│   ├── dashboard/
│   │   └── page.tsx              # Imports from src/pages/dashboard/
│   └── api/                      # Next.js API routes (not FSD)
└── src/                          # FSD lives here
    ├── app/                      # FSD app layer: providers, global styles
    ├── pages/                    # FSD pages: compositions for each route
    ├── widgets/
    ├── features/
    ├── entities/
    └── shared/
```

### Key rules

- Next.js `app/` directory pages are thin wrappers -- they import and re-export FSD page compositions from `src/pages/`
- Server Components are the default in `app/` -- use `'use client'` directive only where needed (interactive features, browser APIs)
- Server-side data fetching belongs in FSD `api/` segments -- pass data down as props from server components
- Place RSC-specific data loaders alongside their slice in `api/` segment, not in Next.js route files
- Cache boundaries align with slice boundaries -- each slice's `api/` segment controls its own caching

### Server/client boundary in FSD

```
Layer     | Typically server     | Typically client
----------|---------------------|-----------------
app/      | Layout, providers   | Theme toggle, auth context
pages/    | Page shell, data    | Interactive sections
widgets/  | Static widgets      | Interactive widgets
features/ | Data mutations      | Forms, interactive UI
entities/ | Data types, API     | Entity UI components
shared/   | Utils, config       | UI kit components
```

The boundary is per-component, not per-layer. A feature slice may have both server and client components in its `ui/` segment.

---

## Nuxt 3

Nuxt uses `pages/` for file-based routing, conflicting with FSD's `pages/` layer.

### Recommended structure

```
project-root/
├── pages/                        # Nuxt routing (thin wrappers)
│   ├── index.vue                 # Imports from src/pages/home/
│   └── dashboard.vue             # Imports from src/pages/dashboard/
└── src/                          # FSD layers
    ├── app/
    ├── pages/
    ├── widgets/
    ├── features/
    ├── entities/
    └── shared/
```

Configure `srcDir` in `nuxt.config.ts` if needed, or use path aliases to reference FSD layers.

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
