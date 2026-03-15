# Error Handling Patterns

## Contents

- [The Core Rule](#the-core-rule)
- [Pattern 1: Library Error Design (thiserror)](#pattern-1-library-error-design-thiserror)
- [Pattern 2: Application Error Propagation (anyhow)](#pattern-2-application-error-propagation-anyhow)
- [Pattern 3: Cross-Layer Error Conversion](#pattern-3-cross-layer-error-conversion)
- [Pattern 4: Error in async Traits](#pattern-4-error-in-async-traits)
- [Pattern 5: User-Facing Errors (miette)](#pattern-5-user-facing-errors-miette)
- [Anti-Patterns](#anti-patterns)

---

## The Core Rule

**Reason about intent, not crate names:**
- Can the caller recover differently based on which error occurred? → typed `thiserror` enum
- Is the error only being propagated or logged? → `anyhow`
- Is the error shown to a human with source context? → `miette`

---

## Pattern 1: Library Error Design (thiserror)

```rust
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    // Caller can match on this to retry
    #[error("connection to {host} failed: {source}")]
    Connection { host: String, #[source] source: io::Error },

    // Caller can match on this to handle not-found
    #[error("key {0:?} not found")]
    NotFound(String),

    // Wraps lower-level error — use #[from] only at layer boundaries
    #[error("serialization failed")]
    Serialization(#[from] serde_json::Error),

    // Catch-all for truly unrecoverable situations
    #[error("internal error: {0}")]
    Internal(String),
}
```

Rules:
- Every variant a caller might `match` on deserves its own type
- `#[from]` is convenient but hides the conversion — use sparingly
- `#[source]` preserves the error chain without consuming `Display`
- Avoid generic `Internal(Box<dyn Error>)` — it's `anyhow` without the ergonomics

---

## Pattern 2: Application Error Propagation (anyhow)

```rust
use anyhow::{Context, Result};

pub async fn run_job(config: &Config) -> Result<()> {
    let conn = connect(&config.db_url).await
        .context("failed to connect to database")?;

    let records = conn.fetch_pending().await
        .context("failed to fetch pending records")?;

    for record in records {
        process(&conn, record).await
            .with_context(|| format!("failed to process record {}", record.id))?;
    }

    Ok(())
}
```

Rules:
- Add `.context()` at every `?` — the error chain is your stacktrace substitute
- Use `.with_context(|| ...)` (lazy) when the message involves allocation
- `anyhow::bail!("message")` is shorthand for `return Err(anyhow!("message"))`
- `anyhow::ensure!(condition, "message")` is shorthand for if-then-bail

---

## Pattern 3: Cross-Layer Error Conversion

At the boundary between library errors and application errors:

```rust
// Don't: silently convert all library errors to anyhow
fn process() -> anyhow::Result<()> {
    repo.find(id)?  // StoreError → anyhow, context lost
}

// Do: explicitly map with context
fn process() -> anyhow::Result<()> {
    repo.find(id)
        .context("failed to load order from store")?;
    Ok(())
}
```

---

## Pattern 4: Error in async Traits

Async trait errors must be `Send + Sync + 'static` to work across thread boundaries:

```rust
// BAD: Box<dyn Error> is not necessarily Send + Sync
pub trait Processor {
    async fn process(&self) -> Result<(), Box<dyn Error>>;
}

// GOOD: typed error or anyhow::Error (which is Send + Sync + 'static)
pub trait Processor {
    async fn process(&self) -> Result<(), ProcessError>;
}

// ALSO OK for app code:
pub trait Processor {
    async fn process(&self) -> anyhow::Result<()>;
}
```

---

## Pattern 5: User-Facing Errors (miette)

For CLIs and tools that display errors to users:

```rust
use miette::{Diagnostic, SourceSpan};

#[derive(Debug, Diagnostic, thiserror::Error)]
#[error("parse error in configuration")]
pub struct ConfigError {
    #[source_code]
    pub src: miette::NamedSource<String>,

    #[label("unexpected token here")]
    pub span: SourceSpan,

    #[help]
    pub advice: String,
}
```

Output looks like:
```
  × parse error in configuration
   ╭─[config.toml:3:1]
 3 │ timeout = "not-a-number"
   ·           ^^^^^^^^^^^^^
   ╰────
  help: expected an integer (e.g. timeout = 30)
```

---

## Anti-Patterns

```rust
// ❌ Swallowing errors
let result = risky_operation();
// ignoring result entirely

// ❌ panic instead of error
let value = map.get(key).expect("key must exist"); // in production code

// ❌ Stringly-typed errors
return Err("something went wrong".into()); // caller can't match

// ❌ Over-converting with From
impl From<io::Error> for AppError { ... }
impl From<serde_json::Error> for AppError { ... }
impl From<sqlx::Error> for AppError { ... }
// Everything becomes AppError, losing callsite context

// ❌ Result<T, Box<dyn Error>> in library
pub fn parse(s: &str) -> Result<Config, Box<dyn Error>>
// Use Result<Config, ParseError> instead
```

---

## Error Handling Review Checklist

Use during code review or before marking implementation complete:

- [ ] No `.unwrap()` or `.expect()` in non-test production code
- [ ] Every `?` has a `.context(...)` or equivalent at the right level
- [ ] Error types are `Send + Sync + 'static` (required for async)
- [ ] Library code returns typed errors (not `anyhow::Error`)
- [ ] All error variants are necessary — no "catch-all" variants hiding details
- [ ] `#[from]` conversions don't silently swallow context
- [ ] No `todo!()` / `unimplemented!()` in production paths
- [ ] No `Box<dyn Error>` return types in library code — use `thiserror` enum
