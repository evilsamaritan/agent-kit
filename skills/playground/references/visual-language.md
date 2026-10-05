# Diagram Language

## Contents

- [Boundary with the visual system](#boundary-with-the-visual-system)
- [Node and boundary grammar](#node-and-boundary-grammar)
- [Relationship grammar](#relationship-grammar)
- [Composition and layout](#composition-and-layout)
- [Label contract](#label-contract)
- [Density and scale](#density-and-scale)
- [Consistency across views](#consistency-across-views)
- [Accessibility](#accessibility)

## Boundary with the visual system

This reference owns what diagram marks mean: nodes, boundaries, relationship kinds and their line treatments, labels, density, and consistency. [visual-system.md](visual-system.md) owns tone, tokens, typography, and the category palette. [shell-components.md](shell-components.md) lists the classes that implement these marks.

Select semantics before style. A renderer may adapt shapes or layout, but it must preserve element identity, boundaries, relationship direction, status, and evidence meaning.

## Node and boundary grammar

Define what visual marks mean before styling them. Use the smallest grammar that distinguishes the relationships in the model.

| Meaning | Default encoding | Required annotation |
|---|---|---|
| actor | distinct actor shape or explicit type label | role and goal |
| bounded system/group | enclosing region with a clear title | scope or ownership |
| component/item | simple shape inside its owner/group | name, type, short responsibility |
| store or durable state | distinct store shape or explicit label | authoritative, replica, or derived status |
| external dependency | outside the in-scope boundary | type and capability consumed |
| current/proposed/retiring status | border or status badge plus text | explicit status word |
| uncertainty | distinct treatment plus label | inferred, unknown, disputed, or unverified |

Do not rely on notation the audience must already know. Put the element type in its label or a nearby legend.

Use enclosing regions only for real containment, ownership, trust, deployment, or scope. Use whitespace for visual grouping when no formal boundary exists.

## Relationship grammar

Every relationship has a semantic kind, a direction convention, and one line treatment. Use one stable grammar within an artifact:

| Relationship | Direction means | Line | Label example |
|---|---|---|---|
| dependency | consumer points to provider | solid arrow | `depends on contract` |
| call or message | sender points to receiver | solid arrow | `requests catalog` |
| data write | writer points to authority | solid arrow | `stores session` |
| data read | reader points to source | solid arrow | `reads projection` |
| transition | source state points to destination | solid arrow | `timeout elapsed` |
| event or indirect influence | publisher points to subscriber or channel | dashed arrow | `publishes room updated` |
| constraint or annotation | note associates with subject | dotted line, no strong arrowhead | `limited by configuration` |
| failure or forbidden path | same as the underlying kind | risk-colored line plus an explicit label | `rejects stale token` |
| containment | boundary encloses member | no line | `System boundary` |

A stronger accent line marks the selected or primary path; it is not a new relationship kind. Never let one dashed line mean both asynchronous flow and proposed status. If the domain needs another distinction, state it once in the legend and apply it consistently.

Lines are `1.5–2px` with simple `8–10px` arrowheads, consistent bends, and orthogonal routing when it reduces crossings. Every important arrow carries a verb phrase of roughly two to five words, placed near the middle of the edge on an opaque theme-matched background where lines could pass behind it. Point the arrow in the semantic direction and state the convention in the legend when readers might expect the opposite. Avoid animated arrows unless motion is the subject and can be paused. The Mermaid spelling of these treatments is in [mermaid-rendering.md](mermaid-rendering.md#relationship-grammar-in-mermaid).

Render connectors as geometry: use the shared `.viz-connector` block for simple reflowing relations and SVG paths with markers for routed graphs. Never fake arrows with repeated box-drawing characters, hyphens, emoji, or a font glyph string; their length, weight, alignment, and arrowhead position change with typography.

Keep the line and arrowhead inside one connector component on one geometric centerline, and run it from the source boundary to the target boundary. Do not position the shaft, label, and head as unrelated absolute elements or leave arbitrary layout gaps that make an edge look detached from its nodes. A routed edge or self-loop must be one SVG path with `marker-end`; do not approximate it with several borders and a loose triangle.

When a compact projection removes connector geometry, replace the complete edge with textual semantics: `source → target`, a precise verb phrase, and status when relevant. Never preserve only the old edge label. Relative labels such as `up`, `down`, `left`, or `right` are invalid without named endpoints because reflow changes their meaning.

Show bidirectional arrows only when both directions express the same relationship. Otherwise draw and label two directed relationships or switch to a sequence view.

For sequence views, derive exactly one lifeline from the center of each participant header. Do not use a repeating background gradient: it creates unrelated stripes, cannot stay attached to reordered participants, and makes message endpoints ambiguous. Place every message, self-loop, and arrowhead in one SVG coordinate system. Keep routine messages neutral; use semantic color only for a selected path, risk, or unresolved relationship rather than recoloring every message by participant. Omit step numbers unless prose refers to them. At compact width, switch to the shared dense message-log projection with one continuous rail and explicit `sender → receiver`; preserve message order, status, and unknowns without carrying over desktop spacing.

## Composition and layout

Select one dominant reading direction:

- left-to-right for dependency, interaction, and time flows;
- top-to-bottom for hierarchy, layers, or staged processing;
- radial only when a real center/periphery relationship exists;
- free spatial layout only when position itself is meaningful.

Build the primary path first. Place secondary context around it with weaker visual emphasis. Align peers, keep group boundaries spacious, and minimize crossings before adding bends or routing tricks.

Whitespace communicates separation. An enclosing boundary communicates ownership or containment. Do not add boxes merely to make the page look structured.

At compact widths, recompose semantic blocks or switch to a compact projection over the same model. Allow local horizontal scrolling only when reflow would distort topology, keep the primary path initially visible, and provide an explicit affordance. Scaling an entire view until labels become small is not responsive design. See [responsive-layout.md](responsive-layout.md).

## Label contract

Use a short label hierarchy:

```text
Name
Type or status
One responsibility or value
```

Prefer verbs on relationships: `creates`, `reads`, `publishes`, `retries`, `owns`, `routes`. Avoid generic labels such as `uses`, `data`, or `connection` when a more precise action is known.

Use sentence case unless repository language conventions require otherwise. Keep acronyms explained on first use. Preserve exact domain names across views; do not shorten them differently to fit individual layouts.

Keep node labels to about three short lines and relationship labels to a verb phrase when practical. Put detailed contracts, evidence, and edge cases in the related text view or details panel.

Use the type sizes from the visual system at the final delivery viewport. Shorten content, enlarge the canvas, scroll, or split the view before reducing text below normal reading size.

## Density and scale

Split a view when:

- more than one abstraction level competes for attention;
- labels turn into paragraphs or shrink below comfortable reading size;
- edges cross frequently or travel across unrelated groups;
- the legend needs many exceptions;
- readers must hide most elements to understand the default state;
- the title needs more than one question.

About a dozen primary elements is often a useful upper heuristic for an overview, but comprehension is the gate. A well-grouped hierarchy may support more; a dense network may support fewer.

Reduce density in this order:

1. remove irrelevant detail;
2. aggregate repeated peers when their identity is unimportant;
3. split by question or abstraction level;
4. use small multiples with stable positions;
5. add useful filters or details-on-demand;
6. enlarge or scroll the canvas.

Do not use zoom as the first repair for an unselected model.

## Consistency across views

A multi-view document should feel like projections of one model:

- same element → same name, category, and core color;
- same relationship → same direction and line semantics;
- same scope → same boundary title;
- same status → same explicit label;
- same current/target distinction → same treatment;
- overview and detail → stable relative placement when practical.

Reuse visual grammar, not coordinates. A sequence diagram and dependency graph may arrange the same components differently, but their identity must remain obvious. Filtered versions of the same base view should preserve positions when practical.

## Accessibility

Provide:

- meaningful title and short description for each visual;
- non-color cues for categories, status, and errors;
- sufficient text/background and line/background contrast;
- keyboard access and visible focus for interactive controls;
- logical focus and reading order matching the visual hierarchy;
- text or table equivalents for essential relationships;
- reduced-motion behavior for animation;
- labels that do not depend on hover.

For Mermaid, use accessible title and description syntax supported by the target renderer. For HTML/SVG, expose semantic names and state through native elements and appropriate accessibility attributes.

The delivery checklist for a rendered view is step 8 of [create.md](../workflows/create.md).
