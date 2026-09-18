# Responsive Diagram Composition

## Contents

- [Core principle](#core-principle)
- [Compact-width strategy](#compact-width-strategy)
- [Implementation guidance](#implementation-guidance)
- [Validation viewports](#validation-viewports)
- [Failure modes](#failure-modes)

## Core principle

Responsive visualization preserves the question and semantics, not the desktop coordinates. A diagram is responsive when a reader can identify its scope, primary path, labels, and outcome without page-level horizontal scrolling or browser zoom.

Do not treat `width: 100%` on a large fixed SVG as sufficient: it may technically fit while shrinking labels below readable size. Do not treat an invisible horizontal scrollbar as the default compact layout.

Compose the components the shell provides ([shell-components.md](shell-components.md)) for the current model instead of forcing every visualization through one coordinate script. What each view becomes at compact width is listed in the [view catalog](diagram-selection.md#catalog).

## Compact-width strategy

Apply these repairs in order:

1. Remove details that do not answer the view's question.
2. Shorten labels without changing domain names.
3. Reflow semantic building blocks using CSS layout.
4. Change the projection: overview first, selected detail second.
5. Use a compact projection for topology-dependent views such as sequence diagrams ([view catalog notes](diagram-selection.md#notes-on-specific-views)).
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

For a diagram that cannot scale safely, first try the same source in a compact direction; only then provide separate wide and compact projections ([shell-components.md](shell-components.md#wide-and-compact-projections)). Both projections must use the same entities, names, statuses, relationship meanings, cardinality or optionality, and failure paths; they may arrange or aggregate them differently. Keep one canonical model and audit the compact projection edge by edge rather than maintaining it as an independent design.

Use scripts only when data volume, automatic layout, filtering, or coordinated interaction earns the runtime cost. Do not embed one-off entity coordinates in a general-purpose skill script. The agent should model the current task and compose the supplied blocks in the most direct medium.

## Validation viewports

This is the one viewport list for the skill. Inspect the actual artifact at these representative conditions unless the consuming project defines its own breakpoints:

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
- **Coordinate script** — one script dictates coordinates and notation for unrelated questions.
- **Breakpoint by device name** — layout changes target devices instead of available content width.
- **Responsive chrome only** — navigation adapts but the diagram remains fixed-width.
- **Page-level overflow** — one diagram makes the entire document pan horizontally.
