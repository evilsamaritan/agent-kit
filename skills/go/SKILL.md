---
name: go
description: Write idiomatic Go — goroutines, channels, interfaces, error handling, generics, modules, testing. Use when working with .go files, go.mod, or any Go question. Triggers on goroutine, channel, context.Context, go build, golangci-lint. Do NOT use for general backend patterns (use backend) or infrastructure (use devops).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Go

Idiomatic Go patterns. Go 1.24+, modules, generics, structured concurrency.

**Hard rules:**
- `gofmt` is not optional — all code is formatted with `gofmt`/`goimports`
- Errors are values — handle them explicitly, never ignore with `_`
- Accept interfaces, return structs
- `context.Context` is always the first parameter
- No `init()` — explicit initialization, testable code
- No `panic()` in library code — return errors
- No global mutable state — pass dependencies explicitly

---

## Core Mental Model

Go favors **simplicity over cleverness**, **composition over inheritance**, and **explicit over implicit**. The language deliberately omits features (no inheritance, no exceptions, limited generics) to keep code readable by anyone.

**Zero values** — every type has a useful zero value. `""` for strings, `0` for numbers, `nil` for pointers/slices/maps/channels/interfaces, `false` for bools. Design structs so zero value is valid.

**Value vs pointer receivers:**
```
Method modifies receiver?     → pointer receiver (*T)
Receiver is large struct?     → pointer receiver (*T)
Consistency (other methods)?  → match existing receivers
Everything else?              → value receiver (T)
```

**Interfaces** — implicit satisfaction. Define interfaces where they're consumed, not where they're implemented. Small interfaces (1-2 methods) compose best.

```go
// Good: consumer defines the interface it needs
type UserStore interface {
    GetUser(ctx context.Context, id string) (User, error)
}

// Implementation satisfies it implicitly
type PostgresStore struct { db *sql.DB }
func (s *PostgresStore) GetUser(ctx context.Context, id string) (User, error) { ... }
```

---

## Error Handling

Errors are the most important Go pattern. Get this right.

```go
// Wrap with context at each layer
if err != nil {
    return fmt.Errorf("fetch user %s: %w", id, err)
}
```

| Pattern | When | Example |
|---------|------|---------|
| Sentinel errors | Callers check specific condition | `var ErrNotFound = errors.New("not found")` |
| Custom error types | Callers need structured data | `type ValidationError struct { Field, Message string }` |
| Wrapping with `%w` | Add context, preserve chain | `fmt.Errorf("save order: %w", err)` |
| `errors.Is(err, target)` | Check error chain for sentinel | `if errors.Is(err, sql.ErrNoRows)` |
| `errors.As(err, &target)` | Extract typed error from chain | `var ve *ValidationError; errors.As(err, &ve)` |

**Rules:**
- Wrap errors at every layer boundary with meaningful context
- Never `log.Fatal` in library code — return the error
- Use `errors.Join` for multiple errors (Go 1.20+)
- Prefix wrap messages with the operation, not "failed to" or "error in"

---

## Concurrency

### Goroutines & Channels

```
When to use what?
├── Independent tasks, collect results → errgroup.Group
├── Pipeline (producer → transformer → consumer) → channels
├── Shared state with rare writes → sync.RWMutex
├── One-time initialization → sync.Once
├── Broadcast to multiple consumers → close(channel) as signal
└── Fan-out/fan-in → multiple goroutines → single channel
```

**errgroup** — the standard pattern for concurrent work:

```go
g, ctx := errgroup.WithContext(ctx)
for _, url := range urls {
    g.Go(func() error {
        return fetch(ctx, url)
    })
}
if err := g.Wait(); err != nil {
    return err
}
```

### context.Context

- First parameter to every function that does I/O or may be cancelled
- `context.WithCancel` — manual cancellation
- `context.WithTimeout` — deadline-based cancellation
- `context.WithValue` — request-scoped metadata only (trace IDs, auth), never for function parameters
- Never store context in a struct

### Goroutine Leak Prevention

```go
// ALWAYS ensure goroutines can exit
func process(ctx context.Context) {
    go func() {
        select {
        case <-ctx.Done():
            return // goroutine exits when context cancelled
        case result := <-work:
            handle(result)
        }
    }()
}
```

---

## Generics (Go 1.18+)

```go
// Type parameters with constraints
func Map[T, U any](s []T, f func(T) U) []U {
    result := make([]U, len(s))
    for i, v := range s {
        result[i] = f(v)
    }
    return result
}

// Type sets as constraints
type Number interface {
    ~int | ~int64 | ~float64
}
```

**When to use generics:**
- Container types (lists, trees, caches)
- Utility functions (map, filter, reduce)
- Type-safe wrappers

**When NOT to use generics:**
- When an interface suffices (method-based polymorphism)
- For domain logic (readability > reusability)
- When `any` would do the same job

---

## Testing

Go has first-class testing built in. No framework needed.

### Table-Driven Tests

