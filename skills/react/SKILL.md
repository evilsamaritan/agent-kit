---
name: react
description: "Build or review React. Use for hooks, effects, state ownership, Suspense, Server Components, server functions, and React data flow."
user-invocable: true
---

# React

Determine the project's React version and framework first (`package.json` or lockfile, framework config). Feature availability by version is in [hooks-patterns.md](references/hooks-patterns.md#react-version-notes). RSC is a React feature, not tied to one framework.

---

## Hooks

**Rules (enforced by the linter and compiler):** call hooks at the top level of a component or custom hook — never in conditions, loops, or nested functions. `use` is the exception: it may be called conditionally.

| Hook | Purpose | When to use |
|------|---------|-------------|
| `useState` / `useReducer` | Local state | Simple values / multi-field transitions |
| `useEffect` | Synchronize with an external system | Subscriptions, timers, non-React widgets, DOM APIs |
| `useEffectEvent` | Read the latest props/state inside an effect without re-running it | Handler called from an effect that must not re-subscribe |
| `useSyncExternalStore` | Subscribe to a store outside React | External stores, browser state (online, media query) |
| `useRef` | Mutable value that does not re-render | DOM nodes, timers, previous values |
| `useMemo` / `useCallback` | Memoize | Only when profiling shows a cost, or for referential stability a child depends on |
| `useContext` | Read context | Low-frequency values: theme, locale, session |
| `useId` | Stable ID | Label/ARIA pairing |
| `useTransition` / `useDeferredValue` | Keep UI responsive | Non-urgent updates, deferred expensive renders |
| `useOptimistic` | Show expected state until the server confirms | Mutations with a likely outcome |
| `useActionState` | Form action result and pending state | Forms with actions |
| `use` | Read a promise or context during render | Suspense-based data, conditional context |

**Effects.** An effect has a reason: synchronize with something outside React. It needs cleanup (unsubscribe, clear timer, abort the request) and complete dependencies. If the value is only needed to compute rendering, it is not an effect. If an effect must read the latest value without re-subscribing, use `useEffectEvent`.

**Memoization.** If the React Compiler is enabled (check the build config), manual `useMemo`/`useCallback` is rarely needed; otherwise add it after measuring.

**Custom hooks.** `use` prefix; one purpose; return a single value directly, a pair as a tuple, three or more as a named object. A hook that subscribes to something must clean up. Patterns and testing → [hooks-patterns.md](references/hooks-patterns.md).

---

## Server Components and Client Components

| | Server Component | Client Component |
|---|---|---|
| **Directive** | None (default under RSC) | `"use client"` at the top of the file |
| **Runs on** | Server only | Server (SSR) and client |
| **Can use** | `async/await`, databases, files, secrets | Hooks, event handlers, browser APIs |
| **Client JS** | None | Included in the bundle |

- Default to a Server Component. Add `"use client"` only for interactivity or browser APIs, and push the boundary down to the smallest interactive leaf.
- A Server Component fetches and passes serializable props down. Client Components receive Server Components as `children` or props; they cannot import them.
- Props crossing the boundary must be serializable (no functions, class instances, symbols).

Directives, serialization, data fetching, composition → [rsc-patterns.md](references/rsc-patterns.md).

### Server functions are public endpoints

A `"use server"` function is callable over HTTP by anyone who can reach the app, not only by your UI.

- **Re-derive the caller inside every server function** from the session or request context. Never accept a user ID, role, or tenant from the arguments.
- **Check authorization and validate input** inside the function; hiding the button is not a control. Details → `auth`, `security`.
- Keep `react-server-dom-*` and the framework on patched releases; see [rsc-patterns.md](references/rsc-patterns.md#server-functions).

```ts
"use server";

export async function updateProfile(formData: FormData) {
  const session = await requireSession();            // identity comes from the session
  const name = parseDisplayName(formData.get("name")); // validate, do not trust
  await db.user.update({ where: { id: session.userId }, data: { name } });
}
```

---

## Suspense

Wrap each region that loads independently in its own boundary so the rest renders first; nest boundaries from page shell down to slow regions. Suspense works with `React.lazy`, async Server Components, `use()` on a promise, and data libraries that support it. Put an error boundary next to each Suspense boundary that can reject.

---

## Frameworks for RSC

Choose a framework that supports React Server Components if the project needs them, and check that framework's current RSC support before relying on it — support, versions, and APIs change between releases. Framework specifics (Next.js App Router, caching, revalidation) → [nextjs.md](references/nextjs.md).

---

## State management

Ownership rules (who owns server, URL, form, local, shared state) live in `frontend`. In React:

```
What kind of state?
├── Data from a server → the framework's data layer, `use` with Suspense,
│   or a server-state cache. Never copy it into a client store.
├── Should survive reload or be linkable → URL (router search params)
├── Draft values in a form → form state (`useActionState`, uncontrolled inputs,
│   or a form library); the server cache owns the result
├── One component's UI state → useState / useReducer
├── Low-frequency, wide reach (theme, locale, session) → Context
└── Client-only state read by distant components
    → one owner module exposing operations (`useSyncExternalStore`-based store);
      other code calls the operations (`development`: one writer)
```

Product examples (server-state caches, external stores) → [hooks-patterns.md](references/hooks-patterns.md#state-tool-examples).

---

## Anti-Patterns

1. **`useEffect` for derived state** — compute during render; memoize only if measured.
2. **`useEffect` for data fetching** — use the framework's data layer, Suspense, or a server-state cache; raw effects create waterfalls and race conditions (if unavoidable, abort on cleanup).
3. **Server data copied into a client store** — two caches that disagree.
4. **A shared store with many writers** — expose operations from one owner.
5. **Premature memoization** — measure first.
6. **Importing a Server Component from a Client Component** — pass it as `children`.
7. **Server function without a caller check** — see the rule above.
8. **Context for high-frequency values** — every consumer re-renders; use a store with selectors.
9. **Effect with missing dependencies or no cleanup** — stale closures and leaks.

---

## Related Knowledge

- `frontend` — state ownership, rendering strategy, UI verification
- `development` — one writer, explicit dependencies, async lifetime inside components
- `javascript` — types, generics for typed hooks and components
- `html`, `css` — semantic markup, layout, styling
- `accessibility` — ARIA, keyboard, focus management
- `web` — fetch, service workers, browser APIs
- `auth`, `security` — server function authorization, input trust
- `feature-sliced-design` — structuring a React app by layers

## References

- [hooks-patterns.md](references/hooks-patterns.md) — effect and subscription patterns, testing hooks, version notes, state tool examples
- [rsc-patterns.md](references/rsc-patterns.md) — framework-agnostic RSC: directives, serialization, data fetching, server functions, composition
- [nextjs.md](references/nextjs.md) — Next.js App Router specifics: file conventions, caching, revalidation, alternatives
