# Workflow: Tester

## Contents

- [Phase 1 — Understand What Needs Testing](#phase-1--understand-what-needs-testing)
- [Phase 2 — Tooling Setup](#phase-2--tooling-setup)
- [Phase 3 — Unit Tests](#phase-3--unit-tests)
- [Phase 4 — Property-Based Tests with Proptest](#phase-4--property-based-tests-with-proptest)
- [Phase 5 — Snapshot Tests with Insta](#phase-5--snapshot-tests-with-insta)
- [Phase 6 — Integration Tests](#phase-6--integration-tests)
- [Phase 7 — What "Done" Means](#phase-7--what-done-means)
- [Phase 8 — Benchmarks (for perf-sensitive code only)](#phase-8--benchmarks-for-perf-sensitive-code-only)
- [References Used by This Workflow](#references-used-by-this-workflow)

**Goal:** Prove that the code does what the spec says, handles failures correctly, and maintains invariants under all inputs — not just the happy path.

---

## Phase 1 — Understand What Needs Testing

Before writing tests, read:
1. The spec — what are the invariants and failure modes?
2. The public API — what are the contracts?
3. The error types — what can fail?

Build a test matrix:

| Scenario | Test type | Priority |
|----------|-----------|---------|
| Normal operation | Unit / integration | P0 |
| Every error variant | Unit | P0 |
| Boundary conditions | Unit + proptest | P1 |
| Concurrent access | Integration | P1 |
| Invariants under random input | Proptest | P1 |
| Regression (specific past bugs) | Unit | P0 |
| Benchmarks for perf-sensitive paths | Criterion/divan | P2 |

---

## Phase 2 — Tooling Setup

Add to workspace dependencies:

```toml
[dev-dependencies]
proptest = "1"
insta = { version = "1", features = ["yaml"] }
tokio = { version = "1", features = ["full", "test-util"] }

# For benchmarks (choose one)
criterion = { version = "0.5", features = ["html_reports"] }
divan = "0.1"  # simpler API, recommended for new projects
```

Run tests:
```bash
cargo nextest run --workspace              # parallel, isolated
cargo test --doc                           # doctests separately
INSTA_UPDATE=new cargo nextest run         # create new snapshots
cargo insta review                         # review snapshot changes
```

---

## Phase 3 — Unit Tests

Write unit tests in the same file as the code, in `#[cfg(test)] mod tests`.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // ✅ Test normal behavior
    #[test]
    fn new_order_has_no_items() {
        let order = Order::new(OrderId::new());
        assert!(order.items.is_empty());
        assert_eq!(order.status, OrderStatus::Draft);
    }

    // ✅ Test every error variant
    #[tokio::test]
    async fn find_nonexistent_order_returns_none() {
        let repo = InMemoryOrderRepo::new();
        let result = repo.find(&OrderId::new()).await.expect("query should not fail");
        assert!(result.is_none());
    }

    // ✅ Test boundary conditions
    #[test]
    fn add_item_with_zero_quantity_returns_error() {
        let mut order = Order::new(OrderId::new());
        let err = order.add_item("sku", 0).unwrap_err();
        assert!(matches!(err, OrderError::InvalidQuantity { .. }));
    }

    // ✅ Test state transitions
    #[test]
    fn cannot_submit_empty_order() {
        let order = Order::new(OrderId::new());
        assert!(matches!(order.submit().unwrap_err(), OrderError::EmptyOrder));
    }
}
```

---

## Phase 4 — Property-Based Tests with Proptest

Use proptest to test invariants over random inputs. Load `references/testing-strategies.md` for advanced strategies.

```rust
use proptest::prelude::*;

// Strategy: generate valid orders
fn arb_order_id() -> impl Strategy<Value = OrderId> {
    any::<u128>().prop_map(|n| OrderId(uuid::Uuid::from_u128(n)))
}

fn arb_quantity() -> impl Strategy<Value = u32> {
    1u32..=10_000u32  // positive, non-zero
}

proptest! {
    // Invariant: saving and loading preserves all fields
    #[test]
    fn save_load_roundtrip(id in arb_order_id(), qty in arb_quantity()) {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let repo = InMemoryOrderRepo::new();
            let order = Order::with_item(id, "sku-1", qty);
            repo.save(&order).await.unwrap();
            let loaded = repo.find(&order.id).await.unwrap().unwrap();
            prop_assert_eq!(order, loaded);
            Ok(())
        })?;
    }

    // Invariant: total price is always ≥ sum of item prices
    #[test]
    fn total_always_covers_items(items in prop::collection::vec(arb_quantity(), 1..20)) {
        let order = Order::with_items(items.iter().map(|&q| ("sku", q)));
        let total = order.total_price();
        let sum: u64 = order.items.iter().map(|i| i.price()).sum();
        prop_assert!(total >= sum);
    }
}
```

Key proptest patterns:
- `any::<T>()` — generate arbitrary T
- `prop::collection::vec(strategy, range)` — generate Vec
- `prop_oneof![a, b, c]` — choose among strategies
- `strategy.prop_filter("reason", |x| condition)` — reject invalid values
- `strategy.prop_map(|x| transform(x))` — transform generated values
- `strategy.prop_flat_map(|x| dependent_strategy(x))` — dependent generation

---

## Phase 5 — Snapshot Tests with Insta

Use insta for outputs that are complex to assert manually: serialized structs, formatted output, error messages.

```rust
use insta::assert_yaml_snapshot;

#[test]
fn order_serializes_correctly() {
    let order = Order::fixture();  // deterministic test fixture
    assert_yaml_snapshot!(order, {
        ".id" => "[uuid]",           // redact dynamic field
        ".created_at" => "[timestamp]",
    });
}

#[test]
fn error_message_format() {
    let err = OrderError::NotFound { id: OrderId::fixture() };
    insta::assert_snapshot!(err.to_string());
}
```

Workflow:
1. Run tests first time → snapshots created in `snapshots/` directory
2. Review: `cargo insta review`
3. Accept: `cargo insta accept`
4. Commit snapshot files with the code

**Redact dynamic values** (UUIDs, timestamps, random data) to make snapshots stable.

---

## Phase 6 — Integration Tests

Integration tests live in `tests/` directory, test the system through public API only.

```rust
// tests/order_flow.rs
use my_crate::{OrderService, OrderRepository, Config};

async fn setup() -> (OrderService<impl OrderRepository>, ...) {
    // Use in-memory adapters, not real DB
    let repo = InMemoryOrderRepo::new();
    let svc = OrderService::new(repo);
    (svc, ...)
}

#[tokio::test]
async fn complete_order_flow() {
    let (svc, _) = setup().await;
    
    let order = svc.create_order().await.unwrap();
    svc.add_item(&order.id, "sku-1", 3).await.unwrap();
    let submitted = svc.submit(&order.id).await.unwrap();
    
    assert_eq!(submitted.status, OrderStatus::Submitted);
    assert_eq!(submitted.items.len(), 1);
}
```

Rules for integration tests:
- Never use real external services (DB, HTTP) — use fakes/in-memory adapters
- Test through public API only — no `use my_crate::internal::*`
- One test file per major user journey

---

## Phase 7 — What "Done" Means

Tests are done when:

- [ ] Every public function has at least one test
- [ ] Every error variant is triggered by at least one test
- [ ] At least one proptest for every non-trivial invariant
- [ ] Snapshot tests for all complex serialization outputs
- [ ] All tests pass with `cargo nextest run --workspace`
- [ ] All doctests pass with `cargo test --doc`
- [ ] No test uses `sleep` to wait for async operations
- [ ] No test has `#[ignore]` without a linked issue
- [ ] `cargo nextest run` completes in reasonable time (< 30s for unit, < 2min for integration)

---

## Phase 8 — Benchmarks (for perf-sensitive code only)

Use `divan` for new benchmarks (simpler API than criterion):

```rust
// benches/order_processing.rs
use divan::Bencher;

fn main() {
    divan::main();
}

#[divan::bench]
fn create_order(b: Bencher) {
    b.bench(|| {
        Order::new(OrderId::new())
    });
}

#[divan::bench(args = [10, 100, 1000])]
fn process_batch(b: Bencher, count: usize) {
    let orders: Vec<_> = (0..count).map(|_| Order::new(OrderId::new())).collect();
    b.bench(|| {
        orders.iter().for_each(|o| process(o));
    });
}
```

Run: `cargo bench`

Benchmark rules:
- Benchmark only production-path code
- Store baseline results in `benches/baseline/`
- Fail CI if regression > 10% on tracked benchmarks

---

## References Used by This Workflow

- `references/testing-strategies.md` — advanced proptest strategies, kani formal verification, model-based testing, bolero
