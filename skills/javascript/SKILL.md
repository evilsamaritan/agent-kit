---
name: javascript
description: Apply JavaScript language patterns — ES2025+ modules, async model, runtime selection, TypeScript type system. Use when working with JS/TS modules (ESM/CJS), async/await, event loop, runtime choice (Node/Bun/Deno), TypeScript types, generics, or tsconfig. Do NOT use for React patterns (use react) or web platform APIs (use web).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# JavaScript

Expert-level JavaScript and TypeScript knowledge. ES2025+ language, module system, async model, runtime selection, TypeScript as default type layer.

**Hard rules:** Use TypeScript for all new projects. NEVER use `any` — use `unknown` and narrow. ALWAYS enable `strict: true`. ALWAYS use `node:` prefix for Node.js built-in imports. Prefer ESM over CJS for new code.

---

## Core Language (ES2025+)

- Modules: ESM (`import`/`export`) is the standard. CJS (`require`) for legacy only.
- Destructuring: objects, arrays, nested, defaults, rest/spread
- Iterators & generators: `Symbol.iterator`, `function*`, `yield`, lazy evaluation
- Optional chaining (`?.`) and nullish coalescing (`??`) — prefer over `&&` chains
- `structuredClone()` for deep copy (not `JSON.parse(JSON.stringify())`)
- `Object.groupBy()` / `Map.groupBy()`, `Set` methods (union, intersection, difference) — ES2025
- `using` / `await using` — explicit resource management (TC39 Stage 3, TS 5.2+)
- Temporal: Stage 3, shipping in Node 22+ behind --experimental-vm-modules; becoming Stage 4 / native baseline in browsers. Check `Temporal` availability before use; fall back to polyfill for older runtimes.
- Import attributes: `import data from './data.json' with { type: 'json' }`

---

## Module System Decision Tree

```
What module format?
├── New project → ESM ("type": "module" in package.json)
├── Library targeting npm → ESM + CJS dual (package.json exports)
├── Legacy codebase → CJS (migrate to ESM incrementally)
└── Bundled app → ESM (bundler handles resolution)

Module resolution (tsconfig)?
├── Bundled app (Vite, webpack, Turbopack) → moduleResolution: "bundler", module: "esnext"
├── Node.js/library → moduleResolution: "nodenext", module: "nodenext"
└── Running TS natively (Node 22.18+, Deno, Bun) → moduleResolution: "nodenext"
```

**ESM requires file extensions in imports:** `import { foo } from './bar.js'`
With `--rewriteRelativeImportExtensions` (TS 5.8+), use `.ts` extensions.

**Barrel files** (`index.ts` re-exports) — avoid in large projects. They defeat tree-shaking and slow IDE performance.

**Package.json exports field** — the modern way to define public API:
```json
{
  "exports": {
    ".": { "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./utils": { "import": "./dist/utils.js" }
  }
}
```

---

## Async Model (Quick Reference)

JavaScript is single-threaded with an event loop. Understanding execution order is critical.

```
Call Stack → Microtask Queue (Promise.then, queueMicrotask) → Macrotask Queue (setTimeout, I/O)
```

**Key rules:**
- Microtasks drain completely before next macrotask
- `await` yields to microtask queue
- `Promise.all()` for concurrent operations, `Promise.allSettled()` when all must complete
- `AbortController` for cancellation (fetch, timeouts, custom operations)
- Always handle promise rejections — unhandled rejections crash Node.js

→ Deep patterns: `references/async-patterns.md`

---

## Runtime Decision Tree

```
Which JS/TS runtime?
├── Maximum ecosystem compatibility → Node.js
├── Security-first, permissions model → Deno
├── Raw performance, fast DX, all-in-one → Bun
└── Cross-runtime portability → Web Standard APIs (Request/Response)
```

All three run `.ts` natively:
| Runtime | How | Constraints |
|---------|-----|-------------|
| **Node.js** (22.18+) | `node app.ts` (type-stripping) | `erasableSyntaxOnly: true` — no enums, namespaces |
| **Deno** | `deno run app.ts` | Native, no constraints |
| **Bun** | `bun app.ts` | Native transpiler, no constraints |

→ Deep patterns: `references/runtime-patterns.md`

---

## TypeScript Essentials

**Hard rule:** TypeScript for all new projects. It's a type-system layer — the code IS JavaScript.

### Type System
- **Structural typing** — checks shape, not name
- **Type narrowing** — `typeof`, `instanceof`, `in`, discriminated unions, type guards
- **Discriminated unions** — the idiomatic pattern for variant types:

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
function handle(r: Result<string>) {
  if (r.ok) return r.value;     // narrowed
  throw r.error;                 // narrowed
}
```

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

### tsconfig Recommendations

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

**TS 7 awareness:** Go-based compiler, defaults to `strict: true`, `module: "esnext"`, `target: "es2025"`. Drops ES5, AMD/UMD/SystemJS. Address deprecation warnings before upgrading.

→ Advanced type patterns: `references/typescript.md`

---

## Anti-Patterns

1. **`any` abuse** — use `unknown` and narrow; `any` disables type checking and spreads virally
2. **Over-complex generics** — if the type is harder to read than the code, simplify
3. **Ignoring strict mode** — `strict: false` defeats TypeScript's value
4. **Barrel file proliferation** — `index.ts` re-exports slow builds, break tree-shaking
5. **Type assertions over narrowing** — `as T` hides bugs; use type guards
6. **Enums in native execution** — use `as const` objects or string literal unions
7. **Callback hell** — use async/await; promisify legacy callbacks
8. **Unhandled promise rejections** — always catch or use `.catch()`; Node.js crashes on unhandled
9. **Blocking the event loop** — CPU work off main thread via workers
10. **`var` declarations** — use `const` by default, `let` when mutation needed

---

## Related Knowledge

- **react** / **vue** — framework-specific patterns, typed hooks
- **backend** — server frameworks, middleware, API patterns
- **frontend** — component architecture, bundling, build tools
- **web** — browser APIs, fetch, service workers

## References

Load on demand for detailed patterns:

- `references/typescript.md` — advanced type patterns, conditional types, template literals, branded types, type-safe builders
- `references/runtime-patterns.md` — Node.js, Deno, Bun APIs, HTTP servers, file I/O, workers, streams
- `references/async-patterns.md` — event loop model, Promise patterns, async/await, AbortController, async iteration
