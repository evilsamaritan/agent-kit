# TypeScript Runtime Patterns

## Contents

- [Runtime Comparison](#runtime-comparison)
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
| **TypeScript support** | Native type-stripping (v22.18+), `tsx`, or `ts-node` | Native -- runs `.ts` directly | Native -- runs `.ts` directly |
| **Package manager** | npm, yarn, pnpm | `deno add` (JSR + npm) | `bun install` (npm-compatible, ~25x faster) |
| **Module system** | ESM + CJS (`"type": "module"`) | ESM-first, CJS via compat | ESM + CJS (auto-detected) |
| **Built-in test runner** | `node:test` (v18+) | `Deno.test` + `deno test` | `bun test` (Jest-compatible) |
| **HTTP server** | `node:http` or frameworks | `Deno.serve()` (Web API) | `Bun.serve()` (Web API) |
| **Permission model** | Unrestricted | Granular `--allow-*` flags | Unrestricted |
| **Config file** | `package.json` + `tsconfig.json` | `deno.json` (unified) | `package.json` + `tsconfig.json` |
| **Standard APIs** | Node APIs + partial Web APIs | Web APIs + `Deno.*` namespace | Web APIs + `Bun.*` namespace + Node APIs |

**Choosing a runtime:** Node.js for maximum ecosystem compatibility. Deno for security-first and TypeScript-native workflows. Bun for raw performance and fast development cycles. All three are production-ready.

---

## HTTP Servers

All three runtimes converge on Web Standard `Request`/`Response` objects. Prefer this pattern for portable code.

### Runtime-agnostic pattern (works everywhere)

```typescript
// Handler signature shared across runtimes
type Handler = (request: Request) => Response | Promise<Response>;

const handler: Handler = (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/health") return new Response("ok");
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

**Portable frameworks:** Hono, h3, and Elysia work across all three runtimes with the same `Request`/`Response` interface.

---

## File I/O

### Runtime-agnostic pattern

For cross-runtime code, use the Web Streams API or conditional imports. For single-runtime projects, use the native APIs below.

### Node.js

```typescript
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Always use node: prefix for builtins
// Always use fs/promises (not callback API)

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

### Node.js (`node:test`)

```typescript
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

describe("UserService", () => {
  it("fetches user by id", async () => {
    const mockDb = { query: mock.fn(() => Promise.resolve([{ id: "1", name: "Alice" }])) };
    const service = new UserService(mockDb as any);
    assert.equal((await service.getById("1")).name, "Alice");
  });
});
```

### Deno (`Deno.test`)

```typescript
import { assertEquals } from "jsr:@std/assert";

Deno.test("fetches user by id", async () => {
  const user = await service.getById("1");
  assertEquals(user.name, "Alice");
});

// Deno-specific: permission-scoped tests
Deno.test({ name: "reads config", permissions: { read: ["./config.json"] }, async fn() {
  const data = await Deno.readTextFile("./config.json");
  assertEquals(typeof data, "string");
}});
```

### Bun (`bun:test` -- Jest-compatible)

```typescript
import { describe, it, expect, mock } from "bun:test";

describe("UserService", () => {
  it("fetches user by id", async () => {
    const mockDb = { query: mock(() => Promise.resolve([{ id: "1", name: "Alice" }])) };
    const service = new UserService(mockDb as any);
    expect((await service.getById("1")).name).toBe("Alice");
  });
});
```

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

### Graceful shutdown (Node.js)

```typescript
const server = app.listen(3000);

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close();                          // Stop accepting connections
  const timeout = setTimeout(() => process.exit(1), 30_000);
  await cleanup();                         // Drain DB, cache, etc.
  clearTimeout(timeout);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});
```

### Graceful shutdown (Deno)

```typescript
const ac = new AbortController();

const server = Deno.serve({ port: 3000, signal: ac.signal }, handler);

Deno.addSignalListener("SIGTERM", () => {
  console.log("SIGTERM received");
  ac.abort();
});

await server.finished;
```

### Graceful shutdown (Bun)

```typescript
const server = Bun.serve({
  port: 3000,
  fetch: handler,
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  server.stop();
  process.exit(0);
});
```
