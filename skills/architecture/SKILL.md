---
name: architecture
description: "Design or review system and module structure: boundaries, data ownership, contracts between modules, consistency, application styles, decision rationale, and views. Use for a new system or subsystem, a redesign or migration, an architecture review, or root causes across modules."
argument-hint: "[design|review|critique] [target]"
---

# Software Architecture

Decide the structure that code lives in: systems, applications, modules, the contracts between them, and who owns which state. The same judgment applies to a new design, a redesign, a migration, or a review of what exists. How code is written inside a module belongs to `development`. Workflows exist for the frequent flows; everywhere else apply the core judgment directly. Work from whatever exists: no particular project file, document format, or process is required.

## Core judgment

### 1. See the whole before the part

Scenarios, bug reports, review findings, and feature requests are evidence, not the work list. Before proposing components, fixes, or tasks, reduce them to the few operations, policies, states, invariants, and failure modes they share.

- **Problems:** symptoms -> a missing owner, an unenforced invariant, a leaky boundary, duplicated knowledge, or a variation point that must be edited for every case. Merge symptoms into one cause only when it survives the counterfactual — *if this cause were fixed, which symptoms disappear and which remain?* — and keep the residual cases. A list of findings is input to analysis, never a to-do list: correct each cause once at its owner, then account for every item. Method: [root-cause-analysis.md](references/root-cause-analysis.md).
- **A design:** a hundred cases usually reduce to a few operations, policies, states, and failure modes. The scenario list is never the component list or the task list.

### 2. Boundaries follow change, invariants, and lifecycle

