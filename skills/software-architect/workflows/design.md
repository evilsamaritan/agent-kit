# Workflow: Architecture from Scratch

**Goal:** Produce a clear architectural specification for a new system or module — one that an implementation team can execute without architectural guesswork.

**Output:** Context diagram, container diagram, NFR list, key ADRs, open questions list, module breakdown with responsibilities and interfaces.

---

## Phase 1 — Frame the Problem

Before any design, answer these explicitly. Write them down.

### Functional scope
- What does this system do? (one paragraph — if it takes more, the scope is unclear)
- What does it explicitly NOT do?
- Who are the users / clients?
- What are the external systems it integrates with?

### Constraints (non-negotiable)
- Regulatory / compliance constraints (GDPR, HIPAA, SOC2, etc.)
- Technology mandates (existing stack, cloud provider, licensing)
- Team constraints (size, skills, timeline)
- Budget / infra constraints

### Quality attribute targets (NFRs)
Assign concrete numbers, not adjectives:

| Attribute | Target | Rationale |
|-----------|--------|-----------|
| Availability | 99.9% | business requirement |
| P99 latency | < 500ms | user experience |
| Throughput | 1,000 req/s at peak | measured traffic model |
| Data durability | RPO < 1min, RTO < 5min | criticality of data |

Do not proceed until NFRs have numbers.  
"Fast" and "reliable" are not NFRs.

### Assumptions
List every assumption explicitly.  
Assumptions are proto-risks — if they're wrong, the design may be wrong.

---

## Phase 2 — Identify the Domain

For systems with non-trivial business logic, apply Domain-Driven Design thinking.  
For simple CRUD systems, skip to Phase 3.

Load `references/architecture-patterns.md` → **DDD section**.

### Steps:
1. **Identify subdomains** — what are the major business capabilities?
   - Core domain: where competitive advantage lives → invest heavily
   - Supporting domain: needed but not differentiating → build lean
   - Generic domain: commodity → buy, don't build

2. **Draw bounded context boundaries** — where does a term mean something different?
   - "Customer" in billing ≠ "Customer" in support
   - Boundaries become module/service boundaries

3. **Define ubiquitous language** — terms used in code must match terms domain experts use
   - Write a glossary of 10–20 key terms
   - If developers and stakeholders use different words, there's a translation layer that accumulates bugs

4. **Identify domain events** — what meaningful things happen?
   - `OrderPlaced`, `PaymentConfirmed`, `InventoryReserved`
   - Events reveal workflow and coupling between subdomains

---

## Phase 3 — Choose the Architecture Style

Use this decision tree:

```
Is complexity primarily in business logic?
  YES → DDD + Hexagonal / Clean Architecture
  NO  → continue

Is this a data pipeline / event-driven system?
  YES → Event-driven architecture (pipes and filters, streaming)
  NO  → continue

Is this CRUD with simple business rules?
  YES → Layered (3-tier) or simple MVC
  NO  → continue

Is this short-lived, request-driven with unpredictable traffic?
  YES → Serverless / FaaS (Lambda, Cloud Functions)
  NO  → continue

Do different parts have wildly different scaling needs?
  YES → consider CQRS for the specific hot path
  NO  → unified model is fine

Does the system need independent failure isolation at scale?
  YES → Cell-based architecture (partition by tenant/region)
  NO  → standard deployment topology
```

**Team size → deployment model:**
```
< 10 engineers   → Single deployable unit (monolith or modular monolith)
10–50 engineers  → Modular monolith with clear internal boundaries
> 50 engineers   → Microservices ONLY if team autonomy is the primary constraint
```

Load `references/architecture-patterns.md` for deep-dive on each style.

**Document your choice as ADR-001.** See `references/adr-template.md`.

---

## Phase 4 — Define Module Boundaries

For each major module/component/service:

```
Module: [Name]
Responsibility: [One sentence — what it does and does NOT do]
Public interface: [what it exposes — APIs, events, data contracts]
Dependencies: [what it depends on — never circular]
Owns data: [which data it is the authoritative source for]
Failure mode: [what happens when this module fails]
```

### Boundary rules:
- Dependencies flow in one direction only — draw the DAG
- Circular dependencies are architectural debt, not a design choice
- Each module owns its data — no other module reads its DB directly
- Public interface is the contract — implementation is private

### For hexagonal / clean architecture:
- Core domain has zero infrastructure dependencies
- Interfaces (ports) live in the domain
- Implementations (adapters) live outside the domain
- Dependency injection wires them together at the composition root

Load `references/architecture-patterns.md` → **Hexagonal / Clean section**.

---

## Phase 5 — Data Architecture

### Storage selection:
For each type of data, choose the right store:

| Data type | Recommended |
|-----------|-------------|
| Relational, ACID required | PostgreSQL (default) |
| Global distributed ACID | CockroachDB / YugabyteDB |
| Document / flexible schema | PostgreSQL JSONB (prefer) or MongoDB |
| Time-series metrics | TimescaleDB or InfluxDB |
| Vector / semantic search < 50M | pgvector on PostgreSQL |
| Vector / semantic search > 50M | Milvus, Qdrant, Pinecone |
| Graph relationships | Neo4j (or PostgreSQL for simple graphs) |
| Caching / session | Redis |
| Event log / audit trail | Append-only PostgreSQL table or EventStoreDB |

