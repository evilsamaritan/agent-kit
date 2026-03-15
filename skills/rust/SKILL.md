---
name: rust
description: Write, review, and architect Rust code — ownership, lifetimes, async, error handling, crate selection, API design. Use when working with .rs files, Cargo.toml, or any Rust question. Triggers on cargo, tokio, serde, axum, clippy, Edition 2024.
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Rust

Production-grade Rust expertise. Edition 2024, resolver 3, safety-first.

---

## Core Principles

**Ownership & Borrowing** — every value has exactly one owner. Borrowing (`&T`, `&mut T`) grants temporary access without ownership transfer. Prefer borrowing in function parameters; let callers decide lifetimes.

**Lifetimes** — the compiler tracks how long references live. Explicit lifetimes (`'a`) are needed when the compiler cannot infer relationships. Edition 2024 changes `impl Trait` lifetime capture — use `use<..>` for precise control.

**Error handling with Result/Option** — no exceptions. `Result<T, E>` for recoverable errors, `Option<T>` for absence. Propagate with `?` and `.context()`. Never `.unwrap()` or `.expect()` in production paths.

- **Library crate** -> `thiserror` (typed errors callers can match on)
- **Application / binary** -> `anyhow` (opaque propagation with context)
- **User-facing CLI** -> `miette` (rich diagnostics with source spans)
- **Main function** -> `color-eyre` (colorized error reports with backtraces)

**Fearless concurrency** — Rust's type system prevents data races at compile time. `Send` + `Sync` traits gate cross-thread access. Async code uses Tokio; all async errors must be `Send + Sync + 'static`.

**Rules that NEVER bend:**
- No `.unwrap()` / `.expect()` in production paths — use `?` + `.context()`
- No `std::thread::sleep` in async code — use `tokio::time::sleep`
- No `lazy_static!` / `once_cell` — use `std::sync::LazyLock` (stable since 1.80)
- No `async-std` — discontinued; Tokio is the runtime
- No `sled` for new projects — use `redb` or `fjall`
- No `async-trait` crate — use native `async fn` in traits (stable since 1.75)
- All errors must be `Send + Sync + 'static` in async code

---

## Edition 2024 Changes

| Feature | Old way | New way |
|---------|---------|---------|
| `impl Trait` lifetimes | implicit capture | `use<..>` for precise control |
| Temporaries in `if let` | drop at end of statement | drop at end of `if` block (fewer deadlocks) |
| `extern` blocks | `extern { }` | `unsafe extern { }` |
| `env::set_var` | safe | `unsafe` required |
| Prelude | -- | `Future`, `IntoFuture` added |

New language features to use actively:
- **`let` chains**: `if let Some(x) = foo() && x > 5 && let Ok(y) = bar(x)` (Edition 2024 only)
- **Async closures**: `async || { ... }` with `AsyncFn`/`AsyncFnMut`/`AsyncFnOnce` traits
- **`#[expect(lint)]`**: Replaces `#[allow]` — warns if lint is NOT triggered
- **Inline const**: `const { std::mem::size_of::<T>() }` in expressions
- **Native `async fn` in traits**: No `async-trait` crate needed for static dispatch
- **Naked functions**: `#[naked]` for full assembly control (no compiler prologue/epilogue)
- **`array_windows`**: `slice.array_windows::<N>()` returns `&[T; N]` iterator (not `&[T]`)

Every new project starts with:

```toml
edition = "2024"
resolver = "3"
```

---

## Standard Crate Defaults

```toml
[workspace.dependencies]
tokio          = { version = "1",    features = ["full"] }
axum           = { version = "0.8",  features = ["macros"] }
reqwest        = { version = "0.12", features = ["rustls-tls", "json"] }
serde          = { version = "1",    features = ["derive"] }
serde_json     = "1"
thiserror      = "2"
anyhow         = "1"
sqlx           = { version = "0.8",  features = ["postgres", "runtime-tokio"] }
tracing        = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
clap           = { version = "4",    features = ["derive"] }
uuid           = { version = "1",    features = ["v4", "v7"] }
```

Standard lint configuration:

```toml
[workspace.lints.rust]
unsafe_code = "forbid"

[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
unwrap_used = "warn"
expect_used = "warn"
panic = "warn"
todo = "warn"
dbg_macro = "warn"
print_stdout = "warn"
print_stderr = "warn"
module_name_repetitions = "allow"
must_use_candidate = "allow"
missing_errors_doc = "allow"
```

See `references/library-reference.md` for full crate catalog by category.

---

## API Design Cheat Sheet

```
Function parameters:    &str, &[T], impl AsRef<Path>      — NOT String, Vec<T>, PathBuf
Storing a value:        impl Into<String>                  — convert at storage boundary
Maybe-owned return:     Cow<'_, str>
Always derive:          Debug, Clone, PartialEq, Eq, Hash, Default, Serialize, Deserialize
Naming conversions:     as_*  (cheap, ref->ref)
                        to_*  (expensive, allocating)
                        into_ (consuming ownership)
```

Key patterns:
- **Builder** — use `bon` crate for compile-time required/optional field enforcement
- **Newtype** — wrap domain concepts (`OrderId(Uuid)`) instead of raw primitives
- **From/Into** — implement `From<A> for B` to get `Into<B> for A` free; convert at boundaries
- **Display/Debug** — implement `Display` for user-facing output, derive `Debug` for everything

---

## CI Checklist

Every PR must pass:

```bash
cargo fmt --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo nextest run --workspace
cargo doc --no-deps --workspace
cargo deny check
```

---

## Related Knowledge

- **backend** — service patterns, DI, middleware when building Rust services
- **database** — sqlx patterns, connection pooling, query optimization
- **qa** — proptest, Kani verification, cargo-mutants, test architecture

## References

Load on demand for detailed patterns and deep-dive knowledge:

- `references/architecture-patterns.md` — hexagonal, typestate, CQRS, event sourcing, DI, ownership checklist
- `references/async-patterns.md` — Tokio structured concurrency, cancellation, backpressure, async safety checklist
- `references/error-handling-patterns.md` — thiserror / anyhow / miette / color-eyre patterns, error review checklist
- `references/testing-strategies.md` — proptest, kani, bolero, insta, model-based testing, test completion checklist
- `references/library-reference.md` — full crate catalog by category with versions
