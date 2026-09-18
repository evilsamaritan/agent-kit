---
name: architecture
description: "Design, evaluate, and evolve software structure at every scale — system, module, and code: boundaries, contracts, ownership, state, composition, extensibility. Use when designing or redesigning a system or module, adding a feature to existing code without bolting it on, refactoring for maintainability, finding the shared root cause behind recurring bugs, reviewing an architecture, checking whether a merge request or fix treats the cause or only patches a symptom, or applying SOLID and design patterns. Do NOT use for a polished web explainer of an agreed design (use visualization), trivial edits inside a settled design, detailed API/schema design, or CI/CD."
argument-hint: "[design|review|critique] [target]"
---

# Software Design and Architecture

Treat design as one continuous problem from system topology down to the code inside a function. The same judgment applies whether the task is a new design, a feature added to existing code, a refactor, a search for root causes, or a critique of someone's change. Workflows exist for the frequent flows; everywhere else apply the core judgment directly. Work from whatever exists: no particular project file, document format, or process is required.

## Core judgment

### 1. See the whole before the part

Scenarios, bug reports, review findings, and feature requests are evidence, not the work list. Before proposing components, fixes, or tasks, reduce them to the few operations, policies, states, invariants, and failure modes they share.

- **Problems:** symptoms -> a missing owner, an unenforced invariant, a leaky boundary, duplicated knowledge, or a variation point that must be edited for every case. Merge symptoms into one cause only when it survives the counterfactual — *if this cause were fixed, which symptoms disappear and which remain?* — and keep the residual cases. A list of findings is input to analysis, never a to-do list: correct each cause once at its owner, then account for every item. Method: [root-cause-analysis.md](references/root-cause-analysis.md).
- **A feature:** read the structure that exists and name the structure the feature wants before writing the first line.
- **A design:** a hundred cases usually reduce to a few operations, policies, states, and failure modes. The scenario list is never the component list or the task list.

### 2. Extend by adding, not by editing

Prefer a small core with a narrow contract. Add behavior by composition — plain functions, decorators or middleware, strategies, events, dependencies passed in. Ship conveniences as defaults built on the same public contract, so a consumer can replace them or throw them away. A *seam* is a place where behavior can be added or replaced without editing the code around it.

| Test | Open | Closed |
|---|---|---|
| Add a behavior | compose a new piece; the core is untouched | edit the core, a switch, a factory, or a flag list |
| Replace a default | from outside, through the public contract | fork, patch, or ask the owner |
| Explain it | well-known pattern names and the project's own words | coined vocabulary and a private framework |
| Weigh it | simpler than the sum of the cases it replaces | more machinery than the cases it serves |

Openness is a property of structure, not size: one function parameter is a seam; a plugin registry with one plugin is ceremony. Buy the cheapest seam that works — a parameter, then a passed-in function, then a small contract, then a composition mechanism — and only for variation that exists or is committed. Contrast pairs: [composable-design.md](references/composable-design.md).

### 3. Give everything one owner behind a contract

- Things that change together live together. Different owners, invariants, lifecycles, trust, or scaling needs may need a boundary.
- Every invariant and mutable state has one authority and one write path, or an explicit coordination model. A copy of a rule, a type, or a piece of state in every consumer is an ownership defect, not a style issue.
- Separate policy from mechanism: decisions stay independent of transport, persistence, frameworks, and vendors unless those are the actual constraint.
- Name the contract before the internals: responsibility, inputs, outputs, errors, state ownership, ordering, lifecycle, compatibility.

### 4. Restructure in proportion

Adding or fixing something in existing code is a design decision. Direct embedding is one option, never the default. Weigh what the direct change costs now *and adds to every later change* — another copy, branch, writer, or special case — against what restructuring costs and how reversible it is.

| Situation | Response |
|---|---|
| The change fits an existing seam and owner | Make it. No ceremony. |
| It needs local restructuring inside the touched module, behavior preserved | Restructure first as a separate step, then add the change. Report both. |
| It alters another module's contract, a boundary, state ownership, or is hard to reverse | Stop. Present two or three options — direct, local restructuring, wider redesign — with cost now, cost later, and reversibility. Recommend one. |
| It is the second fix of the same kind | Stop patching. Find the shared cause first. |

Never restructure for taste: restructuring must remove a named cost. Judgment and examples: [change-integration.md](references/change-integration.md).

## Critical rules

1. **Evidence before redesign.** Inspect code, runtime configuration, and call paths first. Label facts, assumptions, unknowns, and decisions. Documentation is a hypothesis until executable evidence confirms it; its absence is never a blocker.
2. **Patterns only for named forces.** Every abstraction states the variation, coupling, failure, or lifecycle problem it solves and the complexity it adds. Plain functions and direct calls win when nothing varies independently.
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
| Collaboration | How should variable behavior compose? | direct call, pipeline, decorator, strategy, state machine, events |
| Code | What does this unit own, and what is passed in? | cohesion of a function or file, explicit dependencies, state versus pure logic, composition instead of flags |

