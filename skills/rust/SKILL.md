---
name: rust
description: "Write or review Rust. Use for .rs/Cargo.toml, ownership, lifetimes, async, errors, traits, crates, cargo workspaces, and clippy."
user-invocable: true
---

# Rust

Production-grade Rust: ownership, error design, async, traits, cargo workspaces, safety-first.

**Determine the toolchain first.** Read `edition` and `rust-version` in `Cargo.toml` and `rust-toolchain.toml`, and use language and library features only up to that version (minimums are listed below). Crate versions come from the lockfile; check currency before adding or upgrading a crate ([library-reference.md](references/library-reference.md)).

---

## Core Principles

**Ownership and borrowing** — every value has one owner. Borrowing (`&T`, `&mut T`) grants temporary access. Take borrowed parameters; let callers decide lifetimes.

**Lifetimes** — the compiler tracks how long references live. Write explicit lifetimes (`'a`) only where it cannot infer the relationship.

**Result and Option** — no exceptions. `Result<T, E>` for recoverable errors, `Option<T>` for absence. Propagate with `?` and add context at layer boundaries.

**Fearless concurrency** — `Send` and `Sync` gate cross-thread access at compile time. Async code that is spawned onto a multi-thread runtime needs `Send` futures, so values held across `.await` and the errors it returns must be `Send` (and `'static` for spawned tasks).

**Rules that do not bend:**
- No `.unwrap()` / `.expect()` on fallible input (I/O, parsing, user or network data). `.expect("invariant message")` is allowed where the contract excludes the state, and `unwrap` is fine in tests
- No blocking calls (`std::thread::sleep`, blocking I/O) inside async code
- Use `std::sync::LazyLock` (stable since 1.80) / `OnceLock` (since 1.70) instead of `lazy_static!` or `once_cell`
- Every `unsafe` block has a `// SAFETY:` comment stating why it is sound
- Dependencies are explicit and variants are exhaustive: see `development`; Rust forms are in [design-idioms.md](references/design-idioms.md)

---

## Project Kind Decision Tree

```
What is being built?
├── Library crate
│   ├── Runtime-agnostic: do not depend on an async runtime; expose futures and take traits or channels
│   ├── Errors: a typed error enum (derive-based) callers can match on; never an opaque application error type in the public API
│   └── Logging: emit through a logging facade; never install a subscriber
├── Service or daemon
│   ├── Runtime: Tokio is the default for services
│   ├── Errors: typed enums at module boundaries, opaque error with context at the top level
│   └── Logging: structured, with spans, and a subscriber installed once in `main`
├── CLI
│   ├── Argument parsing: derive-based parser; stdout for output, stderr for diagnostics
│   └── Errors: opaque error with context in `main`; rich diagnostics only when source spans help the user
├── Embedded or `no_std`
│   ├── `#![no_std]`, `core` and `alloc` only; no std-only dependencies
│   └── Errors as plain enums; a runtime for embedded targets only if needed, and not the server one
└── WebAssembly
    ├── Target constraints: no threads or blocking I/O by default; async via the host's event loop
    └── Keep the core `no_std`-friendly and thin bindings at the edge
```

Named crates per category and their currency are in [library-reference.md](references/library-reference.md).

---

## Async Traits

```
Which async trait form?
├── Statically dispatched, used inside one crate → native `async fn` in the trait
├── Public trait whose futures must be spawned on a multi-thread runtime → declare `fn f(&self) -> impl Future<Output = T> + Send`
├── Used as `dyn Trait` → native `async fn` is not dyn-compatible: use a boxing macro, return `Pin<Box<dyn Future<Output = T> + Send + '_>>` by hand, or dispatch through an enum of adapters
└── Avoiding the problem → pass a generic parameter (`R: Repository`) instead of `Box<dyn Repository>`
```

---

## Editions and Features

Edition 2024 changes (migrate with `cargo fix --edition`):

| Area | Change |
|------|--------|
| `impl Trait` in return position | Captures all in-scope lifetimes by default; use `use<..>` to opt out precisely |
| `if let` scrutinee temporaries | Dropped before the `else` block |
| Block tail-expression temporaries | Dropped before the block's locals |
| `extern` blocks | Must be `unsafe extern`; items may be marked `safe` |
| `env::set_var`, `env::remove_var` | `unsafe` |
| `unsafe_op_in_unsafe_fn` | Warns by default: unsafe operations in an `unsafe fn` need their own `unsafe` block |
| Prelude | Adds `Future` and `IntoFuture` |
| Cargo resolver | Edition 2024 packages default to resolver 3 (MSRV-aware); in a workspace root, set `resolver` explicitly |

Features by minimum stable version:

| Feature | Since |
|---------|-------|
| Native `async fn` in traits | 1.75 |
| Inline `const { }` blocks | 1.79 |
| `LazyLock`, `LazyCell` | 1.80 |
| `#[expect(lint)]` (warns if the lint does not fire; prefer over `#[allow]`) | 1.81 |
| Async closures (`async \|\| { }`, `AsyncFn*` traits) | 1.85 |
| Edition 2024 | 1.85 |
| `let` chains in `if` and `while` (edition 2024 only) | 1.88 |
| `#[unsafe(naked)]` functions (low-level code only) | 1.88 |

