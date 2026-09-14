---
name: architecture
description: "Design, diagram, and review software architecture: boundaries, contracts, ownership, state, behavior, evolution, and NFRs. Use when designing or redesigning a system, defining core or module boundaries, synthesizing scenarios, applying SOLID or design patterns, planning extensibility or migration, writing ADRs, or drawing diagrams. Do NOT use when an agreed design only needs a polished web explainer (use visualization), or for routine implementation, detailed API/schema design, or CI/CD."
user-invocable: true
---

# Software Architecture and System Design

Treat architecture as one continuous design problem from system topology down to module collaboration. Choose the level of detail from the decision being made; do not split one coherent problem into unrelated scenario-by-scenario fixes.

## Critical rules

1. **Synthesize before decomposing.** Scenarios are evidence. Group them into capabilities, invariants, state transitions, failure modes, and axes of variation before proposing components or tasks.
2. **Design around change and ownership.** Things that change together belong together. Things with different owners, invariants, lifecycles, security boundaries, or scaling needs may need a boundary.
3. **Give every invariant and mutable state an explicit authority model.** Prefer one owner and write path. If multi-writer is required, define partitioning, coordination, or merge semantics instead of allowing accidental shared writes.
4. **Separate policy from mechanism.** Keep domain decisions independent from transport, persistence, frameworks, vendors, and operational plumbing unless those details are the actual constraint.
5. **Define contracts before internals.** Name responsibilities, inputs, outputs, errors, state ownership, ordering, idempotency, and compatibility before choosing classes or files.
6. **Choose patterns only for named forces.** Every abstraction or pattern must state the variation, coupling, failure, or lifecycle problem it solves and the complexity it adds.
7. **Prefer the smallest coherent design.** Avoid both copy-pasted special cases and speculative generality. A useful extension point corresponds to demonstrated variation or a committed near-term requirement.
8. **Make architecture visible.** Choose the minimum System, Structure, Internal, Runtime, Data & State, Deployment, or Evolution views that expose the decision, then draw concise renderable diagrams when relationships are easier to verify visually than in prose.
9. **Prove the design against change.** Walk representative happy paths, failures, concurrency, recovery, and one plausible extension through the same model.
10. **Preserve delivery safety.** For existing systems, map current behavior and compatibility constraints, then migrate through reversible slices with explicit verification.
11. **Separate evidence from decisions.** Label repository facts, assumptions, unknowns, alternatives, and chosen decisions. Inspect before redesigning; do not invent the current architecture.
12. **Choose the deliverable before the depth.** Default to a decision brief. A difficult problem justifies deeper reasoning, not a longer artifact. Produce a full design dossier only when the user explicitly asks for exhaustive documentation or the deliverable itself is the specification.
13. **Synthesize reviews; do not concatenate them.** Parallel findings and scenario inventories are working material. Rank, merge, reject, and compress them before updating the canonical design.

## Scope and boundaries

This skill covers four connected levels:

| Level | Main question | Typical decisions |
|---|---|---|
| System | What are the major runtime parts? | deployment units, data ownership, communication, consistency, scaling, failure isolation |
| Application | Where is the business core? | capabilities, bounded contexts, core versus adapters, dependency direction |
| Module | What changes together behind one contract? | responsibilities, public surface, state authority, collaboration, extension points |
| Collaboration | How should variable behavior compose? | direct call, pipeline, decorator, strategy, state machine, events, policies |

Use sibling skills for depth after the architectural boundary is chosen:

- API protocol and wire contracts → `api-design`
- Schema, indexes, migrations, and query plans → `database`
- Service wiring, middleware, request pipelines, and runtime lifecycle → `backend`
- Concrete resilience mechanisms and SLO practice → `reliability`
- Threat modeling and security controls → `security`
- Runtime-specific implementation idioms → language/framework skills
- Deployment and delivery mechanics → `ci-cd` and `release-engineering`
- Repository-wide ADR conventions, placement, linking, and docs-as-code mechanics → `documentation` (architecture owns whether to record the decision, its technical content, and rationale)

Routine code inside an established design does not need this skill. Cross-cutting changes, new modules, shared mechanisms, state ownership changes, and architectural refactors do.

## Flow selection

