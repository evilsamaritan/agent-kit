# Interactive HTML Explainers

## Contents

- [When HTML earns its cost](#when-html-earns-its-cost)
- [Multi-view explorer pattern](#multi-view-explorer-pattern)
- [Information architecture](#information-architecture)
- [Interaction contract](#interaction-contract)
- [Implementation shape](#implementation-shape)
- [Responsive behavior](#responsive-behavior)
- [Accessibility and durability](#accessibility-and-durability)
- [Validation](#validation)
- [Anti-patterns](#anti-patterns)

## When HTML earns its cost

Prefer a static view unless at least one of these capabilities materially improves comprehension:

- stable navigation across several distinct questions or abstraction levels;
- search or filtering across a meaningful number of entities;
- details-on-demand for contracts, owners, evidence, examples, or definitions;
- current/target/transition or scenario switching over one model;
- progressive zoom from overview to selected detail;
- coordinated highlighting across related views;
- large diagrams that need controlled pan/zoom while preserving readable text.

HTML is not justified by rounded boxes, animation, or the ability to drag nodes.

## Multi-view explorer pattern

For a substantial technical design, use a document-like explorer rather than a slide deck, built on the canonical shell ([shell-components.md](shell-components.md)). The shell provides:

```text
persistent section navigation
  + document status and scope
  + current section title and takeaway
  + diagram / text-and-contracts switch when both are useful
  + one focused visual canvas
  + boundary note, legend, or evidence footer
```

The section sequence should progress through the reader's model, not through arbitrary page counts. For example:

```text
overview
  -> responsibility and ownership
  -> module or component structure
  -> contracts
  -> selected lifecycles and flows
  -> failure behavior and rules
```

This pattern is especially useful when many related views share vocabulary and readers need to jump directly to a topic. It should still work as a freely navigable document; do not force a next-slide sequence.

The first viewport should establish location, status, takeaway, and the primary visual. Move long rationale, contracts, and evidence into the related detail level rather than placing an introduction wall before the diagram.

## Information architecture

Give every section:

1. a stable identifier and deep link;
2. a short type label such as `Component graph`, `Lifecycle`, or `Contract`;
3. a precise title;
4. one-sentence takeaway;
5. one primary visual or structured text view;
6. only the legend, boundary, evidence, or caveat needed for that section.

Use tabs only for complementary representations of the same scope, such as `Diagram` and `Text and API`. Do not use tabs as page or chapter navigation, for sequential steps, or when readers must compare the hidden views side by side.

Keep navigation labels semantic and short. Preserve the same nouns across navigation, titles, diagram nodes, details panels, and source data.

Choose the navigation mode only after duplicate and non-visual views have been removed ([shell-components.md](shell-components.md#navigation-modes)). Navigation does not make an oversized view set concise: if the primary result needs more than three views and no reference deliverable was requested, return to view selection before building.

## Interaction contract

Every interaction must answer a reader need:

| Interaction | Valid purpose | Required behavior |
|---|---|---|
| section navigation | move between distinct questions | current location visible; deep links work |
| tab/view switch | compare complementary representations | selected view labelled; state preserved when useful |
| filter | remove irrelevant categories | active filters visible and removable |
| search | locate a known entity | matches highlighted with context |
| select/details | inspect one element without cluttering overview | selection visible; details have heading and close path |
| current/target toggle | compare status over one model | state unmistakable; stable layout when practical |
| zoom/pan | navigate a genuinely large visual | not provided by the shell; if a task adds it, an explicit mode on a region marked `data-viz-pan-zoom`, with reset/fit and a keyboard alternative |
| scenario playback | reveal order or state changes | manual controls; reduced-motion mode; final state readable |

Avoid hover-only information, hidden navigation, auto-advancing sequences, and interactions that change facts without updating visible state. Preserve positions across filters and current/target projections when practical so readers can compare without relearning the layout.

## Implementation shape

Represent long-lived content as one structured model. Use the field names of the architecture handoff so nothing is translated twice:

```text
views
  id, question, audience, scope/level, status/priority, takeaway
entities
  id, name, type, responsibility, boundary or authority, evidence status
relationships
  source, kind, target, label, status, order or cardinality
```

Render several projections from these stable identities. Avoid copying names and facts into navigation markup, diagram coordinates, details panels, and event handlers independently.

Keep rendering and publishing separate. A local HTML artifact is a complete default result when the user asked for visualization, not deployment. External publication requires explicit authorization.

Prefer native HTML controls and CSS layout. Delivery paths and optional dependencies are in [runtime-output.md](runtime-output.md). Add a diagram or chart library only when it materially improves layout, interaction, or accessibility and is compatible with the target environment.

## Responsive behavior

The shell owns responsive chrome: the collapsing navigation, the mobile bottom sheet with its backdrop, scroll lock, focus containment, and dismissal. Content follows [responsive-layout.md](responsive-layout.md): recompose or switch to a compact projection before scrolling, keep labels at reading size, stack supporting panels without changing semantic order, and retain the selected section and view through layout changes. A mobile reader may need a simplified overview plus selected detail rather than the same dense graph in a narrow column.

## Accessibility and durability

Provide:

- semantic landmarks, headings, buttons, links, and tab relationships;
- visible keyboard focus and complete keyboard operation;
- section announcements or focus management after navigation when necessary;
- text/table equivalents for essential nodes and relationships;
- non-color status and selection indicators;
- reduced motion and no time-dependent reading requirement;
- a printable or static snapshot for review and archival when the artifact is consequential;
- a visible source/version/status label so proposals are not mistaken for current behavior.

Deep links should remain stable when content is reordered. If state is useful to share, encode only meaningful section, view, filters, or selection in the URL; avoid opaque transient state.

## Validation

Interaction-specific checks, in addition to step 8 of [create.md](../workflows/create.md): open the default deep link and every section; exercise tabs, filters, selection, and reset paths; verify keyboard order, focus visibility, and non-hover access; test direct URLs, refresh, back, and forward; confirm essential content stays available without animation; inspect the print or static fallback if one was promised.

## Anti-patterns

- **Presentation shell** — previous/next controls and slide numbers replace semantic navigation.
- **Card dashboard** — every section becomes a tile although the content is relational.
- **Theme afterthought** — dark mode is an inversion, a late recolor, or never inspected.
- **One SVG universe** — all views are coordinates inside one enormous canvas.
- **Tiny fit-to-screen** — readability is sacrificed to avoid horizontal scrolling.
- **State mystery** — filters, selected scenario, or current/target mode are not visible.
- **Duplicated model** — each view contains manually copied names and facts.
- **Decorative motion** — animation competes with comprehension or cannot be paused.
- **Local-only meaning** — colors or icons change semantics between sections.
- **Publish by default** — a local explanation unexpectedly becomes an external artifact.
