# Architecture View Selection

## Contents

- [Boundary with visualization](#boundary-with-visualization)
- [Direct diagram or visualization handoff](#direct-diagram-or-visualization-handoff)
- [Choose a view by architecture question](#choose-a-view-by-architecture-question)
- [Minimal architecture set](#minimal-architecture-set)
- [C4 zoom levels](#c4-zoom-levels)
- [Module and dependency views](#module-and-dependency-views)
- [Dynamic and risk views](#dynamic-and-risk-views)
- [Current, target, and transition](#current-target-and-transition)
- [Architecture view contract](#architecture-view-contract)
- [Further reading](#further-reading)

## Boundary with visualization

This reference chooses and draws projections of an architecture model. Architecture owns both the model and the concise diagrams used to explain it. Use maintainable Mermaid, text, or a host-native diagram when that is sufficient.

Architecture owns:

- which system, runtime, module, contract, state, or migration question matters;
- the authoritative entities, boundaries, relationships, status, and evidence;
- the abstraction levels that need separate views;
- the guarantees and tradeoffs the visual must expose.

The separate `visualization` skill is optional. Combine it only when the agreed model must become a polished responsive HTML or Playground-style explorer with shared themes, navigation, progressive disclosure, code/diff presentation, and browser-level render QA. It must not reinterpret boundaries or invent relationships. Architecture must still prioritize the view set; the renderer is not responsible for turning an unedited design inventory into a coherent story.

Architecture selects from seven questions and chooses the concrete projection:

| Architecture view | Architecture owns | Useful projections |
|---|---|---|
| System | scope, actors, neighboring systems | system context or landscape |
| Structure | major runtime/logical units and responsibilities | container, module, or capability map |
| Internal | one architecturally significant subsystem | component, package, layer, or dependency view |
| Runtime | consequential collaboration over time | sequence, request, event, or failure flow |
| Data & State | ownership, relationships, movement, consistency, lifecycle | ERD, authority map, data flow, or state machine |
| Deployment | execution placement and operational boundaries | deployment, network, or trust-boundary view |
| Evolution | current, target, and transitional guarantees | paired views, transition map, or timeline |

Do not generate every view by default. A brief normally has one structural view and, when necessary, one dynamic or risk-specific view. A third primary view must expose a separate consequential decision. Larger atlases belong to an explicitly requested reference deliverable and still need a short executive entry point.

## Direct diagram or visualization handoff

```text
Need to explain an architecture relationship?
├── One or a few maintainable diagrams inside the design document
│   └── architecture selects and draws them directly
└── A separate responsive web explorer or polished interactive artifact
    └── architecture freezes the view contract; visualization renders and verifies it
```

For an HTML handoff, provide the visualization skill with:

- the question, audience, scope, and current/proposed/transition status;
- authoritative nodes, boundaries, relationships, direction, and labels;
- one takeaway and the unique job of each view;
- priority: primary, supporting, or appendix;
- facts versus inferences, proposals, and unknowns;
- a compact alternative when a dense topology cannot reflow without changing meaning.

The handoff is a semantic contract, not pixel coordinates. Architecture may suggest a projection, but the HTML layer may recompose it for compact widths while preserving the same facts. Before handoff, merge views with duplicate questions or takeaways and move evidence inventories out of the primary navigation.

## Choose a view by architecture question

```text
Who uses the system and what is outside it?
  -> system context view

What applications, processes, and stores make it run?
  -> runtime/container view

How is one application partitioned into cohesive responsibilities?
  -> module/component boundary map

Which modules or packages depend on which contracts?
  -> directed dependency graph

How does one risky scenario cross boundaries over time?
  -> sequence/dynamic view

What lifecycle states and transitions are valid?
  -> state diagram

Where does data originate, move, replicate, and cross trust boundaries?
  -> data-flow and authority view

Where do runtime units execute and fail independently?
  -> deployment view

What changes from current to target architecture?
  -> separate current and target views plus a transition view if needed
```

Do not choose a class diagram or code excerpt merely because the design involves code. Use a type relationship view only when that relationship is architecturally consequential. Use code or diff views as focused evidence, not as a substitute for the missing model.

## Minimal architecture set

Most non-trivial decisions need only:

1. **One static map** — context/container for a system decision or module/dependency map for an application decision.
2. **One dynamic view** — the most important or risky scenario crossing those boundaries.
3. **One risk-specific view** — state, data/trust, deployment, or migration only when that dimension drives an additional decision; in a brief, this normally replaces rather than supplements the dynamic view.

For a small module refactor, a module map plus one sequence may be enough. For a distributed stateful system, context, runtime, sequence, and state/data views may all earn their place.

Add a view when it answers a different consequential question. Remove it when it repeats names or a takeaway already clear in another view or text. Navigation and progressive disclosure organize justified views; they do not justify creating more.

## C4 zoom levels

C4 provides a notation-independent hierarchy for static software structure:

| Level | Scope | Use when |
|---|---|---|
| System context | one system, users, neighboring systems | establish scope, actors, and external dependencies |
| Container | applications/processes/data stores inside the system | explain runtime responsibilities and communication |
| Component | cohesive components inside one container | internal responsibility boundaries are consequential and not obvious from code |
| Code | classes/types inside one component | type structure itself is the decision |

In C4, a container is a running application or data store, not necessarily an operating-system container. Components execute inside a container and are not independently deployable by definition.

Start with context. Add a container view for runtime architecture. Add component or code views only where extra zoom changes understanding; do not generate every level for completeness.

## Module and dependency views

Use a **module map** to show conceptual responsibilities, state authority, and contracts. Use a **dependency graph** to show actual import, build, or runtime dependencies. Label which relationship the arrows represent.

For each module, include:

- stable name and type;
- one responsibility or invariant owned;
- enclosing application/domain boundary;
- public contract where it matters;
- current, proposed, transitional, or retiring status.

For each important dependency, include direction and intent such as `calls`, `implements`, `publishes`, `reads`, or `adapts`. Generated dependency graphs are evidence; filter them to the decision under review instead of presenting every package.

## Dynamic and risk views

Choose only the dimension that exposes the architectural force:

| View | Use when | Show |
|---|---|---|
| sequence/dynamic | order, waits, retries, ownership crossing, or failure motivates the design | decision-relevant participants, messages, alternative/failure path |
| state | lifecycle validity or concurrency depends on explicit transitions | states, triggers, guards, terminal/recovery paths |
| data/authority | consistency, privacy, trust, or retention drives boundaries | sources of truth, writers, transformations, replicas, trust crossings |
| deployment | placement changes latency, availability, scaling, residency, or blast radius | execution nodes, replicas, stores, routing, failure isolation |

Do not turn a sequence into a trace dump, a state model into every Boolean combination, a data-flow view into an ERD, or a deployment view into a cloud-resource inventory.

## Current, target, and transition

Prefer three explicit projections when migration is consequential:

1. **Current** — executable reality and current authority.
2. **Target** — intended steady state.
3. **Transition** — temporary adapters, routes, dual reads/writes, shadowing, or authority transfer for one phase.

Keep identities, terminology, scope, and relative placement stable when practical. Label the phase and the moment authority changes. Static documentation should use separate views; an interactive explorer may toggle projections over one shared model only when status remains unmistakable.

## Architecture view contract

Every architecture view should state:

- question and audience;
- scope and abstraction level;
- current, target, or transition status;
- element names, types, and short responsibilities;
- relationship direction and intent;
- relevant boundary or authority semantics;
- which content is repository evidence, inference, proposal, or unknown;
- one-sentence takeaway;
- primary, supporting, or appendix priority;
- link or proximity to the decision, contract, or evidence it explains.

For an explicitly requested multi-view architecture explorer, a useful progression is overview → selected structure/ownership detail → selected flow or risk → optional appendix views. Do not turn every design-document heading into navigation. That is document navigation, not a forced slide sequence.

## Further reading

- [C4 model diagrams](https://c4model.com/diagrams) — zoom levels and supporting dynamic/deployment views
- [C4 notation guidance](https://c4model.com/diagrams/notation) — titles, scope, descriptions, legends, and relationships
- [C4 diagram review checklist](https://c4model.com/diagrams/checklist) — standalone comprehensibility checks
