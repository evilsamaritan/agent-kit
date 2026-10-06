# Go Versions

Features that change decisions, by the release that introduced them. Read the `go` directive in `go.mod` first: language features follow the `go` directive, library features follow the toolchain that builds the module, and a feature newer than the directive's version is a compile error or silently different behavior. As of 2026-10-06 the latest stable release is Go 1.27 (2026-08-19); the notes below come from the official release notes at go.dev/doc (go1.24 to go1.27).

## Contents

- [Language](#language)
- [Standard library](#standard-library)
- [Toolchain and runtime](#toolchain-and-runtime)
- [Choosing by `go` directive](#choosing-by-go-directive)

## Language

| Version | Feature | Note |
|---------|---------|------|
| 1.18 | Generics, fuzzing | |
| 1.21 | `min`, `max`, `clear` builtins | |
| 1.22 | Per-iteration loop variables | Closures and goroutines in a loop capture the iteration's own variable. Applies only when the module's `go` directive is 1.22 or later |
| 1.22 | Range over integers | `for i := range 10` |
| 1.23 | Range over functions | `for v := range seq` with `iter.Seq` and `iter.Seq2` |
| 1.26 | `new(expr)` | `new(yearsSince(born))` allocates a pointer initialized from an expression |
| 1.26 | Self-referential generic constraints | `type Adder[A Adder[A]] interface{ Add(A) A }` |
| 1.27 | Generic methods | Methods can declare their own type parameters |

## Standard library

| Version | Feature | Use |
|---------|---------|-----|
| 1.20 | `errors.Join`, multi-`%w` | Combine errors |
| 1.21 | `log/slog`, `slices`, `maps`, `sync.OnceValue` | Structured logging, generic helpers, lazy init |
| 1.22 | `net/http` pattern routing | `mux.HandleFunc("GET /users/{id}", h)` with `r.PathValue("id")` |
| 1.24 | `testing.B.Loop`, `T.Context`, `T.Chdir`, `weak`, `encoding/json` `omitzero` | Benchmarks without `b.N`, test-scoped context, weak pointers, omit zero values |
| 1.24 | `testing/synctest` (experiment) | Became generally available in 1.25 |
| 1.25 | `sync.WaitGroup.Go` | Starts and counts a goroutine in one call; replaces `Add(1)` plus `go func(){ defer Done() }()` |
| 1.25 | `testing/synctest` stable | `synctest.Test` runs a test in a bubble with virtual time |
| 1.25 | `encoding/json/v2` as an experiment | Behind `GOEXPERIMENT=jsonv2` |
| 1.26 | `errors.AsType` | Generic, type-safe replacement for `errors.As` |
| 1.27 | `encoding/json/v2`, `encoding/json/jsontext` | New packages; `encoding/json` itself is now backed by the v2 implementation (same behavior, error message text may differ; `GOEXPERIMENT=nojsonv2` restores the old one). v2 rejects invalid UTF-8 and duplicate object names by default |
| 1.27 | `testing/synctest.Sleep` | `time.Sleep` plus `synctest.Wait` in one call |

## Toolchain and runtime

| Version | Change |
|---------|--------|
| 1.21 | Profile-guided optimization from `default.pgo` in the main package |
| 1.24 | Swiss-table maps; `tool` directives in `go.mod` (`go get -tool`) replace the `tools.go` workaround |
| 1.25 | Container-aware `GOMAXPROCS` on Linux; `go vet` analyzers for misplaced `WaitGroup.Add` and for `host:port` string formatting; `ignore` directive in `go.mod` |
| 1.26 | Green Tea garbage collector is the default (experiment in 1.25); `go fix` is rewritten as the home of code modernizers |
| 1.26 | Goroutine leak profile as an experiment (`GOEXPERIMENT=goroutineleakprofile`) |
| 1.27 | Goroutine leak profile generally available: profile `goroutineleak` in `runtime/pprof` and `/debug/pprof/goroutineleak`; `go test` runs the `stdversion` vet check |

## Choosing by `go` directive

```
go directive below 1.22 → capture loop variables explicitly in closures and goroutines
go directive below 1.23 → no range-over-func; use callbacks or slices
go directive below 1.25 → wg.Add(1) / defer wg.Done(); no synctest.Test
otherwise              → use the features above, and let `go fix` modernize old patterns
```

When raising the `go` directive, do it deliberately: it changes language semantics (loop variables) and the minimum toolchain for every consumer of a library.

## Example: `WaitGroup.Go` and `synctest`

```go
// 1.25+
var wg sync.WaitGroup
for _, url := range urls {
    wg.Go(func() { fetch(ctx, url) })
}
wg.Wait()
```

```go
// 1.25+: virtual time inside the bubble; the sleep returns immediately in wall-clock terms
func TestDeadline(t *testing.T) {
    synctest.Test(t, func(t *testing.T) {
        ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
        defer cancel()

        time.Sleep(5 * time.Second)
        synctest.Wait() // all goroutines in the bubble are blocked or finished
        if ctx.Err() == nil {
            t.Fatal("context should have expired")
        }
    })
}
```
