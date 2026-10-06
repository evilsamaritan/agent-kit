---
name: vue
description: "Build or review Vue. Use for Composition API, reactivity, composables, Pinia, Vue Router, SFCs, and Vapor mode."
user-invocable: true
---

# Vue.js — Composition API & Ecosystem

Determine the project's Vue version and meta-framework first (`package.json` or lockfile); several APIs below depend on the minor version. Version notes → [composition-patterns.md](references/composition-patterns.md#version-notes).

---

## Project Setup — Choosing Your Stack

### Project Setup Decision Tree

```
What are you building?
├── SPA, internal tool, or dashboard?
│   └── Vanilla Vue + Vite (full control, no framework overhead)
│
├── Need SSR or SSG for SEO?
│   ├── Full-stack with server routes, auto-imports, file-based routing?
│   │   └── Nuxt (Vue meta-framework with server routes and SSR)
│   └── Static docs or marketing site?
│       └── VitePress (Vite-powered, Markdown-first) or Nuxt Content
│
├── Need cross-platform (desktop/mobile)?
│   └── A cross-platform Vue framework (for example Quasar) — check that it
│       fits the target platforms before adopting
│
└── Default → Vanilla Vue + Vite (add meta-framework only when needed)
```

### Vanilla Vue + Vite Setup

Scaffold with `create-vue` (official scaffolding tool):

```bash
npm create vue@latest    # prompts for TypeScript, Router, Pinia, etc.
```

Standard `main.ts` entry point:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

Recommended project structure:

```
src/
├── components/        # Reusable UI components
├── composables/       # Shared composables (useX pattern)
├── views/             # Route-level page components
├── router/            # Vue Router configuration
├── stores/            # Pinia stores
├── assets/            # Static assets
├── App.vue
└── main.ts
```

TypeScript config essentials: `strict: true`, `moduleResolution: "bundler"`. Enforce type-checked builds with `vue-tsc --noEmit` before `vite build`.

---

## Key Concepts

### Composition API — ref vs reactive

| Feature | `ref()` | `reactive()` |
|---------|---------|--------------|
| Primitives | Yes | No |
| Objects | Yes (nested reactivity) | Yes |
| Destructurable | No (loses reactivity) | No (loses reactivity) |
| `.value` needed | Yes (in script) | No |
| Template unwrap | Automatic | N/A |
| Reassignable | Yes (`ref.value = newObj`) | No (use `Object.assign`) |

**Default choice:** `ref()` for everything. Use `reactive()` only for object-shaped state that is never reassigned.

### SFC `<script setup>` Compiler Macros

```vue
<script setup lang="ts">
// Props — reactive destructure (Vue 3.5+, stable)
const { title, count = 0 } = defineProps<{ title: string; count?: number }>()
// `title` and `count` are reactive — no .value, no lost reactivity

// Emits — type-safe events
const emit = defineEmits<{ update: [value: string]; close: [] }>()

// Two-way binding (Vue 3.4+)
const model = defineModel<string>()          // v-model
const named = defineModel<number>('count')   // v-model:count

// Template refs — useTemplateRef (Vue 3.5+)
const inputEl = useTemplateRef<HTMLInputElement>('input')

// Unique IDs — SSR-stable (Vue 3.5+)
const id = useId()  // e.g., for form label + input pairing

// Expose to parent via template ref
defineExpose({ reset, validate })
</script>
```

### Reactivity Utilities

| Utility | Purpose |
|---------|---------|
| `toRef(obj, 'key')` | Single reactive property from reactive object |
| `toRefs(obj)` | All properties as individual refs (safe destructure) |
| `toValue(refOrGetter)` | Unwrap ref, getter, or plain value |
| `shallowRef(val)` | Only `.value` assignment triggers (not deep) |
| `triggerRef(ref)` | Force trigger on shallowRef |
| `customRef(factory)` | Custom get/set with explicit trigger control |
| `readonly(obj)` | Deep readonly wrapper |
| `useTemplateRef(key)` | Type-safe template ref (Vue 3.5+) |
| `useId()` | SSR-stable unique ID (Vue 3.5+) |

### Composables — Convention

```ts
// useCounter.ts — "use" prefix, returns reactive state
export function useCounter(initial = 0) {
  const count = ref(initial)
  const increment = () => count.value++
  const reset = () => (count.value = initial)

  // Return plain object of refs (not reactive wrapper)
  return { count, increment, reset }
}
```

Rules:
- Name: `use` + PascalCase domain
- Accept refs or plain values as input (`toValue()` / `toRef()`)
- Return plain object of refs (allows destructuring)
- Side effects: register cleanup with `onScopeDispose()`
- Async work: abort or ignore a stale response when inputs change or the scope is disposed (pattern in `composition-patterns.md`)

