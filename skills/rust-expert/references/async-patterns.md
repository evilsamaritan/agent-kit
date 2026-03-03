# Async Patterns (Tokio)

## Contents

- [Concurrency Primitives — Decision Guide](#concurrency-primitives--decision-guide)
- [Pattern 1: Fixed Concurrency](#pattern-1-fixed-concurrency)
- [Pattern 2: Dynamic Task Pool (JoinSet)](#pattern-2-dynamic-task-pool-joinset)
- [Pattern 3: Cancellation with CancellationToken](#pattern-3-cancellation-with-cancellationtoken)
- [Pattern 4: Bounded Channels for Backpressure](#pattern-4-bounded-channels-for-backpressure)
- [Pattern 5: Broadcast (1-to-many)](#pattern-5-broadcast-1-to-many)
- [Pattern 6: spawn_blocking for CPU/Blocking Work](#pattern-6-spawn_blocking-for-cpublocking-work)
- [Cancellation Safety](#cancellation-safety)
- [Mutex Rules](#mutex-rules)
- [Common Mistakes](#common-mistakes)

Tokio is the only runtime for production. `edition = "2024"` + Tokio 1.x.

---

## Concurrency Primitives — Decision Guide

```
Fixed N concurrent operations (known at compile time) → tokio::join!
Dynamic N concurrent operations                        → JoinSet
Ordered stream of results                              → FuturesOrdered
Unordered results as fast as possible                  → FuturesUnordered
First one to complete wins                             → tokio::select!
Cancel on signal / timeout                             → CancellationToken + select!
CPU-bound work                                         → spawn_blocking
```

---

## Pattern 1: Fixed Concurrency

```rust
// Run exactly N futures concurrently, wait for all
let (users, orders, inventory) = tokio::join!(
    fetch_users(&conn),
    fetch_orders(&conn),
    fetch_inventory(&conn),
);
// All three run in parallel; returns when all complete
```

---

## Pattern 2: Dynamic Task Pool (JoinSet)

```rust
use tokio::task::JoinSet;

let mut set = JoinSet::new();

for item in items {
    set.spawn(async move {
        process_item(item).await
    });
}

// Collect results as they complete
while let Some(result) = set.join_next().await {
    match result {
        Ok(Ok(value)) => handle_success(value),
        Ok(Err(e)) => handle_error(e),
        Err(join_err) => handle_panic(join_err), // task panicked
    }
}
```

JoinSet drops all remaining tasks when it's dropped — useful for automatic cleanup.

---

## Pattern 3: Cancellation with CancellationToken

```rust
use tokio_util::sync::CancellationToken;

async fn run_service(token: CancellationToken) -> Result<(), Error> {
    loop {
        tokio::select! {
            biased;  // check cancellation first

            _ = token.cancelled() => {
                tracing::info!("shutting down gracefully");
                return Ok(());
            }

            result = next_task() => {
                process(result?).await?;
            }
        }
    }
}

// Caller:
let token = CancellationToken::new();
let child_token = token.child_token(); // child cancelled when parent is
tokio::spawn(run_service(child_token));

// On shutdown:
token.cancel(); // cancels all children too
```

---

## Pattern 4: Bounded Channels for Backpressure

```rust
// ALWAYS use bounded channels in production
let (tx, mut rx) = tokio::sync::mpsc::channel::<Work>(100); // buffer = 100

// Producer: will block when buffer is full (backpressure)
tokio::spawn(async move {
    for item in work_items {
        tx.send(item).await?; // awaits when buffer full
    }
    // tx dropped here → receiver gets None
});

// Consumer
while let Some(work) = rx.recv().await {
    process(work).await;
}
```

Unbounded channels (`mpsc::unbounded_channel`) are acceptable only when producers are naturally rate-limited.

---

## Pattern 5: Broadcast (1-to-many)

```rust
let (tx, _) = tokio::sync::broadcast::channel::<Event>(512);

// Each subscriber gets their own receiver
let mut rx1 = tx.subscribe();
let mut rx2 = tx.subscribe();

tokio::spawn(async move {
    while let Ok(event) = rx1.recv().await {
        handle_event(event).await;
    }
});
```

---

## Pattern 6: spawn_blocking for CPU/Blocking Work

```rust
// CPU-intensive work — moves to a blocking thread pool
let result = tokio::task::spawn_blocking(|| {
    heavy_computation(data)
}).await?;

// Blocking I/O — must not happen on async executor
let content = tokio::task::spawn_blocking(|| {
    std::fs::read_to_string(path)
}).await??;

// Better: use tokio::fs for file I/O
let content = tokio::fs::read_to_string(path).await?;
```

---

## Cancellation Safety

Not all async operations are safe to cancel (drop mid-execution):

| Operation | Safe? | Notes |
|-----------|-------|-------|
| `tokio::time::sleep` | ✅ | Pure timer |
| `mpsc::Receiver::recv()` | ✅ | Message stays in channel |
| `tokio::fs::read` | ✅ | Kernel handles partial reads |
| `sqlx::query::fetch` | ⚠️ | Transaction may be left open |
| Writing to channel mid-send | ❌ | Data may be lost |

In `select!`, if a branch is not cancellation-safe, document it:

```rust
// SAFETY: fetch_next is not cancellation-safe — use biased to prevent
// interleaving with the cancellation branch
tokio::select! {
    biased;
    _ = shutdown_signal() => break,
    item = fetch_next() => process(item).await,
}
```

---

## Mutex Rules

```rust
// std::sync::Mutex: OK if lock is NEVER held across .await
{
    let value = mutex.lock().unwrap(); // lock acquired
    compute(value);
    // lock released here (before any .await)
}

// tokio::sync::Mutex: required if lock must be held across .await
let value = tokio_mutex.lock().await; // async lock
save_to_db(value).await?;            // .await while holding lock — safe
```

---

## Common Mistakes

```rust
// ❌ Blocking sleep in async
tokio::spawn(async {
    std::thread::sleep(Duration::from_secs(1)); // blocks executor thread!
    do_work().await;
});
// ✅ Fix:
tokio::spawn(async {
    tokio::time::sleep(Duration::from_secs(1)).await;
    do_work().await;
});

// ❌ std::Mutex across .await (can deadlock)
async fn bad(mutex: Arc<Mutex<State>>) {
    let guard = mutex.lock().unwrap();
    save(guard.data).await; // .await with guard held → potential deadlock
}
// ✅ Fix: either release before .await or use tokio::sync::Mutex

// ❌ Spawning without tracking
tokio::spawn(background_task()); // fire and forget — panics are silent
// ✅ Fix:
let handle = tokio::spawn(background_task());
// Store handle, or use JoinSet
```
