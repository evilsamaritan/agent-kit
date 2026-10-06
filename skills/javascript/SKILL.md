---
name: javascript
description: "Write or review JavaScript/TypeScript. Use for TypeScript types, generics and tsconfig, ESM/CJS modules and package.json exports, async/await and the event loop, Node.js/Deno/Bun runtime choice, and build tooling: bundlers, package managers, workspaces, lint, format. Not for React or Vue component code."
user-invocable: true
---

# JavaScript

JavaScript and TypeScript: language features, module system, async model, runtime selection, TypeScript as the default type layer, and the build tooling around them.

**Determine the project's versions first.** Read `engines` and `.nvmrc` (Node), the `typescript` version in the lockfile, and `target` and `module` in `tsconfig.json`. Use language features and APIs only up to what the target runtimes support; version-dependent notes are in the references.

**Hard rules:** Use TypeScript for any project that outlives a script. Never use `any` for a value: use `unknown` and narrow (`any` is accepted only inside type-level constraints, such as `any[]` in an `infer` pattern). Enable `strict`. Use the `node:` prefix for Node.js built-in imports. Prefer ESM over CJS for new code.

---

## Core Language

- Modules: ESM (`import`/`export`) is the standard; CJS (`require`) for legacy and for libraries that still ship a CJS build.
- Optional chaining (`?.`) and nullish coalescing (`??`) over `&&` chains; `structuredClone()` for deep copies.
- `Object.groupBy()` / `Map.groupBy()` and the `Set` methods (union, intersection, difference) replace hand-written helpers.
- Iterators and generators (`function*`, `Symbol.iterator`) for lazy sequences.
- `using` / `await using` (explicit resource management) and `Temporal` (replacement for `Date`) are finished TC39 proposals slated for ES2027; check the target runtime's support and fall back to transpilation or a polyfill for older runtimes. Support by runtime is in [runtime-patterns.md](references/runtime-patterns.md#language-feature-support).
- Import attributes: `import data from './data.json' with { type: 'json' }`.

---

## Module System

```
What module format?
├── New application → ESM ("type": "module" in package.json)
├── Library published to npm → ESM, plus a CJS build only if consumers still need it (package.json exports)
├── Legacy codebase → CJS; migrate to ESM incrementally
└── Bundled app → ESM (the bundler resolves modules)
```

