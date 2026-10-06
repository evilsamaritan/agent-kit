# Nuxt Patterns

Data fetching, server routes, middleware, modules, state management, and deployment patterns for Nuxt 4 (check the installed major version; paths below assume the `app/` source directory). Module names and presets are examples, not recommendations.

---

## Project Structure (Nuxt 4+)

Nuxt 4 uses `app/` directory for application code, separating it from config:

```
project/
├── app/
│   ├── components/       # Auto-imported components
│   ├── composables/      # Auto-imported composables
│   ├── layouts/          # Layout components
│   ├── middleware/        # Route middleware
│   ├── pages/            # File-based routes
│   ├── plugins/          # App plugins
│   ├── app.vue           # Root component
│   └── error.vue         # Error page
├── server/               # Server routes and middleware
├── public/               # Static assets
└── nuxt.config.ts
```

---

## Data Fetching

### useFetch vs useAsyncData

| Feature | `useFetch` | `useAsyncData` |
|---------|-----------|---------------|
| Purpose | Fetch from URL | Any async operation |
| Caching | By URL (auto-keyed) | By explicit key |
| SSR | Yes (serialized to client) | Yes |
| Reactivity | Watches URL/params changes | Manual `watch` option |
| Best for | API calls | DB queries, complex logic |

```vue
<script setup>
// useFetch — shorthand for URL-based fetching
const { data: users, status, error, refresh } = useFetch('/api/users', {
  query: { page: 1, limit: 20 },
  // The route returns { data, total }; shape it and reduce the payload here.
  // pick: ['data', 'total'] is the lighter option when no reshaping is needed.
  transform: (response) => response.data.map(({ id, name, email }) => ({ id, name, email })),
})

// useAsyncData — for non-URL async operations
const { data: stats } = useAsyncData('dashboard-stats', () => {
  return $fetch('/api/stats', { headers: useRequestHeaders(['cookie']) })
})

// Lazy loading — don't block navigation
const { data, status } = useLazyFetch('/api/heavy-data')
// status: 'idle' | 'pending' | 'success' | 'error'
</script>

<template>
  <div v-if="status === 'pending'">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>{{ users }}</div>
</template>
```

### Caching & Revalidation

By default the cached value is only the hydrated payload. To expire it, record when it was fetched with `transform` and compare in `getCachedData`:

```ts
// Reuse the cached response for 60 seconds
const { data } = useFetch('/api/products', {
  transform(response) {
    return { ...response, fetchedAt: Date.now() }   // nothing else sets fetchedAt
  },
  getCachedData(key, nuxtApp, ctx) {
    if (ctx.cause === 'refresh:manual') return undefined   // an explicit refresh() always refetches
    const cached = nuxtApp.payload.data[key] || nuxtApp.static.data[key]
    if (!cached) return undefined
    return Date.now() - cached.fetchedAt < 60_000 ? cached : undefined
  },
})

// Manual refresh
const { data, refresh } = useFetch('/api/data')
await refresh() // re-fetches from server
```

---

## Server Routes

### File-Based API Routes

```
server/
├── api/
│   ├── users/
│   │   ├── index.get.ts       → GET /api/users
│   │   ├── index.post.ts      → POST /api/users
│   │   └── [id].get.ts        → GET /api/users/:id
│   └── health.ts              → GET /api/health (all methods)
├── middleware/
│   └── auth.ts                → Server middleware (runs on every request)
└── utils/
    └── db.ts                  → Shared server utilities
```

### Server Route Patterns

Every server route is a public HTTP endpoint: authenticate the caller, authorize the action on the specific record, and validate and bound every input there. Route middleware on the client (below) is navigation UX, not a security control. Details → `auth`, `api-design`, `security`.

```ts
// server/api/users/index.get.ts
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),   // clamp page size
})

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event)                // example helper in server/utils: throws 401
  assertCan(caller, 'user:list')                         // example helper: throws 403
  const { page, limit } = await getValidatedQuery(event, querySchema.parse)
  const users = await db.users.findMany({ skip: (page - 1) * limit, take: limit })
  return { data: users, total: await db.users.count() }
})

// server/api/users/index.post.ts
export default defineEventHandler(async (event) => {
  const caller = await requireUser(event)
  assertCan(caller, 'user:create')
  const parsed = createUserSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, data: parsed.error.issues })
  }
  const user = await db.users.create({ data: parsed.data })
  setResponseStatus(event, 201)
  return user
})

// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const caller = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing id' })
  const user = await db.users.findUnique({ where: { id } })
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })
  assertCanRead(caller, user)                            // per-record check, not only a role check
  return user
})
```

### Server Middleware

```ts
// server/middleware/auth.ts — runs on every server request
export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'authorization')?.replace(/^Bearer /, '')
  if (token) {
    event.context.user = await verifyToken(token)   // verify signature, expiry, audience; throws on failure
  }
})
```

