# Module and Application Design

Use this reference to decide what belongs in the application core, where module boundaries sit, who owns state, and how dependencies flow. For extension points and open composition read [composable-design.md](composable-design.md); for choosing a collaboration pattern read [design-patterns.md](design-patterns.md); for structure inside a module read [code-design.md](code-design.md).

## Contents

- [Model the application](#model-the-application)
- [Core and edges](#core-and-edges)
- [Boundary evidence](#boundary-evidence)
- [Module contract](#module-contract)
- [State and invariant ownership](#state-and-invariant-ownership)
- [Dependency direction](#dependency-direction)

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

Do not add a port for every concrete dependency. Introduce an abstraction when the core needs a narrower semantic contract, tests need deterministic control, or implementations genuinely vary. A direct dependency is simpler when it is stable, local, and already matches the needed semantics.

## Boundary evidence

Apply the boundary and abstraction tests in SKILL.md: change, invariants, language, lifecycle, scale and failure, security and ownership, reuse. A strong module boundary combines several of them and exposes a public contract smaller and more stable than the implementation behind it.

Weak evidence by itself:

- file or line count;
- one class per noun;
- a reusable-sounding name;
- a different technical layer;
- the possibility of future reuse;
- a desire to mirror an organization chart.

Split a module when the new boundary reduces change propagation and clarifies ownership. Merge modules when they share one invariant, coordinate chattily, or evolve in lockstep without a stable contract.

## Module contract

A module contract states:

1. Responsibility and explicit non-responsibilities.
2. Commands, queries, and events exposed to collaborators.
3. Input and output semantics independent of internal representation.
4. Domain errors, rejection reasons, and side effects.
5. State ownership and consistency guarantees.
6. Ordering, idempotency, concurrency, and cancellation behavior where relevant.
7. Compatibility and evolution rules.
8. Lifecycle: construction, start, stop, disposal, and recovery where relevant.

Keep the public surface smaller than the internal model. Do not export storage entities, framework contexts, or mutable collections merely because they already exist.

Before freezing a contract that several modules will implement, check what it assumes there is exactly one of — one instance, one session, one active module, one transport — and whether a known upcoming requirement breaks that assumption. Exercise it with at least one real implementation first.

## State and invariant ownership

Give each state an explicit authority model. Prefer one authoritative writer. Read replicas, projections, caches, and derived views may copy facts, but they do not become co-owners. If multiple writers are essential, define partition ownership, coordination, conflict detection, and deterministic merge or reconciliation semantics.

Use these tests:

- Which component decides whether a transition is valid?
- Which operation serializes competing changes?
- Which store is authoritative after restart?
- Which published fact tells other modules that the change completed?
- How are stale, duplicate, reordered, or partially applied operations handled?
- Can another component bypass the owner?

If several modules can independently enforce or mutate the same invariant, either consolidate ownership or define an explicit coordination protocol. A shared table is not a coordination protocol, and a copy of the same state in every module is not ownership.

When another module needs owned state, give it a query, a published fact, or a narrow interface from the owner — not a second copy to maintain (see [composable-design.md](composable-design.md#contrast-pairs), pair 6).

## Dependency direction

Dependencies point from volatile details toward stable policy:

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

Checks that keep these decisions enforced — acyclic dependencies, public entry points, core free of adapters — are listed in [engineering-health.md](engineering-health.md#architecture-fitness-functions).
