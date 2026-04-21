---
name: architecture
description: Design and review software architecture — system decomposition, ADRs, patterns (DDD, CQRS, hexagonal, event-driven, cell-based, serverless), NFR frameworks, tech-debt assessment. Use when starting a new system, choosing between monolith/microservices/modular monolith, writing an ADR, evaluating architectural alternatives, or auditing a system against NFRs. Do NOT use for implementation code (use frontend/backend), API contracts (use api-design), schema design (use database), or CI/CD (use ci-cd).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# Software Architecture

Architectural patterns, NFR frameworks, ADR conventions, and system decomposition strategies. Vendor-neutral. This skill carries the **what** and **when** — the *how* to think as an architect lives in the `architect` role-template.

## Scope and boundaries

**This skill covers:**
- System decomposition: monolith vs modular monolith vs microservices vs cell-based vs serverless
- Architectural styles: layered, hexagonal, clean, DDD, CQRS, event-driven, data-centric, AI-augmented
- NFR frameworks: latency/availability/durability/cost/security/observability budgets
- ADR authoring: templates, lifecycle, archival
- Tech-debt assessment methodology (what makes debt "load-bearing" vs "decorative")

**This skill does not cover:**
- HTTP/REST/GraphQL contract design → `api-design`
- Database schema/index/query design → `database`
- Implementation idioms per language → `go`, `rust`, `kotlin`, `javascript`, etc.
- CI/CD pipelines → `ci-cd`
- Release strategies (canary/blue-green/flags) → `release-engineering`
- Observability instrumentation → `observability`

## Decision tree — picking a style

```
Is the system one team, < 50k LOC, < 10 services worth of complexity?
├─ yes → modular monolith (default). Skip microservices until it hurts.
└─ no →
   Does domain carry strong bounded contexts with independent scaling?
   ├─ yes → microservices per context. Watch for: chatty network, distributed transactions.
   └─ no →
      Does workload spike to zero and traffic is bursty?
      ├─ yes → serverless / functions. Watch for: cold starts, vendor lock-in, observability.
      └─ no → cell-based (groups of services behind per-cell control plane). Watch for: cross-cell coordination cost.
```

Pick from constraints (team, scale, cost, regulatory), not from fashion.

## Core patterns — when each earns its keep

| pattern | use when | cost |
|---------|----------|------|
| **Layered** | CRUD-heavy, stable domain | can become transaction-script soup |
| **Hexagonal / ports-and-adapters** | multiple transports (HTTP + queue + CLI) over same core | more boilerplate |
| **DDD** | domain is the hardest part; multiple experts with different vocabularies | heavy up-front investment |
| **CQRS** | read/write workloads differ by ≥ 10×, or read model needs composition | consistency lag, two models to maintain |
| **Event-driven** | cross-service invariants are async, decoupling matters more than latency | debugging is harder, need replay + idempotency |
| **Cell-based** | per-tenant or per-region isolation required (blast radius, data residency) | each cell duplicates infra — budget accordingly |

**Rule:** pick the simplest pattern that solves the current constraint. Revisit when the constraint changes.

## NFR framework

Every significant architectural decision names at least:

- **Latency budget** — p50, p95, p99 target per path that matters
- **Availability target** — percentile (99.9%? 99.99%?), over what window, measured how
- **Durability** — loss tolerance for data (0? 1 hour? replicated / backed up?)
- **Cost envelope** — unit economics ($ per request, $ per tenant, $ per TB)
- **Security posture** — threat model scope, data sensitivity classes, auth boundaries
- **Observability surface** — what signals must be emitted for this decision to stay safe

Silence on any of these = "same as existing defaults". Only valid if you state it explicitly.

## ADR rules

- One ADR per decision. Don't stack multiple decisions in one document.
- **Status** (Proposed / Accepted / Superseded / Deprecated) is part of the file. Superseded ADRs stay in the repo — history matters.
- **Context** section describes the problem and constraints *as of the decision date* — don't rewrite history.
- **Alternatives** section lists at least two rejected options with why. A decision without alternatives isn't a decision, it's a preference.
- **Consequences** section is honest about tradeoffs, including the ugly ones.

See `references/adr-template.md` for the full template.

## Tech-debt assessment

Debt is **load-bearing** (if we don't fix it, something breaks / stops scaling) or **decorative** (makes devs unhappy, no functional impact). Only load-bearing debt earns engineering cycles.

Red flags indicating load-bearing debt:
- a single team owns > 5 services with no clear bounded context
- one service holds > 50% of revenue traffic and has < 2 on-call rotations worth of experience
- schema migrations require manual coordination across 3+ teams
- rollback-by-redeploy takes > 10 minutes

See `references/engineering-health.md` for a full audit checklist.

## Context adaptation

**As architect (planning a new system):** lead with constraints (scale, budget, team), enumerate 2–3 style candidates with tradeoffs, pick, write ADR. Don't design for a scale 10× beyond next year's demand.

**As reviewer (auditing an existing system):** score against NFRs, flag load-bearing debt, list 3–5 concrete leverage points ordered by ROI. A review without ROI ordering is noise.

**As implementer (executing someone else's design):** your ADRs are downstream — if the spec contradicts NFRs, escalate before writing the code.

**As operator (running the system):** you see which architectural choices cost the most in on-call. Feed that back into the next ADR review cycle.

## Anti-patterns

- **Architecture astronauting** — abstractions for imaginary scale or imaginary future features.
- **No-alternatives ADRs** — "we chose X" without naming what you rejected and why.
- **NFR amnesia** — ADRs that never mention latency, availability, or cost.
- **Pattern worship** — "it should be microservices / event-driven / DDD" because the pattern is trendy.
- **Review paralysis** — endless architecture review without a forcing function for a decision.
- **Reorg-as-architecture** — team boundaries conflated with service boundaries. They reinforce each other but aren't the same.

## Related Knowledge

- `api-design` — once decomposition is decided, contracts between services
- `database` — data model is half the architecture
- `observability` — how you'll see whether the architecture is working
- `reliability` — SLOs are the runtime projection of architectural choices
- `release-engineering` — deployment shape amplifies or masks architecture problems

## References

- [adr-template.md](references/adr-template.md) — standard ADR structure
- [architecture-patterns.md](references/architecture-patterns.md) — pattern catalog with tradeoffs
- [design-principles.md](references/design-principles.md) — SOLID, YAGNI, loose coupling, high cohesion — why each earns its keep
- [design-patterns.md](references/design-patterns.md) — classical GoF + modern patterns
- [system-design.md](references/system-design.md) — end-to-end walkthrough of a system design interview-style
- [ai-system-patterns.md](references/ai-system-patterns.md) — RAG, agents, evals, guardrails — architectural considerations for AI-backed systems
- [engineering-health.md](references/engineering-health.md) — org-level tech-health audit checklist (monorepo vs polyrepo, dependency graphs, DX, cross-team standards)
