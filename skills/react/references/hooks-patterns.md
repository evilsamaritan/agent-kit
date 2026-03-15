# React Hooks Patterns

## Contents

- [Custom Hooks Cookbook](#custom-hooks-cookbook)
- [Composition Patterns](#composition-patterns)
- [State Machine Hook](#state-machine-hook)
- [Data Fetching Hooks](#data-fetching-hooks)
- [DOM and Browser Hooks](#dom-and-browser-hooks)
- [Testing Hooks](#testing-hooks)

---

## Custom Hooks Cookbook

### useLocalStorage

```typescript
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  }, [key, value]);

  const remove = useCallback(() => {
    localStorage.removeItem(key);
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, setValue, remove] as const;
}
```

### useMediaQuery

```typescript
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// Usage
const isDark = useMediaQuery("(prefers-color-scheme: dark)");
const isMobile = useMediaQuery("(max-width: 768px)");
```

### useDebounce

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

### usePrevious

```typescript
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}
```

### useOnClickOutside

```typescript
function useOnClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}
```

### useIntersection

```typescript
function useIntersection(
  ref: RefObject<HTMLElement | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry.isIntersecting),
      options,
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options?.threshold, options?.root, options?.rootMargin]);

  return isIntersecting;
}
```

---

## Composition Patterns

### Hook Composition

```typescript
// Build complex hooks from simple ones
function useSearchWithHistory(apiEndpoint: string) {
  const [query, setQuery] = useLocalStorage("search-query", "");
  const debouncedQuery = useDebounce(query, 300);
  const previousQuery = usePrevious(debouncedQuery);

  const { data, isLoading, error } = useSWR(
    debouncedQuery.length > 2 ? `${apiEndpoint}?q=${debouncedQuery}` : null,
    fetcher,
  );

  const hasNewResults = previousQuery !== debouncedQuery && data;

  return { query, setQuery, results: data, isLoading, error, hasNewResults };
}
```

### Hook with Ref Callback

```typescript
// When you need to observe a DOM element that may change
function useResizeObserver<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (node) {
      observerRef.current = new ResizeObserver(([entry]) => {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });
      observerRef.current.observe(node);
    }
  }, []);

  return [ref, size] as const;
}

// Usage — works even if element is conditionally rendered
const [sizeRef, size] = useResizeObserver<HTMLDivElement>();
return <div ref={sizeRef}>Size: {size.width}x{size.height}</div>;
```

---

## State Machine Hook

```typescript
type MachineConfig<S extends string, E extends string> = {
  initial: S;
  states: Record<S, { on?: Partial<Record<E, S>> }>;
};

function useMachine<S extends string, E extends string>(config: MachineConfig<S, E>) {
  const [state, setState] = useState<S>(config.initial);

  const send = useCallback(
    (event: E) => {
      setState((current) => {
        const nextState = config.states[current].on?.[event];
        return nextState ?? current;
      });
    },
    [config],
  );

  const is = useCallback((s: S) => state === s, [state]);

  return { state, send, is };
}

// Usage
const machine = useMachine({
  initial: "idle" as const,
  states: {
    idle: { on: { FETCH: "loading" } },
    loading: { on: { SUCCESS: "success", ERROR: "error" } },
    success: { on: { RESET: "idle" } },
    error: { on: { RETRY: "loading", RESET: "idle" } },
  },
});

machine.send("FETCH");
if (machine.is("loading")) return <Spinner />;
```

---

## Data Fetching Hooks

### useAsync

```typescript
interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
}

function useAsync<T>(asyncFn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    error: undefined,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: undefined }));

    asyncFn()
      .then((data) => { if (!cancelled) setState({ data, error: undefined, isLoading: false }); })
      .catch((error) => { if (!cancelled) setState({ data: undefined, error, isLoading: false }); });

    return () => { cancelled = true; };
  }, deps);

  return state;
}
```

### useOptimisticList

```typescript
function useOptimisticList<T extends { id: string }>(
  initialItems: T[],
  onDelete: (id: string) => Promise<void>,
) {
  const [items, setItems] = useState(initialItems);

  const optimisticDelete = useCallback(async (id: string) => {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));

    try {
      await onDelete(id);
    } catch {
      setItems(previous); // Rollback on failure
    }
  }, [items, onDelete]);

  return { items, optimisticDelete };
}
```

---

## DOM and Browser Hooks

### useEventListener

```typescript
function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: EventTarget = window,
) {
  const savedHandler = useRef(handler);
  savedHandler.current = handler;

  useEffect(() => {
    const listener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);
    element.addEventListener(eventName, listener);
    return () => element.removeEventListener(eventName, listener);
  }, [eventName, element]);
}
```

### useKeyboardShortcut

```typescript
function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {},
) {
  useEventListener("keydown", (e) => {
    if (
      e.key === key &&
      !!modifiers.ctrl === e.ctrlKey &&
      !!modifiers.shift === e.shiftKey &&
      !!modifiers.alt === e.altKey &&
      !!modifiers.meta === e.metaKey
    ) {
      e.preventDefault();
      callback();
    }
  });
}

// Usage
useKeyboardShortcut("k", openCommandPalette, { meta: true });
```

---

## Testing Hooks

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";

// Basic hook test
test("useCounter increments", () => {
  const { result } = renderHook(() => useCounter(0));

  expect(result.current.count).toBe(0);

  act(() => { result.current.increment(); });

  expect(result.current.count).toBe(1);
});

// Async hook test
test("useAsync fetches data", async () => {
  const mockFetch = vi.fn().mockResolvedValue({ name: "Alice" });

  const { result } = renderHook(() => useAsync(mockFetch, []));

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({ name: "Alice" });
  });
});

// Hook with context — pass wrapper to renderHook: { wrapper: ThemeProvider }
// Rerender with new props — use rerender({ value: "new" }) and vi.advanceTimersByTime()
```
