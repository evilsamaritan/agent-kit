# Architecture Health and Evolution

Assess architecture by its effect on correctness, change, ownership, delivery, and operations. Repository aesthetics and pattern consistency matter only when they influence those outcomes.

## Contents

- [Health dimensions](#health-dimensions)
- [Evidence sources](#evidence-sources)
- [Change amplification](#change-amplification)
- [Ownership and boundaries](#ownership-and-boundaries)
- [Architecture fitness functions](#architecture-fitness-functions)
- [Technical debt](#technical-debt)
- [Migration strategy](#migration-strategy)

## Health dimensions

| Dimension | Review question | Healthy signal | Warning signal |
|---|---|---|---|
| Coherence | Do scenarios pass through one shared model or many independent fixes? | scenarios share a small model and mechanisms | each case introduces a new branch or subsystem |
| Ownership | Does each invariant and mutable state have one owner or an explicit coordination model? | explicit authority per invariant and state | accidental shared writes, duplicated rules, state copied per consumer |
| Modularity | Do modules hold what changes together, and can a change stay local? | changes remain within cohesive boundaries | unrelated modules change together |
| Dependency | Is dependency direction visible, acyclic, and stable? | policy does not depend on mechanism | cycles, reach-through imports, hidden globals |
| Contracts | Can consumers bypass contracts or depend on internals? | narrow semantic surfaces with explicit failure | internal or storage models leak to consumers |
| Openness | Do demonstrated variations compose, or does each new case edit the core? | new behavior is a new piece; defaults are replaceable | growing switches, flags, and factories |
| Simplicity | Does each abstraction and runtime boundary pay for its complexity? | direct calls where nothing varies; known patterns | coined machinery, a framework for one case |
| Reliability | Are timeout, partial failure, retry, duplicate, recovery, and degradation explicit? | failure and overload are designed | unknown outcomes and manual repair are normal |
| Delivery | Can change ship in reversible, independently verified slices? | reversible slices | lockstep or big-bang changes |
| Evolvability | Can contracts, data, and behavior migrate without lockstep replacement? | compatibility and migration are routine | every change needs coordinated replacement |
| Operability | Can production evidence confirm the design's assumptions? | runtime evidence tests assumptions | incidents are the only feedback mechanism |
| Comprehension | Can the main flow and ownership be explained without reading every file? | explainable from a short model | only tribal knowledge connects the pieces |

Do not demand maximum scores everywhere. A prototype may intentionally trade durability or modular ceremony for learning speed. Make the trade explicit and revisitable.

## Evidence sources

Prefer executable and runtime evidence:

- entry points and composition roots;
- dependency/import graph and public package surfaces;
- state schemas, writers, migrations, queues, and scheduled work;
- end-to-end call paths and failure handling;
- tests around contracts, transitions, concurrency, and recovery;
- deployment units and rollout configuration;
- telemetry, incident patterns, queue lag, and repair procedures;
- version history showing files that change together;
- team ownership and coordination required for representative changes.

Documentation and diagrams explain intent but may drift. Report contradictions rather than choosing whichever source supports the preferred conclusion.

## Change amplification

Measure architecture through representative changes:

1. Choose a frequent or high-risk business change.
2. Trace every module, contract, state owner, deployment, and team it touches.
3. Identify edits caused by the business rule versus incidental plumbing.
4. Find repeated rules and parallel state representations.
5. Compare the observed propagation with the intended boundary.

High amplification suggests a missing abstraction, wrong ownership, leaky contract, or false separation. Low file count does not guarantee good architecture if one edit can silently violate an invariant elsewhere.

Co-change history is a clue, not proof. Files may change together during migrations, formatting, or generated updates.

## Ownership and boundaries

Review each important invariant and capability with the ownership tests in [module-design.md](module-design.md#state-and-invariant-ownership), and check whether runtime and team boundaries reinforce or fight the code boundary.

Common structural problems:

- shared database tables treated as an integration contract;
- utility packages containing business policy from many domains;
- the same state, rule, or formatter copied into every module of a kind instead of one owner;
- central orchestrators owning every decision;
- technical-layer services with no cohesive capability;
- events published without schema/semantic ownership;
- services whose independence exists only in deployment manifests.

## Architecture fitness functions

A fitness function is an automated or regularly evaluated check that protects an architectural property.

Examples:

| Property | Possible check |
|---|---|
| dependency direction | forbidden-import or architecture test; core packages do not import adapters or frameworks |
| acyclic structure | dependency-graph cycle check |
| module encapsulation | only public entry points importable across boundaries |
| one state owner | write access restricted and audited |
| contract compatibility | consumer/provider contract suite; one shared suite run against every implementation of a contract |
| open extension | adding a representative variant needs a new piece and a composition change, not edits across the core |
| clean removal | removing a module leaves no hidden table, queue, or configuration ownership behind |
| valid lifecycle | model/property tests over state transitions |
| idempotency | duplicate and retry integration tests |
| projection convergence | reconciliation test and lag alert |
| latency/capacity budget | performance gate on a representative path |
| migration safety | mixed-version and rollback tests |
| operational recovery | restore/replay exercise |

Protect only consequential decisions. Excessive structural rules freeze accidental folder shapes and turn architecture into lint noise.

## Technical debt

Classify debt by consequence and leverage rather than ugliness.

**High-pressure debt:** threatens correctness, security, compatibility, recovery, scaling, or delivery; repeated changes amplify its cost.

**Enabling debt:** blocks a committed capability or safe migration even if production is currently stable.

**Local friction:** raises comprehension or test cost in a bounded area but has limited blast radius.

**Cosmetic inconsistency:** style difference with no demonstrated outcome.

Rank a debt item using:

- probability and severity of failure;
- frequency and amplification of affected changes;
- number of users, systems, and teams exposed;
- reversibility and migration risk;
- effort and risk reduction of the smallest correction;
- evidence quality and unresolved uncertainty.

Do not propose a platform rewrite for local friction. Do not dismiss ambiguous state ownership as cleanup merely because the system currently runs.

## Migration strategy

Architecture evolves safely through seams:

- **branch by abstraction** — place old/new implementations behind one stable contract;
- **strangler** — route one characterized capability to a new owner and retire the old path;
- **expand/migrate/contract** — add compatible schema/contract capability, migrate, then remove old forms;
- **shadow/compare** — run a new read or decision path without authority and compare outputs;
- **versioned boundary** — preserve old semantics while consumers migrate;
- **reconciliation** — detect and repair divergence during dual operation.

For each slice define authority, compatibility, observability, rollback, and cleanup. Avoid indefinite dual writes; if unavoidable, designate one authority and reconcile explicitly. Contract and data compatibility during a migration is covered in [system-design.md](system-design.md#evolution); the report form for a health assessment is the review output in [review.md](../workflows/review.md).
