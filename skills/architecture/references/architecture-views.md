# Architecture View Selection

Use this reference to choose which views of an architecture to draw, to draw them directly in the design document, and to hand an agreed view set to the `visualization` skill when a separate web explorer is required. Architecture owns the model and its concise diagrams; a diagram is part of the design, not decoration and not a handoff stub.

## Contents

- [Choose a view by question](#choose-a-view-by-question)
- [Minimal view set](#minimal-view-set)
- [C4 zoom levels](#c4-zoom-levels)
- [Module and dependency views](#module-and-dependency-views)
- [Dynamic and risk views](#dynamic-and-risk-views)
- [Current, target, and transition](#current-target-and-transition)
- [Drawing views directly](#drawing-views-directly)
- [View contract](#view-contract)
- [Handoff to the visualization skill](#handoff-to-the-visualization-skill)
- [Further reading](#further-reading)

## Choose a view by question

| Question the reader must answer | View | Useful projections |
|---|---|---|
| Who uses the system and what is outside it? | System | system context or landscape |
| What major runtime or logical units exist, and what is each responsible for? | Structure | container, module, or capability map |
| How is one significant subsystem partitioned, and which parts depend on which contracts? | Internal | component, package, layer, or directed dependency view |
| How does one risky scenario cross boundaries over time? | Runtime | sequence, request, event, or failure flow |
| Which states and transitions are valid? Where does data originate, move, replicate, and cross trust boundaries? | Data & State | state machine, authority map, data flow, ERD |
| Where do runtime units execute and fail independently? | Deployment | deployment, network, or trust-boundary view |
| What changes from the current to the target architecture? | Evolution | paired current/target views, transition map, or timeline |

Do not choose a class diagram or code excerpt merely because the design involves code. Use a type-relationship view only when that relationship is architecturally consequential. Code and diff views are focused evidence, not a substitute for a missing model.

## Minimal view set

Most non-trivial decisions need only:

1. **One static map** — System or Structure for a system decision; Structure or Internal for an application decision.
2. **One dynamic view** — the most important or risky scenario crossing those boundaries.
3. **One risk-specific view** — Data & State, Deployment, or Evolution only when that dimension drives an additional decision. In a brief this normally replaces the dynamic view rather than joining it.

A brief carries one or two views. Design mode may carry three primary views. Anything beyond three needs an explicitly requested reference deliverable; otherwise demote the extra views to supporting material behind a short entry point.

Add a view when it answers a different consequential question. Remove it when it repeats names or a takeaway already clear from another view or the text.

## C4 zoom levels

C4 provides a notation-independent hierarchy for static structure:

| Level | Scope | Use when |
|---|---|---|
| System context | one system, users, neighboring systems | establishing scope, actors, and external dependencies |
| Container | applications, processes, and data stores inside the system | explaining runtime responsibilities and communication |
| Component | cohesive components inside one container | internal responsibility boundaries are consequential and not obvious from code |
| Code | classes or types inside one component | the type structure itself is the decision |

In C4 a container is a running application or data store, not necessarily an operating-system container. Components execute inside a container and are not independently deployable.

Start with context. Add a container view for runtime architecture. Add component or code views only where the extra zoom changes understanding; do not generate every level for completeness.

## Module and dependency views

Use a **module map** to show conceptual responsibilities, state authority, and contracts. Use a **dependency graph** to show actual import, build, or runtime dependencies. Label which relationship the arrows represent.

For each module include a stable name and type, the one responsibility or invariant it owns, its enclosing boundary, its public contract where that matters, and its status: current, proposed, transitional, or retiring.

For each important dependency include direction and intent: `calls`, `implements`, `publishes`, `reads`, `adapts`. Generated dependency graphs are evidence; filter them to the decision under review instead of presenting every package.

## Dynamic and risk views

| View | Use when | Show |
|---|---|---|
| sequence/dynamic | order, waits, retries, ownership crossing, or failure motivates the design | decision-relevant participants, messages, the alternative or failure path |
| state | lifecycle validity or concurrency depends on explicit transitions | states, triggers, guards, terminal and recovery paths |
| data/authority | consistency, privacy, trust, or retention drives boundaries | sources of truth, writers, transformations, replicas, trust crossings |
| deployment | placement changes latency, availability, scaling, residency, or blast radius | execution nodes, replicas, stores, routing, failure isolation |

Do not turn a sequence into a trace dump, a state model into every Boolean combination, a data-flow view into an ERD, or a deployment view into a cloud-resource inventory.

## Current, target, and transition

When migration is consequential, use separate views:

1. **Current** — executable reality and current authority.
2. **Target** — intended steady state.
3. **Transition** — temporary adapters, routes, dual reads or writes, shadowing, or authority transfer for one phase.

Keep identities, terminology, scope, and relative placement stable across them. Label the phase and the moment authority changes.

## Drawing views directly

Draw the selected views in the design document with maintainable Mermaid, text, or a host-native diagram.

- Keep standard topology as Mermaid when flowchart, sequence, state, or ER grammar expresses the view accurately: the design document then has a readable, diffable source.
- Use stable node IDs and label every relationship with its intent and direction.
- Arrange the diagram so arrows follow one dominant direction; a view whose arrows must cross repeatedly is usually two views.
- Do not force non-topological content into Mermaid. Containment-only ownership, timelines, comparison matrices, and quantitative charts need a table, a text tree, or their own renderer.
- Put a one-sentence takeaway next to each diagram. Do not replace the diagram with prose.
- When a view will be handed to `visualization`, that skill documents an optional semantic class vocabulary for Mermaid flowcharts. Categories are presentation metadata, not architecture; relationship labels and directions stay authoritative.

## View contract

Every architecture view states:

- the question it answers and its audience;
- scope and abstraction level;
- current, target, or transition status;
- element names, types, and short responsibilities;
- relationship direction and intent;
- relevant boundary or authority semantics;
- which content is repository evidence, inference, proposal, or unknown;
- a one-sentence takeaway;
- its priority: primary, supporting, or appendix.

## Handoff to the visualization skill

The `visualization` skill is optional. Combine it only when the agreed model must become a polished responsive HTML explorer with themes, navigation, progressive disclosure, and browser-level render checks. It renders; it must not reinterpret boundaries or invent relationships. Architecture still edits the view set first: merge views with duplicate questions or takeaways, and move evidence inventories out of the primary navigation.

```text
Need to explain an architecture relationship?
├── one or a few maintainable diagrams inside the design document
│   └── architecture selects and draws them directly
└── a separate responsive web explorer
    └── architecture fixes the view contract; visualization renders and verifies it
```

The handoff is a semantic contract, not pixel coordinates; the HTML layer may recompose a view for narrow widths as long as the facts stay the same. Give each selected view in this form:

```markdown
## View: module-dependencies

- Question: Which modules depend on the environment contract?
- Audience: implementation team
- Scope / level: client application / Internal
- Status / priority: target / primary
- Takeaway: game modules depend on one stable environment contract

### Entities
| ID | Name | Type | Responsibility | Boundary or authority | Evidence status |
|---|---|---|---|---|---|

### Relationships
| Source | Kind | Target | Label | Status | Order or cardinality |
|---|---|---|---|---|---|

- Canonical source: Mermaid block, render model, or exact source link
- Compact projection: equivalent direction/layout or relationship-list rule
- Textual equivalent: concise statement of the essential entities and relationships
```

Omit empty optional columns, but keep stable IDs, direction, status, and evidence explicit. Presentation choices — shell, themes, renderer, semantic color classes — belong to the `visualization` skill.

## Further reading

- [C4 model diagrams](https://c4model.com/diagrams) — zoom levels and supporting dynamic/deployment views
- [C4 notation guidance](https://c4model.com/diagrams/notation) — titles, scope, descriptions, legends, and relationships
- [C4 diagram review checklist](https://c4model.com/diagrams/checklist) — standalone comprehensibility checks