Use sibling skills for depth after the boundary is chosen:

- API protocol and wire contracts → `api-design`
- Schema, indexes, migrations, and query plans → `database`
- Service wiring, middleware, request pipelines, and runtime lifecycle → `backend`
- Concrete resilience mechanisms and SLO practice → `reliability`
- Threat modeling and security controls → `security`
- Runtime-specific implementation idioms → language and framework skills
- Deployment and delivery mechanics → `ci-cd` and `release-engineering`
- Documentation conventions, placement, and docs-as-code mechanics → `documentation` (architecture owns whether to record a decision, its technical content, and rationale)

A trivial edit inside a settled design does not need this skill. New behavior in existing structure, cross-cutting changes, shared mechanisms, state ownership changes, recurring fixes, and refactors do.

## Flow selection

When invoked with an argument, `design`, `review`, or `critique` selects the workflow and the remaining text is the target. Otherwise pick the route from the intent.

| Intent | Route |
|---|---|
| `design` — new system, subsystem, or module family; redesign or migration | [design.md](workflows/design.md) |
| `review` — evaluate an architecture, codebase, or proposal; turn an issue inventory into causes and a target model | [review.md](workflows/review.md) |
| `critique` — one merge request, diff, or proposed fix: cause or symptom, integrated or bolted on, what would be better | [critique.md](workflows/critique.md) |
| Add a feature or fix to existing code; port code from elsewhere | core judgment + [change-integration.md](references/change-integration.md) |
| Many problems, recurring bugs, a growing list of findings | [root-cause-analysis.md](references/root-cause-analysis.md) |
| Make something extensible; design a core or library API; replace flags, switches, or factories | [composable-design.md](references/composable-design.md) |
| Write or refactor code inside a module: tangled functions, mixed responsibilities, hidden dependencies | [code-design.md](references/code-design.md) |
| Focused decision or module-boundary sketch | the design loop below; return a brief |
| Define module boundaries, a core, state ownership, dependency direction | [module-design.md](references/module-design.md) |
| Choose a system or application style: monolith, modular, hexagonal, host with modules, services, events | [architecture-patterns.md](references/architecture-patterns.md) |
| Reason about state, scale, consistency, failure, and compatibility across a system | [system-design.md](references/system-design.md) |
| Weigh SOLID, DRY, YAGNI, and coupling tradeoffs | [design-principles.md](references/design-principles.md) |
| Depth on one collaboration pattern | [design-patterns.md](references/design-patterns.md) |
| Select or draw architecture views | [architecture-views.md](references/architecture-views.md) |
| Turn an agreed architecture into a polished responsive HTML explorer | finish the model and views, then combine with `visualization` |
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

Use the problem as the selection key. Depth for each candidate: [design-patterns.md](references/design-patterns.md).

| Problem signal | Candidate | Avoid when |
|---|---|---|
| orthogonal behavior wraps one operation | Decorator or middleware | order and shared context dominate; use an explicit pipeline |
| an algorithm or policy varies by context | Strategy or passed-in function | there is one stable behavior |
| an external model must not leak into the core | Adapter or anticorruption layer | mapping adds no semantic isolation |
| many callers need one stable entry point | Facade | it becomes an ownerless god API |
| construction depends on runtime composition | Factory at the composition root | callers can construct one concrete value directly |
| valid behavior depends on explicit lifecycle state | State machine | states are merely display labels |
| ordered independent stages transform work | Pipeline | stages secretly share mutable internals |
| one of several handlers may accept work | Chain of responsibility | all handlers must run, or order is fixed business policy |
| an operation must be queued, retried, or audited | Command | a direct call expresses the behavior fully |
| independent consumers react to a completed fact | Domain event or observer | the producer needs their synchronous result |
| the domain needs a collection-like persistence boundary | Repository | it only mirrors generic CRUD or leaks storage queries |
| rules need semantic composition | Specification | simple conditions are clearer inline |
| a long-running process crosses owners | Saga or process manager | one local transaction can preserve the invariant |
| state update and message publication must agree | Transactional outbox | best-effort notification is sufficient |
| reads and writes have materially different models | Separate query model | one model serves both; full CQRS only when its cost is justified |

Composition is the default way to add orthogonal behavior. Inheritance fits only a genuinely substitutable hierarchy with stable variation.

## Output contract

Default to a five-minute **brief**; use **design** mode when several coupled decisions must guide implementation, and **dossier** mode only for an explicitly requested exhaustive record. Complexity, reviewer count, and reasoning effort do not select a longer mode. [design.md](workflows/design.md) defines the modes.

