# React Hook Patterns

Patterns that carry a decision. Well-known utility hooks (debounce, previous value, click-outside, local-storage wrappers) are not repeated here: write them when needed, using the rules below.

## Contents

- [Subscribing to external state](#subscribing-to-external-state)
- [Reading the latest value inside an effect](#reading-the-latest-value-inside-an-effect)
- [Cleanup and abort](#cleanup-and-abort)
- [Observing a DOM node](#observing-a-dom-node)
- [Testing hooks](#testing-hooks)
- [React version notes](#react-version-notes)
- [State tool examples](#state-tool-examples)

---

## Subscribing to external state

Anything that changes outside React (media queries, online status, a store) goes through `useSyncExternalStore`. It avoids tearing under concurrent rendering and gives SSR a server snapshot. Do not mirror it into `useState` plus an effect.

```ts
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // server snapshot
  );
}
```

Rules: `getSnapshot` must return a cached, referentially stable value when nothing changed; `subscribe` must be stable between renders or the hook resubscribes every render.

---

## Reading the latest value inside an effect

When an effect needs the latest props or state but should not re-run when they change, extract that logic into an effect event.

```ts
function useWindowEvent<K extends keyof WindowEventMap>(
  name: K,
  handler: (event: WindowEventMap[K]) => void,
) {
  const onEvent = useEffectEvent(handler);
  useEffect(() => {
    const listener = (event: WindowEventMap[K]) => onEvent(event);
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
  }, [name]); // handler identity does not resubscribe
}
```

Rules: call an effect event only from inside effects; never pass it to other components or hooks; do not use it to hide a dependency that should re-run the effect.

---

## Cleanup and abort

Every effect that starts something must stop it. When the data layer cannot be used and an effect must fetch, abort on cleanup and ignore abort errors:

```ts
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(setResults)
    .catch((error) => {
      if (error.name !== "AbortError") setError(error);
    });
  return () => controller.abort();
}, [query]);
```

Prefer the framework's data layer, Suspense with `use`, or a server-state cache over this pattern (waterfalls, no dedup, no retry). For optimistic UI, use `useOptimistic` with an action, not a hand-rolled rollback list.

---

## Observing a DOM node

When the node may mount or unmount conditionally, observe it from a ref callback instead of `useRef` plus an effect. In React 19 a ref callback may return a cleanup function.

```ts
function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((node: T | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
```

---

## Testing hooks

Test behavior through `renderHook`; wrap state updates in `act`; provide context with `wrapper`; control time with fake timers rather than real waits.

```ts
import { renderHook, act } from "@testing-library/react";

test("useMediaQuery follows the query", () => {
  const listeners = new Set<() => void>();
  let matches = false;
  window.matchMedia = ((_query: string) => ({
    get matches() { return matches; },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;

  const { result } = renderHook(() => useMediaQuery("(min-width: 40rem)"));
  expect(result.current).toBe(false);

  act(() => { matches = true; listeners.forEach((fn) => fn()); });
  expect(result.current).toBe(true);
});
```

Also assert cleanup: unmount and check that listeners, timers, and requests are released.

---

## React version notes

Checked 2026-10-06 against the React 19.3 release post. Confirm against the project's installed version.

| Version | Notable |
|---------|---------|
| 19.0 | Actions, `useActionState`, `useOptimistic`, `use`, ref as a prop, context as a provider, server functions |
| 19.2 | `Activity` (hide a subtree and keep its state), `useEffectEvent` |
| 19.3 | `ViewTransition` (stable; animates enter, exit, update, and shared elements inside a transition), Fragment refs, `browser()` from `react-dom` (opt a component out of server rendering), Trusted Types support. Older releases need the canary channel for `ViewTransition`. For the browser API itself see `css` and `web` |

- **React Compiler** 1.x is stable and opt-in (build plugin or framework option). Check the build config before recommending or removing manual memoization.
- **Security patches.** Keep the RSC packages and the framework patched; see [rsc-patterns.md](rsc-patterns.md#server-functions).

---

## State tool examples

Examples only; pick by the ownership question in SKILL.md, not by product.

| Kind of state | Examples |
|---------------|----------|
| Server cache with invalidation | TanStack Query, SWR, the framework's data layer |
| Shared client state with one owner | Zustand, Jotai, Redux Toolkit, Valtio (all expose a store plus operations) |
| Low-frequency wide reach | Built-in Context |
| URL state | The router's search-params API |