The tsconfig that matches each case (`module`, `moduleResolution`, `target`) is one decision tree in [typescript.md](references/typescript.md#tsconfig-decision-tree).

**ESM requires file extensions in relative imports:** `import { foo } from './bar.js'` (or `./bar.ts` with the options in the tsconfig tree).

**The package.json `exports` field** defines a package's public entry points; consumers cannot import anything it does not list:
```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./utils": { "types": "./dist/utils.d.ts", "import": "./dist/utils.js" }
  }
}
```
Put `types` first in each condition block; conditions match in order.

---

## Async Model

JavaScript is single-threaded with an event loop: synchronous code runs to completion, then all microtasks (`Promise.then`, `await` continuations, `queueMicrotask`) drain, then the next macrotask (timer, I/O) runs.

**Key rules:**
- Choose the combinator by contract: `Promise.all` when every result is required, `Promise.allSettled` when partial failure is acceptable, `Promise.any` for the first success, `Promise.race` for the first outcome.
- Pass an `AbortSignal` into work that can be cancelled (`fetch`, timers, your own loops); `AbortSignal.timeout(ms)` and `AbortSignal.any([...])` compose deadlines.
- Every promise is awaited, returned, or has a `.catch`; unhandled rejections crash Node.js by default.
- Async work has an owner that cancels it and releases what it holds on every path (`development`).

Patterns, Node-specific ordering, concurrency limiting, and pitfalls: [async-patterns.md](references/async-patterns.md).

---

## Runtime Decision Tree

```
Which JS/TS runtime?
├── What does the deployment platform support? → use that; platform limits decide before preferences do
├── Does the project need native addons or specific npm packages? → Node.js has the broadest compatibility; test them on Deno or Bun before committing
├── Is least-privilege execution needed for third-party code? → Deno's permission flags, or Node's opt-in `--permission` model (stable since Node 22.13 and 23.5; a guard against accidents, not a boundary against malicious code per the Node docs); for hostile code use OS-level isolation
├── Should the same code run on several runtimes? → write to Web Standard APIs (Request/Response, fetch, Web Streams)
└── Otherwise → Node.js LTS, the default for services and tooling
```

Node.js 22.18+ and 24 run `.ts` files by stripping types with no flag (stable in 24.12+ and 25.2+; write `erasableSyntaxOnly: true` in tsconfig, so no enums or namespaces); Deno and Bun run TypeScript natively. None of them type-check at runtime: run `tsc --noEmit`.

Differences in APIs, servers, lifecycle, and testing: [runtime-patterns.md](references/runtime-patterns.md).

---

## TypeScript Essentials

TypeScript is a type-system layer: the code is JavaScript.

### Type System
- **Structural typing** — checks shape, not name
- **Type narrowing** — `typeof`, `instanceof`, `in`, discriminated unions, type guards
- **Discriminated unions** — the idiomatic shape for a closed set: results, protocol messages, states. Dispatch over more than two members with an exhaustive `switch` whose default hands the value to `never`, so a new member fails to compile:

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
function handle(r: Result<string>) {
  if (r.ok) return r.value;     // narrowed
  throw r.error;                 // narrowed
}

function assertNever(value: never): never { throw new Error(`Unhandled variant: ${String(value)}`); }
```

- **Open families** — providers, document types, widgets that keep growing are not unions consumed by `switch` or `instanceof` chains. Put the behavior on each class, or keep one table at the registration that maps each kind to its module, typed `Record<Kind, KindModule>` so the type checker proves it complete — never a per-consumer table of per-kind values. Consumers call the operation (`development`).

### Generics Quick Reference

| Pattern | Use when | Example |
|---------|----------|---------|
| **Constrained** | Require shape | `<T extends { id: string }>` |
| **Conditional** | Type branching | `T extends string ? A : B` |
| **Mapped** | Transform properties | `{ [K in keyof T]: Readonly<T[K]> }` |
| **Template literal** | String types | `` `on${Capitalize<string>}` `` |
| **Infer** | Extract inner types | `T extends Promise<infer U> ? U : T` |

Rule: if a generic has > 3 type parameters, refactor.

### Utility Types

| Utility | Use |
|---------|-----|
| `Pick<T, K>` / `Omit<T, K>` | Subset/exclude properties |
| `Partial<T>` / `Required<T>` | Optional/required all props |
| `Record<K, V>` | Object with known keys |
| `Extract<T, U>` / `Exclude<T, U>` | Filter union members |
| `ReturnType<F>` / `Parameters<F>` | Infer from functions |
| `Awaited<T>` | Unwrap Promise |
| `NoInfer<T>` | Prevent inference position |

### tsconfig

Set `strict`, `module`, `moduleResolution`, `target`, and `types` explicitly, and turn on `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` for new code. The decision tree per project type, and what changed in TypeScript 6 and 7, are in [typescript.md](references/typescript.md#tsconfig-decision-tree).

→ Advanced type patterns: [typescript.md](references/typescript.md)

---

## Build Tooling

Bundler, package manager, workspace, lint, format, type-check, and git-hook choices, with current configuration: [build-tooling.md](references/build-tooling.md). Keep the project's existing tools unless there is a reason to change them.

---

## Anti-Patterns

1. **`any` abuse** — use `unknown` and narrow; `any` disables type checking and spreads virally
2. **Over-complex generics** — if the type is harder to read than the code, simplify
3. **Ignoring strict mode** — `strict: false` defeats TypeScript's value
4. **Type assertions over narrowing** — `as T` hides bugs; use type guards
5. **Enums in native execution** — use `as const` objects or string literal unions
6. **Callback hell** — use async/await; promisify legacy callbacks
7. **Unhandled promise rejections** — always catch or use `.catch()`; Node.js crashes on unhandled
8. **Blocking the event loop** — CPU work off main thread via workers
9. **`var` declarations** — use `const` by default, `let` when mutation needed
10. **Timers and listeners without an owner** — a timeout, interval, or event listener that nothing cancels on teardown

---

## Related Knowledge

- **development** — code practice these idioms express: variant families, ownership, explicit dependencies, async lifetime
- **react** / **vue** — framework-specific patterns, typed hooks
- **backend** — server frameworks, middleware, API patterns, lifecycle and shutdown design
- **frontend** — UI structure, state ownership, rendering strategy, barrel-file rule
- **web** — browser APIs, fetch, service workers
- **testing** — test strategy; runner configuration is in the runtime and build-tooling references
- **ci-cd** — pipeline design around the tooling here

## References

- [typescript.md](references/typescript.md) — advanced type patterns, branded types, builders, tsconfig tree, TypeScript 6 and 7
- [runtime-patterns.md](references/runtime-patterns.md) — Node.js, Deno, Bun differences: servers, file I/O, workers, streams, process lifecycle, feature support
- [async-patterns.md](references/async-patterns.md) — event loop ordering, cancellation, concurrency limiting, async iteration, pitfalls
- [build-tooling.md](references/build-tooling.md) — bundlers, package managers and workspaces, lint, format, type-check, git hooks