```go
func TestParse(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    int
        wantErr bool
    }{
        {"valid", "42", 42, false},
        {"negative", "-1", -1, false},
        {"invalid", "abc", 0, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Parse(tt.input)
            if (err != nil) != tt.wantErr {
                t.Fatalf("Parse(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
            }
            if got != tt.want {
                t.Errorf("Parse(%q) = %v, want %v", tt.input, got, tt.want)
            }
        })
    }
}
```

| Testing feature | Purpose |
|----------------|---------|
| `t.Run(name, fn)` | Subtests with descriptive names |
| `t.Parallel()` | Run test in parallel |
| `t.Helper()` | Mark function as test helper (better error locations) |
| `t.Cleanup(fn)` | Register cleanup (runs after test, LIFO) |
| `testing.Short()` | Skip slow tests with `-short` flag |
| `func FuzzX(f *testing.F)` | Fuzz testing (Go 1.18+) |
| `func BenchmarkX(b *testing.B)` | Benchmarks with `b.N` loop |
| `testify` | Assertion library (optional, widely used) |

---

## Project Structure

```
myproject/
├── cmd/
│   └── server/         # main packages (one per binary)
│       └── main.go
├── internal/            # private packages (enforced by compiler)
│   ├── handler/
│   ├── service/
│   └── repository/
├── pkg/                 # public library packages (use sparingly)
├── go.mod
├── go.sum
└── Makefile
```

**Rules:**
- `internal/` prevents external imports — use for implementation details
- `cmd/` for entry points — minimal code, wire up dependencies, call `run()`
- Flat packages for small projects — don't over-structure
- Package names: short, lowercase, no underscores, no plurals

---

## Go 1.22-1.24 Features

| Feature | Version | What changed |
|---------|---------|-------------|
| Range over integers | 1.22 | `for i := range 10` |
| Range over func | 1.23 | `for v := range iter.Seq[V]` — custom iterators |
| Enhanced HTTP routing | 1.22 | `mux.HandleFunc("GET /users/{id}", handler)` — method + path params |
| Loop variable capture fix | 1.22 | Loop vars are per-iteration (no more goroutine capture bug) |
| `slices` / `maps` packages | 1.21 | Generic utility functions for slices and maps |
| `log/slog` | 1.21 | Structured logging in stdlib |
| `sync.OnceValue` / `sync.OnceFunc` | 1.21 | Type-safe lazy initialization |
| Fuzz testing | 1.18 | Built-in fuzzer |
| `go tool` improvements | 1.24 | `go tool` subcommand for tool management |

---

## Common Patterns

### Functional Options

```go
type Server struct {
    addr    string
    timeout time.Duration
}

type Option func(*Server)

func WithAddr(addr string) Option { return func(s *Server) { s.addr = addr } }
func WithTimeout(d time.Duration) Option { return func(s *Server) { s.timeout = d } }

func NewServer(opts ...Option) *Server {
    s := &Server{addr: ":8080", timeout: 30 * time.Second}
    for _, o := range opts {
        o(s)
    }
    return s
}
```

### Middleware Chain

```go
func Logging(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        slog.Info("request", "method", r.Method, "path", r.URL.Path)
        next.ServeHTTP(w, r)
    })
}
// chain: Logging(Auth(handler))
```

---

## Tooling

```bash
go fmt ./...                    # format all code
go vet ./...                    # static analysis (built-in)
golangci-lint run               # comprehensive linter (replaces many individual linters)
go test ./... -race -count=1    # tests with race detector
go test ./... -bench=.          # run benchmarks
go tool pprof                   # CPU/memory profiling
```

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Fix |
|---|-------------|---------|-----|
| 1 | Goroutine leak | No exit path, blocks forever | Always select on `ctx.Done()` |
| 2 | Nil interface trap | `(*T)(nil)` is not `nil` interface | Compare concrete type to nil before wrapping |
| 3 | Slice append to shared backing | `append` may mutate original | Copy or pre-allocate with `make([]T, 0, cap)` |
| 4 | `context.Value` for dependencies | Invisible, untyped coupling | Pass dependencies as function parameters |
| 5 | `init()` functions | Hidden side effects, untestable | Explicit initialization in `main()` |
| 6 | Naked returns in long functions | Unreadable, error-prone | Name returns only for documentation |
| 7 | `panic` in library code | Crashes caller, unrecoverable | Return errors — let caller decide |
| 8 | Ignoring `errcheck` | Silently swallowed errors | Handle every error or explicitly `_ =` with comment |
| 9 | Large interfaces | Hard to implement, hard to mock | 1-2 method interfaces, compose as needed |
| 10 | `sync.Mutex` on value receiver | Lock copied, not shared | Always pointer receiver for mutex-holding structs |

---

## Related Knowledge

- **backend** — HTTP handlers, middleware, DI, service lifecycle
- **database** — database/sql, sqlc, pgx, connection pooling, migrations
- **qa** — table-driven tests, fuzzing, race detection, testcontainers
- **docker** — multi-stage builds for Go binaries, scratch/distroless
- **observability** — OpenTelemetry Go SDK, slog, pprof

## References

Load on demand for detailed patterns:

- `references/concurrency-patterns.md` — goroutine lifecycle, channel patterns, errgroup, worker pools, pipeline
- `references/library-reference.md` — standard library highlights, popular third-party packages by category
