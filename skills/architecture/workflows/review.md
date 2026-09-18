# Review an Architecture

Review the architecture that exists in executable evidence, not the architecture implied by folder names or diagrams. Use this workflow to evaluate a codebase, a subsystem, or a design proposal, and to turn a large issue inventory into causes and a target model. For a single merge request, diff, or fix, use [critique.md](critique.md).

## Contents

- [1. Set the review question](#1-set-the-review-question)
- [2. Gather evidence](#2-gather-evidence)
- [3. Reconstruct the model](#3-reconstruct-the-model)
- [4. Test the architecture](#4-test-the-architecture)
- [5. Rank findings](#5-rank-findings)
- [6. Recommend change](#6-recommend-change)
- [Reviewing with several agents](#reviewing-with-several-agents)

## 1. Set the review question

1. State the decision or risk under review.
2. Define the affected users, flows, components, and compatibility surface.
3. Record the relevant quality attributes and constraints.
4. Avoid a generic best-practices audit when the user asked a bounded question.

## 2. Gather evidence

1. Inspect entry points, composition roots, module and package boundaries, the dependency graph, state stores, queues, scheduled work, and external calls.
2. Trace at least one representative success path and one failure or recovery path.
3. Find all writers of important state and all implementations of repeated rules.
4. Inspect tests, runtime configuration, deployment shape, and telemetry that confirm or contradict the intended design.
5. Distinguish proven facts from inferences and missing evidence. An absent pattern is not evidence of intent.

## 3. Reconstruct the model

1. Name current capabilities, modules, state owners, contracts, and runtime units.
2. Identify invariants and where they are actually enforced.
3. Map dependency direction and cycles.
4. Reduce reported and observed symptoms to causes with [root-cause-analysis.md](../references/root-cause-analysis.md): verify, deduplicate, cluster, test each cluster, keep residuals.
5. Mark accidental boundaries and missing boundaries.
6. Draw a compact current-state module or runtime map when ownership or relationships are not obvious from a short table.

## 4. Test the architecture

Evaluate the dimensions in [engineering-health.md](../references/engineering-health.md#health-dimensions) — coherence, ownership, modularity, dependency, contracts, openness, simplicity, reliability, delivery, evolvability, operability, comprehension — using its review questions and signals. Skip dimensions the review question does not touch, and say which you skipped.

Test the cost of one representative change: count the modules, contracts, state owners, deployments, and teams it touches. Change propagation is stronger evidence than line count ([engineering-health.md](../references/engineering-health.md#change-amplification)).

## 5. Rank findings

Report findings per cause, not per symptom. For each:

- severity: blocker (the design cannot hold as is), concern (fix with a planned follow-up), or note;
- concrete evidence and the affected scenarios;
- the violated invariant or architectural force;
- the consequence if unchanged;
- the smallest coherent correction, stated once at the cause's owner;
- migration and verification notes.

Prioritize correctness, state ownership, compatibility, failure and recovery, security boundaries, and changes with a large blast radius. Do not inflate stylistic inconsistency into architectural debt. Reject recommendations that cost more than the problem they address, and say which ones you rejected.

## 6. Recommend change

1. Describe the target model before listing edits.
2. Show how several symptoms collapse into fewer mechanisms.
3. Visualize the target model separately from the current model; add a transition view only when migration coordination is consequential.
4. Compare the proposed design with keeping the current design and at least one viable alternative.
5. Order changes into reversible slices with characterization and fitness tests.
6. State remaining risks, unknowns, and decisions that require the user's authority.

The result explains the system's shape and leverage points. A file-by-file cleanup list is not an architecture review.

Default review output is a five-minute read: verdict and scope, the few highest-impact causes with their findings, one target view when it clarifies the correction, unresolved risks, and the next verifiable action. Link evidence or a full finding ledger separately instead of interleaving it with the decision narrative; keep a complete raw ledger only when the user asks for audit traceability.

## Reviewing with several agents

Split by zone of the system, not by finding. Give every reviewer the review question and the core judgment, or have it load this skill; a reviewer without them reports symptoms. Concerns found independently by several reviewers raise confidence; they do not deserve duplicate sections. One synthesizer merges overlaps, rejects unsupported claims, reduces findings to causes, keeps unexplained residuals, and drops the low-value tail before anything reaches the reader.
