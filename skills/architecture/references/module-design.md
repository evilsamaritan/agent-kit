# Module and Application Design

Use this reference to decide what belongs in the application core, where module boundaries should sit, how dependencies should flow, and which extension seams are justified.

## Contents

- [Model the application](#model-the-application)
- [Core and edges](#core-and-edges)
- [Boundary forces](#boundary-forces)
- [Module contract](#module-contract)
- [State and invariant ownership](#state-and-invariant-ownership)
- [Dependency direction](#dependency-direction)
- [Collaboration choices](#collaboration-choices)
- [Extension design](#extension-design)
- [Object-oriented and functional shapes](#object-oriented-and-functional-shapes)
- [Reuse and duplication](#reuse-and-duplication)
- [Module fitness checks](#module-fitness-checks)

## Model the application

Start from behavior rather than folders. Reduce requirements to:

- **Capabilities** — outcomes the application provides.
- **Operations** — commands and queries that realize a capability.
- **Invariants** — conditions that must remain true.
- **State** — durable or ephemeral facts used by operations.
- **Policies** — decisions that may vary independently.
- **Events** — meaningful facts that have already happened.
- **Mechanisms** — transport, persistence, scheduling, serialization, and vendor integration.

Scenario names rarely make good module names. Several scenarios may be different combinations of the same operations and policies.

## Core and edges

The **core** contains stable policy and domain meaning. The **edges** translate between the core and volatile mechanisms.

| Put toward the core | Put toward the edge |
|---|---|
| invariants and domain decisions | HTTP/RPC/UI handlers |
| state transitions and use cases | database and cache adapters |
| policy interfaces owned by the application | vendor clients and SDK types |
| domain values and errors | serialization and transport models |
| orchestration that expresses business order | logging, metrics, clocks, process lifecycle |

Do not add a port for every concrete dependency. Introduce an abstraction when the core needs a narrower semantic contract, tests need deterministic control, or implementations genuinely vary. A direct dependency can be simpler when the dependency is stable, local, and already matches the needed semantics.

## Boundary forces

A strong module boundary usually combines several forces:

- distinct business language or capability;
- cohesive invariants and state ownership;
- independent reason or cadence of change;
- narrow collaboration with the rest of the application;
- different lifecycle, trust, ownership, failure, or scale;
- a public contract that is smaller and more stable than the implementation.

Weak evidence by itself:

- file or line count;
- one class per noun;
- a reusable-sounding name;
- a different technical layer;
- the possibility of future reuse;
- a desire to mirror an organization chart.

Split a module when the new boundary reduces change propagation and clarifies ownership. Merge modules when they share one invariant, coordinate chattily, or evolve in lockstep without a stable contract.

## Module contract

A module contract should state:

1. Responsibility and explicit non-responsibilities.
2. Commands, queries, and events exposed to collaborators.
3. Input and output semantics independent of internal representation.
4. Domain errors, rejection reasons, and side effects.
5. State ownership and consistency guarantees.
6. Ordering, idempotency, concurrency, and cancellation behavior where relevant.
7. Compatibility and evolution rules.
8. Lifecycle: construction, start, stop, disposal, and recovery where relevant.

Keep the public surface smaller than the internal model. Do not export storage entities, framework contexts, or mutable collections merely because they already exist.

## State and invariant ownership

Give each state an explicit authority model. Prefer one authoritative writer. Read replicas, projections, caches, and derived views may copy facts, but they do not become co-owners. If multiple writers are essential, define partition ownership, coordination, conflict detection, and deterministic merge/reconciliation semantics.

Use these tests:

- Which component decides whether a transition is valid?
- Which operation serializes competing changes?
- Which store is authoritative after restart?
- Which published fact tells other modules that the change completed?
- How are stale, duplicate, reordered, or partially applied operations handled?

If several modules can independently enforce or mutate the same invariant, either consolidate ownership or define an explicit coordination protocol. A shared table is not a coordination protocol.

## Dependency direction

Dependencies should point from volatile details toward stable policy:

```text
drivers -> application contract -> core policy -> required ports <- adapters
```

The exact folder structure is secondary. The useful property is that the core can be reasoned about without a running transport, database, framework, or vendor SDK.

Avoid cycles. When A and B depend on each other:

1. Check whether they are one cohesive module split artificially.
2. Move a shared invariant to its real owner.
3. Extract a smaller contract owned by the stable side.
4. Replace a request for internal state with a higher-level operation.
5. Use events only when temporal decoupling is semantically correct, not merely to hide the cycle.

## Collaboration choices

| Need | Prefer | Cost to acknowledge |
|---|---|---|
| immediate result under one consistency boundary | direct synchronous call | temporal and availability coupling |
| independent reaction to a completed fact | domain event | ordering, delivery, idempotency, observability |
| several ordered transformations | pipeline | order and short-circuit semantics |
| orthogonal behavior around one operation | decorator/middleware | nesting/order and error propagation |
| variable policy chosen by context | strategy/function | configuration and discoverability |
| protect the core from an external model | adapter/anticorruption layer | translation and model duplication |
| coordinate a multi-step use case | application service/orchestrator | risk of becoming a god coordinator |

Do not use events when the caller must know whether an invariant was accepted. Do not use synchronous calls merely because they are easy if the receiver is an independent observer of a completed fact.

## Extension design

Design extension points around known variation axes:

- policy varies while operation stays stable → strategy or injected function;
- behavior wraps the same contract → decorator;
- ordered stages vary → pipeline;
- external representations vary → adapter;
- object family creation varies → factory at the composition root;
- lifecycle states vary behavior → explicit state machine;
- independent consumers vary → events.

An extension point should answer:

1. What may vary?
2. What must remain invariant?
3. Who selects and orders extensions?
4. What context can an extension access?
5. How are errors, cancellation, and partial effects handled?
6. How is compatibility maintained?
7. How is the extension tested in isolation and composition?

Avoid a universal plugin framework when one explicit composition root or pipeline is enough.

## Object-oriented and functional shapes

Choose by state and variation, not ideology.

**Objects fit when:** identity, encapsulated mutable state, lifecycle, substitutable implementations, or protocol-like collaboration dominate.

**Functions fit when:** transformations are stateless, composition is dataflow-like, dependencies can be explicit arguments, and algebraic data types represent states clearly.

**Hybrid designs are normal:** immutable domain values and pure policy functions can live inside stateful aggregates or services; object adapters can compose functional middleware.

Prefer composition over inheritance. Use inheritance only when subtypes preserve the full behavioral contract and the hierarchy is more stable than its combinations.

## Reuse and duplication

DRY applies to knowledge, not visual similarity.

| Situation | Response |
|---|---|
| same business rule copied across paths | centralize under one authoritative owner |
| same operation with orthogonal policies | expose a stable contract and compose policies |
| similar mechanics for different domain meanings | keep separate until a shared concept is proven |
| shared helper imports half the application | restore ownership; move behavior to the cohesive module |
| generic abstraction contains many flags | split by variation axis or return to explicit implementations |

A good abstraction makes consumers simpler and future changes more local. If callers must understand its internals, configure unrelated flags, or handle many impossible states, it is not hiding the right concept.

## Module fitness checks

Useful automated or review-time checks include:

- dependency graph remains acyclic;
- only public entry points are importable across module boundaries;
- core packages do not import adapters/frameworks;
- the authority or multi-writer coordination model is enforced for each protected state;
- contract tests cover each adapter implementation;
- state-transition tests cover invalid and concurrent transitions;
- adding a representative policy requires a new component and composition change, not edits across the core;
- removing a module leaves no hidden table, queue, or configuration ownership behind.

Fitness checks protect decisions that matter. Avoid enforcing directory aesthetics with no architectural consequence.
