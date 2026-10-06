# React Server Components Patterns

Framework-agnostic RSC. Framework-specific behavior (routing, caching, revalidation) is in [nextjs.md](nextjs.md). The Server versus Client comparison and the server-function authorization rule are in SKILL.md.

## Contents

- [Core concepts](#core-concepts)
- [Directives and boundaries](#directives-and-boundaries)
- [Serialization rules](#serialization-rules)
- [Data fetching](#data-fetching)
- [Server functions](#server-functions)
- [Streaming and composition](#streaming-and-composition)

---

## Core concepts

React Server Components render ahead of time in an environment separate from the client app, at build time or per request. Benefits: no client JavaScript for server-only components, direct access to server resources (database, filesystem, secrets), `async/await` in render, and automatic code splitting at the client boundary. Any framework that implements the RSC protocol provides them.

---

## Directives and boundaries

**`"use client"`** marks a file as a client entry point. It is a module-level boundary: everything the file exports ships to the client, and everything it imports becomes client code too.

**`"use server"`** marks functions as server functions callable from client code. It is not the directive for Server Components, which have no directive.

- Server Components may import Client Components; Client Components cannot import Server Components.
- Client Components may render Server Components received as `children` or props.
- A server function is a client-to-server RPC boundary: treat every argument as untrusted input.

```tsx
"use client";
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

---

## Serialization rules

Values crossing the server/client boundary must be serializable.

**Can cross:** strings, numbers, booleans, `null`, `undefined`, `bigint`, plain objects and arrays, `Date`, `Map`, `Set`, typed arrays and `ArrayBuffer`, `FormData` (as a server function argument), promises (read with `use()` on the client), JSX elements (as props from a Server to a Client Component, not as server function arguments), server function references, symbols registered with `Symbol.for`.

**Cannot cross:** functions and callbacks (except server function references), class instances, other symbols, DOM nodes, closures. Precompute on the server or call a server function instead.

```tsx
// Promise passed down and read on the client, so the server does not block on it
async function ServerParent() {
  const promise = db.fetch(); // not awaited
  return <ClientChild dataPromise={promise} />;
}
```

Send only the fields the client needs. A whole database row in props can leak columns the UI never shows.

---

## Data fetching

```tsx
// A Server Component reads its own data; identity comes from the request, not from props
async function Dashboard() {
  const session = await requireSession();
  const [stats, orders] = await Promise.all([
    getStats(session.userId),
    getRecentOrders(session.userId),
  ]);
  return <DashboardView stats={stats} orders={orders} />;
}
```

- **Fetch in parallel** (`Promise.all`) when requests are independent. **Stream** dependent regions behind Suspense instead of awaiting them in the parent.
- **`cache()` deduplicates** calls with the same arguments within one render pass:

```tsx
import { cache } from "react";
const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }));
// UserName and UserAvatar both call getUser(id); one query runs.
```

- Authorization belongs in the data-access function that reads the data, not only in the component, so every caller is covered.

---

## Server functions

A server function is a public HTTP endpoint (see the rule in SKILL.md). Each one re-derives the caller, checks authorization on the specific record, and validates its input with a schema.

```tsx
// actions.ts
"use server";
import { z } from "zod";

const Schema = z.object({ title: z.string().min(1).max(200), content: z.string().min(1) });

export async function createPost(_prev: unknown, formData: FormData) {
  const session = await requireSession();
  if (!can(session, "post:create")) return { error: "forbidden" };
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const post = await db.post.create({ data: { ...parsed.data, authorId: session.userId } });
  // Revalidate through the framework's mechanism
  return { id: post.id };
}
```

```tsx
"use client";
import { useActionState } from "react";
import { createPost } from "./actions";

function NewPostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null);
  return (
    <form action={formAction}>
      <input name="title" required />
      {state?.fieldErrors?.title && <p role="alert">{state.fieldErrors.title}</p>}
      <textarea name="content" required />
      <button disabled={isPending}>{isPending ? "Creating..." : "Create"}</button>
    </form>
  );
}
```

For optimistic UI, call `useOptimistic`'s setter inside the action's transition; the optimistic value reverts when the action settles.

**Security upkeep.** The RSC protocol packages (`react-server-dom-webpack`, `-turbopack`, `-parcel`) deserialize untrusted request bodies. A 2025 flaw (CVE-2025-55182) allowed unauthenticated remote code execution through server function endpoints; it was fixed in 19.0.1, 19.1.2, and 19.2.1 and later. Keep these packages and the framework on a patched release of the project's minor line, and follow the framework's security advisories. Input handling and secrets → `security`; sessions and policy → `auth`.

---

## Streaming and composition

### Progressive loading

```tsx
function Page() {
  return (
    <div>
      <Header />
      <Suspense fallback={<HeroSkeleton />}><HeroSection /></Suspense>
      <Suspense fallback={<GridSkeleton />}><FeaturedProducts /></Suspense>
      <Footer />
    </div>
  );
}
```

### Server Components as children

Interactive wrappers receive server-rendered content as `children`, so the content stays out of the client bundle and does not re-render with the wrapper's state.

```tsx
"use client";
function Sidebar({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <aside className={isOpen ? "open" : "closed"}>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && children}
    </aside>
  );
}

async function Layout() {
  return <Sidebar><NavigationLinks /></Sidebar>;
}
```
