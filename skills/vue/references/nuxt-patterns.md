# Nuxt Patterns

Data fetching, server routes, middleware, modules, state management, and deployment patterns for Nuxt (4.x).

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
  transform: (response) => response.data, // shape the response
  pick: ['id', 'name', 'email'],           // reduce payload
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

```ts
// Cache for 60 seconds
const { data } = useFetch('/api/products', {
  getCachedData(key, nuxtApp) {
    const cached = nuxtApp.payload.data[key] || nuxtApp.static.data[key]
    if (!cached) return null
    // Return cached if less than 60s old
    const expiresAt = new Date(cached.fetchedAt).getTime() + 60_000
    if (Date.now() < expiresAt) return cached
    return null
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

```ts
// server/api/users/index.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event) // { page: '1', limit: '20' }
  const users = await db.users.findMany({
    skip: (Number(query.page) - 1) * Number(query.limit),
    take: Number(query.limit),
  })
  return { data: users, total: await db.users.count() }
})

// server/api/users/index.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  // Validate with zod
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      data: parsed.error.issues,
    })
  }
  const user = await db.users.create({ data: parsed.data })
  setResponseStatus(event, 201)
  return user
})

// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = await db.users.findUnique({ where: { id } })
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })
  return user
})
```

### Server Middleware

```ts
// server/middleware/auth.ts — runs on every server request
export default defineEventHandler((event) => {
  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (event.path.startsWith('/api/admin') && !token) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (token) {
    event.context.user = verifyToken(token)
  }
})
```

---

## Route Middleware

### Client-Side Middleware

```ts
// middleware/auth.ts — named middleware
export default defineNuxtRouteMiddleware((to, from) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})

// middleware/admin.ts
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
// middleware/analytics.global.ts — .global suffix = runs on every route
export default defineNuxtRouteMiddleware((to) => {
  trackPageView(to.fullPath)
})
```

---

## State Management

### useState — SSR-Safe Shared State

```ts
// composables/useCounter.ts
export function useCounter() {
  // useState creates SSR-safe, cross-component shared state
  const count = useState<number>('counter', () => 0)
  const increment = () => count.value++
  return { count, increment }
}
```

**Key difference from ref:** `useState` is serialized during SSR and hydrated on the client. Plain `ref` would reset on hydration.

### Pinia in Nuxt

```ts
// stores/user.ts — auto-imported by @pinia/nuxt module
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
