# Architecture Styles and System Shapes

Architecture styles constrain dependencies, state, communication, and deployment. They are compatible building blocks, not exclusive labels for an entire codebase.

## Contents

- [Choose the decision level](#choose-the-decision-level)
- [Selection map](#selection-map)
- [Simple and modular monoliths](#simple-and-modular-monoliths)
- [Layered architecture](#layered-architecture)
- [Hexagonal and clean architecture](#hexagonal-and-clean-architecture)
- [Microkernel and plug-in architecture](#microkernel-and-plug-in-architecture)
- [Domain-driven design](#domain-driven-design)
- [Microservices](#microservices)
- [Event-driven architecture](#event-driven-architecture)
- [CQRS](#cqrs)
- [Event sourcing](#event-sourcing)
- [Serverless, cells, and edge](#serverless-cells-and-edge)
- [Combining styles](#combining-styles)

## Choose the decision level

Separate three decisions that are often conflated:

| Decision | Examples | Independent of |
|---|---|---|
| Code organization | layered, hexagonal, feature-oriented modules | number of deployments |
| Domain boundaries | capabilities, bounded contexts, state owners | process and network placement |
| Runtime topology | one process, services, functions, cells, edge nodes | internal code style |

A modular monolith can use hexagonal boundaries and events. A microservice can still be an unstructured transaction script. Moving code over a network does not create better architecture.

## Selection map

Start with the forces:

```text
Need the lowest coordination and operational cost?
  -> one deployable; add explicit modules when change boundaries appear

Is business policy the primary complexity and infrastructure volatile?
  -> core plus ports/adapters; optionally use DDD to discover the model

Does one application host many independently developed, loaded, or
enabled features — games, editors, tools, tenants' extensions?
  -> host plus modules behind one module contract (microkernel)

Do independently owned capabilities need independent release, scale,
security, or failure isolation?
  -> consider services, but only with independent data and operations

Do independent consumers react to completed facts at different times?
  -> consider events; preserve clear ownership and delivery semantics

Are read and write models materially different?
  -> separate query representation; adopt full CQRS only if needed

Is history itself authoritative?
  -> consider event sourcing for the bounded scope that needs it

Does locality, tenant isolation, or burst-to-zero dominate?
  -> evaluate edge, cells, or functions after operational constraints
```

Prefer a local code boundary before a process boundary, and a process boundary before a network boundary. Cross a boundary only when its benefit exceeds coordination, latency, failure, compatibility, and operational costs.

## Simple and modular monoliths

### Simple monolith

One deployable with minimal internal ceremony fits a small or uncertain domain where rapid learning dominates. It becomes unhealthy when unrelated capabilities share mutable state and every change touches the same central code.

### Modular monolith

One deployable contains modules with explicit contracts and controlled dependencies.

**Useful when:**

- domain or feature boundaries are known;
- transactional work benefits from local calls;
- independent deployment is not a demonstrated constraint;
- the team wants low operational cost with strong internal separation.

**Required discipline:**

- each invariant and table has an owner;
- cross-module access uses public contracts;
- dependency direction is enforced;
- internal models do not leak through shared utility packages;
- module boundaries have contract and integration tests.

**Warning:** a folder-per-module without import control, state ownership, and contracts is only visual modularity.

## Layered architecture

Layered architecture separates presentation, application, domain, and infrastructure concerns.

**Useful when:** flow is mostly request/response, policy is straightforward, and consistent separation improves comprehension.

**Costs:** changes organized by capability may cross every layer; generic service/repository layers can become pass-through ceremony; dependencies may drift toward the database model.

Organize by capability first when possible, then use layers inside each capability. Enforce dependency direction rather than assuming folder names create it.

## Hexagonal and clean architecture

Both place application/domain policy inside and mechanisms outside.

```text
driver adapters -> use-case contracts -> domain policy
                                      -> required ports <- driven adapters
```

**Useful when:**

- domain policy should outlive transports or storage;
- several drivers invoke the same use cases;
- external dependencies need semantic translation;
- tests need deterministic control of time, identity, I/O, or vendors.

**Costs:** extra types, mapping, composition, and navigation. Avoid one interface per class or ports that merely reproduce a vendor API.

The core owns port semantics. An adapter translates external behavior into that semantic contract. Keep framework and persistence types at the edge.

## Microkernel and plug-in architecture

A small host owns what is shared; features live in modules that the host loads, starts, and stops through one module contract. Client applications with a shell and lazily loaded feature modules, editors with extensions, and platforms with tenant plug-ins are all this style.

```text
host: lifecycle, navigation, session, transport, shared state owners
  -> module contract: describe, load, start(context), stop
       <- module A      <- module B      <- module C
```

**Useful when:**

- features are developed, loaded, enabled, or released independently of each other;
- a feature must not be paid for (downloaded, started, licensed) until it is used;
- the set of features grows while the host should stay stable.

**Required discipline:**

- the host knows modules only through the contract and a list assembled in one composition root; it never imports a specific module's internals;
- modules do not import each other; what they share is owned by the host or by a library both depend on;
- shared facts — identity, session, wallet, locale, clock, connection — have one owner, and modules receive them through a narrow typed context the host passes in, not as copies inside each module's own state;
- a cheap description of a module (identity, routes, availability) is separate from its implementation, so the host can decide without loading it;
- lifecycle is explicit: what start receives, what stop must release, what happens to in-flight work, and how one module's failure is contained;
- cross-cutting behavior — logging, retries, authorization, error reporting — wraps the contract once rather than being rewritten in every module.

**Costs:** the module contract becomes the most expensive thing to change; host-versus-module version skew needs a policy; debugging crosses the host boundary.

**Warnings:** validate the module contract with one real module before freezing it, and check what it assumes there is exactly one of — one active module, one instance per kind, one connection ([module-design.md](module-design.md#module-contract)). A host that accumulates every module's special cases has become the application again.

## Domain-driven design

DDD is a modeling approach, not a deployment topology.

Use strategic DDD when language and business rules differ across parts of a complex domain:

- **bounded context** — one internally consistent model and vocabulary;
- **context map** — relationships and translation between models;
- **core domain** — differentiating capability deserving the deepest investment;
- **supporting/generic domain** — necessary but less differentiating capability.

Use tactical patterns only where they clarify real invariants:

- **entity** for identity across change;
- **value object** for immutable value semantics;
- **aggregate** for a transactional invariant boundary;
- **domain service** for policy belonging to no single entity;
- **domain event** for a meaningful completed fact;
- **repository** when the domain benefits from collection-like persistence semantics.

Avoid DDD terminology when the domain is simple, experts do not use the model, or objects merely wrap CRUD records.

## Microservices

Microservices create independent runtime, data, release, and failure boundaries.

**Evidence that may justify a service boundary:**

- a cohesive capability has independent ownership and release cadence;
- it needs materially different scale, locality, trust, or availability;
- its data and invariants can be owned without shared writes;
- the contract is stable enough to absorb network and versioning costs;
- the organization can test, deploy, observe, secure, and operate it independently.

**Evidence against:**

- synchronous chatty calls dominate normal work;
- services share tables or must deploy in lockstep;
- one team owns the entire call chain;
- retries, partial failure, compatibility, and observability are unspecified;
- the split follows technical layers rather than capabilities.

Start by enforcing the boundary inside one deployable. Extract when runtime independence becomes a demonstrated requirement. For migrations, route one characterized capability through a seam and keep rollback possible.

## Event-driven architecture

Events communicate completed facts to independent consumers.

**Useful when:** consumers have different lifecycles, the producer need not wait for their work, replay/audit has value, or spikes require buffering.

**Costs:** eventual visibility, delivery semantics, ordering, duplicates, schema evolution, tracing, recovery, and harder end-to-end reasoning.

Keep commands and events distinct:

- command: request one owner to attempt an action;
- event: report that an owned fact already happened.

Do not publish vague state-change notifications that force every consumer to query internals. Publish stable domain facts without exposing the producer's storage model.

## CQRS

CQRS separates the models used to change state from those used to answer queries. It ranges from separate code paths over one store to independently maintained read models.

**Useful when:** command rules are rich, query shapes differ materially, read projections need independent optimization, or multiple views derive from the same facts.

**Costs:** model duplication, projection lag, reconciliation, more test paths, and user-visible consistency decisions.

Do not adopt separate infrastructure merely because commands and queries are different functions. Escalate the separation only as measured forces require it.

## Event sourcing

Event sourcing makes the event history authoritative and derives current state by folding that history.

**Useful when:** temporal truth, auditability, reconstruction, or domain history is essential and events form a stable business model.

**Costs:** event schema evolution, replay semantics, snapshots, projection rebuilds, deletion/privacy constraints, concurrency, and difficult correction of bad historical facts.

An event-driven system does not require event sourcing. Prefer state storage plus an outbox when current state is authoritative and reliable publication is the actual need.

## Serverless, cells, and edge

These are topology responses to particular operational forces.

| Shape | Useful force | Main cost |
|---|---|---|
| Functions/serverless | bursty independent handlers, managed scaling, low idle use | platform constraints, cold paths, distributed state and observability |
| Cells | tenant/region partitioning and blast-radius isolation | routing, duplicated infrastructure, cross-cell operations |
| Edge/local execution | latency, offline operation, privacy, bandwidth, locality | synchronization, fleet/version management, constrained compute |

Keep domain policy portable across topology when that portability is valuable. Do not hide topology-specific failure and consistency semantics behind an interface that promises more than it can deliver.

## Combining styles

Real systems combine styles at bounded scopes. Example:

```text
one modular deployment
  -> capability-oriented modules
  -> hexagonal boundary around volatile integrations
  -> direct calls for invariant-bearing commands
  -> domain events for independent reactions
  -> one read projection for a materially different query
```

Record each meaningful choice at its own scope. Avoid declaring that the entire system "is DDD" or "is event-driven" without naming where the style applies and what force it resolves.
