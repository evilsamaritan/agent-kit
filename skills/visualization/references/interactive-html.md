# Interactive HTML Explainers

## Contents

- [When HTML earns its cost](#when-html-earns-its-cost)
- [Multi-view explorer pattern](#multi-view-explorer-pattern)
- [Information architecture](#information-architecture)
- [Theme and shell contract](#theme-and-shell-contract)
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

For a substantial technical design, use a document-like explorer rather than a slide deck. Apply [visual-system.md](visual-system.md) and the reusable [visualization-shell.css](../assets/visualization-shell.css). A clean default shell can provide:

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

Select navigation by depth only after duplicate and non-visual views have been removed:

- one view → no sidebar;
- two or three peer views → visible switcher or in-page headings;
- four to twelve justified sections in an explicitly requested reference/atlas → persistent side navigation on wide screens;
- more than twelve justified reference sections → bounded groups plus search or quick navigation, not one flat list.

Navigation does not make an oversized view contract concise. If the primary result needs more than three views and no atlas/reference deliverable was requested, return to view selection before building the shell.

## Theme and shell contract

Support automatic light/dark adaptation in every standalone HTML artifact:

1. declare both supported color schemes;
2. use semantic CSS custom properties from the default visual system;
3. follow the operating-system preference by default;
4. if a manual control is useful, expose `Auto`, `Light`, and `Dark` and persist only the override;
5. update embedded SVG, Mermaid, or canvas content rather than inverting it;
6. keep category, status, selected, and failure semantics identical in both themes;
7. validate both themes at wide and narrow viewports.

Keep the page shell quiet: flat background, one bordered content surface, compact navigation, restrained accent, and minimal shadow. Use panels to group one coherent visual or detail region; do not wrap every paragraph or entity in a card.

When a persistent side navigation exists, put global display controls such as theme in its utility footer. Keep the document header for status, title, and takeaway; do not make global controls compete with the content hierarchy.

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
| zoom/pan | navigate a genuinely large visual | reset/fit control; keyboard alternative |
| scenario playback | reveal order or state changes | manual controls; reduced-motion mode; final state readable |

Avoid hover-only information, hidden navigation, auto-advancing sequences, and interactions that change facts without updating visible state. Preserve positions across filters and current/target projections when practical so readers can compare without relearning the layout.

## Implementation shape

Represent long-lived content as structured data or a clearly documented model:

```text
sections
  id, type, title, takeaway, status
nodes
  id, name, type, responsibility, owner, status, evidence
relationships
  source, target, kind, direction, label, status
views
  id, question, node selection, relationship selection, layout hints
```

Render several projections from these stable identities. Avoid copying names and facts into navigation markup, diagram coordinates, details panels, and event handlers independently.

Keep rendering and publishing separate. A local HTML artifact is a complete default result when the user asked for visualization, not deployment. External publication requires explicit authorization.

Prefer native HTML controls and CSS layout. For standalone implementation, follow [runtime-output.md](runtime-output.md): Tailwind may own the shell and responsive layout while the shared visualization asset owns semantic diagram primitives. Add a diagram or chart library only when it materially improves layout, interaction, or accessibility and is compatible with the target environment.

## Responsive behavior

Preserve comprehension across viewport sizes:

- collapse persistent navigation into an explicit accessible menu on narrow screens;
- recompose semantic blocks or switch to a compact projection before using scroll;
- let irreducibly wide diagrams scroll horizontally only inside their own labelled region and expose that behavior visibly;
- keep node labels at readable size instead of scaling the entire canvas down;
- stack supporting panels without changing semantic order;
- keep tabs and controls reachable without horizontal page scrolling;
- retain the selected section and view through layout changes;
- provide a fit/reset option for zoomable canvases.

Mobile output may need a simplified overview plus selected detail rather than the same dense graph reflowed into a narrow column.

Read [responsive-layout.md](responsive-layout.md) for topology-specific adaptations and reusable composition blocks.

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

Validate in the actual browser or closest available environment:

1. open the default deep link and every section;
2. exercise tabs, navigation, filters, selection, and reset paths;
3. verify keyboard order, focus visibility, and non-hover access;
4. inspect automatic, light, and dark theme behavior;
5. inspect wide and narrow viewport behavior;
6. confirm readable text, contrast, boundaries, arrows, and legends;
7. verify current/proposed status and source labels;
8. test direct URLs, refresh, back, and forward behavior;
9. inspect print/static fallback if promised;
10. check that essential content remains available without animation;
11. report which browsers, themes, viewports, and interactions were actually inspected.

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
