# Design or Redesign an Architecture

Use this workflow for a new system, a new subsystem/module family, or a material redesign. Preserve the reasoning sequence while publishing only the detail required by the selected deliverable mode.

## Contents

- [Output mode](#output-mode)
- [1. Frame the decision](#1-frame-the-decision)
- [2. Establish the current state](#2-establish-the-current-state)
- [3. Synthesize scenarios](#3-synthesize-scenarios)
- [4. Model state and invariants](#4-model-state-and-invariants)
- [5. Draw boundaries](#5-draw-boundaries)
- [6. Define contracts and collaboration](#6-define-contracts-and-collaboration)
- [7. Select patterns](#7-select-patterns)
- [8. Visualize the architecture](#8-visualize-the-architecture)
- [9. Prove the design](#9-prove-the-design)
- [10. Plan delivery](#10-plan-delivery)
- [11. Produce the architecture result](#11-produce-the-architecture-result)

## Output mode

Choose before research expands:

- **Brief — default:** one decision-oriented document readable in about five minutes. Use one compact structural view, plus at most one dynamic or risk view when it adds a different fact.
- **Design:** a canonical implementation guide for several coupled decisions. Keep evidence, exhaustive scenarios, detailed contracts, and rollout mechanics in linked supporting files.
- **Dossier:** an exhaustive RFC, audit record, or reference set requested explicitly. Keep a brief as the entry point; do not make the reader traverse the dossier to learn the decision.

Complexity and high reasoning effort do not select dossier mode. Research can be extensive while the delivered artifact remains a brief.

## 1. Frame the decision

1. State the user/business outcome and the architectural decision being made.
2. Set the boundary: whole system, subsystem, application, module family, or shared mechanism.
3. Record hard constraints: compatibility, data, latency, availability, security, cost, team ownership, deadline, and mandated technology.
4. Separate repository facts, user requirements, assumptions, and unknowns.
5. Ask the user only when a remaining unknown materially changes scope, public behavior, cost, permissions, or reversibility. Otherwise make and label a conservative assumption.

Do not begin with a preferred pattern or component list.

## 2. Establish the current state

For an existing system:

1. Inspect entry points, runtime composition, dependency direction, state stores, public contracts, background work, and external integrations.
2. Trace representative end-to-end paths through code and runtime configuration.
3. Identify actual state writers and the code enforcing each invariant.
4. Map compatibility consumers, migration constraints, and operational dependencies.
5. Note contradictions between documentation and executable evidence.

For a greenfield system, record the relevant surrounding systems and constraints instead of inventing an empty-world design.

## 3. Synthesize scenarios

1. Collect representative scenarios, including success, rejection, failure, retry, cancellation, concurrency, recovery, and evolution.
2. When the cases cannot yet be grouped, build a working scenario matrix using dimensions such as actor, operation, state, policy, trigger, dependency, failure, and output.
3. Group cases that share the same business rule, lifecycle, data, or variation point.
4. Identify cases that only look similar but express different domain knowledge.
5. Replace the flat scenario list with a smaller vocabulary of capabilities, operations, policies, states, and events.

Example synthesis:

```text
Cases: authenticated call, retried call, measured call, cached call, combinations
Stable operation: execute RPC request
Orthogonal policies: authenticate, retry, measure, cache
Resulting pressure: compose policies without duplicating or modifying the transport core
Candidate shape: narrow client contract plus ordered decorators/pipeline stages
```

The scenario matrix validates the architecture; it must not become one component or task per row. Publish only the representative cases that change or disprove the model. Keep the full matrix as a separate appendix only when it is a requested acceptance artifact.

## 4. Model state and invariants

1. Name each durable and ephemeral state.
2. Assign an explicit authority model for every invariant. Prefer one owner/write path; document partitioning, consensus, or merge semantics when multiple writers are essential.
3. Describe valid state transitions and rejected transitions.
4. Decide which facts are queried synchronously and which changes are published as events.
5. State transaction, ordering, idempotency, consistency, and recovery expectations where relevant.
6. Separate domain policy from persistence and transport mechanisms.

If two proposed components must jointly enforce one invariant synchronously, reconsider the boundary before adding distributed coordination.

## 5. Draw boundaries

1. Group responsibilities that change together and share invariants.
2. Separate responsibilities with distinct language, ownership, lifecycle, trust, scale, or failure behavior.
3. Define the core: policies and models that express the system's purpose.
4. Put volatile mechanisms—frameworks, transports, storage, vendors, UI, clocks—behind edge adapters when independence has concrete value.
5. Test each boundary for cohesion, coupling, fan-in/fan-out, cyclic dependencies, and chatty collaboration.
6. Choose the deployment boundary separately from the code/module boundary. A module does not need to become a service.

Prefer explicit modules inside the simplest viable deployment topology.

## 6. Define contracts and collaboration

For each boundary:

1. State responsibility and non-responsibilities.
2. Define the smallest public contract needed by consumers.
3. Name inputs, outputs, errors, side effects, ownership transfer, and compatibility rules.
4. Choose dependency direction so stable policy does not depend on volatile details.
5. Choose synchronous calls when the caller needs an immediate result and coupled availability is acceptable.
6. Choose events when a completed fact has independent consumers and temporal decoupling is valuable.
7. Make lifecycle and composition order explicit for decorators, middleware, plugins, or pipelines.

Avoid exposing internal data structures merely to save one mapping layer.

## 7. Select patterns

1. Name the force before the pattern: variation, isolation, coordination, lifecycle, consistency, or compatibility.
2. Consider the direct solution first.
3. Compare at least one viable alternative and the option to keep the current design.
4. Select the smallest pattern that resolves the demonstrated force.
5. Record the new complexity: indirection, ordering, state, operational burden, testing surface, or migration cost.
6. Define a deletion or simplification path for temporary architecture.

Read the relevant pattern reference only after the force is known.

## 8. Visualize the architecture

1. State the question and abstraction level for each view.
2. Create one static map: system context/container for a system decision, or component/module/dependency map for an application decision.
3. In brief mode, add at most one sequence/dynamic or risk-specific view when it exposes a fact the static map cannot.
4. In design or dossier mode, add another state, data/trust, deployment, or migration view only when that dimension drives a separate decision.
5. Keep current, target, and transitional architecture in separate views with stable identities and explicit status.
6. Label responsibilities and relationship intent; distinguish repository evidence, inference, proposal, and unknowns.
7. Draw the selected views directly with maintainable Mermaid, text, or a host-native diagram. Use the `visualization` skill only when a separate responsive HTML or Playground-style artifact is part of the request.
8. Put a one-sentence takeaway next to each diagram. Do not replace the diagram with prose or a presentation.

Read [visualization.md](../references/visualization.md) for view selection, direct diagramming, and the optional semantic handoff. Architecture owns concise diagrams in its document; the `visualization` skill owns the polished web shell, responsive projections, themes, interaction, and browser inspection when that extra artifact is required.

## 9. Prove the design

Internally walk the smallest representative set that covers the applicable risks:

1. Representative success path.
2. Validation or business rejection.
3. Dependency timeout, partial failure, or malformed response.
4. Duplicate, retry, or concurrent operation where applicable.
5. Restart or recovery with in-flight work where applicable.
6. One likely extension that exercises a declared variation point.
7. One unrelated change that should remain isolated.

If each case needs a new exception in the core, the model is incomplete. If the extension requires only configuration but has materially new semantics, the abstraction may be hiding important differences. Report the cases that changed the decision or remain risky; do not turn every internal walkthrough into a section of the canonical design.

## 10. Plan delivery

For an existing system or when the user asks for an implementation plan:

1. Identify a seam where old and new behavior can coexist.
2. Split delivery into independently verifiable vertical slices.
3. Preserve public compatibility or provide an explicit migration/versioning strategy.
4. Define characterization tests before changing poorly understood behavior.
5. Add architecture fitness checks for critical boundaries and invariants.
6. Define telemetry, rollout gates, rollback points, and cleanup conditions.
7. Keep the final architecture and the transitional architecture distinct.

For a greenfield decision with no migration, record only the first verifiable slice. Do not manufacture rollback, telemetry, or compatibility sections that do not affect the decision. Do not present a big-bang rewrite as the default migration plan.

## 11. Produce the architecture result

Return a decision-first canonical artifact:

1. **Decision and scope:** conclusion, status, drivers, constraints, and consequential unknowns.
2. **Model:** one structural view and a compact ownership/contract explanation.
3. **Behavior:** one representative flow only when order, failure, or concurrency changes the design.
4. **Tradeoffs:** chosen approach, important alternative, cost, and unresolved risk.
5. **Delivery:** next verifiable slice; add migration and rollback only when they are part of the problem.

Then link conditional supporting artifacts instead of merging them into the main reading path:

- evidence and current-state inventory;
- detailed contracts or API/schema specifications;
- full scenario/acceptance matrix;
- ADRs;
- rollout, observability, and fitness plans.

Before delivery, remove duplicated conclusions, background that does not change a decision, and details already owned by a linked artifact. Parallel reviews must produce a ranked synthesis, not the union of every concern. Write ADRs only for consequential decisions that future maintainers will need to understand independently.