### Watchers

```ts
watch(source, (newVal, oldVal) => { ... })         // Lazy by default
watch([a, b], ([newA, newB]) => { ... })            // Multiple sources
watchEffect(() => { /* auto-tracks deps */ })       // Immediate, auto-track
watchPostEffect(() => { /* after DOM update */ })   // Post-flush timing
```

Choose `watch` when the sources are explicit and you need old/new values or lazy start (`immediate: true` makes it run once at start). Choose `watchEffect` when every reactive read inside should be a dependency. They are not interchangeable: `watchEffect` tracks whatever the callback happens to read, including after refactors.

### Pinia Stores

| Style | When to Use |
|-------|-------------|
| **Setup store** (`defineStore('id', () => {...})`) | Complex logic, composable reuse, TypeScript inference |
| **Option store** (`defineStore('id', { state, getters, actions })`) | Simple CRUD, team familiarity with Options API |

Setup store is preferred for new code — it mirrors Composition API patterns.

**One writer.** A store owns its state and exposes actions that keep its invariants; components call actions instead of assigning store fields from many places. State that only one component uses stays in that component. Server data belongs in a data-fetching layer (`useFetch`/`useAsyncData` in Nuxt, or a server-state library), not copied into a store (`frontend`, `development`).

### Vue Router

Newer Vue Router releases fold file-based routing and typed routes (from unplugin-vue-router) into the core package; check the installed version before relying on them.

```ts
// Lazy-loaded routes
{ path: '/dashboard', component: () => import('./Dashboard.vue') }

// Navigation guards
router.beforeEach((to, from) => {
  if (to.meta.requiresAuth && !isAuthenticated()) return '/login'
})

// Route meta for layout/permissions
{ path: '/admin', meta: { layout: 'admin', requiresAuth: true } }
```

### Nuxt (when using Nuxt)

Nuxt: file-based routing, auto-imports, server routes, `useFetch`/`useAsyncData`/`useState`. Directory layout and data-fetching cache rules by version → [nuxt-patterns.md](references/nuxt-patterns.md).

### Vapor Mode

Compiler-driven rendering without a virtual DOM, opted into per component on `<script setup>`:

```vue
<script setup vapor>
// Composition API as usual
</script>
```

Needs `<script setup>` (no Options API). Vapor and virtual-DOM components can coexist through an interop plugin. Not part of a stable release by default: confirm the release channel and read the status in [composition-patterns.md](references/composition-patterns.md#version-notes) before recommending it for production.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Options API in new Vue 3 code | Misses Composition API benefits (reuse, TypeScript, tree-shaking) | Use `<script setup>` with Composition API |
| Mutating props directly | One-way data flow violation, silent failures | Emit event, let parent update |
| Making everything reactive | Unnecessary overhead, confusing reactivity tracking | Only wrap state that drives UI updates |
| Components assigning store state from many places | Several writers, invariants enforced nowhere | Expose actions that keep the invariants; trivial local UI state stays in the component |
| Server data copied into a store | Two caches that disagree | Let the data-fetching layer own it |
| String template refs instead of `useTemplateRef()` | Ambiguous naming, not composable-friendly | Use `useTemplateRef('name')` (Vue 3.5+) |
| `withDefaults(defineProps<T>(), {...})` for simple defaults | Verbose compared to reactive destructure | Use `const { x = default } = defineProps<T>()` (Vue 3.5+) |

---

## Related Knowledge

- **javascript** — Vue TypeScript integration, typed props, composable types
- **development** — one writer, explicit dependencies, async lifetime in composables
- **html**, **css** — semantic markup, layout, CSS features used in SFC styles
- **accessibility** — ARIA in Vue templates, keyboard handling
- **web** — fetch API, service workers, browser APIs used alongside Vue
- **feature-sliced-design** — Feature-Sliced Design for Vue project structure
- **frontend** — state ownership, rendering strategy, UI verification
- **auth**, **api-design** — server-side authorization and input validation for Nuxt server routes

## References

- [composition-patterns.md](references/composition-patterns.md) — composables (including async), reactivity, lifecycle, provide/inject, TypeScript, testing, version notes (works with any Vue setup)
- [nuxt-patterns.md](references/nuxt-patterns.md) — Nuxt data fetching, server routes, middleware, modules, deployment (load only when project uses Nuxt)

For other meta-frameworks (VitePress, Quasar), consult their official documentation — the Composition API patterns from `composition-patterns.md` apply universally.
