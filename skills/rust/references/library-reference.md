# Library Reference

Crates by category. Check currency before adding a crate: recent releases, open security advisories, and whether its MSRV fits the project's `rust-version`. Versions are deliberately omitted; read them from the project's lockfile, and from crates.io or `cargo search` for new choices. Prefer the project's existing crates over introducing a second one for the same job.

## Contents

- [Choosing by category](#choosing-by-category)
- [Feature flags worth knowing](#feature-flags-worth-knowing)
- [Cargo extensions](#cargo-extensions)
- [Superseded](#superseded)

## Choosing by category

| Category | Default | Alternatives and when |
|----------|---------|-----------------------|
| Async runtime (services) | `tokio` | `smol` for small or embedded executors. Libraries should not force a runtime |
| Errors | `thiserror` for typed library errors; `anyhow` for application propagation | `miette` for CLIs and compilers that show source spans; `color-eyre` for backtraces in a `main` |
| HTTP server | `axum` | Others when the team already runs them |
| HTTP client | `reqwest` | Enable a TLS backend feature explicitly and check the current feature names in its docs; prefer rustls where a system OpenSSL is a burden |
| gRPC | `tonic` | |
| Middleware | `tower`, `tower-http` | |
| Serialization | `serde` with the format crate (`serde_json`, `toml`) | `postcard` for `no_std` binary; `rkyv` for zero-copy; `bitcode` for compact binary. Benchmark before choosing on speed |
| SQL | `sqlx` (async, checked queries) | `diesel` for a synchronous ORM; check each one's current async story |
| Embedded key-value | `redb` | `fjall` for write-heavy LSM workloads; `heed` for LMDB |
| Observability | `tracing` with `tracing-subscriber` | `metrics` for counters and histograms; `opentelemetry` for OTLP export |
| Concurrent data | `dashmap` for a concurrent map, `crossbeam` for lock-free structures | `rayon` for CPU-parallel iterators; `flume` or the runtime's channels for message passing |
| CLI | `clap` with `derive` | `argh` when binary size matters |
| Time | `jiff` for new code | `chrono` or `time` when a dependency already pins one |
| IDs | `uuid` (v4 random, v7 time-sortable) | v7 keeps database indexes better ordered |
| Configuration | `figment` for layered sources | `config` for simple cases; `dotenvy` for `.env` in development |
| Testing | `proptest`, `insta`, `tokio-test` | `criterion` or `divan` for benchmarks; `kani-verifier` (the Kani model checker) and `bolero` for formal and fuzz harnesses |

## Feature flags worth knowing

- `tokio` with `features = ["full"]` is convenient in applications; libraries and production builds enable only what they use.
- `reqwest` TLS and JSON are opt-in features whose names have changed across major versions; read the version's feature list.
- `uuid` generators (`v4`, `v7`) are features.
- `sqlx` needs a runtime and a database feature; check the current names.

## Cargo extensions

```bash
cargo install cargo-nextest    # faster parallel test runner (does not run doctests)
cargo install cargo-deny       # licenses, duplicates, advisories
cargo install cargo-audit      # security advisory scanning
cargo install cargo-machete    # unused dependencies
cargo install cargo-expand     # expand macros for debugging
```

## Superseded

| Crate | Use instead |
|-------|-------------|
| `lazy_static`, `once_cell` | `std::sync::LazyLock` (Rust 1.80+) and `OnceLock` (Rust 1.70+) |
| `async-std` | `smol` (the async-std README names it as the replacement) or `tokio` for services; async-std is discontinued |
| `failure` | `thiserror` and `anyhow` |
| `sled` | `redb` or `fjall` for new projects (sled's own README says its main branch is an in-progress rewrite) |
| `async-trait` | Native `async fn` in traits where traits are statically dispatched; keep the macro for `dyn` use |
