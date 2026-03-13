# CTO Domain Knowledge

Decision trees, anti-patterns, maturity model, and heuristics for technical leadership.

## Contents

- [Healthy Repository Indicators](#healthy-repository-indicators)
- [Package Decomposition Decision Tree](#package-decomposition-decision-tree)
- [Service Decomposition Signals](#service-decomposition-signals)
- [Common Repository Anti-Patterns](#common-repository-anti-patterns)
- [Cross-Cutting Concern Patterns](#cross-cutting-concern-patterns)
- [Engineering Maturity Model](#engineering-maturity-model)
- [Team Topology Alignment](#team-topology-alignment)

---

## Healthy Repository Indicators

```
Structure follows domain, not technology
Every package justifies its existence
Dependency graph is a DAG (no cycles)
Scripts are consistent across workspaces
One way to do each thing (one DI pattern, one logging approach, one error taxonomy)
New service creation is copy+modify, not reinvent
All checks pass in under 60 seconds locally
Build cache hit rate is high in CI
Onboarding time under 15 minutes
```

---

## Package Decomposition Decision Tree

```
Should this be a separate shared package?

  Is it used by 2+ services?
    YES → shared package (e.g., shared logging, shared DB client)
    NO  → Is it a distinct domain concern?
            YES → shared package (separation of concerns)
            NO  → Keep it as a module within the service

  Is it pure utility with no domain logic?
    YES → root-level config or utility (linter config, formatter config)
    NO  → shared package directory

  Does it have its own external dependencies?
    YES → shared package (isolates dependency surface)
    NO  → Consider if it's just types/interfaces — could be inline
```

---

## Service Decomposition Signals

```
SPLIT a service when:
  - It handles two unrelated event streams or request domains
  - It needs different scaling characteristics
  - Failure in one part should not affect the other
  - Different teams would own different parts
  - It has grown beyond ~2000 LOC of business logic

MERGE / DO NOT SPLIT when:
  - The "services" share a database and cannot be separated
  - Communication between them would be synchronous and frequent
  - The split adds operational overhead without clear benefit
  - Total LOC is small (<500) — nanoservice overhead is not worth it
```

---

## Common Repository Anti-Patterns

| # | Anti-Pattern | Description | Fix |
|---|-------------|-------------|-----|
| 1 | Phantom dependencies | Service uses a package only installed transitively — works locally, breaks in isolated build | Declare all direct dependencies explicitly |
| 2 | Cross-package relative imports | Bypasses the package API, creates invisible coupling | Use workspace aliases or package names |
| 3 | Empty script stubs | Scripts that run but do nothing — clutters manifests, misleads CI | Remove or implement |
| 4 | Version drift | Different compiler/runtime versions across packages — different behavior | Pin to a single version at root level |
| 5 | Kitchen sink package | One package does logging + config + DB + types — too many concerns | Split by concern or document the deliberate choice |
| 6 | Inconsistent DI | Different dependency injection patterns across services | Pick one pattern, enforce it |
| 7 | Orphan scripts | Scripts exist but nothing calls them | Remove or wire into CI/hooks |
| 8 | Undocumented architecture decisions | Patterns exist but nobody wrote down why | Create ADRs for implicit decisions |
| 9 | Monorepo without task orchestration | Running all tests/builds serially instead of in dependency order | Use workspace-aware task runner |
| 10 | Shared database access | Multiple services reading/writing the same tables | Assign ownership, create API boundaries |

---

## Cross-Cutting Concern Patterns

### Observability
- Structured logging: JSON logs with correlation IDs, service name, environment
- Metrics: request latency, error rates, queue depth, custom business metrics
- Distributed tracing: propagate trace context across service boundaries
- Consistency check: are all services using the same logging library and format?

### Configuration Management
- Typed config: validated at startup, fails fast on missing/invalid values
- Environment-based: .env files for local, environment variables for production
- Secrets separation: secrets never in config files, always from vault/env
- Consistency check: same config loading pattern in every service?

### Error Handling
- Error taxonomy: shared error codes/types across services
- Error boundaries: catch at service boundary, translate to API response
- Error propagation: structured error context flows through the call chain
- Consistency check: same error handling pattern in every service?

### API Versioning
- URL-based: `/v1/`, `/v2/` — simple, explicit, but endpoint proliferation
- Header-based: `Accept: application/vnd.api+json;version=2` — cleaner URLs
- Additive changes: add fields, do not remove or rename
- Deprecation policy: announce, sunset period, remove

---

## Engineering Maturity Model

| Level | Name | Characteristics |
|-------|------|----------------|
| L0 | Prototype | Works on author's machine. No tests, no CI, no containers. |
| L1 | Reproducible | Env template, containerized infra, documented scripts. Another developer can start. |
| L2 | Verified | CI runs lint + type-check. Container builds work. Code review catches human-visible issues. |
| L3 | Tested | Unit tests on critical paths. Integration tests for data stores and message queues. CI catches regressions. |
| L4 | Deployable | Container images built in CI. Deploy script exists. Rollback possible. Health checks gate deploys. |
| L5 | Observable | Structured logs, metrics, alerts. System state visible without SSH. |
| L6 | Resilient | Graceful degradation. Circuit breakers. Reconciliation. System recovers without human intervention. |

---

## Team Topology Alignment

Code structure should reflect team ownership. When they diverge, friction increases.

```
Aligned:
  Team A owns service-a/ and packages used only by service-a
  Team B owns service-b/ and packages used only by service-b
  Platform team owns shared packages used by all services

Misaligned:
  Team A and Team B both modify shared-package/ frequently → ownership conflict
  One team owns a service but its dependencies are owned by another team → coupling
  Package boundaries do not match team boundaries → coordination overhead

Fix: restructure packages to match team ownership, or restructure teams to match code.
Conway's Law is a constraint, not a suggestion.
```
