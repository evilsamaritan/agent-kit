# Go Dependencies and Tooling

Rules for choosing dependencies, not a catalog. Check each package's maintenance status (latest release, open security issues, archived repository) before adding it.

## Decision rules

```
HTTP server        → net/http first (method and path-pattern routing is built in). Add a router only for middleware composition, and a framework only for a large API surface
PostgreSQL         → pgx for the driver; sqlc for type-checked queries generated from SQL. Add an ORM only when the model needs it
Other databases    → database/sql with the vendor's driver; modernc.org/sqlite for SQLite without cgo
Logging            → log/slog
Tracing, metrics   → OpenTelemetry SDK; Prometheus client when scraping is the contract
Config             → environment variables and flags first; a config library only when files, env, and flags must merge
CLI                → flag for a few options; cobra when there are subcommands and completions
Concurrency        → sync, context, and golang.org/x/sync (errgroup; singleflight to deduplicate calls; semaphore only for weighted limits)
Serialization      → encoding/json (check the json/v2 notes in go-versions.md); google.golang.org/protobuf for protobuf
Testing            → testing; go-cmp for deep comparisons; httptest for handlers; testcontainers-go for integration tests against real services
Mocks              → hand-written fakes for small interfaces; generate a mock only for a large interface
```

Prefer the standard library when the cost of the dependency (updates, vulnerabilities, API drift) exceeds the code it saves. Check an unfamiliar module with `go list -m -versions` and `govulncheck ./...`.

## Linting

Use the project's golangci-lint configuration. The file format differs between golangci-lint v1 and v2 (v2 starts with `version: "2"`, selects linters under `linters.default` and `linters.enable`, and merged `gosimple` and `stylecheck` into `staticcheck`; `golangci-lint migrate` converts a v1 file), so check the installed version and its migration guide before writing keys. Linters worth enabling beyond the defaults: `errcheck` (unhandled errors), `errorlint` (`%w` and `errors.Is/As` misuse), `exhaustive` (switches over closed sets), `nilerr`, and `gocritic`.

```bash
golangci-lint version
golangci-lint run ./...
govulncheck ./...
go vet ./...
```
