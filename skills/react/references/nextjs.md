# Next.js App Router Patterns

Framework-specific extension to [rsc-patterns.md](rsc-patterns.md). Checked 2026-10-06 against the Next.js 16 documentation; confirm the installed version first (`package.json`), since caching and routing APIs differ between 14, 15, and 16.

## Contents

- [File conventions](#file-conventions)
- [Caching and revalidation](#caching-and-revalidation)
- [Request APIs and the network boundary](#request-apis-and-the-network-boundary)
- [Routing patterns](#routing-patterns)
- [Other RSC frameworks](#other-rsc-frameworks)

---

## File conventions

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI (required for the route to exist) |
| `layout.tsx` | Persistent shared UI across navigation |
| `template.tsx` | Like layout but re-mounts on navigation |
| `loading.tsx` | Suspense fallback for the segment |
| `error.tsx` | Error boundary for the segment (a Client Component) |
| `not-found.tsx` | 404 UI |
| `route.ts` | HTTP endpoint (GET, POST, ...) |

---

## Caching and revalidation

Next.js 16 caches with **Cache Components**: the `"use cache"` directive works only when `cacheComponents` is enabled.

```ts
// next.config.ts
const nextConfig = { cacheComponents: true };
export default nextConfig;
```

```tsx
import { cacheLife, cacheTag } from "next/cache";

async function getProducts(category: string) {
  "use cache";
  cacheLife("hours"); // set the lifetime explicitly at every use-cache scope
  cacheTag("products");
  return db.product.findMany({ where: { category } });
}
```

- Cached scopes cannot read `cookies()`, `headers()`, or search params. Read them outside and pass values as arguments; arguments become part of the cache key.
- Never put per-user data in a shared cache entry. Include the user in the key through arguments, or do not cache it.

**Invalidation after a mutation:**

```tsx
"use server";
import { updateTag } from "next/cache";

export async function saveProduct(formData: FormData) {
  const session = await requireSession();            // re-derive the caller; see the server function rule in SKILL.md
  if (!can(session, "product:update")) throw new Error("Forbidden");
  await db.product.update(/* validated input */);
  updateTag("products");          // Server Actions only: expire now, so the caller reads its own write
}
```

Webhooks arrive at route handlers, not Server Actions. Never export a webhook trigger from a `"use server"` file: it becomes a public action anyone can call.

```ts
// app/api/webhooks/products/route.ts
import { revalidateTag } from "next/cache";

export async function POST(req: Request) {
  const body = await req.text();
  if (!verifySignature(body, req.headers.get("x-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }
  revalidateTag("products", "max"); // stale-while-revalidate; the second argument is required
  // revalidateTag("products", { expire: 0 }) expires immediately
  return new Response(null, { status: 204 });
}
```

- `revalidateTag(tag)` with one argument is deprecated; pass a profile (`"max"` recommended) or `{ expire: 0 }`.
- `updateTag` is for Server Actions; from route handlers or webhooks use `revalidateTag`.
- `revalidatePath("/posts")` invalidates a path rather than tagged data.
- Before 16 (or without `cacheComponents`), `fetch` options such as `next: { revalidate, tags }` and `cache: "no-store"` control caching per request; confirm the project's version before using them.

---

## Request APIs and the network boundary

- `params` and `searchParams` are promises in current versions; `await` them. `cookies()` and `headers()` are async too.
- `middleware.ts` was renamed `proxy.ts` in Next.js 16. Treat the proxy as a coarse gate (redirects, rewrites, headers); enforce authorization in data access and server functions, because proxies are bypassable by direct calls to other entry points.
- Server Actions are public endpoints; apply the rule in SKILL.md.

---

## Routing patterns

- **Parallel routes** (`@slot`) render several pages in one layout (dashboards, modals).
- **Intercepting routes** (`(.)`, `(..)`) show a route in the current context (a modal over a feed).
- **Route groups** (`(group)`) organize files without changing the URL.

---

## Other RSC frameworks

Other frameworks implement the RSC protocol with different routing and server-function APIs (for example Waku, React Router, TanStack Start). Their RSC support and maturity change quickly: read the framework's current documentation before choosing or relying on it. Everything in `rsc-patterns.md` applies; routing, caching, and invalidation do not carry over from this file.
