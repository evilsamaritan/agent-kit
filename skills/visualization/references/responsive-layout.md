# Responsive Diagram Composition

## Contents

- [Core principle](#core-principle)
- [Building blocks](#building-blocks)
- [Adapt by topology](#adapt-by-topology)
- [Compact-width strategy](#compact-width-strategy)
- [Implementation guidance](#implementation-guidance)
- [Validation viewports](#validation-viewports)
- [Failure modes](#failure-modes)

## Core principle

Responsive visualization preserves the question and semantics, not the desktop coordinates. A diagram is responsive when a reader can identify its scope, primary path, labels, and outcome without page-level horizontal scrolling or browser zoom.

Do not treat `width: 100%` on a large fixed SVG as sufficient: it may technically fit while shrinking labels below readable size. Do not treat an invisible horizontal scrollbar as the default compact layout.

Use the smallest set of semantic building blocks. Let the agent compose them for the current model instead of forcing every visualization through one universal renderer or coordinate script.

## Building blocks

| Block | Meaning | Typical rendering |
|---|---|---|
| orientation | scope, status, question, takeaway | compact header |
| node | actor, component, state, store, or option | labelled shape or bordered item |
| boundary | ownership, containment, trust, or deployment | titled enclosing region |
| relationship | call, dependency, event, transition, or association | directional labelled connector |
| relationship list | compact projection of several edges | `source -> target`, verb, and status |
| group | visual peers without formal containment | whitespace and aligned layout |
| contract rail | shared interface or extension point | labelled horizontal/vertical rail |
| sequence message | ordered interaction between participants | lane arrow or compact event row |
| evidence | source, API, rationale, or uncertainty | caption, details, or text alternative |
| navigation | move between distinct questions | compact menu or section links |
| display control | theme, projection, or meaningful filter | quiet utility control |

The reusable CSS asset supplies visual tokens and composition primitives. It does not choose entities, edges, breakpoints, or the number of views. Those remain task-specific decisions.

## Adapt by topology

| View | Wide layout | Compact layout |
|---|---|---|
| boundary map | peers inside one visible boundary | boundary stays visible; peers stack or group into selected detail |
| ownership with cross-boundary relations | boundaries plus directed edges | named boundaries plus compact relationship list |
| hierarchy | horizontal levels or compact tree | vertical indented tree |
| dependency graph | selected directed graph | fewer nodes, grouped dependencies, or overview plus selected detail |
| process flow | left-to-right steps and branches | top-to-bottom flow with branch outcomes below the decision |
| sequence | participant lanes and horizontal messages | ordered message log with sender, action, receiver, and outcome |
| state | horizontal primary lifecycle | vertical transitions; exception returns remain explicit |
| data flow | sources, transformations, authority, sinks | vertical pipeline; trust boundaries remain enclosing regions |
| data model | aligned entities and relationships | stacked entities with relationship labels between them |
| deployment | left-to-right request path across zones | vertical path; zone boundaries stay named |
| timeline | horizontal time axis | vertical time axis |
| before/after | aligned side-by-side small multiples | stacked views with identical vocabulary and ordering |
| comparison matrix | table with aligned criteria | one option per block with criterion labels, or local table scroll for exact dense data |
| chart | fluid plot with direct labels | simplify labels and series; stack small multiples; never change scales silently |

Do not reflow a graph when the new geometry would falsely change ownership, order, or direction. In that case, use a compact projection over the same model and offer the detailed view separately.

For a compact sequence, use one continuous time rail and dense event rows. Put `sender → receiver` in muted metadata and the verb/action in primary text. Keep rows content-sized with roughly `8–12px` vertical padding; do not retain desktop lane height, a card per message, disconnected border fragments, or participant-colored prose. Mark failure or unknown status separately and write self-messages explicitly, for example `Room Manager ↻ self`.

For a compact ownership or boundary view with several directional relations, keep the ownership blocks and replace the desktop edge geometry with one compact relationship list. Every row must name `source → target`, then the relationship verb, plus any proposed, unknown, asynchronous, or failure status. Never hide shafts and arrowheads while leaving labels such as `read models down`, `command up`, or `status up`: those fragments no longer identify a relationship.

## Compact-width strategy

Apply these repairs in order:

1. Remove details that do not answer the view's question.
2. Shorten labels without changing domain names.
3. Reflow semantic building blocks using CSS layout.
4. Change the projection: overview first, selected detail second.
5. Use a compact alternative for topology-dependent views such as sequence diagrams.
6. Use local horizontal scrolling only when reflow would distort the model.

When local scrolling remains necessary:

- keep it inside the labelled diagram region, never at page level;
- expose only the axis that is actually needed: usually `overflow-x: auto` with no nested vertical scroll;
- let vertical wheel and touch gestures bubble to the document; only an explicit, labelled pan/zoom mode may capture them. Contain overscroll on the scrolling axis only (`overscroll-behavior-x`): the two-axis `overscroll-behavior` shorthand, a restrictive `touch-action`, or a wheel listener traps vertical scrolling even when the region itself cannot scroll vertically;
- show a visible scroll hint or clipped-edge affordance;
- keep the primary path visible at the initial position;
- provide a compact overview that fits without scrolling;
- preserve keyboard access and normal text size.

## Implementation guidance

Prefer semantic HTML and CSS layout for boundaries, nodes, trees, timelines, simple flows, matrices, and responsive stacking. Use inline SVG for lines, dense geometry, charts, and views whose spatial relationships carry meaning.

For an SVG that can scale safely:

- use a meaningful `viewBox` and omit fixed rendered width/height;
- use `width: 100%; height: auto`;
- keep the view simple enough that final labels remain readable;
- use `vector-effect: non-scaling-stroke` where essential lines must remain visible;
- expose a title and description.

For an SVG that cannot scale safely, provide separate wide and compact projections selected with CSS. Both projections must use the same entities, names, statuses, relationship meanings, cardinality/optionality, and failure paths; they may arrange or aggregate them differently. Keep one canonical source/render model and audit the compact projection edge by edge rather than maintaining it as an independent design.

Use scripts only when data volume, automatic layout, filtering, or coordinated interaction earns the runtime cost. Do not embed one-off entity coordinates in a general-purpose skill script. The agent should model the current task and compose the supplied blocks in the most direct medium.

## Validation viewports

Inspect the actual artifact at these representative conditions unless the consuming project defines its own breakpoints:

| Condition | What it exposes |
|---|---|
| half-width desktop, about `900–1100px` | shell and diagram competing for horizontal space |
| wide desktop, about `1440px` | excessive whitespace and over-wide reading paths |
| tablet, about `768px` | navigation collapse and mixed compact/wide behavior |
| mobile, about `360–390px` | label readability, stacking, overflow, and touch targets |
| zoom at `200%` | reflow, clipping, and control reachability |

For each condition, verify the default section plus every topology that changes representation. Test both themes at least once after layout changes.

## Failure modes

- **Scaled poster** — a large fixed SVG is reduced until text becomes miniature.
- **Hidden second half** — the model overflows but the page gives no scroll or detail affordance.
- **Desktop-only truth** — the compact version drops a failure path, status, owner, or direction.
- **False reflow** — stacking changes a dependency or sequence into apparent containment.
- **Universal generator** — one script dictates coordinates and notation for unrelated questions.
- **Breakpoint by device name** — layout changes target devices instead of available content width.
- **Responsive chrome only** — navigation adapts but the diagram remains fixed-width.
- **Page-level overflow** — one diagram makes the entire document pan horizontally.
