# JavaScript Runtime Patterns

## Contents

- [Runtime Comparison](#runtime-comparison)
- [Language Feature Support](#language-feature-support)
- [HTTP Servers](#http-servers)
- [File I/O](#file-io)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Request-Scoped Context](#request-scoped-context)
- [Worker Threads](#worker-threads)
- [Streams](#streams)
- [Process Lifecycle](#process-lifecycle)

---

## Runtime Comparison

| Capability | Node.js | Deno | Bun |
|---|---|---|---|
| **TypeScript** | Type stripping (22.18+) for erasable syntax; `tsx` or a build step otherwise | Runs `.ts` directly | Runs `.ts` directly |
| **Package manager** | npm, pnpm, Yarn | `deno add` (JSR and npm) | `bun install` (npm-compatible) |
| **Modules** | ESM and CJS (`"type": "module"`) | ESM first, CJS through compatibility | ESM and CJS, auto-detected |
| **Test runner** | `node:test` | `Deno.test` | `bun test` (Jest-style API) |
| **HTTP server** | `node:http` or a framework | `Deno.serve()` (Web API) | `Bun.serve()` (Web API) |
| **Permissions** | Unrestricted by default; opt-in `--permission` model, stable since 22.13 and 23.5, documented as a seat belt rather than protection against malicious code | Deny by default, granular `--allow-*` flags | Unrestricted |
| **Config** | `package.json` and `tsconfig.json` | `deno.json` or `package.json` | `package.json` and `tsconfig.json` |
| **Standard APIs** | Node APIs plus most Web APIs | Web APIs plus `Deno.*` | Web APIs, `Bun.*`, and most Node APIs |

Choose by questions, not slogans:

- What does the deployment platform run? Managed platforms often support one runtime well.
- Which native addons and npm packages does the project need? Compatibility on Deno and Bun is high but not complete; test the ones that matter.
- Is least-privilege execution required for third-party code? Deno's model is built in; Node's is opt-in.
- Does the same code need to run on several runtimes? Stay on Web Standard APIs.
- What does the team already operate and monitor? Tooling, profilers, and debuggers differ.

---

## Language Feature Support

Standard features reach runtimes at different times. Check the target runtime's documentation (or compatibility tables) rather than this list; as of 2026-10 (MDN browser-compat data, Node.js release notes, TC39 finished proposals):

| Feature | Notes |
|---------|-------|
| `Temporal` | Finished TC39 proposal, slated for ES2027. Shipped in Chromium 144 and Firefox 139; Safari lists it only in Technology Preview; Node.js enables it by default from version 26, earlier versions need a flag or a polyfill; Deno 2.7 and Bun 1.4. Use a polyfill where a target lacks it |
| `Intl.DurationFormat` | Standard. Shipped in Chromium 129, Firefox 136, and Safari 16.4; Node.js follows its V8 version. Feature-detect (`typeof Intl.DurationFormat`) and fall back to a formatjs polyfill or manual formatting; pair with `Temporal.Duration` (or a plain duration object) as input. Formatting rules are in `i18n` |
| `using` / `await using` | Finished TC39 proposal, slated for ES2027. Chromium 134, Firefox 141, Node.js 24, Deno, and Bun; Safari lists it only in Technology Preview, so Safari and Node before 24 need transpilation (TypeScript 5.2+ lowers it) |
| `Promise.withResolvers`, `Promise.try`, `Object.groupBy`, `Set` methods, `Array.fromAsync` | Available in current runtimes; absent in old LTS lines. Check the Node.js line in `engines` |
| Iterator helpers (`.map`, `.filter`, `.take` on iterators) | Available in current runtimes |

When the lowest supported runtime lacks a feature: transpile through the build tool when the feature is syntax (`using`), and polyfill when it is an API (`Temporal`). Do not write both paths by hand.

---

## HTTP Servers

All three runtimes converge on Web Standard `Request`/`Response` objects. Prefer this pattern for portable code.

### Runtime-agnostic pattern (works everywhere)

```typescript
// Handler signature shared across runtimes
type Handler = (request: Request) => Response | Promise<Response>;

const handler: Handler = (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/livez") return new Response("ok"); // probe endpoints: `reliability`
  return new Response("Not Found", { status: 404 });
};
```

### Node.js

```typescript
import { createServer } from "node:http";
// Or use a framework that exposes Request/Response (e.g., Hono, h3)
createServer(async (req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello from Node.js");
}).listen(3000);
```

### Deno

```typescript
Deno.serve({ port: 3000 }, (req: Request) => {
  return new Response("Hello from Deno");
});
```

### Bun

```typescript
Bun.serve({
  port: 3000,
  fetch(req: Request): Response {
    return new Response("Hello from Bun");
  },
});
```

A framework that exposes `Request`/`Response` (for example Hono or h3) runs on several runtimes unchanged; check each one's runtime adapters.

---

## File I/O

### Runtime-agnostic pattern

For cross-runtime code, use the Web Streams API or conditional imports. For single-runtime projects, use the native APIs below.

### Node.js

```typescript
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Use the node: prefix for builtins and the promise API (fs/promises)

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

// Atomic write — write to temp, then rename
async function atomicWrite(path: string, content: string): Promise<void> {
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, content, "utf-8");
  await rename(tmp, path);
}
```

### Deno

```typescript
// Deno uses its own namespace — no imports needed
await Deno.mkdir("./data", { recursive: true });

// Text I/O
const text = await Deno.readTextFile("./config.json");
await Deno.writeTextFile("./output.txt", "Hello");

// Binary I/O
const bytes = await Deno.readFile("./image.png");
await Deno.writeFile("./copy.png", bytes);

// Requires --allow-read and --allow-write permissions
```

### Bun

```typescript
// Bun.file returns a lazy reference — no read until consumed
const file = Bun.file("./config.json");
const text = await file.text();
const json = await file.json();

// Bun.write handles strings, Blobs, ArrayBuffers, and Response objects
await Bun.write("./output.txt", "Hello");
await Bun.write("./copy.png", Bun.file("./image.png"));
```

---

## Error Handling

These patterns work identically across all runtimes.

```typescript
// Always type catch as unknown
try {
  await riskyOperation();
} catch (err: unknown) {
  if (err instanceof DatabaseError) { /* specific */ }
  else if (err instanceof Error) { log(err.message, { stack: err.stack }); }
  else { log("Unknown error", { error: String(err) }); }
}

// Custom error with cause chaining (ES2022 — all runtimes)
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

// Wrap lower-level errors
throw new AppError("Failed to fetch user", "USER_FETCH", 500, { cause: err });

// Result pattern — functional error handling
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

---

## Testing

Each runtime ships a runner: `node:test` with `node:assert/strict`, `Deno.test` with `jsr:@std/assert`, and `bun:test` (Jest-style `expect`). Strategy, fixtures, and mocking policy are in `testing`. Use typed fakes instead of casts:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

class FakeDb implements UserDb {
  async query() { return [{ id: "1", name: "Alice" }]; }
}

describe("UserService", () => {
  it("fetches user by id", async () => {
    const service = new UserService(new FakeDb());
    assert.equal((await service.getById("1")).name, "Alice");
  });
});
```

Deno adds permission-scoped tests (`Deno.test({ permissions: { read: ["./config.json"] }, ... })`). In Node and Bun, `mock.fn()` and `mock()` create spies; type them against the interface they replace.

---

## Request-Scoped Context

`AsyncLocalStorage` from `node:async_hooks` works in Node.js, Bun, and Deno (via compat layer).

```typescript
import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext { requestId: string; userId?: string; startTime: number }
const als = new AsyncLocalStorage<RequestContext>();

// Set context for entire request lifecycle
function withContext(req: Request, next: () => void) {
  als.run({ requestId: crypto.randomUUID(), startTime: performance.now() }, next);
}

// Read anywhere in the call stack — no prop drilling
function getRequestId(): string {
  return als.getStore()?.requestId ?? "no-context";
}
```

---

## Worker Threads

CPU-intensive work belongs off the main thread. All runtimes support workers, but APIs differ.

### Node.js / Bun (`node:worker_threads`)

Bun implements the Node.js `worker_threads` API.

```typescript
import { Worker, parentPort } from "node:worker_threads";

// Main thread — spawn a worker
const worker = new Worker("./heavy-task.ts");
worker.postMessage({ numbers: [1, 2, 3] });
worker.on("message", (result) => console.log("Result:", result));
worker.on("error", (err) => console.error("Worker error:", err));

// Worker file (heavy-task.ts)
parentPort?.on("message", (data: { numbers: number[] }) => {
  const result = heavyComputation(data.numbers);
  parentPort?.postMessage(result);
});
```

For production workloads, wrap workers in a pool that queues tasks and recycles idle workers (pool size = `cpus().length`).

### Deno (Web Workers)

```typescript
// Deno uses the standard Web Worker API
const worker = new Worker(new URL("./worker.ts", import.meta.url).href, {
  type: "module",
});

worker.postMessage({ numbers: [1, 2, 3] });
worker.onmessage = (e: MessageEvent) => {
  console.log("Result:", e.data);
};
```

---

## Streams

### Node.js (node:stream)

```typescript
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";

// Always use pipeline() for backpressure and error handling
await pipeline(
  createReadStream("input.csv"),
  createGzip(),
  createWriteStream("output.csv.gz"),
);

// Web Streams interop (Node 18+)
import { Readable } from "node:stream";
const webReadable = Readable.toWeb(nodeReadable);
```

### All runtimes (Web Streams API)

```typescript
// ReadableStream, WritableStream, TransformStream work everywhere
const transform = new TransformStream<string, string>({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase());
  },
});

const readable = new ReadableStream({
  start(controller) {
    controller.enqueue("hello");
    controller.enqueue("world");
    controller.close();
  },
});

// Pipe through transform
const result = readable.pipeThrough(transform);
for await (const chunk of result) {
  console.log(chunk); // "HELLO", "WORLD"
}
```

**Prefer Web Streams** for new cross-runtime code. Use Node.js streams only when interfacing with Node-specific APIs (e.g., `fs.createReadStream`, `zlib`).

---

## Process Lifecycle

Shutdown policy (order, deadlines, what readiness reports) is owned by `reliability`, and the code form by `backend`. The runtime-specific part is how each one stops accepting work and waits for in-flight requests:

| | Signal API | Stop accepting and drain |
|---|---|---|
| Node.js | `process.on("SIGTERM", ...)` | `server.close(callback)` stops new connections, closes idle keep-alive sockets (Node 19 and later), and waits for active ones |
| Deno | `Deno.addSignalListener("SIGTERM", ...)` | `await server.shutdown()` stops accepting and waits for in-flight requests; aborting the `Deno.serve` signal is a non-graceful stop |
| Bun | `process.on("SIGTERM", ...)` | `await server.stop()` waits for in-flight requests; `server.stop(true)` closes them immediately |

Order in every runtime: stop accepting, wait for in-flight work (with a deadline), close downstream clients, then exit. Exiting before the wait finishes drops requests.

```typescript
// Node.js
import { once } from "node:events";

async function shutdown(signal: string) {
  const deadline = setTimeout(() => process.exit(1), 30_000);
  deadline.unref();
  server.close();                // also closes idle keep-alive sockets (Node 19+)
  await once(server, "close");   // in-flight requests finished
  await closeClients();          // database, cache, queues
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Bun
process.on("SIGTERM", async () => {
  await server.stop();           // drain first
  await closeClients();
  process.exit(0);
});
```

Unhandled rejections: Node.js terminates by default. Log through `process.on("unhandledRejection", ...)` only to record and exit non-zero, never to continue.
