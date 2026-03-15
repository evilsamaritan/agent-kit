# Library Reference

## Contents

- [Async Runtime](#async-runtime)
- [Error Handling](#error-handling)
- [Web / HTTP](#web--http)
- [Serialization](#serialization)
- [Database / Storage](#database--storage)
- [Observability](#observability)
- [Concurrency / Data Structures](#concurrency--data-structures)
- [CLI](#cli)
- [Time](#time)
- [IDs](#ids)
- [Configuration](#configuration)
- [Testing](#testing)
- [Build Tools (cargo extensions)](#build-tools-cargo-extensions)
- [Do NOT Use (deprecated / superseded)](#do-not-use-deprecated--superseded)

Curated crate catalog for production Rust.
**One recommendation per category.** Alternatives noted where the choice is context-dependent.

---

## Async Runtime

**`tokio` 1.x** — the only choice for production.
- Required by: reqwest, sqlx, axum, tonic, tower
- Features: `["full"]` for development, specific features for production builds
- Note: async-std discontinued. Use smol only for embedded/no-std.

---

## Error Handling

| Crate | When |
|-------|------|
| **`thiserror` 2.x** | Library crates — typed errors callers match on |
| **`anyhow` 1.x** | Binary/application code — opaque propagation |
| **`miette` 7.x** | CLIs and compilers — rich diagnostics with source spans |
| **`color-eyre` 0.6** | Main function — colorized error reports |

---

## Web / HTTP

| Crate | Role |
|-------|------|
| **`axum` 0.8** | HTTP server — preferred over actix-web (better DX, Tower ecosystem) |
| **`reqwest` 0.12** | HTTP client — use `rustls-tls` feature, avoid `openssl` |
| **`tower-http` 0.6** | Middleware: CORS, tracing, compression, auth |
| **`tonic` 0.12** | gRPC server and client |

---

## Serialization

| Crate | When |
|-------|------|
| **`serde` 1.x** | Default — derive Serialize/Deserialize on everything |
| **`serde_json`** | JSON (required for axum/reqwest) |
| **`bitcode` 0.6** | Fast binary — best combined ser+deser+size performance |
| **`rkyv` 0.8** | Zero-copy deserialization — when latency matters most |
| **`postcard`** | no-std binary serialization |

---

## Database / Storage

| Crate | When |
|-------|------|
| **`sqlx` 0.8** | Postgres / SQLite / MySQL — async, compile-time query checking |
| **`redb` 2.x** | Embedded KV — pure Rust, ACID, B-tree, stable |
| **`fjall` 0.x** | Embedded KV — write-heavy workloads (LSM-tree) |
| **`heed` 3.x** | LMDB wrapper — when you need the fastest possible reads |
| ~~sled~~ | Do NOT use — still alpha, rewrite in progress |

---

## Observability

| Crate | Role |
|-------|------|
| **`tracing` 0.1** | Structured spans and events — use instead of `log` |
| **`tracing-subscriber` 0.3** | Subscriber setup with `env-filter` |
| **`metrics` 0.23** | Counters, gauges, histograms |
| **`opentelemetry` 0.27** | OTLP export for distributed tracing |

---

## Concurrency / Data Structures

| Crate | When |
|-------|------|
| **`dashmap` 6.x** | Concurrent HashMap — standard choice |
| **`papaya`** | Concurrent HashMap — lock-free reads, better tail latency |
| **`crossbeam` 0.8** | Lock-free data structures, scoped threads |
| **`rayon` 1.x** | CPU-parallel iterators |
| **`flume`** | MPMC channels — faster than std, simpler than crossbeam |
| **`kanal`** | Fastest async/sync channel available |

---

## CLI

**`clap` 4.x** with `features = ["derive"]` — derive-based, handles everything.  
Use `argh` only if binary size is critical.

---

## Time

| Crate | When |
|-------|------|
| **`jiff` 0.2** | New projects — best timezone correctness, IANA database built-in |
| **`chrono` 0.4** | When ecosystem compatibility required (sqlx uses it) |
| **`time` 0.3** | no-std environments |

---

## IDs

```toml
uuid = { version = "1", features = ["v4", "v7"] }
```
- UUIDv4 for random IDs
- UUIDv7 for time-sortable IDs (better DB index performance)

---

## Configuration

| Crate | When |
|-------|------|
| **`figment` 0.10** | Complex config — layered sources (file + env + defaults) |
| **`config` 0.14** | Simpler projects |
| **`dotenvy`** | Load `.env` files in development |

---

## Testing

| Crate | Role |
|-------|------|
| **`proptest` 1.x** | Property-based testing |
| **`insta` 1.x** | Snapshot testing |
| **`tokio-test`** | Test utilities for async code |
| **`divan` 0.1** | Benchmarking — simpler API than criterion |
| **`criterion` 0.5** | Benchmarking — more features, statistical analysis |
| **`kani`** | Formal verification (requires separate install) |
| **`bolero` 0.13** | Unified fuzzing + proptest + kani harness |

---

## Build Tools (cargo extensions)

```bash
cargo install cargo-nextest    # faster parallel test runner
cargo install cargo-deny       # license / duplicate / vuln checking
cargo install cargo-audit      # security advisory scanning
cargo install cargo-machete    # find unused dependencies
cargo install cargo-expand     # expand macros for debugging
```

---

## Do NOT Use (deprecated / superseded)

| Crate | Reason | Use instead |
|-------|--------|-------------|
| `lazy_static` | superseded | `std::sync::LazyLock` |
| `once_cell` | superseded | `std::sync::OnceLock` / `LazyLock` |
| `async-std` | discontinued | `tokio` |
| `sled` | perpetual alpha | `redb` or `fjall` |
| `failure` | superseded | `thiserror` + `anyhow` |
| `async-trait` | superseded | native `async fn` in traits (stable since Rust 1.75) |
