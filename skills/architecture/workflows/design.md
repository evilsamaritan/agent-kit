# Design or Redesign an Architecture

Use this workflow for a new system, subsystem, or module family, or a material redesign. The order is: take the scope from the request, inspect, draft a model with labeled assumptions, ask about the assumptions that matter, prove the draft, then publish only the detail the selected output mode needs.

## Contents

- [Output mode](#output-mode)
- [1. Scope the decision](#1-scope-the-decision)
- [2. Inspect what exists](#2-inspect-what-exists)
- [3. Synthesize scenarios](#3-synthesize-scenarios)
- [4. Draft the model](#4-draft-the-model)
- [5. Ask about the assumptions that matter](#5-ask-about-the-assumptions-that-matter)
- [6. Prove the design](#6-prove-the-design)
- [7. Draw the views](#7-draw-the-views)
- [8. Plan delivery](#8-plan-delivery)
- [9. Produce the result](#9-produce-the-result)

## Output mode

Choose before research expands:

- **Brief — default:** one decision-oriented document readable in about five minutes, with one compact structural view, at most one more view that adds a different fact, and a contract sketch.
- **Design:** a canonical implementation guide for several coupled decisions. Evidence, exhaustive scenarios, detailed contracts, and rollout mechanics live in linked supporting files.
- **Dossier:** an exhaustive RFC, audit record, or reference set, only when requested explicitly. A brief remains the entry point.

Complexity and high reasoning effort do not select a longer mode. Research can be extensive while the delivered artifact stays a brief. Turning an agreed design into maintained project documentation is a separate step for the project's documentation practice or the `documentation` skill.

## 1. Scope the decision

1. State the outcome the user wants and the architectural decision being made, taken from the request as given.
2. Set the boundary: whole system, subsystem, application, module family, or shared mechanism.
3. Record hard constraints that are already known: compatibility, data, latency, availability, security, cost, team ownership, deadline, mandated technology.
4. Separate user requirements from your assumptions and unknowns. Do not ask anything yet; most unknowns are answered by the code.

Do not begin with a preferred pattern or component list.

## 2. Inspect what exists

For an existing system:

1. Inspect entry points, runtime composition, dependency direction, state stores, public contracts, background work, and external integrations.
2. Trace representative end-to-end paths through code and runtime configuration.
3. Identify the actual writers of each important state and the code that enforces each invariant.
4. Map compatibility consumers, migration constraints, and operational dependencies.
5. Note contradictions between documentation and executable evidence; the code wins.

For a greenfield system, record the surrounding systems, the conventions of the host repository, and the constraints they impose instead of designing for an empty world.

## 3. Synthesize scenarios

1. Collect representative scenarios: success, rejection, failure, retry, cancellation, concurrency, recovery, and evolution.
2. When reported problems are part of the input, reduce them to causes first with [root-cause-analysis.md](../references/root-cause-analysis.md).
3. When cases do not group easily, build a working matrix over dimensions such as actor, operation, state, owner, invariant, policy, trigger, dependency, failure, and output.
4. Separate cases that only look similar but express different domain knowledge or need different owners.
5. Replace the flat list with a smaller vocabulary of capabilities, operations, policies, states, and events.

Example:

```text
Cases: authenticated call, retried call, measured call, cached call, combinations
Stable operation: execute RPC request
Orthogonal policies: authenticate, retry, measure, cache
Resulting pressure: compose policies without duplicating or modifying the transport core
Candidate shape: narrow client contract plus ordered decorators
```

The matrix validates the architecture; it must not become one component or task per row. Publish only the cases that establish, change, or disprove the model.

## 4. Draft the model

Draft quickly and mark every assumption. The draft is what the questions in step 5 will be about.

**State and invariants**

1. Name each durable and ephemeral state and give every invariant an explicit authority model ([module-design.md](../references/module-design.md#state-and-invariant-ownership)).
2. Describe valid and rejected transitions.
3. State transaction, ordering, idempotency, consistency, and recovery expectations where they matter.

If two proposed components must jointly enforce one invariant synchronously, reconsider the boundary before adding coordination.

**Boundaries**

1. Group responsibilities that change together and share invariants; separate those with distinct language, ownership, lifecycle, trust, scale, or failure behavior (boundary tests in SKILL.md).
2. Define the core: the policies and models that express the system's purpose. Put volatile mechanisms behind edge adapters when that independence has concrete value.
3. Choose the deployment boundary separately from the module boundary. A module does not need to become a service. Prefer explicit modules inside the simplest viable deployment topology.

**Contracts and collaboration**

1. For each boundary state responsibility and non-responsibilities, the smallest public contract consumers need, and inputs, outputs, errors, side effects, and compatibility rules.
2. Choose dependency direction so stable policy does not depend on volatile details.
3. Write the contract sketch now: the few interfaces, signatures, or pseudo-code fragments with real names, who calls whom, who owns what.
4. Check what each contract assumes there is exactly one of, and whether a known upcoming requirement breaks that.

**Composition and patterns**

1. Name the force before the pattern: variation, isolation, coordination, lifecycle, consistency, or compatibility.
2. Consider the direct solution first, then the smallest open shape that resolves the force ([composable-design.md](../references/composable-design.md), [design-patterns.md](../references/design-patterns.md)).
3. Compare at least one viable alternative and, for an existing system, keeping the current design.
4. Record the complexity each choice adds: indirection, ordering, state, operational burden, testing surface, migration cost.

## 5. Ask about the assumptions that matter

Ask only about assumptions that would change a boundary, an owner, a lifetime or cardinality, external behavior, cost, or a one-way decision. Everything else stays a labeled assumption.

- Look facts up in the repository; never ask them.
- Ask in the user's words, not the draft's internal names.
- Give each question two to four options and say what each option changes in the design.
- Attach a concrete example from the code or a scenario, so the choice is not abstract.
- Ask in one batch, revise the draft, and ask again only if an answer opened a new consequential fork.

When the run cannot pause for answers, proceed on the most conservative assumptions and list the open questions at the top of the result, each with the decision it would change.

## 6. Prove the design

Walk the smallest representative set that covers the applicable risks:

1. A representative success path.
2. A validation or business rejection.
3. A dependency timeout, partial failure, or malformed response.
4. A duplicate, retry, or concurrent operation where applicable.
5. A restart or recovery with in-flight work where applicable.
6. One likely extension that exercises a declared extension point.
7. One unrelated change that should stay isolated.

If each case needs a new exception in the core, the model is incomplete. If an extension with materially new semantics needs only configuration, the abstraction may be hiding an important difference. Report the cases that changed the decision or remain risky; do not turn every walkthrough into a section.

## 7. Draw the views

Select and draw the views with [architecture-views.md](../references/architecture-views.md): one static map, plus one dynamic or risk view when it exposes a fact the map cannot. Keep current, target, and transitional architecture in separate views. Put a one-sentence takeaway next to each diagram. Use the `visualization` skill only when a separate responsive HTML explorer is part of the request.

## 8. Plan delivery

For an existing system, or when the user asks for an implementation plan:

1. Identify a seam where old and new behavior can coexist.
2. Split delivery into independently verifiable vertical slices; validate a shared contract with one real implementation before replicating it.
3. Preserve public compatibility or provide an explicit migration or versioning strategy ([engineering-health.md](../references/engineering-health.md#migration-strategy)).
4. Define characterization tests before changing poorly understood behavior.
5. Add fitness checks for the boundaries and invariants that matter.
6. Define rollout gates, rollback points, and cleanup conditions where they affect the decision.
7. Keep the final architecture and the transitional architecture distinct.

For a greenfield decision with no migration, record only the first verifiable slice. Do not manufacture rollback, telemetry, or compatibility sections that do not affect the decision, and do not present a big-bang rewrite as the default plan.

## 9. Produce the result

Return a decision-first artifact:

1. **Decision and scope:** conclusion, status, drivers, constraints, open questions with the decision each would change.
2. **Model:** one structural view and a compact ownership explanation.
3. **Contract sketch:** the interfaces or pseudo-code an implementer starts from.
4. **Behavior:** one representative flow, only when order, failure, or concurrency changes the design.
5. **Tradeoffs:** the chosen approach, the important alternative, cost, and unresolved risk.
6. **Delivery:** the next verifiable slice; migration and rollback only when they are part of the problem.

Link conditional supporting artifacts instead of merging them into the main reading path: evidence and current-state inventory, detailed contract or API/schema specifications, the full scenario matrix, decision records ([adr-template.md](../references/adr-template.md)), rollout and fitness plans.

Before delivery, remove duplicated conclusions, background that changes no decision, coined terms, and details already owned by a linked artifact. When the design is revised later, update this artifact in place rather than adding a correcting document beside it.
