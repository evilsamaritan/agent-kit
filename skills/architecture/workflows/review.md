# Review an Architecture

Review the architecture that exists in executable evidence, not the architecture implied by folder names or diagrams.

## Contents

- [1. Set the review question](#1-set-the-review-question)
- [2. Gather evidence](#2-gather-evidence)
- [3. Reconstruct the model](#3-reconstruct-the-model)
- [4. Test the architecture](#4-test-the-architecture)
- [5. Rank findings](#5-rank-findings)
- [6. Recommend change](#6-recommend-change)

## 1. Set the review question

1. State the decision or risk under review.
2. Define the affected users, flows, components, and compatibility surface.
3. Record relevant quality attributes and constraints.
4. Avoid a generic best-practices audit when the user asked a bounded question.

## 2. Gather evidence

1. Inspect entry points, composition roots, module/package boundaries, dependency graph, state stores, queues, scheduled work, and external calls.
2. Trace at least one representative success path and one failure/recovery path.
3. Find all writers of important state and all implementations of repeated rules.
4. Inspect tests, runtime configuration, deployment shape, and telemetry that confirm or contradict the intended design.
5. Distinguish proven facts from inferences and missing evidence.

## 3. Reconstruct the model

1. Name current capabilities, modules, state owners, contracts, and runtime units.
2. Identify invariants and where they are actually enforced.
3. Map dependency direction and cycles.
4. Deduplicate reported symptoms, then form candidate causal clusters around a shared invariant, owner, boundary, lifecycle, dependency direction, duplicated rule, or variation axis.
5. Test each cluster against repository/runtime evidence and at least one competing explanation or counterexample. Record residual symptoms it does not explain.
6. Group scenario-specific branches into their validated underlying policies, states, and variation axes.
7. Mark accidental boundaries and missing boundaries.
8. Draw a compact current-state module/runtime map when ownership or relationships are not obvious from a short table.

## 4. Test the architecture

Evaluate:

| Property | Review question |
|---|---|
| Coherence | Do scenarios pass through one shared model or many independent fixes? |
| Cohesion | Does each module contain responsibilities that change together? |
| Coupling | Can a change remain local, or does it fan out through unrelated areas? |
| Ownership | Does each invariant and mutable state have an explicit owner or multi-writer coordination model? |
| Encapsulation | Can consumers bypass contracts or depend on internals? |
| Extensibility | Do demonstrated variations compose, or require editing the core repeatedly? |
| Simplicity | Does each abstraction and runtime boundary pay for its complexity? |
| Failure behavior | Are timeout, partial failure, retry, duplicate, recovery, and degradation explicit? |
| Evolvability | Can contracts, data, and behavior migrate without lockstep replacement? |
| Operability | Can production evidence confirm the design's assumptions? |

Test the cost of one representative change: count affected modules, contracts, state owners, deployments, and teams. Change propagation is stronger evidence than line count.

## 5. Rank findings

For each finding, report:

- severity: blocker, high, medium, or low;
- concrete evidence and affected scenario;
- violated invariant or architectural force;
- consequence if unchanged;
- smallest coherent correction;
- migration and verification notes.

Prioritize correctness, state ownership, compatibility, failure/recovery, security boundaries, and changes with large blast radius. Do not inflate stylistic inconsistency into architectural debt.

Group symptoms only when evidence supports one shared cause such as an owner, invariant, boundary, lifecycle, or variation failure. A shared proposed correction does not by itself prove one finding. When several reviewers contribute, independently discovered concerns increase confidence; they do not require duplicate sections. The synthesizer must merge overlaps, reject unsupported claims, retain unexplained residuals, and omit the low-value tail from the canonical result. Keep a complete raw ledger only when the user explicitly requests audit traceability.

## 6. Recommend change

1. Describe the target model before listing edits.
2. Show how several symptoms collapse into fewer mechanisms.
3. Visualize the target model separately from the current model; add a transition view only when migration coordination is consequential.
4. Compare the proposed design with keeping the current design and at least one viable alternative.
5. Order changes into reversible slices with characterization and fitness tests.
6. State remaining risks, unknowns, and decisions that require user authority.

The result should explain the system's shape and leverage points. A file-by-file cleanup list is not an architecture review.

Default review output is a five-minute read: verdict and scope, the few highest-impact findings, one target view when it materially clarifies the correction, unresolved risks, and the next verifiable action. Link evidence or a full finding ledger separately instead of interleaving it with the decision narrative.
