# Architecture Patterns

## Contents

- [Choosing an Architecture Style](#choosing-an-architecture-style)
- [Layered Architecture (N-Tier)](#layered-architecture-n-tier)
- [Hexagonal Architecture (Ports and Adapters)](#hexagonal-architecture-ports--adapters)
- [Clean Architecture](#clean-architecture)
- [Domain-Driven Design (DDD)](#domain-driven-design-ddd)
- [CQRS](#cqrs)
- [Event Sourcing](#event-sourcing)
- [Monolith vs Modular Monolith vs Microservices](#monolith-vs-modular-monolith-vs-microservices)
- [Serverless / FaaS](#serverless--faas)
- [Cell-Based Architecture](#cell-based-architecture)
- [Edge Computing](#edge-computing)
- [Data Mesh](#data-mesh)
- [Feature Flags and Trunk-Based Development](#feature-flags-and-trunk-based-development)

---

## Choosing an Architecture Style

```
Business logic is the main complexity?
  YES → DDD + Hexagonal or Clean Architecture

Event-driven / data pipeline?
  YES → Event-driven architecture (streaming, pipes-and-filters)

Simple CRUD, few business rules?
  YES → Layered (3-tier) / MVC

Short-lived, request-driven, unpredictable traffic?
  YES → Serverless / FaaS

Read and write workloads radically different?
  YES → Consider CQRS for the hot path (not the whole system)

Need complete audit trail / temporal queries?
  YES → Event Sourcing (with CQRS)

Need independent failure isolation at massive scale?
  YES → Cell-based architecture (partition by tenant/region)

Team > 50, team autonomy is the constraint?
  YES → Microservices (if and only if above is true)
```

---

## Layered Architecture (N-Tier)

**Structure:** Presentation → Business Logic → Data Access → Database  
Each layer depends only on the layer below.

**Use when:** Simple CRUD, small team, rapid prototyping, well-understood domain.

**Weakness:** Domain logic leaks between layers. Database structure drives the design. Hard to test business logic without infrastructure.

**Improvement:** Apply DIP to the data access layer — define a repository interface in the business layer, implement it in data access. This is the minimal refactor toward hexagonal.

---

## Hexagonal Architecture (Ports & Adapters)

**Core idea:** The application core (domain + use cases) has zero knowledge of HTTP, databases, UI, or external services. Communication happens through:
- **Ports:** interfaces owned by the core (e.g., `OrderRepository`, `EmailSender`)
- **Adapters:** implementations living outside the core (e.g., `PostgresOrderRepository`, `SendGridEmailSender`)

**Structure:**
```
Core (domain + use cases)
  ├── ports/
  │   ├── OrderRepository (interface)
  │   └── EmailSender (interface)
  └── domain/
      └── Order, OrderService, ...

Infrastructure (adapters)
  ├── PostgresOrderRepository implements OrderRepository
  ├── SendGridEmailSender implements EmailSender
  └── HttpOrderController (drives the application)
```

**Dependency rule:** Everything depends on the core. Core depends on nothing external.

**Use when:** You need to swap infrastructure (testing with in-memory, migrating DBs, adding a new UI). Business logic is the primary complexity. You want testable domain logic without real infrastructure.

**Testing benefit:** The entire core can be tested without any infrastructure — inject test doubles for all ports.

---

## Clean Architecture

**Same principle as hexagonal, adds explicit layer names:**

```
Entities (enterprise business rules)
  ↑ depends on nothing
Use Cases (application business rules)
  ↑ depends on Entities
Interface Adapters (controllers, presenters, gateways)
  ↑ depends on Use Cases
Frameworks & Drivers (UI, DB, web)
  ↑ depends on Interface Adapters
```

**Dependency Rule:** Source code dependencies point inward only. Inner circles know nothing about outer circles.

**"Screaming Architecture":** The top-level folder structure should reveal the domain intent, not the technology: `orders/`, `payments/`, `inventory/` — not `controllers/`, `services/`, `repositories/`.

**vs. Hexagonal:** Conceptually equivalent. Clean Architecture prescribes layer names and the screaming architecture principle. Hexagonal emphasizes the ports/adapters metaphor and the symmetry between drivers (UI/API calling the core) and driven (DB/external services called by the core).

---

## Domain-Driven Design (DDD)

Use when: Business logic is complex and evolves. Domain experts exist. The system's value is in how it models the real-world domain.

### Strategic DDD

**Bounded Context:** An explicit boundary within which a domain model is consistent. The same word can mean different things in different contexts.
- "Customer" in Billing ≠ "Customer" in Support ≠ "Customer" in Shipping
- Bounded contexts often become module/service boundaries

**Ubiquitous Language:** A shared vocabulary between developers and domain experts, used consistently in code, tests, and conversations. If code uses different terms than the business uses, there's a translation layer accumulating bugs.

**Subdomain classification:**
- **Core domain:** Where competitive advantage lives. Invest heavily. Build, don't buy.
- **Supporting domain:** Necessary but not differentiating. Build lean.
- **Generic domain:** Commodity capability. Buy or use open source.

**Context Map patterns** (how bounded contexts relate):
- **Shared Kernel:** Two contexts share a small, explicitly agreed model
- **Customer/Supplier:** Upstream publishes, downstream consumes; downstream has negotiating power
- **Anticorruption Layer:** Downstream translates upstream's model into its own — prevents conceptual pollution
- **Published Language:** A well-documented interchange language (e.g., standard event schema)

### Tactical DDD

**Entity:** Has identity. Mutable over time. Identity persists through state changes.  
`Order#1234` is the same order whether it's Draft or Shipped.

**Value Object:** Defined by its attributes. No identity. Immutable.  
`Money(100, "USD")` equals any other `Money(100, "USD")`. No ID.

**Aggregate:** A cluster of entities and value objects treated as a unit for data changes.  
- Has one **Aggregate Root** — the only entry point to the cluster
- External objects hold references only to the Root, never to internal entities
- A transaction modifies at most one aggregate
- `Order` is the root; `OrderItem` is internal — you never access `OrderItem` directly

**Domain Event:** Something meaningful that happened in the domain.  
`OrderPlaced`, `PaymentConfirmed`, `InventoryReserved`.  
Events reveal workflow, decouple bounded contexts, and enable audit trails.

**Repository:** Abstracts data access. Domain sees a collection-like interface; infrastructure handles persistence.

**Domain Service:** Business logic that doesn't naturally belong to any entity (e.g., `PricingService.calculate(order, promotions)`).

---

## CQRS

**Command Query Responsibility Segregation:** Separate the write model (commands that change state) from the read model (queries that return data).

```
Write side:                    Read side:
Command → CommandHandler    →  Read Model (denormalized view)
          → Aggregate           updated via events or sync
          → Event               ↑
          → Write DB        ←  QueryHandler → Read DB
```

**Use when:**
- Read and write workloads have different scaling needs
- You need multiple read representations of the same data
- Combined with Event Sourcing (natural fit)
- High-throughput write side with complex read requirements

**Do NOT use when:**
- Simple CRUD — overhead is not justified
- Team lacks experience with eventual consistency
- Read/write loads are balanced and similar in shape

**The hidden cost:** Eventual consistency between write and read models. Users may see stale data. This requires UX design, not just technical design.

---

## Event Sourcing

**Store events, not state.** Current state is derived by replaying events.

```
OrderCreated → ItemAdded → ItemAdded → OrderSubmitted → PaymentConfirmed
↓ replay
Order { id: 123, items: [...], status: Confirmed }
```

**Use when:**
- Audit trail is a core requirement (financial, healthcare, compliance)
- Temporal queries needed: "what was the state at time T?"
- Business rules may change retroactively (replay events under new rules)
- Event-driven integration between bounded contexts

**Do NOT use when:**
- Simple CRUD — operational overhead is unjustifiable
- Team is unfamiliar — learning curve is steep
- Queries require complex current-state joins (need separate read models)

**Operational requirements:**
- Snapshotting (for aggregates with thousands of events)
- Event versioning / upcasting (for schema evolution)
- Idempotent event handlers (events may be replayed)

---

## Monolith vs Modular Monolith vs Microservices

### Decision framework (industry consensus)

| Team size | Revenue / scale | Recommended |
|-----------|----------------|-------------|
| < 10 engineers | Any | Monolith |
| 10–50 engineers | Any | Modular Monolith |
| > 50 engineers | < $10M | Modular Monolith |
| > 50 engineers | > $10M | Microservices (if team autonomy is the real constraint) |

**90% of "microservices" teams still batch-deploy like monoliths** — getting the operational complexity with none of the independence benefit. This is a **distributed monolith** — the worst outcome.

### Modular Monolith

Single deployable unit. Internally divided into modules with enforced boundaries.

**Characteristics:**
- Modules have explicit APIs (no direct database sharing between modules)
- Inter-module calls are synchronous in-process
- Single deployment, single database (per module schema or separate schemas)
- Independent module development is possible via interface contracts

**Shopify serves millions of merchants from a modular Ruby monolith.**  
**GitHub serves 50M+ daily users from a Rails monolith.**

### Microservices

Independent deployable services, each owning its own data.

**Justified when:**
- Independent deployment velocity is the primary constraint (team A can't be blocked by team B)
- Different scaling requirements across components
- Different technology requirements across components
- > 50 engineers with well-defined team ownership

**NOT justified when:**
- Team is small (coordination overhead exceeds benefit)
- Services always deploy together (you have a distributed monolith)
- Services share a database (you have a distributed monolith)
- Latency budget doesn't allow for network hops between components

### Strangler Fig Pattern (migrating monolith → microservices)

Incrementally extract services from a monolith:
1. Identify a bounded context to extract
2. Add a facade/proxy in front of the monolith
3. Implement the new service behind the facade
4. Route traffic to the new service
5. Remove the old code from the monolith
6. Repeat

Never do a big-bang rewrite. Extract one bounded context at a time.

---

## Serverless / FaaS

**Core idea:** Deploy individual functions that run on demand. The cloud provider manages servers, scaling, and availability.

**Structure:**
```
API Gateway → Function A (handler)
            → Function B (handler)
            → Function C (handler)
Each function: stateless, short-lived, auto-scaled
```

**Use when:**
- Unpredictable or bursty traffic (pay-per-invocation, zero cost at zero load)
- Event-driven processing (S3 upload triggers, queue consumers, webhooks)
- Prototyping and MVPs (zero infrastructure management)
- Glue logic between managed services

**Do NOT use when:**
- Long-running processes (Lambda timeout: 15min)
- Low-latency requirements (cold start: 100ms–2s depending on runtime)
- High-throughput steady-state (sustained load is cheaper on containers)
- Complex workflows with shared state (state management becomes external complexity)

**Hidden costs:** Vendor lock-in (cloud-specific triggers and APIs), cold start latency, debugging difficulty (no local state), observability gaps.

**Mitigation:** Use serverless frameworks (SST, Serverless Framework) and define infrastructure as code. Keep functions thin — business logic in libraries, not in handlers.

---

## Cell-Based Architecture

**Core idea:** Partition the system into independent, self-contained cells. Each cell serves a subset of users/tenants and contains a full stack (compute, storage, cache). Failures are isolated to a single cell.

**Structure:**
```
Router (assigns users to cells)
  → Cell A: [API, DB, Cache] → serves Tenant 1, 2, 3
  → Cell B: [API, DB, Cache] → serves Tenant 4, 5, 6
  → Cell C: [API, DB, Cache] → serves Tenant 7, 8, 9
```

**Use when:**
- Multi-tenant SaaS at scale (failure isolation per tenant group)
- Regulatory requirements demand data residency (cell per region)
- Blast radius reduction is critical (outage affects only one cell, not all users)
- Scaling beyond what a single deployment can handle

**Do NOT use when:**
- Single-tenant systems or small scale
- Cross-tenant operations are frequent (cells are isolated by design)
- Team lacks operational maturity for multi-cell deployment

**Key design decisions:**
- Cell sizing: how many tenants per cell?
- Cell routing: DNS-based, API gateway, or application-level
- Cross-cell operations: avoid when possible; use async replication when needed
- Cell provisioning: automate fully — manual cell setup doesn't scale

**AWS, Slack, and Shopify use cell-based architecture** to isolate failures and scale independently.

---

## Edge Computing

**Core idea:** Process data near where it is generated rather than sending everything to a centralized cloud. Reduces latency, lowers bandwidth costs, and enables offline operation.

**Structure:**
```
Edge devices (sensors, user devices)
  → Edge nodes / micro data centers (local processing, filtering, inference)
  → Cloud (long-term storage, model training, aggregation)
```

**Use when:**
- Ultra-low latency is required (< 50ms response time)
- Bandwidth is constrained or expensive (IoT, video processing)
- Offline or intermittent connectivity must be supported
- Data privacy or sovereignty requires local processing (data cannot leave a region)
- AI inference must happen locally (on-device ML, real-time vision)

**Do NOT use when:**
- All users have reliable, low-latency cloud connectivity
- Processing requires centralized data aggregation (analytics, training)
- The system is simple enough for a single deployment location
- Team lacks operational capability for distributed edge management

**Key design decisions:**
- What runs at the edge vs. in the cloud? (filter/process locally, aggregate centrally)
- How do edge nodes synchronize with central systems? (eventual consistency, CRDT, sync protocols)
- How are edge deployments updated? (OTA updates, canary rollout per edge location)
- What happens when an edge node loses connectivity? (local queue, store-and-forward)

**Edge + AI pattern:** Run quantized models at the edge for real-time inference. Train and update models in the cloud. Push updated models to edge via deployment pipeline.

---

## Data Mesh

**Core idea:** Decentralize data ownership. Each domain team owns its analytical data as a product, with self-serve infrastructure and federated governance.

**Four principles:**
1. **Domain-oriented data ownership:** The team that generates the data owns and publishes it
2. **Data as a product:** Data has SLOs, documentation, discoverability, and quality guarantees
3. **Self-serve data platform:** Central platform team provides tooling, not data pipelines
4. **Federated computational governance:** Standards enforced by automation, not a central team

**Use when:**
- Centralized data team is a bottleneck (every team waits for data engineering)
- Multiple domains generate data that other domains consume
- Organization is large enough to have domain teams with data engineering capability

**Do NOT use when:**
- Small team (< 20 engineers) — overhead exceeds benefit
- Single domain — no cross-domain data sharing problem
- Data volume is small — a simple data warehouse suffices

**vs. Data Warehouse / Data Lake:**
- Data warehouse: centralized, schema-on-write, owned by data team
- Data lake: centralized, schema-on-read, often becomes "data swamp"
- Data mesh: decentralized, domain-owned, data-as-a-product

---

## Feature Flags and Trunk-Based Development

**Feature flags** decouple deployment from release.

Types:
- **Release flags:** hide unfinished work in production (short-lived — days/weeks)
- **Operational flags:** kill switches for problematic features (medium-lived)
- **Experiment flags:** A/B tests (short-lived)
- **Permission flags:** role/plan-based access (long-lived)

**Trunk-based development:** All engineers commit to `main` daily. Feature flags hide incomplete work. No long-lived feature branches.

**Empirical result:** 95% of DevOps teams using feature flags report 40% faster release cycles and 72% fewer production incidents.

**Architecture implication:** Feature flags require the architecture to support conditional behavior at runtime. Every module that changes under a flag must be designed for substitutability (OCP, Strategy pattern).

**Flag hygiene:** Every flag needs an expiration date. Stale flags accumulate and become untested code paths. Audit quarterly, remove within a sprint of expiry.
