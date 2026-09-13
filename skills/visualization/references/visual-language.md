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
- [Review checklist](#review-checklist)

## Boundary with the visual system

This reference defines what diagram marks mean. [visual-system.md](visual-system.md) defines the shared tone, exact light/dark tokens, typography, spacing, category palette, shell, and default line treatments.

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

Every relationship needs a semantic kind before it gets a line style:

| Relationship | Direction means | Label example |
|---|---|---|
| dependency | consumer points to provider | `depends on contract` |
| call/message | sender points to receiver | `requests catalog` |
| event | publisher points to subscriber or channel | `publishes room updated` |
| data write | writer points to authority | `stores session` |
| data read | reader points to source | `reads projection` |
| transition | source state points to destination | `timeout elapsed` |
| containment | boundary encloses member; usually no arrow | `System boundary` |
| constraint/annotation | note associates with subject | `limited by configuration` |

Use the default solid/dashed/dotted treatments from the visual system. If the domain needs a different distinction, state it once in the legend and apply it consistently. Never use the same dashed line to mean both asynchronous flow and proposed status within one artifact.

Render connectors as geometry: CSS borders and pseudo-elements for simple reflowing relations, or SVG paths with markers for routed graphs. Never fake arrows with repeated box-drawing characters, hyphens, emoji, or a font glyph string; their length, weight, alignment, and arrowhead position change with typography.

Keep the line and arrowhead on one geometric centerline, and run the connector from the source boundary to the target boundary. Do not position the shaft and head independently or leave arbitrary layout gaps that make an edge look detached from its nodes.

Show bidirectional arrows only when both directions express the same relationship. Otherwise draw and label two directed relationships or switch to a sequence view.

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

## Review checklist

Before delivery, verify:

- the title states the question, scope, and current/target status;
- the intended audience can identify the main takeaway without narration;
- every element has a useful name and type;
- important lines are directional and labelled;
- containment, ownership, and trust boundaries are unambiguous;
- the primary path is visually dominant;
- line styles match the declared relationship grammar;
- colors, shapes, line styles, and acronyms are explained where needed;
- text remains readable at the final viewport and exported size;
- wide content scrolls or splits instead of shrinking;
- unknown, inferred, proposed, and current facts cannot be confused;
- a textual equivalent preserves essential meaning;
- the actual render was inspected, including relevant responsive and interactive states.

Ask a reader to explain the view without the supporting prose. If they cannot name the scope, relationship direction, and primary takeaway, simplify or split it.
