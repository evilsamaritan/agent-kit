---
name: vue
description: Build Vue.js apps with Composition API, reactivity, Pinia, Vue Router, SFC patterns, Vapor mode. Use when working with Vue composables, reactivity, Pinia stores, Vue Router, SFC script setup, or Vapor mode. Do NOT use for HTML/CSS (use html-css) or web platform APIs (use web-platform).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Vue.js — Composition API & Ecosystem

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
│   │   └── Nuxt (most popular Vue meta-framework)
│   ├── Static docs or marketing site?
│   │   └── VitePress (Vite-powered, Markdown-first) or Nuxt Content
│   └── Want Angular-style conventions in Vue?
│       └── Analog.js (file-based routing, API routes, Angular-style DX)
│
├── Need cross-platform (desktop/mobile)?
│   └── Quasar (Material Design components + Electron + Capacitor + SSR)
│
└── Default → Vanilla Vue + Vite (add meta-framework only when needed)
```

Always ask the user before choosing. Present trade-offs, not mandates.

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

### Watchers

```ts
watch(source, (newVal, oldVal) => { ... })         // Lazy by default
watch([a, b], ([newA, newB]) => { ... })            // Multiple sources
watchEffect(() => { /* auto-tracks deps */ })       // Immediate, auto-track
watchPostEffect(() => { /* after DOM update */ })   // Post-flush timing
```

### Pinia Stores

| Style | When to Use |
|-------|-------------|
| **Setup store** (`defineStore('id', () => {...})`) | Complex logic, composable reuse, TypeScript inference |
| **Option store** (`defineStore('id', { state, getters, actions })`) | Simple CRUD, team familiarity with Options API |

Setup store is preferred for new code — it mirrors Composition API patterns. Pinia v3 dropped Vue 2 support and requires TypeScript 5+; no API changes — migration is a version bump.

### Vue Router

Vue Router 5 merges file-based routing (from unplugin-vue-router) into core. Typed routes and data loaders are built-in.

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

Nuxt 4 introduced `app/` directory structure, improved data fetching with smarter caching and abort control, and Vue Router 5 integration. Key APIs: `useFetch()`, `useAsyncData()`, `useState()`, file-based routing, auto-imports, `server/api/` routes. See [nuxt-patterns.md](references/nuxt-patterns.md) for full details.

### Vapor Mode (Experimental, Vue 3.6+)

Compiler-driven rendering — no virtual DOM. Components compile to direct DOM operations. Opt-in per component (`vapor: true`). Same Composition API, dramatically smaller runtime (base bundle under 10 KB). Vapor and VDOM components can coexist in the same component tree. Performance comparable to Solid and Svelte 5 in benchmarks.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Options API in new Vue 3 code | Misses Composition API benefits (reuse, TypeScript, tree-shaking) | Use `<script setup>` with Composition API |
| Mutating props directly | One-way data flow violation, silent failures | Emit event, let parent update |
| Making everything reactive | Unnecessary overhead, confusing reactivity tracking | Only wrap state that drives UI updates |
| Pinia actions for trivial mutations | Boilerplate for simple state changes | Direct store state mutation for simple cases |
| `watch` with `immediate: true` instead of `watchEffect` | More verbose, same behavior | Use `watchEffect` when auto-tracking is appropriate |
| String template refs instead of `useTemplateRef()` | Ambiguous naming, not composable-friendly | Use `useTemplateRef('name')` (Vue 3.5+) |
| `withDefaults(defineProps<T>(), {...})` for simple defaults | Verbose compared to reactive destructure | Use `const { x = default } = defineProps<T>()` (Vue 3.5+) |

---

## Related Knowledge

- **javascript** — Vue TypeScript integration, typed props, composable types
- **html-css** — semantic markup, layout, CSS features used in SFC styles
- **accessibility** — ARIA in Vue templates, keyboard handling
- **web-platform** — fetch API, service workers, browser APIs used alongside Vue
- **feature-sliced-design** — Feature-Sliced Design for Vue project structure
- **frontend** — cross-framework component, state, and performance patterns

## References

- [composition-patterns.md](references/composition-patterns.md) — Composition API, composables, lifecycle, provide/inject, TypeScript integration (works with any Vue setup)
- [nuxt-patterns.md](references/nuxt-patterns.md) — Nuxt data fetching, server routes, middleware, modules, deployment (load only when project uses Nuxt)

For other meta-frameworks (Quasar, VitePress, Analog), consult their official documentation — the Composition API patterns from `composition-patterns.md` apply universally.
