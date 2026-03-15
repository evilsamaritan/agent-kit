# Go Library Reference

Standard library highlights and popular third-party packages by category.

---

## Standard Library Highlights

| Package | Purpose |
|---------|---------|
| `net/http` | HTTP client/server (enhanced routing in 1.22+) |
| `encoding/json` | JSON encode/decode |
| `database/sql` | Database interface |
| `context` | Cancellation, timeouts, request-scoped values |
| `log/slog` | Structured logging (1.21+) |
| `testing` | Tests, benchmarks, fuzzing |
| `errors` | Error wrapping, Is/As |
| `slices` / `maps` | Generic utilities (1.21+) |
| `sync` | Concurrency primitives |
| `crypto/*` | Cryptography (TLS, hashing, encryption) |
| `embed` | Embed files at compile time |
| `io/fs` | Filesystem abstraction |

---

## Web Frameworks / HTTP

| Package | Style | Use when |
|---------|-------|----------|
| `net/http` (stdlib) | Minimal | Simple APIs, stdlib-only policy |
| `chi` | Router | Need middleware, stdlib-compatible |
| `echo` | Framework | Rapid API development, built-in validation |
| `gin` | Framework | Performance-focused APIs |
| `fiber` | Framework | Express.js-like API (fasthttp-based) |
| `connect-go` | RPC | gRPC + HTTP/JSON from same definition |

**Recommendation:** Start with `net/http` (Go 1.22+ routing is powerful). Add `chi` if you need middleware composition. Reach for frameworks only for large API surfaces.

---

## Database

| Package | Purpose |
|---------|---------|
| `database/sql` | Standard interface (use with drivers) |
| `pgx` | PostgreSQL driver (prefer over lib/pq) |
| `sqlc` | Generate type-safe Go from SQL queries |
| `sqlx` | Extensions to database/sql (struct scanning) |
| `ent` | Entity framework / ORM |
| `goose` / `golang-migrate` | Schema migrations |
| `go-sqlite3` / `modernc.org/sqlite` | SQLite (CGo / pure Go) |

**Recommendation:** `pgx` + `sqlc` for PostgreSQL. Type-safe, no runtime reflection.

---

## Observability

| Package | Purpose |
|---------|---------|
| `log/slog` (stdlib) | Structured logging |
| `go.opentelemetry.io/otel` | OpenTelemetry tracing + metrics |
| `prometheus/client_golang` | Prometheus metrics |
| `net/http/pprof` (stdlib) | CPU/memory profiling |

---

## Testing

| Package | Purpose |
|---------|---------|
| `testing` (stdlib) | Tests, benchmarks, fuzzing |
| `testify` | Assertions, mocks, suites |
| `gomock` / `mockgen` | Interface mocking |
| `testcontainers-go` | Docker containers for integration tests |
| `go-cmp` | Deep comparison with options |
| `httptest` (stdlib) | HTTP handler testing |

---

## CLI

| Package | Purpose |
|---------|---------|
| `flag` (stdlib) | Simple flags |
| `cobra` | CLI framework (subcommands, completions) |
| `urfave/cli` | Alternative CLI framework |
| `bubbletea` | Terminal UI (TUI) framework |
| `lipgloss` | Terminal styling |

---

## Configuration

| Package | Purpose |
|---------|---------|
| `os` (stdlib) | Environment variables |
| `viper` | Config files + env + flags |
| `envconfig` | Struct tags → env vars |
| `koanf` | Lightweight config (viper alternative) |

---

## Concurrency

| Package | Purpose |
|---------|---------|
| `sync` (stdlib) | Mutex, WaitGroup, Once, Pool |
| `golang.org/x/sync/errgroup` | Goroutine groups with error propagation |
| `golang.org/x/sync/semaphore` | Weighted semaphore |
| `golang.org/x/sync/singleflight` | Dedup concurrent calls |

---

## Serialization

| Package | Purpose |
|---------|---------|
| `encoding/json` (stdlib) | JSON (reflection-based) |
| `github.com/goccy/go-json` | Fast JSON (drop-in replacement) |
| `google.golang.org/protobuf` | Protocol Buffers |
| `github.com/vmihailenco/msgpack` | MessagePack |

---

## Linting

```yaml
# .golangci.yml (recommended config)
linters:
  enable:
    - errcheck
    - govet
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - gocritic
    - revive
    - nilerr
    - errorlint
    - exhaustive
```