| Intent | Route |
|---|---|
| Make a focused architecture decision or sketch a module boundary | Use the systemic loop below and return a brief |
| Design a new system, subsystem, or module family | Read [design.md](workflows/design.md) and select its brief, design, or dossier mode |
| Redesign or migrate an existing architecture | Read [design.md](workflows/design.md); include current-state and migration steps |
| Review a proposal or codebase architecture | Read [review.md](workflows/review.md) and report evidence-ranked findings |
| Choose a system/application architecture style | Read [architecture-patterns.md](references/architecture-patterns.md) |
| Define module boundaries, a core, or extension seams | Read [module-design.md](references/module-design.md) |
| Select or draw architecture views for systems, modules, flows, state, deployment, or migration | Read [visualization.md](references/visualization.md) |
| Turn an agreed architecture into a polished responsive HTML explorer | Finish the architecture model and view contract, then combine with `visualization` |
| Select SOLID/DRY/YAGNI and coupling principles | Read [design-principles.md](references/design-principles.md) |
| Choose a composition or collaboration pattern | Read [design-patterns.md](references/design-patterns.md) |
| Reason about state, scale, consistency, and failures | Read [system-design.md](references/system-design.md) |
| Record a consequential decision | Read [adr-template.md](references/adr-template.md) |
| Assess architecture health or migration pressure | Read [engineering-health.md](references/engineering-health.md) |

Read only the references needed for the active forces. Do not load the entire catalog by default.

## Deliverable modes

Default to a five-minute **brief**. Use **design** mode when several coupled decisions must guide implementation or migration. Use **dossier** mode only for an explicitly requested exhaustive RFC, audit record, or reference specification. Complexity, reviewer count, and reasoning effort do not select a longer mode. Read [design.md](workflows/design.md) for the mode-specific artifact contract.

## Systemic design loop

For a small decision that does not justify the full workflow, preserve this sequence:

```text
Goal and constraints
  -> scenarios and evidence
  -> invariants, state, and variation
  -> responsibilities and boundaries
  -> contracts and dependency direction
  -> pattern choices with costs
  -> scenario and change simulation
  -> delivery and verification when relevant
```

Do not use the scenario list as the component list or implementation plan. A hundred cases often reduce to a few operations, policies, states, and failure modes.

## Boundary and abstraction tests

Before extracting a component, module, service, or abstraction, ask:

| Test | Evidence for separation | Evidence for keeping together |
|---|---|---|
| Change | changes for a different reason or cadence | changes in the same feature repeatedly |
| Invariants | owns a distinct consistency boundary | must transact atomically with the same state |
| Language | has a stable domain concept and vocabulary | shares one model and cannot define a clean translation |
| Lifecycle | starts, stops, deploys, or retires independently | must evolve and release in lockstep |
| Scale/failure | needs independent scaling or blast-radius isolation | a boundary adds only network and coordination cost |
| Security/ownership | needs a distinct trust or team boundary | the same owner and policy govern both sides |
| Reuse | represents the same knowledge in multiple consumers | code only looks similar but encodes different rules |

Extract when several forces align and the contract is clearer than the code it hides. Keep together when separation would split one invariant, create chatty coordination, or add indirection without independent change.

## Pattern decision discipline

Use the problem as the selection key:

| Pressure | Candidate response |
|---|---|
| Same operation, independently composable cross-cutting behavior | Decorator or middleware pipeline |
| One behavior varies by policy or context | Strategy or higher-order function |
| External model must not leak into the core | Adapter or anticorruption layer |
| Complex subsystem needs one stable entry point | Facade |
| Explicit lifecycle with constrained transitions | State machine |
| Several handlers may process or enrich a request in order | Chain/pipeline |
| Consumers react independently to a fact that already happened | Domain event / publish-subscribe |
| Creation varies while use stays stable | Factory at the composition root |
| Reads and writes have materially different models | Separate query model; full CQRS only if its cost is justified |

Composition is the default way to add orthogonal behavior. Inheritance is appropriate only for a genuine substitutable hierarchy with stable variation. Plain functions and direct calls remain preferable when there is no independent variation.

## Output contract

For design and redesign work, make the decision legible and actionable through:

1. **Decision and scope** — what is being decided, current/target status, constraints, and consequential unknowns.
2. **Coherent model** — the few capabilities, invariants, owners, boundaries, and contracts needed to explain the decision.
3. **Visible structure** — one compact structural view. Add one dynamic or risk-specific view only when it exposes a different consequential fact.
4. **Consequences** — selected approach, important rejected alternative, cost, risk, and the next verification or delivery step.

