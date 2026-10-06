# Async Patterns

Use this reference when writing or reviewing asyncio code: task ownership, cancellation, timeouts, bounded concurrency, shutdown, and bridging sync and async code. Version availability of APIs is in [version-notes.md](version-notes.md). Code practice for async lifetime in general (a live owner for every operation) is in `development`; health probes and shutdown policy are in `reliability`.

## Contents

- [Ownership](#ownership)
- [Cancellation](#cancellation)
- [Timeouts and deadlines](#timeouts-and-deadlines)
- [Bounded concurrency](#bounded-concurrency)
- [Producer and consumer queues](#producer-and-consumer-queues)
- [Service lifetime and shutdown](#service-lifetime-and-shutdown)
- [Bridging sync and async](#bridging-sync-and-async)
- [Exception groups](#exception-groups)
- [Debugging](#debugging)
- [Review checklist](#review-checklist)

## Ownership

Every task has an owner that outlives it, awaits it, and sees its exception.

| Lifetime of the work | Owner |
|----------------------|-------|
| Within one request or function call | `async with asyncio.TaskGroup()` in that function |
| As long as the service runs | A `TaskGroup` opened in the service's main coroutine |
| Detached one-off work that must survive the request | A queue consumed by a worker the service owns, or a background job system (`background-jobs`) |

`asyncio.create_task` returns a task the event loop holds only weakly. If nothing stores and awaits it, it can disappear mid-flight and its exception is reported only as a log line at garbage collection. A set of tasks plus `add_done_callback(tasks.discard)` keeps references, but still needs an owner that cancels and awaits the set on shutdown; a long-lived `TaskGroup` gives both.

`asyncio.gather` does not cancel the remaining awaitables when one fails (without `return_exceptions=True` it raises the first error and leaves the others running). Prefer `TaskGroup` for new code.

## Cancellation

Cancellation is an exception (`asyncio.CancelledError`, a `BaseException`) raised at the next `await` inside the task.

- Clean up in `finally` or `async with`, then let it propagate. Catching it and continuing breaks timeouts, `TaskGroup` sibling cancellation, and shutdown.
- `except Exception` does not catch `CancelledError`; `except BaseException` and bare `except:` do.
- Cleanup that itself awaits can be cancelled again. Keep it short; for a step that must finish (flushing a commit marker), run it under `asyncio.shield` and accept that the outer caller stops waiting.
- `Task.cancel()` requests cancellation; the task decides when it observes it. Await the task after cancelling to know it finished.
- A task group can be stopped early by cancelling the task that owns it, or with `TaskGroup.cancel()` on versions that have it.

## Timeouts and deadlines

```python
async def fetch_quote(client: QuoteClient, symbol: str) -> Quote:
    async with asyncio.timeout(2.0):
        return await client.quote(symbol)
```

- `asyncio.timeout()` (or `wait_for` on older code) converts cancellation into `TimeoutError` at the block boundary.
- Put a deadline on every network wait. Library-level timeouts (client connect and read timeouts) still matter; they bound the socket, the block bounds the whole operation including retries.
- Propagate one deadline through nested calls with `asyncio.timeout_at(deadline)` rather than stacking independent timeouts that add up beyond the caller's budget.
- Retry policy (which errors, backoff with jitter, budgets) is owned by `reliability`.

## Bounded concurrency

Unbounded fan-out exhausts sockets, file descriptors, connection pools, and downstream rate limits.

```python
async def fetch_all(client: ApiClient, ids: Sequence[str], limit: int = 20) -> list[Item]:
    semaphore = asyncio.Semaphore(limit)

    async def fetch_one(item_id: str) -> Item:
        async with semaphore:
            return await client.item(item_id)

    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch_one(i)) for i in ids]
    return [t.result() for t in tasks]
```

For very large or streaming inputs, creating one task per item still costs memory; use a fixed number of worker tasks reading from a bounded queue instead.

## Producer and consumer queues

- `asyncio.Queue(maxsize=n)` gives backpressure: `await queue.put()` waits when consumers fall behind. An unbounded queue hides overload until memory runs out.
- Workers loop on `await queue.get()` and call `task_done()` in `finally`; the producer awaits `queue.join()` when it needs completion.
- Stop workers by cancelling them through their owning `TaskGroup` or with `Queue.shutdown()` where available, not with ad hoc sentinel values scattered across code.
- `asyncio.Queue` is not thread-safe. From threads, hand items over with `loop.call_soon_threadsafe` or use `queue.Queue` with `asyncio.to_thread`.

## Service lifetime and shutdown

```python
async def main(settings: Settings) -> None:
    async with AsyncExitStack() as stack:
        db = await stack.enter_async_context(connect_db(settings.database_url))
        async with asyncio.TaskGroup() as tg:
            tg.create_task(serve_http(settings, db))
            tg.create_task(run_consumer(settings, db))

if __name__ == "__main__":
    asyncio.run(main(load_settings()))
```

- One `asyncio.run` per process, at the entry point. On SIGINT it cancels the main task, so every child unwinds through its `finally` blocks.
- Handle SIGTERM explicitly (container stop) by cancelling the main task through `loop.add_signal_handler` on Unix; frameworks and servers usually provide this hook.
- Resources opened with `async with` close in reverse order after the task group finishes.
- Probe semantics and shutdown ordering (stop accepting, drain, close) are owned by `reliability`; the mechanics of a service's startup and shutdown by `backend`.

## Bridging sync and async

| From | To | Use |
|------|----|-----|
| async | blocking function | `await asyncio.to_thread(fn, *args)` |
| async | CPU-heavy pure Python | `loop.run_in_executor(process_pool, fn, *args)` |
| sync entry point | async API | `asyncio.run(coro)` once, at the top |
| another thread | the running loop | `asyncio.run_coroutine_threadsafe(coro, loop)` |
| sync library code | async code, repeatedly | Keep a dedicated loop on a background thread, or an `asyncio.Runner`; never call `asyncio.run` per request |

Do not call `asyncio.get_event_loop()` to obtain a loop in new code; use `asyncio.get_running_loop()` inside coroutines and `asyncio.run` at the top. The event loop policy API is deprecated; choose a loop implementation through `asyncio.run(..., loop_factory=...)`.

Libraries that must work under both asyncio and Trio target AnyIO; application code picks one runtime.

## Exception groups

`TaskGroup` raises `ExceptionGroup` (or `BaseExceptionGroup`) holding every child failure. Handle specific types with `except*`:

```python
try:
    async with asyncio.TaskGroup() as tg:
        for region in regions:
            tg.create_task(sync_region(region))
except* RegionUnavailable as group:
    for exc in group.exceptions:
        logger.warning("region skipped: %s", exc)
```

Unhandled members re-raise as a new group. Do not flatten groups by catching `Exception` and reading `str(exc)`.

## Debugging

- `PYTHONASYNCIODEBUG=1` or `asyncio.run(main(), debug=True)` logs slow callbacks (blocking calls on the loop) and never-awaited coroutines.
- `python -m asyncio ps PID` and `pstree PID` (3.14+) show the live task tree of a running process.
- A rising count from `len(asyncio.all_tasks())` over time indicates leaked tasks.

## Review checklist

- Every task has an owner that awaits it; no unreferenced `create_task`.
- `CancelledError` is never swallowed; cleanup is in `finally` or `async with`.
- Every network wait has a deadline.
- Fan-out is bounded; queues have `maxsize`.
- No blocking calls inside `async def`.
- One `asyncio.run` per process; no `get_event_loop()`.
