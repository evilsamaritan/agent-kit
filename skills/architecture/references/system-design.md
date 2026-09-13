# System Design Reasoning

Use this reference after scenario synthesis to reason about runtime components, state, data flow, consistency, scale, failure, security, and operations. Product-specific choices belong to their sibling knowledge skills.

## Contents

- [System model](#system-model)
- [Drivers and budgets](#drivers-and-budgets)
- [State and data ownership](#state-and-data-ownership)
- [Consistency and transactions](#consistency-and-transactions)
- [Communication and flow](#communication-and-flow)
- [Failure and recovery](#failure-and-recovery)
- [Capacity and scaling](#capacity-and-scaling)
- [Caching and derived state](#caching-and-derived-state)
- [Security and trust boundaries](#security-and-trust-boundaries)
- [Operability](#operability)
- [Evolution](#evolution)
- [Design completeness check](#design-completeness-check)

## System model

Describe the system through connected views:

| View | Shows | Excludes |
|---|---|---|
| Context | users, external systems, trust boundaries | internal implementation |
| Runtime | processes/services/functions, synchronous and async links | class-level detail |
| Data | authoritative state, writers, replicas, caches, retention | incidental objects |
| Module | application core, capabilities, public contracts, dependencies | deployment assumptions unless relevant |
| Deployment | instances, regions, cells, networks, stores | business logic detail |

Use the fewest views needed to make ownership, interaction, and risk clear. A diagram without semantics is decoration; annotate protocols, direction, ownership, and critical guarantees.

## Drivers and budgets

Architecture is selected from constraints. Capture ranges and uncertainty rather than inventing precision.

- workload: request/event rates, bursts, payloads, read/write ratio, growth;
- latency: user-visible and internal path budgets, including tail latency;
- availability: which operations must remain available and under which failures;
- durability: acceptable data loss and recovery objectives;
- consistency: which reads/writes require immediate agreement;
- security/privacy: data classes, actors, trust boundaries, residency, retention;
- cost: unit cost, fixed/variable limits, operational staffing;
- evolution: compatibility window, migration rate, expected variation;
- team: ownership, operational capacity, and coordination constraints.

Not every quality attribute needs a special mechanism. State which existing default applies when a dimension is not a decision driver.

## State and data ownership

For every important datum, identify:

- semantic owner and authoritative store;
- accepted writers and write contract;
- invariant and transaction boundary;
- derived copies, caches, projections, and indexes;
- retention, deletion, backup, and recovery semantics;
- identity and versioning across boundaries.

Do not let shared schemas create accidental multi-owner state. When another component needs the data, choose among a query contract, published event, replicated projection, or ownership transfer based on freshness, autonomy, and failure needs.

Model the write path before optimizing reads. Read convenience must not obscure who validates and commits the truth.

## Consistency and transactions

Choose consistency per invariant and operation, not once for the entire system.

| Need | Typical response | Cost |
|---|---|---|
| one owner must atomically enforce an invariant | local transaction/serialization | owner availability and contention |
| caller must observe its own accepted write | session/read-your-writes strategy | routing/version tracking |
| independent read model may lag | asynchronous projection | stale UX and reconciliation |
| several owners participate in a process | saga/reconciliation | intermediate states and compensation |
| concurrent writes conflict | optimistic versioning, locking, partitioned ownership, or merge semantics | retries, blocking, or domain complexity |

During a network partition, a distributed operation cannot guarantee both immediate agreement and an accepted response from every side. Decide which operations reject, degrade, queue, or return stale data. "Eventually consistent" is incomplete without convergence, conflict, freshness, and user-experience rules.

## Communication and flow

Prefer synchronous calls when the caller needs an immediate decision and both sides form one availability path. Prefer asynchronous messages when work can be decoupled in time, buffered, replayed, or consumed independently.

For each link specify:

- command, query, or event semantics;
- schema and compatibility ownership;
- timeout/deadline and cancellation;
- retry and idempotency boundary;
- ordering and duplication scope;
- backpressure and overload behavior;
- authentication/authorization context;
- tracing and correlation.

Avoid long synchronous chains. Total reliability and latency compound across dependencies. Avoid replacing a clear local call with messaging when all participants must finish for the same request to succeed.

## Failure and recovery

Assume partial failure: a request can time out after the dependency commits; a message can be delivered twice; a process can restart between state change and acknowledgement.

For every stateful flow ask:

- What if each dependency is slow, unavailable, or returns invalid data?
- Can the caller distinguish rejection, unknown outcome, and success?
- Which operations are safe to retry, and under what key/version?
- How are duplicates and out-of-order work handled?
- What survives restart, and how is in-flight work reconciled?
- What can degrade, queue, serve stale data, or fail closed?
- How is resource exhaustion isolated and backpressure propagated?

Timeouts bound waiting but do not cancel remote effects. Retries improve transient availability but amplify overload and duplicates. Circuit breakers, queues, and bulkheads are conditional responses, not mandatory decoration.

## Capacity and scaling

Estimate the dominant resource before choosing a scaling pattern:

```text
traffic x work per request -> compute demand
writes x retained bytes x retention -> storage demand
fan-out x downstream latency -> concurrency demand
event rate x processing time -> consumer capacity and lag
```

Measure headroom and bottlenecks. Common responses, in increasing architectural cost, include:

- remove unnecessary work and round trips;
- batch, stream, or bound payloads;
- tune algorithms, queries, and resource pools;
- scale the existing owner vertically or horizontally;
- add read replicas or derived read models;
- partition by a stable ownership key;
- split a capability only when it needs independent runtime behavior.

Stateless compute is easier to replicate, but state still exists somewhere. Name session affinity, leases, coordination, and local ephemeral state rather than declaring a service stateless by convention.

## Caching and derived state

A cache is a derived copy with a freshness contract.

Before adding one, define:

- source of truth;
- cache key and tenant/security scope;
- acceptable staleness;
- invalidation or version strategy;
- miss and stampede behavior;
- capacity and eviction;
- outage behavior;
- observability and correctness tests.

Use a cache for measured reuse or latency/load constraints. Do not use it to hide an unclear ownership or query model. A TTL is a recovery bound, not proof of correct freshness.

## Security and trust boundaries

Architecture identifies where trust changes; the `security` skill designs controls in depth.

Mark:

- human, service, device, and third-party identities;
- entry points and privilege transitions;
- sensitive data movement and storage;
- tenant and administrative boundaries;
- untrusted inputs and executable content;
- audit and non-repudiation needs;
- failure modes that must fail closed.

Authenticate the actor and authorize the requested domain operation at the owning boundary. Network location alone is not authority. Minimize data and privilege crossing each boundary.

## Operability

The design should reveal whether its assumptions hold in production.

Define signals for:

- user-visible success, rejection, latency, and correctness;
- dependency health and saturation;
- queue lag, retries, duplicates, dead letters, and stuck states;
- consistency/projection lag and reconciliation;
- resource and cost limits;
- rollout version and compatibility errors.

Provide health behavior, graceful shutdown, backup/restore, recovery, and manual intervention paths appropriate to the system. Logs alone are not an operational model.

## Evolution

Every distributed or public boundary creates compatibility work. Prefer additive changes, tolerant reading with controlled writing, versioned semantics when meaning changes, and explicit deprecation evidence.

For data and contract migrations:

- separate schema capability from behavior activation;
- support old and new readers/writers for the required window;
- backfill or reconcile with restartable, observable work;
- switch authority once, with rollback criteria;
- remove transitional paths after evidence shows they are unused.

Keep the desired architecture distinct from temporary dual-write, proxy, translation, or compatibility mechanisms.

## Design completeness check

A system design is incomplete if it cannot answer:

- What user outcome and constraints drive this shape?
- Who owns each invariant and mutable state?
- How does the main success path cross boundaries?
- What are the contracts and dependency directions?
- What happens on timeout, duplicate, concurrent change, and restart?
- Which parts scale or fail independently, and why?
- Which security and data boundaries matter?
- How will production evidence validate the assumptions?
- How can the design evolve and be migrated safely?
- Which alternatives were rejected and what cost was accepted?