These are acceptance criteria, not mandatory headings. A bounded question may need only a short decision and rationale; a review follows [review.md](workflows/review.md). Scenario matrices, exhaustive ownership catalogs, detailed contracts, ADR collections, source inventories, rollout plans, observability plans, and fitness suites are conditional supporting artifacts. Include or link them only when the request or decision actually needs them; never paste all of them into the canonical narrative merely because they were produced during analysis.

Lead with the conclusion and selected views, then provide only the rationale needed to trust them. Architecture may render compact Mermaid, text, or host-native diagrams itself; those diagrams are part of the design, not a handoff stub. Combine with `visualization` only when the same model needs a polished responsive HTML explorer, richer disclosure, or presentation-grade render QA. Code and diff views may support a decision as implementation evidence; they are not architecture levels.

Before delivery, perform an editorial pass: can the intended reader recover the decision, boundaries, owners, and main tradeoff in five minutes? Remove repeated explanations, inventories without a decision, and sections whose takeaway duplicates another section. Deep research may remain deep internally while the delivered design stays compact.

For a review, rank findings by architectural impact and cite evidence. For a consequential choice, capture the decision in an ADR.

## Context adaptation

**New product:** keep deployment topology simple while making domain and module boundaries explicit. Defer distributed mechanisms until a measured force requires them.

**Existing system:** derive the real architecture from code, runtime configuration, data ownership, and call paths. Treat documentation as a hypothesis until verified.

**Cross-cutting feature:** inspect all consumers first. Separate stable operation from independently varying policies such as retries, logging, caching, authorization, or metrics.

**Legacy redesign:** identify seams around behavior that can be characterized, place compatibility adapters at the edge, and migrate one reversible path at a time.

**Library or framework:** optimize for a small stable public contract, explicit lifecycle, composability, compatibility, and misuse resistance rather than application-specific convenience.

## Anti-patterns

- **Scenario-by-scenario design** — one branch, handler, flag, or task per case with no shared model.
- **Noun-first decomposition** — turning every domain noun or screen into a service/module without change-boundary evidence.
- **Pattern shopping** — selecting a named pattern before identifying the pressure it resolves.
- **Premature platform** — building a generic plugin or configuration system for one concrete use case.
- **False DRY** — merging coincidentally similar code that represents different business knowledge.
- **Distributed monolith** — network boundaries without independent ownership, data, release, or failure isolation.
- **Shared-state ambiguity** — several components can mutate the same invariant without an explicit coordination and authority model.
- **Leaky core** — business policy depends directly on transport, storage, framework, or vendor types.
- **Task-list architecture** — an implementation backlog substitutes for a coherent model and contracts.
- **Big-bang purity rewrite** — architectural improvement has no compatibility path, checkpoints, or rollback.

## Related Knowledge

- `visualization` — turns an agreed architecture model and its views into a polished responsive HTML explorer
- `api-design` — protocol and compatibility design for exposed contracts
- `database` — persistence models and transactional boundaries
- `reliability` — failure handling, SLOs, and recovery
- `performance` — evidence-driven capacity and latency work
- `security` — trust boundaries and threat-driven controls
- `testing` — contract, integration, property, and architecture fitness tests
- `observability` — signals that validate runtime assumptions
- `release-engineering` — safe migration and rollout strategies

## References

- [design.md](workflows/design.md) — full architecture design and redesign workflow
- [review.md](workflows/review.md) — evidence-based architecture review workflow
- [architecture-patterns.md](references/architecture-patterns.md) — system and application styles with forces and costs
- [module-design.md](references/module-design.md) — core, boundaries, ownership, dependencies, and extension seams
- [visualization.md](references/visualization.md) — architecture view selection, direct diagramming, and the optional HTML handoff
- [design-principles.md](references/design-principles.md) — principles as tradeoffs rather than slogans
- [design-patterns.md](references/design-patterns.md) — pattern selection by problem signal
- [system-design.md](references/system-design.md) — end-to-end state, flow, scale, and failure reasoning
- [adr-template.md](references/adr-template.md) — decision record formats
- [engineering-health.md](references/engineering-health.md) — health signals, fitness functions, and migration pressure
