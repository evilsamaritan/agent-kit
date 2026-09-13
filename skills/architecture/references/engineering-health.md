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
- [Review output](#review-output)

## Health dimensions

| Dimension | Healthy signal | Warning signal |
|---|---|---|
| Coherence | scenarios share a small model and mechanisms | each case introduces a new branch or subsystem |
| Ownership | explicit authority/coordination per invariant and mutable state | accidental shared writes and duplicated rules |
| Modularity | changes remain within cohesive boundaries | unrelated modules change together |
| Dependency | visible, acyclic, stable direction | cycles, reach-through imports, hidden globals |
| Contracts | narrow semantic surfaces with explicit failure | internal/storage models leak to consumers |
| Delivery | reversible slices and independent verification | lockstep or big-bang changes |
| Reliability | failure, retry, recovery, and overload are designed | unknown outcomes and manual repair are normal |
| Evolvability | compatibility and migration are routine | every change requires coordinated replacement |
| Operability | runtime evidence tests assumptions | incidents are the only feedback mechanism |
| Comprehension | main flow and ownership are explainable | only tribal knowledge connects the pieces |

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

Review each important invariant and capability:

- Who decides whether a state change is valid?
- Who persists the authoritative result?
- Can another component bypass the owner?
- Are derived views visibly derived?
- Does the module's public contract reflect domain meaning?
- Do runtime and team boundaries reinforce or fight the code boundary?
- Can the owner evolve without coordinated changes in many consumers?

Common structural problems:

- shared database tables treated as an integration contract;
- utility packages containing business policy from many domains;
- central orchestrators owning every decision;
- technical-layer services with no cohesive capability;
- events published without schema/semantic ownership;
- services whose independence exists only in deployment manifests.

## Architecture fitness functions

A fitness function is an automated or regularly evaluated check that protects an architectural property.

Examples:

| Property | Possible check |
|---|---|
| dependency direction | forbidden-import or architecture test |
| module encapsulation | only public entry points importable across boundaries |
| one state owner | write access restricted and audited |
| contract compatibility | consumer/provider contract suite |
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

For each slice define authority, compatibility, observability, rollback, and cleanup. Avoid indefinite dual writes; if unavoidable, designate one authority and reconcile explicitly.

## Review output

An architecture-health report should include:

1. Scope and evidence inspected.
2. Current model: components, owners, state, contracts, and runtime topology.
3. Ranked findings with affected outcomes and concrete evidence.
4. A target model showing how symptoms collapse into fewer mechanisms.
5. Alternatives and accepted tradeoffs.
6. Reversible migration slices.
7. Fitness functions and runtime signals.
8. Unknowns that require a spike or user decision.

Avoid generic maturity scores unless they drive a specific decision. The useful result is a prioritized set of leverage points tied to system outcomes.