Default to **PostgreSQL**. Add specialized stores only when PostgreSQL genuinely cannot serve the need.

### Consistency model choice:
- Financial / transactional data → strong consistency (ACID, serializable isolation)
- User-facing queries, feeds → eventual consistency acceptable
- Audit / event logs → append-only, no updates needed

Load `references/system-design.md` → **Database selection and Consistency models**.

---

## Phase 6 — Integration and API Design

### Synchronous vs asynchronous:
- Synchronous (REST/gRPC): when the caller needs the result to proceed
- Asynchronous (events/queues): when operations can be decoupled in time

### API style:
- Public / external API → REST (industry standard, widest compatibility)
- Internal service-to-service → gRPC (10x lower latency than REST)
- Client-server with complex queries → GraphQL (when UI needs flexible data fetching)

### Cross-module / cross-service communication:
- Prefer domain events for loose coupling between bounded contexts
- Use the **Outbox Pattern** when reliability is required (event published atomically with DB write)
- Use the **Saga Pattern** for distributed transactions across services

Load `references/system-design.md` → **API Design and Messaging sections**.

---

## Phase 7 — Cross-Cutting Concerns

Address these for every system. They must not be afterthoughts:

### Observability (the three pillars)
- **Metrics**: latency, throughput, error rate, saturation (USE: Utilization, Saturation, Errors)
- **Traces**: distributed tracing across module/service boundaries (OpenTelemetry)
- **Logs**: structured (JSON), correlated by trace ID

Instrument from day one — adding observability to an unobservable system is expensive.

### Security
- Authentication: who is the caller?
- Authorization: what can they do? (principle of least privilege)
- Data: what is encrypted at rest? in transit?
- Secrets: never in code or config files — use a secrets manager
- Threat model: what are the highest-risk attack surfaces?

### Resilience (apply in order)
1. Timeouts on all external calls
2. Idempotent writes (safe to retry)
3. Retries with exponential backoff + jitter
4. Circuit breakers on external dependencies
5. Bulkheads for resource isolation

Load `references/system-design.md` → **Resilience patterns**.

---

## Phase 8 — Document and Decide

### Required outputs:
1. **C4 Level 1** — system context diagram (who uses it, what it integrates with)
2. **C4 Level 2** — container diagram (major deployable units and their relationships)
3. **NFR table** — with concrete numbers
4. **Module manifest** — one entry per module (Phase 4 format)
5. **ADR for each significant choice** — architecture style, DB, API protocol, consistency model
6. **Open questions list** — explicitly named, with owner and deadline

### ADR minimum: one per decision where alternatives existed.
Load `references/adr-template.md` for format.

---

## Phase 9 — Validate Before Handing Off

Walk through these scenarios against the design:

- **Happy path**: can the system serve the primary user journey end-to-end?
- **Failure scenarios**: what happens when DB is down? When an external service is unavailable? When a module fails?
- **Scale scenario**: at 10x current load, what breaks first? Is that acceptable?
- **Deployment scenario**: can we deploy a change to Module A without deploying Module B?
- **Evolution scenario**: if requirement X changes next year, which modules are affected?

Any scenario that reveals an unacceptable outcome → revise the design.

### Architecture fitness functions

Define automated checks that verify quality attributes remain within bounds as the system evolves:

| Fitness function | Checks |
|-----------------|--------|
| Dependency direction | No module in core depends on infrastructure (ArchUnit, deptry, dependency-cruiser) |
| Latency budget | P99 latency stays below target in CI integration tests |
| Coupling threshold | Efferent coupling per module stays below threshold |
| Data ownership | No cross-module direct DB access (schema-level enforcement or CI scan) |
| API compatibility | Contract tests pass for all public interfaces |

Fitness functions are the long-term immune system of the architecture — they catch violations before they compound.

---

## Checklist: Ready to Hand Off

- [ ] Functional scope defined (including explicit NOT scope)
- [ ] NFRs have concrete numbers
- [ ] Assumptions listed
- [ ] Architecture style chosen and justified (ADR)
- [ ] Module boundaries defined with responsibilities and interfaces
- [ ] Data stores chosen and justified (ADR)
- [ ] API / integration strategy decided
- [ ] Observability strategy defined
- [ ] Security concerns addressed
- [ ] Resilience strategy defined
- [ ] C4 Level 1 + Level 2 diagrams exist
- [ ] Open questions listed with owners
- [ ] Key decisions recorded as ADRs
- [ ] Architecture fitness functions defined for critical quality attributes

---

## References Used by This Workflow

- `references/architecture-patterns.md` — styles, DDD, hexagonal, CQRS
- `references/design-principles.md` — SOLID, cohesion/coupling
- `references/system-design.md` — databases, caching, messaging, resilience, API
- `references/adr-template.md` — decision recording format
- `references/design-patterns.md` — when specific GoF/modern patterns apply
- `references/ai-system-patterns.md` — if the system involves LLMs, RAG, or agents
