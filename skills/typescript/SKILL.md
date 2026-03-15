---
name: typescript
description: Apply TypeScript type system, generics, module resolution, tsconfig, and native TS execution. Use when working with TypeScript types, generics, conditional types, mapped types, module resolution, or tsconfig. Do NOT use for React patterns (use react) or web platform APIs (use web-platform).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# TypeScript

Expert-level TypeScript knowledge. Structural type system, advanced generics, native TS execution (Node.js, Deno, Bun).

**Hard rules:** NEVER use `any` — use `unknown` and narrow. ALWAYS enable `strict: true`. NEVER use `as T` assertions when narrowing is possible. ALWAYS use `node:` prefix for Node.js built-in imports.

---

## Type System Fundamentals

**Structural typing** — TypeScript checks shape, not name. Two types with identical structure are compatible regardless of declaration.

**Type narrowing** — use control flow to refine types:

```typescript
// Discriminated unions — the idiomatic pattern for variant types
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

function handle(r: Result<string>) {
  if (r.ok) return r.value;     // narrowed to { ok: true; value: string }
  throw r.error;                 // narrowed to { ok: false; error: Error }
}
```

**Narrowing tools:** `typeof`, `instanceof`, `in`, discriminant properties, user-defined type guards (`x is T`), assertion functions (`asserts x is T`).

---

## Generics Patterns

| Pattern | Use when | Example |
|---------|----------|---------|
| **Constrained generic** | Require specific shape | `<T extends { id: string }>` |
| **Conditional type** | Type-level branching | `T extends string ? A : B` |
| **Mapped type** | Transform all properties | `{ [K in keyof T]: Readonly<T[K]> }` |
| **Template literal** | String manipulation at type level | `` `on${Capitalize<string>}` `` |
| **Infer** | Extract inner types | `T extends Promise<infer U> ? U : T` |
| **Recursive type** | Nested structures | `type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> }` |

**Rule of thumb:** If a generic has more than 3 type parameters, refactor. Generics should clarify, not obscure.

---

## Utility Types Cheat Sheet

| Utility | What it does | Common use |
|---------|-------------|------------|
| `Pick<T, K>` | Keep only keys K | API response subsets |
| `Omit<T, K>` | Remove keys K | Exclude internal fields |
| `Partial<T>` | All properties optional | Patch/update payloads |
| `Required<T>` | All properties required | Validated/complete objects |
| `Record<K, V>` | Object with keys K, values V | Lookup maps |
| `Extract<T, U>` | Members of T assignable to U | Filter union members |
| `Exclude<T, U>` | Members of T not assignable to U | Remove union members |
| `ReturnType<F>` | Return type of function | Infer from existing functions |
| `Parameters<F>` | Tuple of parameter types | Wrapper functions |
| `Awaited<T>` | Unwrap Promise recursively | Async return types |
| `NoInfer<T>` | Prevent inference at a position | Force caller to specify type |
| `Readonly<T>` | All properties readonly | Immutable data |

---

## Module Resolution Decision Tree

- If bundled app (webpack, Vite, esbuild, Turbopack) --> `moduleResolution: "bundler"`, `module: "esnext"`
- If Node.js project or library --> `moduleResolution: "nodenext"`, `module: "nodenext"`
- If running TS natively (Node.js 22.18+, Deno, Bun) --> `moduleResolution: "nodenext"`, `module: "nodenext"`

**ESM requires file extensions in imports:** `import { foo } from './bar.js'` (even for `.ts` files). With `--rewriteRelativeImportExtensions` (TS 5.8+), use `.ts` extensions and let the compiler rewrite them.

**Barrel files** (`index.ts` re-exports) -- avoid in large projects. They defeat tree-shaking and slow IDE performance.

---

## Native TS Execution

All three runtimes now run `.ts` files directly -- no build step required.

| Runtime | How | Constraints |
|---------|-----|-------------|
| **Node.js** (22.18+) | `node app.ts` (type-stripping) | Requires `erasableSyntaxOnly: true` -- no enums, namespaces, parameter properties |
| **Deno** | `deno run app.ts` | Native, no constraints, full type support |
| **Bun** | `bun app.ts` | Native transpiler, no constraints |

When using Node.js native execution, add to tsconfig: `"erasableSyntaxOnly": true`, `"rewriteRelativeImportExtensions": true`, `"verbatimModuleSyntax": true`.

---

## tsconfig Recommendations

```jsonc
{
  "compilerOptions": {
    "strict": true,                    // Non-negotiable (default in TS 7+)
    "noUncheckedIndexedAccess": true,  // Arrays/records return T | undefined
    "exactOptionalPropertyTypes": true,// Distinguish undefined from missing
    "isolatedModules": true,           // Required for most bundlers
    "skipLibCheck": true,              // Faster builds, skip .d.ts checking
    "declaration": true,               // Emit .d.ts for libraries
    "sourceMap": true,                 // Debugging support
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

**`strict: true`** enables: `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`.

**TS 7 migration awareness:** TS 7 (Go-based compiler) defaults to `strict: true`, `module: "esnext"`, `target: "es2025"`. Drops ES5 targets, AMD/UMD/SystemJS modules, and `baseUrl` for path resolution. Address TS 6 deprecation warnings before upgrading.

---

## Runtime Patterns

- **HTTP servers** -- all runtimes converge on Web Standard `Request`/`Response`; use portable frameworks (Hono, h3) for cross-runtime code
- **File I/O** -- Node.js: `node:fs/promises`; Deno: `Deno.readTextFile()`; Bun: `Bun.file()`
- **Workers** -- CPU-intensive work off main thread; Node.js/Bun: `node:worker_threads`; Deno: Web Workers
- **Streams** -- prefer Web Streams API for cross-runtime code; Node.js streams for Node-specific APIs
- **Error handling** -- always type catch as `unknown`; use cause chaining (`new Error(msg, { cause })`)
- **Testing** -- Node.js: `node:test`; Deno: `Deno.test`; Bun: `bun:test` (Jest-compatible)

---

## Anti-Patterns

1. **`any` abuse** — use `unknown` and narrow; `any` disables all type checking and spreads virally
2. **Over-complex generics** — if the type is harder to read than the code, simplify; extract named types
3. **Ignoring strict mode** — `strict: false` defeats TypeScript's value; enable and fix errors
4. **Barrel file proliferation** — `index.ts` re-exports slow builds, break tree-shaking, create circular deps
5. **Type assertions over narrowing** -- `as T` hides bugs; use type guards and discriminated unions instead
6. **Enums in native execution** -- `enum` requires code generation; use `as const` objects or string literal unions for Node.js native TS

---

## Related Knowledge

- **react** — React-specific TypeScript patterns, typed hooks, component props
- **vue** — Vue TypeScript integration, typed composables, defineProps
- **backend** — runtime patterns (Node.js, Deno, Bun), server frameworks

## References

Load on demand for detailed patterns and deep-dive knowledge:

- `references/type-patterns.md` — advanced type patterns, conditional types, template literal types, type-safe builders
- `references/runtime-patterns.md` — runtime patterns (Node.js, Deno, Bun), HTTP servers, file I/O, testing, workers
