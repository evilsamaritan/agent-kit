# Workflow: Reviewer

## Contents

- [Review Philosophy](#review-philosophy)
- [Phase 1 — Context Check](#phase-1--context-check)
- [Phase 2 — Automated Gate](#phase-2--automated-gate)
- [Phase 3 — Correctness Checklist](#phase-3--correctness-checklist)
- [Phase 4 — API Design Review](#phase-4--api-design-review)
- [Phase 5 — Performance Flags](#phase-5--performance-flags)
- [Phase 6 — Test Coverage Review](#phase-6--test-coverage-review)
- [Phase 7 — Feedback Format](#phase-7--feedback-format)
- [Checklist Summary](#checklist-summary)
- [References Used by This Workflow](#references-used-by-this-workflow)

**Goal:** Identify correctness issues, safety risks, API design problems, and maintainability gaps. Produce actionable, prioritized feedback.

---

## Review Philosophy

- **Correctness first** — does it do what it says?
- **Safety second** — can it panic, deadlock, leak, or corrupt data?
- **API design third** — is it ergonomic? Hard to misuse?
- **Maintainability fourth** — will the next person understand this?
- Style issues are lowest priority; `rustfmt` and `clippy` handle most of them automatically

---

## Phase 1 — Context Check

Before reviewing any code:

1. Read the spec or task description
2. Read the public API (traits, structs, functions) — not the implementations yet
3. Answer: does the API match the spec? If not, stop here and flag it

---

## Phase 2 — Automated Gate

Run these before reading a single line:

```bash
cargo fmt --check                                                  # formatting
cargo clippy --workspace --all-targets --all-features -- -D warnings  # lints
cargo nextest run --workspace                                      # tests pass
cargo deny check                                                   # license / vuln audit
```

If any of these fail → **blocked**. Do not review code that doesn't pass the gate.

---

## Phase 3 — Correctness Checklist

Work through this systematically for each changed module:

### Error handling
- [ ] No `.unwrap()` or `.expect()` in non-test production code
- [ ] Every `?` has a `.context(...)` or equivalent at the right level
- [ ] Error types are `Send + Sync + 'static` (required for async)
- [ ] Library code returns typed errors (not `anyhow::Error`)
- [ ] All error variants are necessary — no "catch-all" variants hiding details
- [ ] `#[from]` conversions don't silently swallow context

### Async correctness
- [ ] No `std::thread::sleep` inside `async fn` (use `tokio::time::sleep`)
- [ ] No blocking I/O (`std::fs`, `std::net`) on the async executor
- [ ] No `.unwrap()` on `JoinHandle::await` (panics propagate as `JoinError`)
- [ ] Mutexes: no `.lock().unwrap()` across `.await` points (use `tokio::sync::Mutex`)
- [ ] `tokio::spawn` tasks are `'static` — check for non-obvious captures
- [ ] `select!` branches are cancellation-safe (or documented as non-cancellation-safe)
- [ ] Bounded channels used for backpressure; unbounded channels flagged

### Memory and ownership
- [ ] No unnecessary clones — each clone should be justified
- [ ] `Arc<Mutex<T>>` usage is minimal; prefer message passing
- [ ] `unsafe` blocks: are there any? Each requires a `// SAFETY:` comment explaining why it's sound

### Type design
- [ ] Domain concepts wrapped in newtype structs (not raw `String`, `u64`, `Uuid`)
- [ ] State machines use typestate pattern where appropriate
- [ ] `pub` fields only when they need to be — encapsulation is correct
- [ ] `Default` impl is sensible (not just `#[derive(Default)]` that gives nonsense)

---

## Phase 4 — API Design Review

For each public item:

```
pub fn / pub trait / pub struct → apply these checks:
```

| Check | Good | Bad |
|-------|------|-----|
| Parameter types | `&str`, `&[T]`, `impl AsRef<Path>` | `String`, `Vec<T>`, `PathBuf` |
| Return types | `Result<T, SpecificError>` | `Result<T, Box<dyn Error>>` |
| Naming conversions | `as_*`, `to_*`, `into_*` correctly used | inconsistent naming |
| Doc comments | every public item has `///` | missing docs |
| Derives | `Debug` on all public types | no `Debug` |
| Error variants | match caller needs | overloaded single `Internal` variant |

**Hard to misuse principle:** Can a caller accidentally use the API wrong? If yes, can types prevent it?

---

## Phase 5 — Performance Flags

Not every function needs to be optimal — flag these only in hot paths or when clearly wasteful:

- Allocation in a tight loop that could be reused
- `String` concatenation with `+` instead of `format!` or `write!`
- `clone()` of large structures that could be borrowed
- `HashMap` where `BTreeMap` is fine (and vice versa for sorted order needs)
- Synchronous lock held across `await` points

---

## Phase 6 — Test Coverage Review

- [ ] Happy path tested
- [ ] Every error variant has at least one test
- [ ] Boundary conditions tested (empty inputs, max values, zero)
- [ ] Async tests use `#[tokio::test]`
- [ ] Tests use real types, not just string/int literals everywhere
- [ ] No `sleep` in tests to "wait for async" — use proper synchronization

If coverage is thin → request tests. Do not approve code with only happy-path tests for critical logic.

---

## Phase 7 — Feedback Format

Structure feedback by severity. Be specific: include the line/function and the fix.

```markdown
## [BLOCKING] Unsound async code

`OrderService::process` locks `std::sync::Mutex` then awaits `repo.save()`.
Holding a std Mutex across an await point can deadlock the Tokio executor.

**Fix:** Replace `std::sync::Mutex` with `tokio::sync::Mutex`, or restructure
to release the lock before the `.await`.

---

## [BLOCKING] Error context missing

`user_repository.rs:47` — `.context()` is missing on the `?` operator.
When this fails, the error message will say only "connection refused" with no
indication of which operation failed.

**Fix:** `.context("failed to load user by email")?`

---

## [SUGGESTION] Unnecessary clone

`process_batch` on line 83 clones the entire `Config` struct on every iteration.
Config is read-only here — pass `&Config` instead.

---

## [STYLE] Minor naming inconsistency

`fetch_by_id` should be `find_by_id` to match the naming convention used
by all other repository methods in this crate.
```

Severity levels:
- **[BLOCKING]** — correctness, safety, or soundness issue; must fix before merge
- **[CONCERN]** — design issue that will cause pain later; strongly recommend fixing
- **[SUGGESTION]** — improvement that isn't strictly necessary
- **[STYLE]** — cosmetic; fix if easy, ignore if not

---

## Checklist Summary

- [ ] Automated gate passes
- [ ] No `.unwrap()` / `.expect()` in production paths
- [ ] No blocking calls in async context
- [ ] No `std::sync::Mutex` held across `.await`
- [ ] Every `unsafe` block has a `// SAFETY:` comment
- [ ] All public items have `///` documentation
- [ ] API parameters use borrowed / generic types
- [ ] Error types are typed enums with meaningful variants
- [ ] Test coverage includes error paths
- [ ] Feedback is prioritized and actionable

---

## References Used by This Workflow

- `references/error-handling-patterns.md` — for nuanced error handling review
- `references/async-patterns.md` — for async correctness verification
- `references/architecture-patterns.md` — for structural design review