A new project sets `edition = "2024"` in `[package]` (or `[workspace.package]`) and, in a workspace root manifest, `resolver = "3"`.

---

## Lints and Unsafe

Lint configuration depends on the crate kind; use `[workspace.lints]` and have each crate opt in with `[lints] workspace = true`.

| Crate kind | Lint stance |
|------------|-------------|
| Library | `unsafe_code = "forbid"` unless it wraps FFI; clippy `pedantic` at warn with noisy lints allowed; `unwrap_used`, `panic`, `todo`, `dbg_macro` at warn; `expect_used` stays allowed, or, if warned, each invariant `expect` carries `#[expect(clippy::expect_used, reason = "...")]` |
| Binary or CLI | The same, except `print_stdout` and `print_stderr` are allowed |
| Crate with FFI or `unsafe` | `unsafe_code = "deny"` (allow it only in the module that needs it), `unsafe_op_in_unsafe_fn = "warn"` |

Set `allow-unwrap-in-tests`, `allow-expect-in-tests`, and `allow-panic-in-tests` to `true` in `clippy.toml`, so the CI warnings-as-errors run does not reject test code.

FFI and other `unsafe` live in a small dedicated module or crate behind a safe wrapper, with the invariants documented and `// SAFETY:` on every block. Keep `extern "C"` types `#[repr(C)]`, never let a panic unwind across the boundary, and be explicit about who owns and frees memory that crosses it.

---

## API Design Cheat Sheet

```
Function parameters:    &str, &[T], impl AsRef<Path>      — NOT String, Vec<T>, PathBuf
Storing a value:        impl Into<String>                  — convert at storage boundary
Maybe-owned return:     Cow<'_, str>
Derive:                 Debug always; Clone, PartialEq, Eq, Hash, Default where meaningful;
                        Serialize/Deserialize at wire boundaries
Naming conversions:     as_*  (cheap, ref->ref)
                        to_*  (expensive, allocating)
                        into_ (consuming ownership)
```

Key patterns:
- **Builder** — a typestate or derive-based builder when required fields must be enforced at compile time
- **Newtype** — wrap domain concepts (`OrderId(Uuid)`) instead of raw primitives
- **From/Into** — implement `From<A> for B` to get `Into<B> for A` free; convert at boundaries
- **Display/Debug** — implement `Display` for user-facing output, derive `Debug` for everything

---

## CI Checklist

Every PR passes:

```bash
cargo fmt --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace             # or an alternative test runner
cargo test --doc --workspace       # some runners skip doctests
cargo doc --no-deps --workspace
# plus a license and advisory check: tool in library-reference.md
```

Pin the toolchain in `rust-toolchain.toml` when CI uses `-D warnings`, so a compiler upgrade does not turn new lints into build failures. Pipeline design is in `ci-cd`.

---

## Related Knowledge

- **development** — code practice the idioms here express: ownership, variant families, explicit dependencies
- **backend** — service wiring, middleware, lifecycle when building Rust services
- **database** — query and schema design, connection pooling
- **testing** — test strategy; Rust tools are in the testing reference

## References

- [design-idioms.md](references/design-idioms.md) — ports as traits, enum or trait for variant families, typestate, passing dependencies, ownership review
- [async-patterns.md](references/async-patterns.md) — Tokio structured concurrency, cancellation, cancellation safety, backpressure, async review checklist
- [error-handling-patterns.md](references/error-handling-patterns.md) — typed and opaque error patterns, layer conversion, review checklist
- [testing-strategies.md](references/testing-strategies.md) — proptest, test doubles, snapshots, formal tools, test review checklist
- [library-reference.md](references/library-reference.md) — crates by category and currency checks, superseded crates
