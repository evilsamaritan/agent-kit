# JavaScript Async Patterns

Deep-dive into JavaScript's async model: event loop, Promises, async/await, AbortController, async iteration, structured concurrency, and common pitfalls.

## Contents

- [Event Loop Model](#event-loop-model)
- [Promise Patterns](#promise-patterns)
- [Async/Await Patterns](#asyncawait-patterns)
- [AbortController and AbortSignal](#abortcontroller-and-abortsignal)
- [Async Iteration](#async-iteration)
- [Structured Concurrency](#structured-concurrency)
- [Scheduling](#scheduling)
- [Common Pitfalls](#common-pitfalls)

---

## Event Loop Model

JavaScript is single-threaded. All async operations are managed through the event loop.

```
┌─────────────────────────────┐
│         Call Stack           │  ← Synchronous code executes here
│  (one frame at a time)       │
└──────────┬──────────────────┘
           │ stack empty?
           ▼
┌─────────────────────────────┐
│      Microtask Queue         │  ← Promise.then, queueMicrotask, MutationObserver
│  (drains completely before   │
│   moving to macrotasks)      │
└──────────┬──────────────────┘
           │ microtask queue empty?
           ▼
┌─────────────────────────────┐
│      Macrotask Queue         │  ← setTimeout, setInterval, I/O callbacks, setImmediate
│  (one task per iteration)    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│     Render / Paint           │  ← requestAnimationFrame (browser only)
│  (browser only, ~16ms)       │
└─────────────────────────────┘
```

### Execution order rules

1. Synchronous code runs to completion (call stack must empty)
2. **All** microtasks drain before the next macrotask
3. Each event loop iteration processes **one** macrotask, then all resulting microtasks
4. `await` desugars to `.then()` — yields to microtask queue

```typescript
console.log("1 - sync");

setTimeout(() => console.log("5 - macrotask"), 0);

Promise.resolve()
  .then(() => console.log("3 - microtask 1"))
  .then(() => console.log("4 - microtask 2"));

console.log("2 - sync");

// Output: 1, 2, 3, 4, 5
```

### Node.js-specific phases

Node.js has a more granular event loop with phases:
1. **Timers** — `setTimeout`, `setInterval` callbacks
2. **Pending callbacks** — deferred I/O callbacks
3. **Idle/Prepare** — internal
4. **Poll** — retrieve new I/O events, execute I/O callbacks
5. **Check** — `setImmediate` callbacks
6. **Close** — `socket.on('close')` callbacks

`process.nextTick()` runs before any other microtask (even before `Promise.then`). Use sparingly — can starve the event loop.

---

## Promise Patterns

### Chaining

```typescript
// Linear chain — each step depends on the previous
const result = await fetchUser(id)
  .then(user => fetchOrders(user.id))
  .then(orders => orders.filter(o => o.status === "active"))
  .then(activeOrders => calculateTotal(activeOrders));
```

### Combinators

| Method | Resolves when | Rejects when | Use case |
|--------|--------------|-------------|----------|
| `Promise.all(ps)` | All resolve | Any rejects | Parallel fetches where all are required |
| `Promise.allSettled(ps)` | All settle | Never rejects | Parallel ops where partial failure is OK |
| `Promise.race(ps)` | First settles | First rejects | Timeout pattern, fastest response |
| `Promise.any(ps)` | First resolves | All reject (`AggregateError`) | Fallback sources, redundant requests |

```typescript
// Promise.all — fail fast
const [user, orders, prefs] = await Promise.all([
  fetchUser(id),
  fetchOrders(id),
  fetchPreferences(id),
]);

// Promise.allSettled — collect results regardless of failure
const results = await Promise.allSettled([
  sendEmail(user),
  sendSMS(user),
  sendPush(user),
]);

const failures = results
  .filter((r): r is PromiseRejectedResult => r.status === "rejected")
  .map(r => r.reason);

if (failures.length) {
  logger.warn("Some notifications failed", { failures });
}

// Promise.race — timeout pattern
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Promise.any — first success wins
const response = await Promise.any([
  fetch("https://primary.api.com/data"),
  fetch("https://fallback.api.com/data"),
  fetch("https://backup.api.com/data"),
]);
```

### Error boundaries

```typescript
// Catch at the boundary, not at every step
async function handleRequest(req: Request): Promise<Response> {
  try {
    const data = await processRequest(req);  // may throw internally
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return new Response(err.message, { status: 400 });
    }
    if (err instanceof NotFoundError) {
      return new Response("Not found", { status: 404 });
    }
    // Log unexpected errors, return generic response
    logger.error("Unhandled error", { error: err });
    return new Response("Internal error", { status: 500 });
  }
}
```

---

## Async/Await Patterns

### Sequential vs concurrent

```typescript
// WRONG — sequential awaits (unnecessarily slow)
const user = await fetchUser(id);
const orders = await fetchOrders(id);  // waits for user to finish
const prefs = await fetchPreferences(id);  // waits for orders to finish

// RIGHT — concurrent with Promise.all
const [user, orders, prefs] = await Promise.all([
  fetchUser(id),
  fetchOrders(id),
  fetchPreferences(id),
]);

// ALSO RIGHT — start concurrently, await later
const userPromise = fetchUser(id);
const ordersPromise = fetchOrders(id);
const user = await userPromise;
const orders = await ordersPromise;
```

### Error handling with try-catch

```typescript
// Typed error handling
async function safeOperation<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { ok: false, error };
  }
}

// Usage
const result = await safeOperation(() => fetchUser(id));
if (!result.ok) {
  logger.error("Failed to fetch user", { error: result.error });
  return;
}
console.log(result.value);  // narrowed to T
```

### Retry with backoff

```typescript
async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelay?: number; signal?: AbortSignal } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, signal } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      signal?.throwIfAborted();
      return await fn();
    } catch (err: unknown) {
      if (attempt === maxAttempts) throw err;
      if (signal?.aborted) throw signal.reason;

      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}
```

### Debounce and throttle (async-aware)

```typescript
// Async debounce — only latest call executes
function asyncDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let pendingResolve: ((value: any) => void) | undefined;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    return new Promise(resolve => {
      pendingResolve = resolve;
      timeoutId = setTimeout(async () => {
        const result = await fn(...args);
        resolve(result);
      }, ms);
    });
  };
}
```

---

## AbortController and AbortSignal

`AbortController` is the standard cancellation mechanism across all runtimes.

### Fetch cancellation

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch("https://api.example.com/data", {
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return await response.json();
} catch (err: unknown) {
  if (err instanceof DOMException && err.name === "AbortError") {
    console.log("Request was cancelled");
  }
  throw err;
}
```

### AbortSignal.timeout (built-in)

```typescript
// Simpler timeout — no manual controller needed
const response = await fetch("https://api.example.com/data", {
  signal: AbortSignal.timeout(5000),
});
```

### AbortSignal.any (combining signals)

```typescript
// Cancel on either user action OR timeout
const userController = new AbortController();
const combinedSignal = AbortSignal.any([
  userController.signal,
  AbortSignal.timeout(30000),
]);

const response = await fetch(url, { signal: combinedSignal });
```

### Custom cancelable operations

```typescript
async function processLargeDataset(
  items: string[],
  signal?: AbortSignal
): Promise<string[]> {
  const results: string[] = [];

  for (const item of items) {
    // Check abort before expensive work
    signal?.throwIfAborted();

    const result = await expensiveTransform(item);
    results.push(result);
  }

  return results;
}

// Usage
const controller = new AbortController();
const promise = processLargeDataset(data, controller.signal);

// Cancel from elsewhere
cancelButton.onclick = () => controller.abort(new Error("User cancelled"));
```

### Cleanup with abort event listener

```typescript
function createCancelableInterval(
  fn: () => void,
  ms: number,
  signal: AbortSignal
): void {
  const id = setInterval(fn, ms);

  // Cleanup when aborted
  signal.addEventListener("abort", () => clearInterval(id), { once: true });

  // If already aborted
  if (signal.aborted) clearInterval(id);
}
```

---

## Async Iteration

### for-await-of

```typescript
// Iterate over async data sources
async function processStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
```

### Async generators

```typescript
// Paginated API — yields pages lazily
async function* fetchAllPages<T>(
  url: string,
  signal?: AbortSignal
): AsyncGenerator<T[], void, undefined> {
  let nextUrl: string | null = url;

  while (nextUrl) {
    signal?.throwIfAborted();
    const response = await fetch(nextUrl, { signal });
    const data = await response.json();
    yield data.items as T[];
    nextUrl = data.nextPageUrl;
  }
}

// Usage — processes one page at a time, low memory
for await (const page of fetchAllPages<User>("/api/users")) {
  await processUsers(page);
}
```

### ReadableStream as async iterable

```typescript
// Web Streams are async iterable in modern runtimes
const response = await fetch("https://example.com/large-file");
if (!response.body) throw new Error("No body");

for await (const chunk of response.body) {
  process(chunk);
}
```

### Async iterator utilities

```typescript
// Map over async iterable
async function* asyncMap<T, U>(
  iterable: AsyncIterable<T>,
  fn: (item: T) => U | Promise<U>
): AsyncGenerator<U> {
  for await (const item of iterable) {
    yield await fn(item);
  }
}

// Filter async iterable
async function* asyncFilter<T>(
  iterable: AsyncIterable<T>,
  predicate: (item: T) => boolean | Promise<boolean>
): AsyncGenerator<T> {
  for await (const item of iterable) {
    if (await predicate(item)) yield item;
  }
}

// Take first N items
async function* asyncTake<T>(
  iterable: AsyncIterable<T>,
  count: number
): AsyncGenerator<T> {
  let taken = 0;
  for await (const item of iterable) {
    if (taken >= count) return;
    yield item;
    taken++;
  }
}
```

---

## Structured Concurrency

JavaScript lacks built-in structured concurrency, but you can approximate it with `Promise.all` as scope and `AbortController` as cancellation.

### Promise.all as concurrency scope

```typescript
// All operations share a lifecycle — if one fails, all should stop
async function processOrder(orderId: string): Promise<OrderResult> {
  const controller = new AbortController();

  try {
    const [inventory, payment, shipping] = await Promise.all([
      checkInventory(orderId, controller.signal),
      processPayment(orderId, controller.signal),
      calculateShipping(orderId, controller.signal),
    ]);

    return { inventory, payment, shipping };
  } catch (err: unknown) {
    // Cancel remaining operations on first failure
    controller.abort();
    throw err;
  }
}
```

### Concurrency limiter

```typescript
// Process items with bounded parallelism
async function mapWithConcurrency<T, U>(
  items: T[],
  fn: (item: T) => Promise<U>,
  concurrency: number
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

// Usage: process 100 items, max 5 at a time
const results = await mapWithConcurrency(urls, fetchData, 5);
```

### Cancelable task group

```typescript
class TaskGroup {
  private controller = new AbortController();
  private tasks: Promise<unknown>[] = [];

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  add<T>(fn: (signal: AbortSignal) => Promise<T>): void {
    const task = fn(this.controller.signal).catch(err => {
      this.controller.abort(err);  // cancel siblings on failure
      throw err;
    });
    this.tasks.push(task);
  }

  async wait(): Promise<void> {
    await Promise.allSettled(this.tasks);
    if (this.controller.signal.aborted) {
      throw this.controller.signal.reason;
    }
  }
}

// Usage
const group = new TaskGroup();
group.add(signal => fetchUser(id, signal));
group.add(signal => fetchOrders(id, signal));
await group.wait();
```

---

## Scheduling

### queueMicrotask

```typescript
// Schedule work after current synchronous code, before next macrotask
queueMicrotask(() => {
  console.log("Runs after current sync block, before setTimeout callbacks");
});

// Use case: batching DOM reads/writes, deferred cleanup
// WARNING: microtask loops can starve the event loop
```

### requestAnimationFrame (browser)

```typescript
// Smooth animations — runs before next paint (~60fps)
function animate(timestamp: DOMHighResTimeStamp): void {
  updateAnimation(timestamp);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

### scheduler.postTask (browser, experimental)

```typescript
// Priority-based scheduling
await scheduler.postTask(() => heavyComputation(), { priority: "background" });
await scheduler.postTask(() => updateUI(), { priority: "user-blocking" });
```

### setImmediate vs setTimeout(fn, 0) vs process.nextTick (Node.js)

| API | When it runs | Use case |
|-----|-------------|----------|
| `process.nextTick()` | Before I/O, before microtasks | Critical path, must run before anything else |
| `queueMicrotask()` | After nextTick, before I/O | Standard deferred work |
| `setImmediate()` | After I/O polling phase | Non-urgent deferred work |
| `setTimeout(fn, 0)` | Next timer phase (minimum ~1ms) | Delayed execution |

---

## Common Pitfalls

### 1. Floating promises (fire-and-forget)

```typescript
// WRONG — unhandled rejection if sendEmail fails
app.post("/register", (req, res) => {
  createUser(req.body);
  sendEmail(req.body.email);  // floating promise!
  res.json({ ok: true });
});

// RIGHT — handle explicitly
app.post("/register", async (req, res) => {
  await createUser(req.body);
  // Intentionally fire-and-forget? Catch and log
  sendEmail(req.body.email).catch(err => logger.error("Email failed", { err }));
  res.json({ ok: true });
});
```

### 2. Sequential awaits in loops

```typescript
// WRONG — processes one at a time
for (const id of userIds) {
  const user = await fetchUser(id);  // N sequential network calls
  results.push(user);
}

// RIGHT — concurrent
const results = await Promise.all(userIds.map(id => fetchUser(id)));

// RIGHT — concurrent with concurrency limit
const results = await mapWithConcurrency(userIds, fetchUser, 10);
```

### 3. Missing error handling on Promise.all

```typescript
// WRONG — one failure loses all results
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);

// RIGHT — when partial failure is acceptable
const [a, b, c] = await Promise.allSettled([fetchA(), fetchB(), fetchC()]);
```

### 4. Async function in forEach

```typescript
// WRONG — forEach ignores return value, all promises fire simultaneously with no await
[1, 2, 3].forEach(async (id) => {
  await processItem(id);  // floating promise!
});

// RIGHT — sequential
for (const id of [1, 2, 3]) {
  await processItem(id);
}

// RIGHT — concurrent
await Promise.all([1, 2, 3].map(id => processItem(id)));
```

### 5. Memory leaks from uncleaned listeners

```typescript
// WRONG — listener accumulates on every call
function subscribe(emitter: EventEmitter): void {
  emitter.on("data", handleData);  // never removed
}

// RIGHT — clean up
function subscribe(emitter: EventEmitter, signal: AbortSignal): void {
  const handler = (data: unknown) => handleData(data);
  emitter.on("data", handler);
  signal.addEventListener("abort", () => emitter.off("data", handler), { once: true });
}
```

### 6. Blocking the event loop

```typescript
// WRONG — blocks entire server during computation
app.get("/report", async (req, res) => {
  const result = heavySync(data);  // 2 seconds of CPU work
  res.json(result);
});

// RIGHT — offload to worker thread
import { Worker } from "node:worker_threads";

app.get("/report", async (req, res) => {
  const worker = new Worker("./report-worker.ts", { workerData: data });
  worker.on("message", result => res.json(result));
  worker.on("error", err => res.status(500).json({ error: err.message }));
});
```

### 7. Ignoring AbortSignal in long operations

```typescript
// WRONG — operation continues even after client disconnects
async function generateReport(data: BigData[]): Promise<Report> {
  for (const item of data) {
    await process(item);  // continues even if caller aborted
  }
}

// RIGHT — check signal periodically
async function generateReport(data: BigData[], signal?: AbortSignal): Promise<Report> {
  for (const item of data) {
    signal?.throwIfAborted();
    await process(item);
  }
}
```