A boundary between modules or services is worth its cost when the parts change for different reasons, own different invariants, start and stop independently, scale or fail separately, or sit in different trust or team domains. Split when several of these align and the contract is clearer than the code it hides; keep together when separation would split one invariant or add chatty coordination. Tests: [Boundary and abstraction tests](#boundary-and-abstraction-tests).

### 3. Give every state one owner behind a contract

- Things that change together live together.
- Every invariant and every piece of mutable state has one authority and one write path, or an explicit coordination model. A copy of a rule, a type, or a piece of state in every module is an ownership defect, not a style issue.
- Separate policy from mechanism: decisions stay independent of transport, persistence, frameworks, and vendors unless those are the actual constraint.
- Name the contract before the internals: responsibility, inputs, outputs, errors, state ownership, ordering, lifecycle, compatibility.

### 4. Prove the structure against change

Before freezing a boundary or contract, apply critical rule 3 below, then list the change axes: what is expected to change, how often, which modules each change may touch, and whether each family of variants is open or closed.

Inside a module — units, variant families, dependencies, async lifetime, errors, refactoring proportion — the practice belongs to `development`. Architecture sets the boundaries that practice works within.

## Critical rules

1. **Evidence before redesign.** Inspect code, runtime configuration, and call paths first. Label facts, assumptions, unknowns, and decisions. Documentation is a hypothesis until executable evidence confirms it; its absence is never a blocker.
2. **Patterns only for named forces.** Every abstraction states the variation, coupling, failure, or lifecycle problem it solves and the complexity it adds. Plain functions and direct calls win when nothing varies independently. Placing a variant's knowledge on the variant is not an abstraction (`development`).
3. **Prove the design against change.** Walk a success path, a failure, concurrency or recovery where relevant, one plausible extension, and one unrelated change that must stay isolated. Before freezing a contract, ask what it assumes there is exactly one of and which known upcoming requirement breaks that; a contract exercised only by placeholder implementations is not validated.
4. **Plain vocabulary.** Use the project's and the industry's terms. Do not coin names for mechanisms. When a new term is unavoidable, define it once in plain words; one term carries one meaning.
5. **Scope, inspect, draft, then ask.** Take the scope from the request, inspect the code, draft a model with labeled assumptions, and only then ask — about assumptions that change boundaries, owners, lifetimes, or one-way decisions. Phrase each question in the user's words, with options and a concrete example from the code. Facts the repository can answer are looked up, never asked.
6. **Make it visible.** Choose the minimum views that expose the decision and draw concise diagrams when relationships are easier to verify visually than in prose.
7. **Brief first, one canonical statement.** Default to a five-minute brief. A hard problem justifies deeper reasoning, not a longer artifact. Update the one canonical statement in place instead of stacking corrections beside it. Formal documentation is a separate step for the project's own documentation practice.
8. **Synthesize; do not concatenate.** Parallel findings and scenario inventories are working material. Rank, merge, reject, and compress them before they reach the reader.
9. **Preserve delivery safety.** For existing systems, map current behavior and compatibility constraints, then migrate through reversible slices with explicit verification.

## Scope and boundaries

| Level | Main question | Typical decisions |
|---|---|---|
| System | What are the major runtime parts? | deployment units, data ownership, communication, consistency, scaling, failure isolation |
| Application | Where is the core? | capabilities, bounded contexts, core versus adapters, host versus modules, dependency direction |
| Module | What changes together behind one contract? | responsibilities, public surface, state authority, extension points |

Use sibling skills for depth after the boundary is chosen:

- Code inside a module: units, variant families, dependencies, async lifetime, errors, refactoring, collaboration patterns → `development`
- API protocol and wire contracts → `api-design`
- Schema, indexes, migrations, and query plans → `database`
- Service wiring, middleware, request pipelines, and runtime lifecycle → `backend`
- Concrete resilience mechanisms and SLO practice → `reliability`
- Threat modeling and security controls → `security`
- Runtime-specific implementation idioms → language and framework skills
- Deployment and delivery mechanics → `ci-cd` and `release-engineering`
- Documentation conventions, placement, and docs-as-code mechanics → `documentation` (architecture owns whether to record a decision, its technical content, and rationale)

A change inside one module's settled contract needs `development`, not this skill. New modules or services, a changed contract between modules, a moved state owner, a cross-cutting mechanism, or recurring failures across modules need this skill.

## Flow selection

When invoked with an argument, `design` or `review` selects the workflow and the remaining text is the target; `critique` routes to the `development` workflow for one change. Otherwise pick the route from the intent.

| Intent | Route |
|---|---|
| `design` — new system, subsystem, or module family; redesign or migration | [design.md](workflows/design.md) |
| `review` — evaluate an architecture, codebase, or proposal; turn an issue inventory into causes and a target model | [review.md](workflows/review.md) |
| `critique` — one merge request, diff, or proposed fix | `development` [critique.md](../development/workflows/critique.md) |
| Add a feature or fix inside a module; refactor; extend a family of variants | `development` |
| Many problems, recurring bugs, a growing list of findings | [root-cause-analysis.md](references/root-cause-analysis.md) |
| Focused decision or module-boundary sketch | the design loop below; return a brief |
| Define module boundaries, a core, state ownership, dependency direction | [module-design.md](references/module-design.md) |
| Choose a system or application style: monolith, modular, hexagonal, host with modules, services, events | [architecture-patterns.md](references/architecture-patterns.md) |
| Reason about state, scale, consistency, failure, and compatibility across a system | [system-design.md](references/system-design.md) |
| Coordinate state and messages across owners: repository, saga, outbox, CQRS | [integration-patterns.md](references/integration-patterns.md) |
| Select or draw architecture views | [architecture-views.md](references/architecture-views.md) |
| Turn an agreed architecture into a polished responsive HTML explorer | finish the model and views, then combine with `playground` |
| Record a consequential decision or keep a decision log | [adr-template.md](references/adr-template.md) |
| Assess health, technical debt, fitness checks, or a migration strategy | [engineering-health.md](references/engineering-health.md) |

Read only the references the active forces need. Do not load the catalog by default.

## Design loop

For a decision that does not justify a full workflow, preserve this sequence:

```text
Goal and constraints
  -> symptoms, scenarios, and evidence
  -> causes and residual cases
  -> invariants, state, and variation
  -> responsibilities and boundaries
  -> contracts and dependency direction
  -> composition and pattern choices with costs
  -> scenario and change simulation
  -> delivery and verification when relevant
```

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

## Pattern selection

Use the problem as the selection key. Collaboration patterns inside a module — decorator, strategy, factory, state machine, pipeline, command, in-process events — are in `development`.

| Problem signal | Candidate | Avoid when |
|---|---|---|
| an external model or neighbouring context must not leak into the core | Anticorruption layer at the context boundary (in-module adapters: `development`) | mapping adds no semantic isolation |
| many modules need one stable entry point into a subsystem | Subsystem facade (in-module facades: `development`) | it becomes an ownerless god API |
| the domain needs a collection-like persistence boundary | Repository and unit of work | it only mirrors generic CRUD or leaks storage queries |
| a long-running process crosses owners | Saga or process manager | one local transaction can preserve the invariant |
| state update and message publication must agree | Transactional outbox | best-effort notification is sufficient |
| independent modules react to a completed fact | Domain events between modules (in-process observers: `development`) | the producer needs their synchronous result |
| reads and writes have materially different models | Separate query model | one model serves both; full CQRS only when its cost is justified |

Depth: [integration-patterns.md](references/integration-patterns.md) and [architecture-patterns.md](references/architecture-patterns.md).

## Output contract

Default to a five-minute **brief**; use **design** mode when several coupled decisions must guide implementation, and **dossier** mode only for an explicitly requested exhaustive record. Complexity, reviewer count, and reasoning effort do not select a longer mode. [design.md](workflows/design.md) defines the modes.

A design result is legible and actionable through:

1. **Decision and scope** — what is being decided, current and target status, constraints, and open questions with the decision each would change.
2. **Change axes** — what is expected to change, how often, and which modules each change may touch; for each family of variants, whether it is open or closed and why.
3. **Coherent model** — the few capabilities, invariants, owners, and boundaries that explain the decision.
4. **Contract sketch** — the few interfaces, signatures, or pseudo-code fragments that make the boundaries concrete: real names, who calls whom, who owns what. An implementer should be able to start from it. Full API or schema specifications belong to sibling skills.
5. **Visible structure** — one compact structural view; one more dynamic or risk view only when it exposes a different consequential fact.
6. **Consequences** — the selected approach, the important rejected alternative, cost, risk, and the next verification or delivery step.

These are acceptance criteria, not mandatory headings. A bounded question may need only a short decision and rationale. Scenario matrices, ownership catalogs, decision records, rollout plans, and fitness suites are conditional supporting artifacts — include or link them only when the decision needs them.

Lead with the conclusion, then only the rationale needed to trust it. No filler: structure, diagrams, and code fragments carry the content. Architecture draws compact diagrams itself — diagram-as-code following `diagrams` conventions, text, or host-native. Before delivery, check: can the reader recover the decision, boundaries, owners, and main tradeoff in five minutes?

## Context adaptation

**New product:** keep deployment topology simple while making domain and module boundaries explicit. Defer distributed mechanisms until a measured force requires them.

**Existing system:** derive the real architecture from code, runtime configuration, data ownership, and call paths.

**Cross-cutting feature:** inspect all consumers first. Separate the stable operation from independently varying policies such as retries, logging, caching, authorization, or metrics.

**Legacy redesign:** identify seams around behavior that can be characterized, place compatibility adapters at the edge, and migrate one reversible path at a time.

**Library, core, or platform:** optimize for a small stable public contract, explicit lifecycle, composability, replaceable defaults, compatibility, and misuse resistance rather than application-specific convenience.

## Anti-patterns

Thinking:

- **Scenario-by-scenario design** — one branch, handler, flag, or task per case with no shared model.
- **Solution-shaped clustering** — grouping symptoms because one favored pattern could address them ([root-cause-analysis.md](references/root-cause-analysis.md#testing-a-cluster)).
- **Pattern shopping** — selecting a named pattern before identifying the pressure it resolves.
- **Task-list architecture** — an implementation backlog substitutes for a coherent model and contracts.

Structure:

- **Scattered concrete policy** — rules that change independently are repeated in modules that consume them, so one extension edits several modules.
- **Shared-state ambiguity** — several components write the same state or enforce the same invariant without an authority model; the same state copied into every consumer.
- **Leaky core** — policy depends directly on transport, storage, framework, or vendor types.
- **Noun-first decomposition** — turning every domain noun or screen into a module or service without change-boundary evidence.
- **Premature platform** — a generic plugin or configuration system for one concrete use case.
- **Distributed monolith** — network boundaries without independent ownership, data, release, or failure isolation.

Change:

- **Contract frozen on placeholders** — freezing a contract exercised only by stub implementations while a known requirement changes its identity, cardinality, or lifetime.
- **Big-bang purity rewrite** — improvement with no compatibility path, checkpoints, or rollback.

Communication:

- **Invented vocabulary** — coined names for mechanisms where a known term exists; one word carrying several meanings.
- **Overlay documents** — stacking "this file wins" corrections instead of updating one canonical statement.

## Related Knowledge

- `development` — the practice inside a module: units, variant families, dependencies, async lifetime, errors, refactoring
- `grill-me` — settle requirements and open decisions with the user before designing
- `diagrams` — notation, source, and compilation for the views this skill selects
- `playground` — turns an agreed architecture model and its views into a polished responsive HTML explorer
- `api-design` — protocol and compatibility design for exposed contracts
- `database` — physical schema, constraints, isolation, indexes, migrations, and query realization; architecture retains semantic state authority and invariant boundaries
- `reliability` — failure handling, SLOs, and recovery
- `performance` — evidence-driven capacity and latency work
- `security` — trust boundaries and threat-driven controls
- `testing` — contract, integration, property, and architecture fitness tests
- `observability` — signals that validate runtime assumptions
- `release-engineering` — safe migration and rollout strategies
- `documentation` — turning an agreed design into maintained project documentation

## References

Workflows:

- [design.md](workflows/design.md) — design and redesign: scope, inspect, draft, ask, prove, brief
- [review.md](workflows/review.md) — evidence-based architecture review; issue inventory to causes and target model

Judgment:

- [root-cause-analysis.md](references/root-cause-analysis.md) — from many symptoms to few causes

By scale:

- [system-design.md](references/system-design.md) — state, flow, scale, failure, and compatibility across a system
- [architecture-patterns.md](references/architecture-patterns.md) — system and application styles with forces and costs
- [module-design.md](references/module-design.md) — core, boundaries, contracts, state ownership, dependency direction
- [integration-patterns.md](references/integration-patterns.md) — repository and unit of work, saga, transactional outbox, CQRS

Outputs and health:

- [architecture-views.md](references/architecture-views.md) — view selection, direct diagramming, and the optional playground handoff
- [adr-template.md](references/adr-template.md) — decision records and the decision log
- [engineering-health.md](references/engineering-health.md) — health signals, technical debt, fitness functions, migration strategies
