---
name: react
description: React expertise — hooks, Server Components, Suspense, RSC data flow, state management. Use when working with React hooks, Server Components, Suspense, server actions, or state management (Zustand, Jotai, TanStack Query). Do NOT use for HTML/CSS (use html-css) or web platform APIs (use web-platform).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# React

Expert-level React knowledge. Hooks, Server Components (framework-agnostic RSC patterns), modern state management. RSC is a React feature — not tied to any single framework.

---

## Hooks Rules & Patterns

**Rules (enforced by compiler/linter):**
1. Only call hooks at the top level — never inside conditions, loops, or nested functions
2. Only call hooks from React components or custom hooks

| Hook | Purpose | When to use |
|------|---------|-------------|
| `useState` | Local state | Component-scoped, simple values |
| `useReducer` | Complex local state | Multiple sub-values, state machines |
| `useEffect` | Side effects (sync with external system) | Subscriptions, DOM manipulation, timers |
| `useRef` | Mutable ref (no re-render) | DOM refs, previous values, instance vars |
| `useMemo` | Memoize computation | Expensive calculations, referential stability |
| `useCallback` | Memoize function | Stable callback for child components |
| `useContext` | Read context | Theme, auth, locale — low-frequency updates |
| `useId` | Stable unique ID | Form labels, ARIA attributes |
| `useTransition` | Non-urgent updates | Keep UI responsive during heavy renders |
| `useDeferredValue` | Defer re-render of value | Debounce-like behavior without timers |
| `useOptimistic` | Optimistic UI | Show expected state before server confirms |
| `useActionState` | Form actions state | Server action results + pending state |
| `use` | Read resource in render | Read promises, context — can be called conditionally (unlike other hooks) |

**When to memoize:** Only when profiling shows a performance problem. React Compiler (stable v1.0) auto-memoizes — manual `useMemo`/`useCallback` is rarely needed in Compiler-enabled projects.

---

## Custom Hooks

```typescript
// Convention: use* prefix, return tuple or object
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Composition — hooks calling hooks
function useSearch(query: string) {
  const debouncedQuery = useDebounce(query, 300);
  const { data, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchApi(debouncedQuery),
    enabled: debouncedQuery.length > 2,
  });
  return { results: data, isLoading };
}
```

**Return conventions:** Single value → return directly. Two values → tuple `[value, setter]`. Three+ → named object `{ data, isLoading, error }`.

---

## Server Components vs Client Components

| | Server Component | Client Component |
|---|---|---|
| **Directive** | None (default in RSC) | `"use client"` at top |
| **Runs on** | Server only | Server (SSR) + Client |
| **Can use** | `async/await`, DB, fs, env vars | Hooks, event handlers, browser APIs |
| **Bundle** | Zero JS sent to client | Included in JS bundle |
| **State** | None | `useState`, `useReducer` |
| **Re-renders** | Never | On state/prop change |

**Decision tree:**
1. Does it need interactivity (clicks, input, state)? → Client Component
2. Does it only display data? → Server Component
3. Does it fetch data? → Server Component (direct DB/API access, no waterfalls)
4. Mixed? → Server Component wrapper with Client Component children

**Composition pattern:** Server Component fetches data, passes to Client Component as props:

```tsx
// Server Component — fetches data
async function ProductPage({ id }: { id: string }) {
  const product = await db.product.findUnique({ where: { id } });
  return <ProductDetails product={product} />;  // Client Component
}
```

---

## Suspense Boundaries

```tsx
<Suspense fallback={<Skeleton />}>
  <AsyncComponent />       {/* Suspends while loading */}
</Suspense>

{/* Nested Suspense — progressive loading */}
<Suspense fallback={<PageSkeleton />}>
  <Header />
  <Suspense fallback={<ContentSkeleton />}>
    <MainContent />
    <Suspense fallback={<CommentsSkeleton />}>
      <Comments />
    </Suspense>
  </Suspense>
</Suspense>
```

**Suspense works with:** `React.lazy()`, RSC async components, `use()` with promises, data fetching libraries (TanStack Query, SWR).

