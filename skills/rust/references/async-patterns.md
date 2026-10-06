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

Tokio is the default runtime for services; libraries stay runtime-agnostic. The ownership rule behind the cancellation patterns (async work has an owner that cancels it and releases what it holds on every path) is `development` rule 5; this file shows the Tokio idioms.

---

## Concurrency Primitives — Decision Guide

```
Fixed N concurrent operations (known at compile time) → tokio::join!
Dynamic N concurrent operations                        → JoinSet
Ordered stream of results                              → FuturesOrdered
Unordered results as fast as possible                  → FuturesUnordered
First one to complete wins                             → tokio::select!
Deadline on one operation                              → tokio::time::timeout(dur, fut)
Cancel on signal / shutdown                            → CancellationToken + select!
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
            biased;  // poll branches in order: cancellation first (order only, see Cancellation Safety)

            _ = token.cancelled() => {
                tracing::info!("shutting down gracefully");
                return Ok(());
            }

            result = next_task() => { // next_task must be cancellation-safe, e.g. a channel recv
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
    loop {
        match rx1.recv().await {
            Ok(event) => handle_event(event).await,
            // The receiver fell behind and the channel overwrote `n` events: decide, don't exit
            Err(broadcast::error::RecvError::Lagged(n)) => {
                tracing::warn!(skipped = n, "subscriber lagged");
                resync().await;
            }
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
});
```

A slow subscriber never blocks the sender; it loses events instead. Handle `Lagged` explicitly (skip, resync, or fail loudly), because treating every `Err` as the end of the stream silently stops a live subscriber.

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

When a `select!` branch completes, the other branches' futures are dropped. A future is cancellation-safe if dropping it before completion loses no data and leaves no half-done state. The Tokio docs state each method's cancellation safety; read them for any method used as a `select!` branch.

| Operation | Cancellation-safe? | Notes |
|-----------|--------------------|-------|
| `tokio::time::sleep`, `CancellationToken::cancelled` | Yes | Pure waits |
| `Notify::notified`, `Mutex::lock` | Yes, with a cost | Nothing is lost, but cancelling forfeits the place in the fair queue |
| `mpsc::Receiver::recv` | Yes | The message stays in the channel |
| `AsyncReadExt::read` | Yes | Nothing consumed until it returns |
| `AsyncReadExt::read_exact`, `AsyncBufReadExt::read_line` | No | Some data may already be read into the buffer (a partial line or a partly filled slice) |
| `mpsc::Sender::send` | Partly | If another branch wins, the value was not sent and is dropped; use `reserve()` first to keep it |
| An `async fn` with several awaits and side effects between them | No | Dropping it between steps leaves the side effects done and the rest undone |

`biased;` only fixes the order in which branches are polled. It does not make a branch cancellation-safe, and it can starve the later branches. The fix for a cancellation-unsafe future is to create it once, outside the loop, and poll it by reference so a competing branch never drops it:

```rust
let next = fetch_next();            // not cancellation-safe
tokio::pin!(next);
loop {
    tokio::select! {
        _ = token.cancelled() => break,
        item = &mut next => {       // other branches winning does not drop `next`
            process(item).await;
            next.set(fetch_next()); // start the next read after finishing this one
        }
    }
}
```

Alternatively move the read into its own task and select on the channel it feeds (`recv` is cancellation-safe), or split the read from the processing step. Where a branch is deliberately not cancellation-safe, say so in the code with a `// CANCEL-SAFETY:` note (not `// SAFETY:`, which is reserved for `unsafe` blocks).

---

## Mutex Rules

```rust
// std::sync::Mutex: OK if lock is NEVER held across .await
{
    let value = mutex.lock().expect("state mutex poisoned"); // lock acquired
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
    let guard = mutex.lock().expect("state mutex poisoned");
    save(guard.data).await; // .await with guard held → potential deadlock
}
// ✅ Fix: either release before .await or use tokio::sync::Mutex

// ❌ Spawning without tracking
tokio::spawn(background_task()); // fire and forget — panics are silent
// ✅ Fix:
let handle = tokio::spawn(background_task());
// Store handle, or use JoinSet
```

---

## Async Safety Checklist

Use during review or before marking async code complete:

- [ ] No `std::thread::sleep` inside `async fn` — use `tokio::time::sleep`
- [ ] No blocking I/O (`std::fs`, `std::net`) on the async executor — use `tokio::fs` or `spawn_blocking`
- [ ] No `.unwrap()` on `JoinHandle::await` — panics propagate as `JoinError`
- [ ] No `std::sync::Mutex` held across `.await` points — use `tokio::sync::Mutex`
- [ ] `tokio::spawn` tasks are `'static` — check for non-obvious captures
- [ ] `select!` branches are cancellation-safe, or the future is pinned outside the loop (a `// CANCEL-SAFETY:` note if neither)
- [ ] Bounded channels used for backpressure; unbounded channels justified
- [ ] Errors returned from spawned tasks and async traits are `Send + 'static`
- [ ] No spawned tasks without tracked `JoinHandle` or `JoinSet`
