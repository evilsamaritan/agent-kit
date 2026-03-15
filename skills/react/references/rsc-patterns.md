# React Server Components Patterns

## Contents

- [RSC Core Concepts](#rsc-core-concepts)
- [Server vs Client Decision](#server-vs-client-decision)
- [Directives and Boundaries](#directives-and-boundaries)
- [Serialization Rules](#serialization-rules)
- [Data Fetching Patterns](#data-fetching-patterns)
- [Server Actions](#server-actions)
- [Streaming and Composition](#streaming-and-composition)
- [Next.js App Router Specifics](#nextjs-app-router-specifics)
- [Alternative RSC Frameworks](#alternative-rsc-frameworks)

---

## RSC Core Concepts

React Server Components are a **React feature**, not a Next.js feature. RSC lets components render ahead of time, in an environment separate from the client app — either at build time or per-request on a server. Any framework implementing the RSC protocol gets these capabilities.

**Core benefits:** zero client JS for server components, direct server resource access (DB, filesystem, secrets), async/await in render, automatic code splitting at the boundary.

---

## Server vs Client Decision

```
Is this component interactive?
├── Yes (clicks, input, state, effects) → "use client"
└── No
    ├── Does it fetch data? → Server Component (direct DB/API)
    ├── Does it use browser APIs? → "use client"
    └── Static display? → Server Component (zero JS)
```

Default to Server Component. Only add `"use client"` when the component needs interactivity. Push the boundary as deep as possible. See SKILL.md for the Server vs Client comparison table.

---

## Directives and Boundaries

**`"use client"`** — Marks a file as a Client Component entry point. This is a module-level boundary: every export from this file ships to the client.

**`"use server"`** — Marks functions as Server Functions (callable from Client Components, execute on server). NOT the directive for Server Components — they have no directive.

**Boundary rules:**
- `"use client"` creates a server-to-client boundary at the module level
- Server Components can import Client Components, but not vice versa
- Client Components can render Server Components received as `children` or props
- Server Functions (`"use server"`) create a client-to-server RPC boundary

```tsx
"use client";
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

// Server Function — separate file
"use server";
export async function updateProfile(formData: FormData) {
  await db.user.update({ where: { id: userId }, data: { name: formData.get("name") as string } });
}
```

---

## Serialization Rules

Props crossing the server/client boundary must be serializable.

**Can cross:** `string`, `number`, `boolean`, `null`, `undefined`, `bigint`, plain objects/arrays, `Date`, `Map`, `Set`, `FormData` (as Server Function arg), `Promise` (await on client via `use()`), JSX/React elements, Server Function references (opaque markers).

**Cannot cross:** functions/callbacks, class instances, Symbols, DOM nodes, closures. Workaround: use Server Functions or precompute on server.

```tsx
// Valid: serializable props
async function ServerParent() {
  const data = await fetchData();
  return <ClientChild data={data} title="Hello" />;
}
// Valid: promise passed to client, awaited with use()
async function ServerParent() {
  const promise = db.fetch(); // NOT awaited
  return <ClientChild dataPromise={promise} />;
}
// Invalid: function cannot cross the boundary
async function ServerParent() {
  return <ClientChild onClick={() => {}} />;  // Will fail
}
```

---

## Data Fetching Patterns

### Direct Access and Parallel Fetching

```tsx
// Server Component — query database directly
async function UserProfile({ userId }: { userId: string }) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { posts: { take: 5, orderBy: { createdAt: "desc" } } },
  });
  if (!user) notFound();
  return <section><h2>{user.name}</h2><PostList posts={user.posts} /></section>;
}

// Parallel fetching — no waterfalls
async function Dashboard() {
  const [stats, orders, alerts] = await Promise.all([
    getStats(), getRecentOrders(), getNotifications(),
  ]);
  return <DashboardView stats={stats} orders={orders} alerts={alerts} />;
}
```

### Sequential with Suspense + Request Deduplication

```tsx
// Parallelize dependent data with Suspense boundaries
async function OrderDetails({ orderId }: { orderId: string }) {
  const order = await getOrder(orderId);
  return (
    <div>
      <OrderHeader order={order} />
      <Suspense fallback={<Skeleton />}>
        <CustomerInfo customerId={order.customerId} />
      </Suspense>
    </div>
  );
}

// React cache() — deduplicate across components in one render pass
import { cache } from "react";
const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }));
// Both call getUser("123") — only one DB query
async function UserName({ id }: { id: string }) { return <h1>{(await getUser(id)).name}</h1>; }
async function UserAvatar({ id }: { id: string }) { const u = await getUser(id); return <img src={u.avatar} />; }
```

---

## Server Actions

### Form Handling with Validation

```tsx
// actions.ts
"use server";
import { z } from "zod";

const Schema = z.object({ title: z.string().min(1).max(200), content: z.string().min(1) });

export async function createPost(formData: FormData) {
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };
  const post = await db.post.create({ data: parsed.data });
  // Framework-specific revalidation goes here
  return { success: true, id: post.id };
}
```

### useActionState + useOptimistic (React 19)

```tsx
"use client";
import { useActionState } from "react";
import { createPost } from "./actions";

function NewPostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null);
  return (
    <form action={formAction}>
      <input name="title" required />
      {state?.error?.title && <p className="error">{state.error.title}</p>}
      <textarea name="content" required />
      <button disabled={isPending}>{isPending ? "Creating..." : "Create"}</button>
    </form>
  );
}
```

```tsx
"use client";
import { useOptimistic } from "react";

function LikeButton({ liked, count }: { liked: boolean; count: number }) {
  const [optimistic, setOptimistic] = useOptimistic({ liked, count },
    (state, newLiked: boolean) => ({ liked: newLiked, count: state.count + (newLiked ? 1 : -1) }));
  return (
    <form action={async () => { setOptimistic(!optimistic.liked); await toggleLike(); }}>
      <button>{optimistic.liked ? "Unlike" : "Like"} ({optimistic.count})</button>
    </form>
  );
}
```

---

## Streaming and Composition

### Progressive Loading

```tsx
function Page() {
  return (
    <div>
      <Header />                                    {/* Instant */}
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />                             {/* Streams first */}
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton />}>
        <FeaturedProducts />                        {/* Streams second */}
      </Suspense>
      <Footer />                                    {/* Instant */}
    </div>
  );
}
```

### Server Components as Children (avoids re-render)

```tsx
"use client";
function Sidebar({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <aside className={isOpen ? "open" : "closed"}>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && children}  {/* Server Component — no re-render */}
    </aside>
  );
}

// Server parent composes it
async function Layout() {
  return <Sidebar><NavigationLinks /></Sidebar>;  {/* SC rendered on server, passed through */}
}
```

---

## Next.js App Router Specifics

> Everything above is framework-agnostic React. Below is Next.js-specific.

### File Conventions

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI (required for route to exist) |
| `layout.tsx` | Persistent shared UI across navigation |
| `loading.tsx` | Auto-wrapped Suspense fallback |
| `error.tsx` | Error boundary for route segment |
| `not-found.tsx` | 404 UI |
| `route.ts` | API endpoint (GET, POST, etc.) |
| `template.tsx` | Like layout but re-mounts on navigation |

### Revalidation

```tsx
import { revalidatePath, revalidateTag } from "next/cache";
revalidatePath("/posts");                                         // Path-based
revalidateTag("products");                                        // Tag-based

const data = await fetch(url, { next: { revalidate: 3600 } });   // Time-based
const data = await fetch(url, { next: { tags: ["products"] } }); // Tagged
const data = await fetch(url, { cache: "no-store" });             // No cache
```

### Caching (Next.js 16+)

```tsx
// "use cache" directive — replaces unstable_cache
async function getProducts(category: string) {
  "use cache";
  return db.product.findMany({ where: { category } });
}

// With cache profile for revalidation control
import { cacheLife, cacheTag } from "next/cache";
async function getProducts(category: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return db.product.findMany({ where: { category } });
}
```

### Routing Patterns

**Parallel routes** (`@slot`) — render multiple pages in same layout (dashboards, modals).
**Intercepting routes** (`(.)`, `(..)`) — show route in current context (modal over feed).
**Route groups** (`(group)`) — organize without affecting URL.

---

## Alternative RSC Frameworks

RSC is a React protocol, not a Next.js monopoly. These frameworks implement RSC with different philosophies.

### Waku

Minimal RSC framework by Daishi Kato (Zustand, Jotai). Built on Vite + Hono.

```tsx
// src/pages/index.tsx — file-based routing
export default async function HomePage() {
  const posts = await db.post.findMany();
  return <PostList posts={posts} />;
}
export const getConfig = async () => ({ render: "dynamic" }); // or "static"
```

- RSC-first, supports SSR and SSG, file-based routing under `src/pages/`
- Status: v1.0 alpha (API stable, focusing on bug fixes)

### TanStack Start

Full-stack framework from TanStack. Client-first with type-safe routing. RSC support is planned but not yet available.

```tsx
import { createServerFn } from "@tanstack/react-start";
const fetchPosts = createServerFn({ method: "GET" }).handler(async () => db.post.findMany());

export const Route = createFileRoute("/posts")({
  loader: () => fetchPosts(),
  component: PostsPage,
});
```

- Server functions via `createServerFn`, type-safe routing with `createFileRoute`
- Status: v1 stable. No RSC support yet (planned, client-first approach)

### Framework Comparison

| | Next.js 16 | Waku | TanStack Start |
|---|---------|------|----------------|
| RSC model | Server-first paradigm | Minimal RSC layer | Client-first, RSC planned (not yet available) |
| Routing | File-based App Router | File-based pages | Type-safe file routes |
| Server functions | `"use server"` | `"use server"` | `createServerFn` |
| Build tool | Turbopack (default) | Vite | Vite (via Vinxi) |
| Maturity | Production-ready | Alpha (not for production) | v1 stable (no RSC yet) |