Middleware only identifies the caller. Routes still authorize (`requireUser` and a policy check), so a route added later cannot be public by accident.

---

## Route Middleware

### Client-Side Middleware

Route middleware decides where the user is sent. It does not protect data: the server routes behind the page must enforce access themselves.

```ts
// app/middleware/auth.ts — named middleware
export default defineNuxtRouteMiddleware((to, from) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})

// app/middleware/admin.ts
export default defineNuxtRouteMiddleware((to) => {
  const { user } = useUserSession()
  if (user.value?.role !== 'admin') {
    return abortNavigation() // or navigateTo('/forbidden')
  }
})
```

```vue
<!-- Apply to specific pages -->
<script setup>
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})
</script>
```

### Global Middleware

```ts
// app/middleware/analytics.global.ts — .global suffix = runs on every route
export default defineNuxtRouteMiddleware((to) => {
  trackPageView(to.fullPath)
})
```

---

## State Management

### useState — SSR-Safe Shared State

```ts
// app/composables/useCounter.ts
export function useCounter() {
  // useState creates SSR-safe, cross-component shared state
  const count = useState<number>('counter', () => 0)
  const increment = () => count.value++
  return { count, increment }
}
```

**Key difference from ref:** `useState` is serialized during SSR and hydrated on the client. Plain `ref` would reset on hydration.

### Pinia in Nuxt

Keep Pinia for client state with one owner; server data stays in `useFetch`/`useAsyncData`.

```ts
// app/stores/user.ts — auto-imported by the @pinia/nuxt module
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => !!user.value)

  async function login(credentials: Credentials) {
    user.value = await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
  }

  function logout() {
    user.value = null
    navigateTo('/login')
  }

  return { user, isLoggedIn, login, logout }
})
```

---

## Configuration Patterns

### Runtime Config

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Server-only (not exposed to client)
    dbUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,

    // Client-accessible (also available on server)
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:3000',
      appName: 'My App',
    },
  },
})

// Usage in server routes
const config = useRuntimeConfig()
console.log(config.dbUrl) // server-only

// Usage in components
const config = useRuntimeConfig()
console.log(config.public.apiBase) // client-accessible
```

### App Config (Build-Time)

```ts
// app.config.ts — reactive, replaceable at build time, no env vars
export default defineAppConfig({
  theme: {
    primaryColor: '#3B82F6',
  },
  ui: {
    button: { rounded: 'rounded-lg' },
  },
})

// Usage
const appConfig = useAppConfig()
```

---

## Module Patterns

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxt/image',
    'nuxt-auth-utils',
  ],

  // Module-specific configuration
  image: {
    quality: 80,
    formats: ['webp', 'avif'],
  },
})
```

---

## Deployment Patterns

### Presets

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  // Auto-detected in most cases, or set explicitly:
  nitro: {
    preset: 'node-server',   // Default: Node.js server
    // preset: 'cloudflare-pages',
    // preset: 'vercel',
    // preset: 'netlify',
    // preset: 'bun',
  },
})
```

| Preset | Output | Use Case |
|--------|--------|----------|
| `node-server` | Standalone Node server | VPS, Docker, any Node host |
| `vercel` | Serverless functions | Vercel deployment |
| `cloudflare-pages` | Workers + Pages | Edge deployment |
| `static` | Pre-rendered HTML | JAMstack, static hosting |
| `bun` | Bun server | Bun runtime |

### Static Generation (SSG)

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  // Pre-render all routes at build time
  routeRules: {
    '/': { prerender: true },
    '/blog/**': { prerender: true },
    '/api/**': { cors: true },
    '/admin/**': { ssr: false },  // client-only (SPA mode)
  },
})
```

### Hybrid Rendering

```ts
// nuxt.config.ts — mix SSR, SSG, SPA, and ISR per route
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },                          // SSG
    '/blog/**': { isr: 3600 },                         // ISR: revalidate every hour
    '/dashboard/**': { ssr: false },                   // SPA (client-only)
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },
})
```

---

## Error Handling

```vue
<!-- error.vue — global error page -->
<script setup>
const props = defineProps<{ error: { statusCode: number; message: string } }>()

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div>
    <h1>{{ error.statusCode }}</h1>
    <p>{{ error.message }}</p>
    <button @click="handleError">Go Home</button>
  </div>
</template>
```

```vue
<!-- Component-level error boundary -->
<template>
  <NuxtErrorBoundary>
    <SomeComponent />
    <template #error="{ error, clearError }">
      <p>Something went wrong: {{ error.message }}</p>
      <button @click="clearError">Retry</button>
    </template>
  </NuxtErrorBoundary>
</template>
```
