# Mermaid Rendering

Mermaid is the default renderer for diagrams with standard graph semantics: flowchart, sequence, state, ER. It lays out topology; it is not the page shell, the content model, a chart system, a code viewer, or a responsive layer. Which views use it is decided in the [view catalog](diagram-selection.md).

## Contents

- [Source contract](#source-contract)
- [Architecture input](#architecture-input)
- [Markup and loading](#markup-and-loading)
- [Relationship grammar in Mermaid](#relationship-grammar-in-mermaid)
- [Responsive behavior](#responsive-behavior)
- [Dependencies and durability](#dependencies-and-durability)
- [Escalation beyond Mermaid](#escalation-beyond-mermaid)
- [Failure modes](#failure-modes)

## Source contract

For every diagram:

- use stable IDs separate from display labels;
- include `accTitle` and `accDescr`; the contract check fails without them;
- label consequential edges with verbs;
- use subgraphs only for real containment, ownership, trust, or deployment scope;
- keep status words explicit rather than encoding them only through color;
- leave coordinates and connector routing to the layout engine;
- prefer broadly supported flowchart, sequence, state, and ER syntax; verify newer diagram types in the actual renderer;
- keep the Mermaid text as the source. Never hand-edit generated SVG; re-render after a model, theme, or layout change.

Flowchart nodes may carry one of six semantic classes when the category is part of the explanation: `external`, `system`, `interface`, `domain`, `data`, `risk`. The renderer maps them to the shared light/dark palette ([visual-system.md](visual-system.md#diagram-palette)); any other class name fails the check. Keep sequence, state, and ER diagrams neutral unless category color carries necessary meaning.

## Architecture input

When `architecture` supplies a Mermaid-compatible view, its Mermaid block is the canonical diagram source, and the surrounding architecture text owns the question, scope, status, names, direction, labels, and takeaway. This skill may apply theme variables, an equivalent layout direction, disclosure, or a compact projection. It must not add nodes, rename concepts, reverse relationships, or resolve an architectural contradiction; send those back to the owner.

## Markup and loading

```html
<html lang="en" data-viz-theme="auto" data-viz-mermaid-loading>
<head>
  <script>
    /* theme bootstrap from the shell, plus: */
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  </script>
  <noscript><style>[data-viz-mermaid-loading] .viz-content { visibility: visible; }</style></noscript>
</head>
…
<div class="viz-mermaid" data-viz-mermaid data-viz-compact-direction="TB">
  <script type="text/plain">
flowchart LR
  accTitle: Module boundary
  accDescr: The host creates the environment; modules depend on its ports.
  host[Host] -->|provides| ports[Environment ports]
  game[Game module] -->|depends on| ports
  class host system
  class game domain
  </script>
  <div class="viz-mermaid__output" data-viz-mermaid-output></div>
</div>
…
<script type="module" src="visualization-mermaid.js"></script>
```

The loading gate on `<html>` is required whenever Mermaid is present: the renderer lays out all diagrams, restores the requested hash once, then reveals the content. Without it, refresh and deep links visibly jump. The renderer re-renders on theme change and when a container crosses its compact breakpoint, and replaces a failed diagram with its `accDescr` text.

## Relationship grammar in Mermaid

The meanings come from [visual-language.md](visual-language.md#relationship-grammar); this is their Mermaid spelling.

| Meaning | Mermaid treatment |
|---|---|
| direct call, dependency, transition, or primary flow | solid directed link: `-->|verb|` |
| asynchronous event, reply, or indirect influence | dashed directed link: `-.->|verb|`, or the native dashed sequence reply |
| constraint, annotation, or non-flow association | dotted link without a strong arrow: `-.-|verb|` |
| failure or forbidden path | explicit failure verb or status plus a `risk` target or native failure branch; color is secondary |

Do not reuse a dashed arrow for both an event and a constraint in one artifact.

## Responsive behavior

Mermaid solves graph layout, not responsive meaning. In order of preference:

1. **Same source, compact direction.** `data-viz-compact-direction="TB"` re-renders the unchanged source top-to-bottom when the container is narrower than `data-viz-compact-at` (default 720). There is no second projection to keep in sync.
2. **Filter or aggregate** secondary nodes while keeping identities and status explicit.
3. **A separate compact projection** over the same model — a message list or relationship list — using `viz-responsive__wide` and `viz-responsive__compact` ([shell-components.md](shell-components.md#wide-and-compact-projections)).
4. **Labelled local scrolling** only when reflow would falsify topology.

The renderer fits a diagram to its container only while it is at most 18% wider, so 13px labels never fall below 11px, the smallest text size the visual system uses; anything wider keeps its natural size and scrolls inside its own region. Do not defeat this with a forced `width: 100%`.

A hand-written compact projection is unfinished until it has been compared with the Mermaid source edge by edge: source, target, kind, label, order or cardinality, status, and failure paths.

## Dependencies and durability

The provided renderer imports a pinned Mermaid build from a CDN, which suits connected local previews. For durable, offline, published, or production artifacts, vendor or bundle Mermaid through the consuming repository's build while keeping the same source and rendering contract. Essential content always has a textual equivalent, because network and renderer failure are valid states. When rendering tooling is unavailable, report syntax-only validation explicitly.

## Escalation beyond Mermaid

Add a specialized graph renderer only after a reproduced Mermaid limitation affects a required view: ports on specific node sides, incremental layout, coordinated selection across a large graph, manual layout constraints. Keep the same model and shell when escalating; do not introduce a second source of truth to gain a different renderer.

## Failure modes

- **Mermaid page model** — shell, prose, tables, and evidence are forced into diagram nodes.
- **Architecture by renderer** — supported syntax determines the system design.
- **Generated-SVG source** — edited SVG drifts from the diagram text.
- **CSS graph engine** — branching, routing, loops, or ports are rebuilt with borders and absolute positions.
- **Scaled mobile poster** — a correct desktop diagram becomes unreadable at compact width.
- **Duplicate truth** — desktop Mermaid and compact HTML describe independently maintained models.
- **Premature specialized engine** — a larger dependency is added before a concrete Mermaid limitation is reproduced.
