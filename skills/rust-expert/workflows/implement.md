# Workflow: Implementer

## Contents

- [Phase 1 — Before Writing Any Code](#phase-1--before-writing-any-code)
- [Phase 2 — Start with Types and Traits](#phase-2--start-with-types-and-traits)
- [Phase 3 — Implement Bottom-Up](#phase-3--implement-bottom-up)
- [Phase 4 — Write Tests Alongside Code](#phase-4--write-tests-alongside-code)
- [Phase 5 — Iterative Compile-Check Loop](#phase-5--iterative-compile-check-loop)
- [Phase 6 — Before Marking Complete](#phase-6--before-marking-complete)
- [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
- [References Used by This Workflow](#references-used-by-this-workflow)

**Goal:** Translate a specification into correct, idiomatic, tested Rust code.

---

## Phase 1 — Before Writing Any Code

**Read the spec completely.** If there is no spec, stop and request one from the Architect, or write a minimal spec yourself (see `workflows/architect.md` Phase 4).

Answer before starting:
1. Do I understand all public API signatures?
2. Do I know all error variants I need to handle?
3. Do I know which crates I'm allowed to add?
4. Are there any open questions in the spec? (If yes — resolve them, don't silently assume)

If anything is unclear: **ask, don't guess.** A wrong assumption costs more to fix than a clarifying question.

---

## Phase 2 — Start with Types and Traits

Write types and trait definitions BEFORE any implementation logic.

```rust
// Step 1: newtype wrappers for domain concepts
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct OrderId(uuid::Uuid);

impl OrderId {
    pub fn new() -> Self { Self(uuid::Uuid::new_v4()) }
}

// Step 2: domain structs
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Order {
    pub id: OrderId,
    pub items: Vec<OrderItem>,
    pub status: OrderStatus,
}

// Step 3: error type
#[derive(Debug, thiserror::Error)]
pub enum OrderError {
    #[error("order {id} not found")]
    NotFound { id: OrderId },
}

// Step 4: trait (port)
pub trait OrderRepository: Send + Sync + 'static {
    async fn save(&self, order: &Order) -> Result<(), OrderError>;
    async fn find(&self, id: &OrderId) -> Result<Option<Order>, OrderError>;
}
```

Compile types before writing any logic: `cargo check`

---

## Phase 3 — Implement Bottom-Up

Start from leaf functions (no dependencies on other unwritten code), move upward.

### Error handling (mandatory patterns)

```rust
// GOOD: always propagate with context
pub async fn process(id: &OrderId) -> Result<Receipt, ProcessError> {
    let order = self.repo.find(id).await
        .context("failed to load order")?;          // anyhow context
    
    let order = order
        .ok_or(ProcessError::NotFound { id: id.clone() })?;
    
    // NEVER:
    // order.unwrap()
    // order.expect("should exist")
    
    Ok(generate_receipt(order))
}
```

### Async patterns (mandatory)

```rust
// Run concurrent operations
let (result_a, result_b) = tokio::join!(fetch_a(), fetch_b());

// Dynamic concurrency with JoinSet
let mut set = tokio::task::JoinSet::new();
for item in items {
    set.spawn(async move { process(item).await });
}
while let Some(result) = set.join_next().await {
    handle(result??);
}

// With cancellation
use tokio_util::sync::CancellationToken;
let token = CancellationToken::new();
tokio::select! {
    result = do_work() => { ... }
    _ = token.cancelled() => { /* clean shutdown */ }
}

// NEVER block async thread:
// std::thread::sleep(...)   → tokio::time::sleep(...).await
// std::fs::read(...)        → tokio::fs::read(...).await (or spawn_blocking)
```

### Ownership patterns

```rust
// Prefer borrowing in functions — caller decides lifetime
pub fn process(data: &[u8]) -> Result<Output, Error>   // NOT: data: Vec<u8>
pub fn lookup(key: &str) -> Option<&Value>              // NOT: key: String

// Use Cow when sometimes you allocate, sometimes you borrow
pub fn normalize(s: &str) -> Cow<'_, str> {
    if needs_change(s) { Cow::Owned(s.to_uppercase()) }
    else { Cow::Borrowed(s) }
}
```

---

## Phase 4 — Write Tests Alongside Code

Do not defer tests. Write them as you implement each function.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Unit test: pure functions
    #[test]
    fn order_id_is_unique() {
        assert_ne!(OrderId::new(), OrderId::new());
    }

    // Async test
    #[tokio::test]
    async fn save_and_retrieve_order() {
        let repo = InMemoryOrderRepo::new();
        let order = Order::new();
        repo.save(&order).await.unwrap();
        let found = repo.find(&order.id).await.unwrap();
        assert_eq!(found, Some(order));
    }

    // Error path
    #[tokio::test]
    async fn find_missing_order_returns_none() {
        let repo = InMemoryOrderRepo::new();
        let result = repo.find(&OrderId::new()).await.unwrap();
        assert!(result.is_none());
    }
}
```

Use `#[expect(clippy::some_lint)]` instead of `#[allow(...)]` when suppressing lints in tests.

For complex tests, see `references/testing-strategies.md`.

---

## Phase 5 — Iterative Compile-Check Loop

Never write 200 lines before checking if it compiles.

```bash
# After each logical unit (trait impl, function, module):
cargo check                          # fast type-check
cargo clippy -- -D warnings         # lints as errors
cargo nextest run <test-name>        # run specific test
```

Fix ALL clippy warnings before moving to the next unit. Do not accumulate warnings.

---

## Phase 6 — Before Marking Complete

```bash
cargo fmt
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo nextest run --workspace
cargo doc --no-deps --workspace   # check doc comments compile
```

Then verify against the spec:
- [ ] All acceptance criteria from tasks are met
- [ ] All public items have `///` doc comments
- [ ] No `.unwrap()` / `.expect()` outside of tests
- [ ] No `todo!()` / `unimplemented!()` in production paths
- [ ] Error types are `Send + Sync + 'static`
- [ ] Async functions do not block the executor

---

## Common Pitfalls to Avoid

| Mistake | Fix |
|---------|-----|
| `Arc<Mutex<T>>` everywhere | Use message passing (`tokio::sync::mpsc`) for owned state; `Arc<RwLock<T>>` only for shared read-heavy data |
| Cloning to satisfy borrow checker | Restructure lifetimes or use indices; cloning is a sign of design issue |
| `Box<dyn Error>` in library types | Use `thiserror` enum — callers need to match |
| `String` parameters | Use `&str` or `impl AsRef<str>` |
| Spawning without `JoinHandle` | Use `JoinSet` or store handles — dropped tasks are cancelled |
| `unwrap()` in tests | OK in test asserts, but use `?` in helper functions |
| Blocking in `async fn` | Use `spawn_blocking` for CPU-heavy / blocking I/O work |

---

## References Used by This Workflow

- `references/error-handling-patterns.md` — detailed patterns for thiserror/anyhow
- `references/async-patterns.md` — Tokio structured concurrency deep-dive
- `references/testing-strategies.md` — how to write tests for this code
- `references/library-reference.md` — which crate to reach for
