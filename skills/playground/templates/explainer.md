# Template: Explainer

Use when the reader must understand one concept or mechanism: how a reducer updates state, how a cache invalidates, how a consensus round commits. It needs no document or architect; research the topic and mark simplifications.

## Composition

Start from `assets/visualization-page.html`.

```text
header: kicker (topic · simplified/current) · question as title · one-sentence answer · theme control
section 1: the mechanism at a glance — one diagram or flow
section 2: one worked example the reader can step through or change
section 3: the edge that surprises people (failure, ordering, invariant)
footer: what was simplified, sources
```

Two or three sections are usually enough. Add one only for a distinct question.

## Interaction

- **Stepper** over a worked example: previous/next buttons and a step indicator; each step highlights one element and changes one caption. Keyboard arrows move between steps.
- **Example switch** between two or three canonical inputs (empty cart / one item / concurrent update), each rendered from the same state.
- **Highlight on focus**: selecting a term highlights the matching node; the reverse also works.

Every step is readable as text without the animation; reduced motion jumps between states.

## Components

`viz-flow` with `viz-node-card` and `viz-connector` for a short linear chain; a Mermaid block or compiled SVG for branches, sequences, and states; `viz-message-list` as the compact projection of a sequence; `viz-copy` for prose; `viz-legend` for decoding.

## Pitfalls

- Teaching the API surface instead of the mechanism.
- An animation that carries meaning no text states.
- Facts filled in from memory; check versions and defaults in primary sources.
