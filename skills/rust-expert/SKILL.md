---
name: rust-expert
description: Write, review, and architect production Rust code (Edition 2024). Use for architecture design, code generation, code review, testing, async patterns, error handling, workspace setup, crate selection, debugging, or performance. Activates on .rs files, Cargo.toml, or any Rust-related question.
---

# Rust Expert (2026)

Production-grade Rust expertise. Edition 2024, resolver 3, safety-first.

---

## Quick Start

**Read this file first. Then load the workflow reference for your role.**

---

## Core Principles (non-negotiable)

```toml
# Every new project starts with:
edition = "2024"
resolver = "3"
```

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
# Silence noisy pedantic lints
module_name_repetitions = "allow"
must_use_candidate = "allow"
missing_errors_doc = "allow"
```

**Rules that NEVER bend:**
- No `.unwrap()` / `.expect()` in production paths — use `?` + `.context()`
- No `std::thread::sleep` in async code — use `tokio::time::sleep`
- No `lazy_static!` / `once_cell` — use `std::sync::LazyLock` (stable since 1.80)
- No `async-std` — discontinued March 2025; Tokio is the runtime
- No `sled` for new projects — use `redb` or `fjall`
- All errors must be `Send + Sync + 'static` in async code

---

## Standard Crate Defaults

When in doubt, these are the defaults. See `references/library-reference.md` for full catalog.

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

Error handling choice:
- **Library crate** → `thiserror` (typed errors callers can match on)
- **Application / binary** → `anyhow` (opaque propagation with context)
- **User-facing CLI** → `miette` (rich diagnostics with source spans)

---

## Edition 2024 Key Changes

Must know — these break older patterns:

| Feature | Old way | New way |
|---------|---------|---------|
| `impl Trait` lifetimes | implicit capture | `use<..>` for precise control |
| Temporaries in `if let` | drop at end of statement | drop at end of `if` block (fewer deadlocks) |
| `extern` blocks | `extern { }` | `unsafe extern { }` |
| `env::set_var` | safe | `unsafe` required |
| Prelude | — | `Future`, `IntoFuture` added |

New language features to use actively:
- **`let` chains** (1.88): `if let Some(x) = foo() && x > 5 && let Ok(y) = bar(x)`
- **Async closures** (1.85): `async || { ... }` with `AsyncFn` trait
- **`#[expect(lint)]`** (1.81): Replaces `#[allow]` — warns if lint is NOT triggered
- **Inline const** (1.79): `const { std::mem::size_of::<T>() }` in expressions
- **Native `async fn` in traits** (1.75): No `async-trait` crate needed for static dispatch

---

## API Design Cheat Sheet

```
Function parameters:    &str, &[T], impl AsRef<Path>      — NOT String, Vec<T>, PathBuf
Storing a value:        impl Into<String>                  — convert at storage boundary
Maybe-owned return:     Cow<'_, str>
Always derive:          Debug, Clone, PartialEq, Eq, Hash, Default, Serialize, Deserialize
Naming conversions:     as_*  (cheap, ref→ref)
                        to_*  (expensive, allocating)
                        into_ (consuming ownership)
```

---

## Workflows

Each workflow is a complete strategy document for a specific role.  
**Load exactly the one you need:**

| Role | Workflow | When to use |
|------|----------|-------------|
| Architect / Planner | `workflows/architect.md` | Designing modules, defining interfaces, writing specs, breaking down tasks |
| Implementer | `workflows/implement.md` | Writing Rust code from a spec or task description |
| Reviewer | `workflows/review.md` | Reviewing PRs, auditing code quality, checking correctness |
| Tester | `workflows/test.md` | Writing tests, property tests, snapshots, benchmarks |

Each workflow references other skill documents as needed.  
You do not need to load all references — only what the workflow instructs.

---

## Additional References

Load on demand as instructed by your workflow:

- `references/error-handling-patterns.md` — deep-dive thiserror / anyhow / miette patterns
- `references/async-patterns.md` — Tokio structured concurrency, cancellation, backpressure
- `references/architecture-patterns.md` — hexagonal, typestate, CQRS, dependency injection
- `references/testing-strategies.md` — proptest, kani, bolero, insta, model-based testing
- `references/library-reference.md` — full crate catalog by category with versions

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
