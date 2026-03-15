# Go Concurrency Patterns

Deep-dive into goroutine lifecycle, channel patterns, and structured concurrency.

---

## Goroutine Lifecycle Management

### Always ensure goroutines can exit

Every goroutine must have a clear exit path. The most common source of goroutine leaks is missing cancellation handling.

```go
// Pattern: context-controlled goroutine
func worker(ctx context.Context, jobs <-chan Job) {
    for {
        select {
        case <-ctx.Done():
            return // clean exit
        case job, ok := <-jobs:
            if !ok {
                return // channel closed
            }
            process(job)
        }
    }
}
```

### Goroutine ownership

The function that starts a goroutine is responsible for ensuring it stops. Return a cleanup function or use context cancellation.

```go
func startPoller(ctx context.Context, interval time.Duration) (cancel func()) {
    ctx, cancel = context.WithCancel(ctx)
    go func() {
        ticker := time.NewTicker(interval)
        defer ticker.Stop()
        for {
            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
                poll()
            }
        }
    }()
    return cancel
}
```

---

## Channel Patterns

### Fan-Out / Fan-In

Multiple goroutines read from the same channel (fan-out), results merge into one channel (fan-in).

```go
func fanOut(ctx context.Context, input <-chan Task, workers int) <-chan Result {
    results := make(chan Result)
    var wg sync.WaitGroup
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for task := range input {
                select {
                case results <- process(task):
                case <-ctx.Done():
                    return
                }
            }
        }()
    }
    go func() {
        wg.Wait()
        close(results)
    }()
    return results
}
```

### Pipeline

Each stage is a goroutine that reads from input channel, transforms, writes to output channel.

```go
func stage(ctx context.Context, in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for v := range in {
            select {
            case out <- v * 2:
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}
// Usage: result := stage3(ctx, stage2(ctx, stage1(ctx, input)))
```

### Semaphore (Bounded Concurrency)

```go
func processAll(ctx context.Context, items []Item, maxConcurrent int) error {
    sem := make(chan struct{}, maxConcurrent)
    g, ctx := errgroup.WithContext(ctx)
    for _, item := range items {
        sem <- struct{}{} // acquire
        g.Go(func() error {
            defer func() { <-sem }() // release
            return process(ctx, item)
        })
    }
    return g.Wait()
}
```

### Or-Done Channel

Select on a done channel alongside any other channel operation to enable cancellation.

```go
func orDone(ctx context.Context, c <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for {
            select {
            case <-ctx.Done():
                return
            case v, ok := <-c:
                if !ok { return }
                select {
                case out <- v:
                case <-ctx.Done():
                    return
                }
            }
        }
    }()
    return out
}
```

---

## errgroup Patterns

### With concurrency limit

```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(10) // max 10 concurrent goroutines

for _, url := range urls {
    g.Go(func() error {
        return fetch(ctx, url)
    })
}
return g.Wait()
```

### Collecting results

```go
type result struct {
    url  string
    body []byte
}

g, ctx := errgroup.WithContext(ctx)
results := make([]result, len(urls))

for i, url := range urls {
    g.Go(func() error {
        body, err := fetch(ctx, url)
        if err != nil {
            return err
        }
        results[i] = result{url: url, body: body} // safe: each goroutine writes to unique index
        return nil
    })
}
if err := g.Wait(); err != nil {
    return nil, err
}
```

---

## Worker Pool

```go
func workerPool(ctx context.Context, jobs <-chan Job, results chan<- Result, numWorkers int) {
    var wg sync.WaitGroup
    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {
                select {
                case <-ctx.Done():
                    return
                case results <- job.Process():
                }
            }
        }()
    }
    go func() {
        wg.Wait()
        close(results)
    }()
}
```

---

## sync Primitives

| Primitive | Use case |
|-----------|----------|
| `sync.Mutex` | Protect shared state (lock/unlock) |
| `sync.RWMutex` | Many readers, few writers |
| `sync.Once` | One-time initialization |
| `sync.OnceValue[T]` | Lazy init returning a value (Go 1.21+) |
| `sync.WaitGroup` | Wait for N goroutines |
| `sync.Pool` | Reuse temporary objects (reduce GC pressure) |
| `sync.Map` | Concurrent map (specific use cases only) |
| `atomic.*` | Lock-free counters, flags |

**Rule:** Prefer channels for communication, mutexes for state protection. If unsure, use channels.

---

## Testing Concurrency

```go
func TestConcurrent(t *testing.T) {
    t.Parallel() // run alongside other parallel tests

    // Use -race flag to detect data races
    // go test ./... -race

    // Deadlock detection: set timeout
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    result := make(chan int, 1)
    go func() { result <- compute() }()

    select {
    case v := <-result:
        if v != expected {
            t.Errorf("got %d, want %d", v, expected)
        }
    case <-ctx.Done():
        t.Fatal("timed out waiting for result")
    }
}
```