---

## React 19.2 Features

**`<Activity>`** — controls subtree visibility and lifecycle. Two modes:
- `visible` — shows children, mounts effects, processes updates normally
- `hidden` — hides children, unmounts effects, defers updates until idle

Use for: pre-rendering offscreen routes, preserving state on navigation (back button retains form input), background data loading.

**`<ViewTransition>`** — declarative animation when DOM updates via `startTransition`, `useDeferredValue`, or Suspense reveal. Pairs with `<Activity>` for enter/exit animations on route changes.

```tsx
<ViewTransition>
  <Activity mode={isVisible ? "visible" : "hidden"}>
    <Panel />
  </Activity>
</ViewTransition>
```

**React Compiler v1.0** — build-time optimizing compiler. Auto-memoizes components and hooks, eliminating manual `useMemo`/`useCallback`. Supported in Next.js 16 (stable) and Expo SDK 54 (out of the box). For Vite projects, use `babel-plugin-react-compiler`.

---

## RSC Data Flow

```
Server Function → Mutation → Revalidation (framework-specific) → Re-render → Stream to Client
```

```typescript
// Server Function — "use server" directive (React feature, works across frameworks)
"use server";

async function updateProfile(formData: FormData) {
  const name = formData.get("name") as string;
  await db.user.update({ where: { id: userId }, data: { name } });
  // Revalidation is framework-specific:
  // Next.js: revalidatePath("/profile") or revalidateTag("profile")
  // Waku/TanStack Start: framework-managed invalidation
}
```

---

## Framework Integration

RSC is a React feature, not tied to any single framework. Current framework support:

```
Need RSC in production?
├── Yes → Next.js (only production-ready RSC framework)
├── Experimental RSC → Waku (alpha, not for production)
└── No RSC needed, want type-safe routing → TanStack Start (v1 stable, RSC planned)
```

Load `references/rsc-patterns.md` for framework-agnostic RSC core + Next.js App Router, Waku, TanStack Start specifics.

---

## State Management

**Decision tree:**
```
What kind of state?
├── Server/async data (fetching, caching, revalidation) → TanStack Query
├── Global client state
│   ├── Simple (few stores, selectors) → Zustand
│   └── Fine-grained (many independent atoms, derived state) → Jotai
├── Low-frequency global (theme, locale, auth) → React Context
└── Component-local → useState / useReducer
```

| Library | Model | Best for |
|---------|-------|----------|
| **TanStack Query** | Server state cache | Data fetching, caching, background refresh |
| **Zustand** | Single store, selectors | Global client state, simple API |
| **Jotai** | Atomic, bottom-up | Fine-grained reactive state, derived atoms |
| **Valtio** | Mutable proxy | Teams from Vue/MobX, simple mental model |
| **React Context** | Built-in | Low-frequency updates (theme, locale, auth) |

---

## Anti-Patterns

1. **`useEffect` for derived state** — compute during render instead; `useMemo` if expensive
2. **Prop drilling vs context abuse** — 2-3 levels is fine; context for truly global concerns only; Zustand/Jotai for shared client state
3. **Premature memoization** — profile first; React Compiler v1.0 handles most cases automatically
4. **Client Components wrapping Server Components** — loses server benefits; pass Server Components as `children` instead
5. **`useEffect` for data fetching** — use RSC, TanStack Query, or SWR; raw useEffect creates waterfalls and race conditions

---

## Related Knowledge

- **typescript** — type patterns, generics for typed hooks and components
- **html-css** — semantic markup, layout patterns, CSS features
- **accessibility** — ARIA patterns, keyboard navigation, focus management
- **web-platform** — fetch API, service workers, browser APIs

## References

Load on demand for detailed patterns and deep-dive knowledge:

- `references/hooks-patterns.md` — custom hooks cookbook, composition patterns, testing hooks
- `references/rsc-patterns.md` — RSC deep dive: framework-agnostic core (directives, serialization rules, data fetching, server actions, composition), Next.js-specific patterns (revalidation, routing), alternative RSC frameworks (Waku, TanStack Start)
