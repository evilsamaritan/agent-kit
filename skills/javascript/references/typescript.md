# Advanced TypeScript Patterns

Deep-dive into TypeScript's type system: conditional types, template literals, mapped types, branded types, type-safe builders, recursive types, variadic tuples, pattern matching, the tsconfig decision tree, and the TypeScript 6 and 7 changes.

## Contents

- [Conditional Types](#conditional-types)
- [Template Literal Types](#template-literal-types)
- [Mapped Types](#mapped-types)
- [Type-Safe Builders](#type-safe-builders)
- [Branded Types](#branded-types)
- [Recursive Types](#recursive-types)
- [Variadic Tuple Types](#variadic-tuple-types)
- [Pattern Matching with Infer](#pattern-matching-with-infer)
- [tsconfig Decision Tree](#tsconfig-decision-tree)
- [TypeScript 6 and 7](#typescript-6-and-7)
- [Native TS Execution](#native-ts-execution)

---

## Conditional Types

```typescript
// Basic: T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

// Distributive — applies to each union member separately
type ToArray<T> = T extends unknown ? T[] : never;
type Result = ToArray<string | number>; // string[] | number[]

// Prevent distribution with tuple wrapper
type ToArrayNonDist<T> = [T] extends [unknown] ? T[] : never;
type Result2 = ToArrayNonDist<string | number>; // (string | number)[]

// Nested conditional — extract deeply
type UnwrapPromise<T> = T extends Promise<infer U>
  ? UnwrapPromise<U>  // recursive unwrap
  : T;

type Deep = UnwrapPromise<Promise<Promise<string>>>; // string
```

---

## Template Literal Types

```typescript
// Event handler names
type EventName<T extends string> = `on${Capitalize<T>}`;
type ClickEvent = EventName<"click">; // "onClick"

// CSS units
type CSSUnit = "px" | "rem" | "em" | "vh" | "vw" | "%";
type CSSValue = `${number}${CSSUnit}`;

// Route params extraction
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type Params = ExtractParams<"/users/:userId/posts/:postId">;
// "userId" | "postId"

// String manipulation utilities (built-in)
type Upper = Uppercase<"hello">;       // "HELLO"
type Lower = Lowercase<"HELLO">;       // "hello"
type Cap = Capitalize<"hello">;        // "Hello"
type Uncap = Uncapitalize<"Hello">;    // "hello"
```

---

## Mapped Types

```typescript
// Make all properties optional and nullable
type Nullable<T> = { [K in keyof T]: T[K] | null };

// Make specific keys required, rest optional
type RequireKeys<T, K extends keyof T> = Omit<Partial<T>, K> & Pick<T, K>;

// Rename keys with template literals
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User { name: string; age: number }
type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// Filter properties by type
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};
type StringProps = PickByType<User, string>; // { name: string }

// Deep readonly
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// Deep partial
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
```

---

## Type-Safe Builders

```typescript
// Builder with compile-time required field tracking
interface Config {
  host: string;
  port: number;
  ssl: boolean;
}

class ConfigBuilder<State extends Partial<Record<keyof Config, true>> = {}> {
  private config: Partial<Config> = {};

  // The cast is the one place the state type is asserted; keep it in the builder
  host(h: string): ConfigBuilder<State & { host: true }> {
    this.config.host = h;
    return this as unknown as ConfigBuilder<State & { host: true }>;
  }

  port(p: number): ConfigBuilder<State & { port: true }> {
    this.config.port = p;
    return this as unknown as ConfigBuilder<State & { port: true }>;
  }

  ssl(s: boolean): ConfigBuilder<State & { ssl: true }> {
    this.config.ssl = s;
    return this as unknown as ConfigBuilder<State & { ssl: true }>;
  }

  // build() only available when all required fields are set
  build(this: ConfigBuilder<{ host: true; port: true; ssl: true }>): Config {
    return this.config as Config; // safe: the `this` type proves every field is set
  }
}

// Compile error if missing required fields
new ConfigBuilder().host("localhost").port(3000).ssl(true).build(); // OK
// new ConfigBuilder().host("localhost").build(); // Error: port and ssl missing
```

---

## Branded Types

```typescript
// Nominal typing via branding — prevents mixing compatible structural types
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

type USD = Brand<number, "USD">;
type EUR = Brand<number, "EUR">;
type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

// Constructor functions with validation
function usd(amount: number): USD {
  if (amount < 0) throw new Error("Negative amount");
  return amount as USD;
}

function userId(id: string): UserId {
  if (!id.match(/^usr_/)) throw new Error("Invalid user ID format");
  return id as UserId;
}

// Type system prevents mixing
function transfer(from: UserId, amount: USD): void { /* ... */ }
// transfer(orderId, euros); // Compile error!
```

---

## Recursive Types

```typescript
// JSON type
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// Deep path access
type Path<T, K extends string> =
  K extends `${infer Head}.${infer Tail}`
    ? Head extends keyof T
      ? Path<T[Head], Tail>
      : never
    : K extends keyof T
      ? T[K]
      : never;

interface Nested {
  user: { profile: { name: string; age: number } };
}

type Name = Path<Nested, "user.profile.name">; // string

// Flatten nested arrays
type Flatten<T> = T extends (infer U)[] ? Flatten<U> : T;
type F = Flatten<number[][][]>; // number
```

---

## Variadic Tuple Types

```typescript
// Typed pipe/compose
type Last<T extends unknown[]> = T extends [...unknown[], infer L] ? L : never;

// Typed zip
type Zip<A extends unknown[], B extends unknown[]> =
  A extends [infer AH, ...infer AT]
    ? B extends [infer BH, ...infer BT]
      ? [[AH, BH], ...Zip<AT, BT>]
      : []
    : [];

type Zipped = Zip<[1, 2, 3], ["a", "b", "c"]>;
// [[1, "a"], [2, "b"], [3, "c"]]

// Spread in function params
function concat<A extends unknown[], B extends unknown[]>(
  a: [...A], b: [...B]
): [...A, ...B] {
  return [...a, ...b];
}
```

---

## Pattern Matching with Infer

`any[]` and `any` inside `infer` patterns and generic parameter bounds are the accepted use of `any`: they match every signature without widening a value's type. Values stay `unknown`.

```typescript
// Extract function pieces
type FirstArg<F> = F extends (arg: infer A, ...args: any[]) => any ? A : never;
type AwaitedReturn<F> = F extends (...args: any[]) => Promise<infer R> ? R : never;

// Extract array element type
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;

// Extract Map key/value types
type MapKey<T> = T extends Map<infer K, any> ? K : never;
type MapValue<T> = T extends Map<any, infer V> ? V : never;

// Infer with constraints
type GetProperty<T, K extends string> =
  T extends { [P in K]: infer V } ? V : never;

// Multiple infer positions
type ParseRoute<T extends string> =
  T extends `${infer Method} ${infer Path}`
    ? { method: Uppercase<Method>; path: Path }
    : never;

type Route = ParseRoute<"get /users/:id">;
// { method: "GET"; path: "/users/:id" }
```

---

## tsconfig Decision Tree

Set `strict`, `module`, `moduleResolution`, `target`, and `types` explicitly. The defaults changed in TypeScript 6 and differ from older versions, so a config that relies on them behaves differently across toolchains.

### By project type

```
What kind of project?
├── Node.js application or library (compiled by tsc)
│   ├── module: "nodenext", moduleResolution: "nodenext"
│   ├── library: declaration: true, declarationMap: true
│   └── types: ["node"]
├── Bundled app (Vite, webpack, Rspack, framework toolchain)
│   ├── module: "esnext", moduleResolution: "bundler"
│   ├── noEmit: true (the bundler emits)
│   └── types: only the globals the app uses (e.g. "vite/client")
├── Native TS execution (Node 22.18+ or 24, Deno, Bun)
│   ├── module: "nodenext", moduleResolution: "nodenext", noEmit: true
│   ├── erasableSyntaxOnly: true (Node only)
│   ├── verbatimModuleSyntax: true
│   └── `.ts` in relative imports: allowImportingTsExtensions with noEmit, or rewriteRelativeImportExtensions when tsc emits
└── Monorepo package
    ├── composite: true, references: [{ "path": "../other-pkg" }]
    └── same module and resolution as its project type above
```

`target` = the oldest runtime you ship to (the lowest Node or browser baseline), not the newest ES version. It decides which syntax is lowered; library APIs are not polyfilled by `target` but by `lib` and runtime support.

### Always-on flags

```jsonc
{
  "compilerOptions": {
    "strict": true,                    // Non-negotiable
    "noUncheckedIndexedAccess": true,  // Arrays/records return T | undefined
    "exactOptionalPropertyTypes": true,// Distinguish undefined from missing
    "isolatedModules": true,           // Required for most bundlers/transpilers
    "skipLibCheck": true,              // Faster builds, skip .d.ts checking
    "forceConsistentCasingInFileNames": true
  }
}
```

### What `strict: true` enables

`strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`.

### `erasableSyntaxOnly` (TS 5.8+)

Required for Node.js native type-stripping. Disallows TypeScript syntax that requires code generation:
- **Blocked:** `enum`, `namespace`, parameter properties (`constructor(public x: number)`), `import =` / `export =`
- **Allowed:** type annotations, interfaces, `type` keyword, `as const`, `satisfies`, generics
- **Workarounds:** Use `as const` objects instead of enums, regular class properties instead of parameter properties

### `rewriteRelativeImportExtensions` (TS 5.7+)

Allows writing `.ts` extensions in imports and having the compiler rewrite them to `.js` in output:
```typescript
// Source: import { foo } from './bar.ts'
// Output: import { foo } from './bar.js'
```

Only rewrites relative imports (starts with `./` or `../`). Does not affect package imports.

---

## TypeScript 6 and 7

Status as of 2026-10: TypeScript 6.0 (released 2026-03-23) is the last release on the JavaScript-based compiler and the bridge release. TypeScript 7.0 (released 2026-07-08) is the native (Go) compiler, still invoked as `tsc`, with much faster builds. Check the project's `typescript` version before using anything here.

Defaults in TypeScript 6 and 7 (older versions differ):

| Option | Default |
|--------|---------|
| `strict` | `true` |
| `module` | `esnext` |
| `target` | a floating current ES version |
| `types` | `[]` (no `@types/*` auto-inclusion: list `"node"` and others explicitly; `["*"]` restores the old behavior but costs build time) |

Deprecated in 6 (silenced there with `"ignoreDeprecations": "6.0"`) and unsupported in 7: `target: es5`, `downlevelIteration`, `moduleResolution: node10` and `classic`, `module: amd | umd | systemjs | none`, and `baseUrl` (use `paths` relative to the config, or package `exports`). Import attributes require the `with` keyword; `asserts` on imports is an error.

Migration:

1. Upgrade to 6 first, set the options explicitly, and fix its deprecation warnings.
2. Add `types` entries the build needs; missing globals (`process`, `describe`) are the most common break.
3. Replace `baseUrl` lookups with `paths` or workspace packages.
4. Move to 7 when the toolchain allows. TypeScript 7.0 ships without a programmatic API (a new API is expected in 7.1), so tools that load the compiler as a library, typescript-eslint among them, can need the TypeScript 6 compatibility package (`@typescript/typescript6`, which provides a `tsc6` executable and the 6.0 API) beside it, for example through an npm alias. Check each tool's support before upgrading.

## Native TS Execution

Node 22.18+ and 24 run `.ts` files directly by stripping types, with no flag (stable from 24.12 and 25.2); Deno and Bun run TypeScript natively. Type stripping does not transform syntax that needs code generation, hence `erasableSyntaxOnly`. Write `.ts` in relative import specifiers, keep type-only imports as `import type` (or `verbatimModuleSyntax`), and run `tsc --noEmit` for type checking: the runtimes do not check types.