A design result is legible and actionable through:

1. **Decision and scope** — what is being decided, current and target status, constraints, and open questions with the decision each would change.
2. **Coherent model** — the few capabilities, invariants, owners, and boundaries that explain the decision.
3. **Contract sketch** — the few interfaces, signatures, or pseudo-code fragments that make the boundaries concrete: real names, who calls whom, who owns what. An implementer should be able to start from it. Full API or schema specifications belong to sibling skills.
4. **Visible structure** — one compact structural view; one more dynamic or risk view only when it exposes a different consequential fact.
5. **Consequences** — the selected approach, the important rejected alternative, cost, risk, and the next verification or delivery step.

These are acceptance criteria, not mandatory headings. A bounded question may need only a short decision and rationale. Scenario matrices, ownership catalogs, decision records, rollout plans, and fitness suites are conditional supporting artifacts — include or link them only when the decision needs them.

Lead with the conclusion, then only the rationale needed to trust it. No filler: structure, diagrams, and code fragments carry the content. Architecture draws compact diagrams itself — diagram-as-code, text, or host-native. Before delivery, check: can the reader recover the decision, boundaries, owners, and main tradeoff in five minutes?

## Delegating design-sensitive work

An agent that has not seen the model will bolt its change on. When delegating implementation or review that touches boundaries, owners, or shared mechanisms, pass the relevant owners, contracts, and the proportion table in the task, or tell the agent to load this skill. For an independent architecture critic on a change, run [critique.md](workflows/critique.md) in a separate agent and treat its alternatives as options to weigh, not orders.

## Context adaptation

**New product:** keep deployment topology simple while making domain and module boundaries explicit. Defer distributed mechanisms until a measured force requires them.

**Existing system:** derive the real architecture from code, runtime configuration, data ownership, and call paths.

**Feature in existing code:** find the owner and the seam first. If neither exists, that is the finding; apply the proportion table before writing.

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

- **Edit-to-extend** — a factory, switch, flag set, or bundled API that must be edited for every new case and cannot be replaced from outside.
- **God function or file** — one unit owns every step, mixing state, policy, and mechanism.
- **Shared-state ambiguity** — several components write the same state or enforce the same invariant without an authority model; the same state copied into every consumer.
- **Leaky core** — policy depends directly on transport, storage, framework, or vendor types.
- **False DRY** — merging coincidentally similar code that represents different knowledge.
- **Noun-first decomposition** — turning every domain noun or screen into a module or service without change-boundary evidence.
- **Premature platform** — a generic plugin or configuration system for one concrete use case.
- **Distributed monolith** — network boundaries without independent ownership, data, release, or failure isolation.

Change:

- **Bolt-on change** — attaching a feature or fix to whatever exists without asking what structure it wants or what it costs the next change.
- **Restructuring for taste** — restructuring that removes no named cost.
- **Contract frozen on placeholders** — freezing a contract exercised only by stub implementations while a known requirement changes its identity, cardinality, or lifetime.
- **Big-bang purity rewrite** — improvement with no compatibility path, checkpoints, or rollback.

Communication:

- **Invented vocabulary** — coined names for mechanisms where a known term exists; one word carrying several meanings.
- **Overlay documents** — stacking "this file wins" corrections instead of updating one canonical statement.

## Related Knowledge

- `visualization` — turns an agreed architecture model and its views into a polished responsive HTML explorer
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
- [critique.md](workflows/critique.md) — architecture critic for one merge request, diff, or proposed fix

Judgment across scales:

- [root-cause-analysis.md](references/root-cause-analysis.md) — from many symptoms to few causes
- [change-integration.md](references/change-integration.md) — fitting a feature or fix into existing code; proportion; signs of a workaround
- [composable-design.md](references/composable-design.md) — open versus closed structure, contrast pairs, extension points
- [design-principles.md](references/design-principles.md) — principles as tradeoffs rather than slogans
- [design-patterns.md](references/design-patterns.md) — depth per collaboration pattern

By scale:

- [system-design.md](references/system-design.md) — state, flow, scale, failure, and compatibility across a system
- [architecture-patterns.md](references/architecture-patterns.md) — system and application styles with forces and costs
- [module-design.md](references/module-design.md) — core, boundaries, contracts, state ownership, dependency direction
- [code-design.md](references/code-design.md) — structure inside a module: units, dependencies, conditionals, names

Outputs and health:

- [architecture-views.md](references/architecture-views.md) — view selection, direct diagramming, and the optional visualization handoff
- [adr-template.md](references/adr-template.md) — decision records and the decision log
- [engineering-health.md](references/engineering-health.md) — health signals, technical debt, fitness functions, migration strategies
