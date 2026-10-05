# Template: Reference

Use when the reader looks things up: an API cheat sheet, a glossary, a configuration reference, a pattern catalog. Lookup speed beats narrative.

## Composition

Start from `assets/visualization-shell.html` with `data-viz-navigation="sidebar"` for many sections, or from `assets/visualization-page.html` with a table of contents for a short one.

```text
header: scope and version of what is documented · theme control
search: one input filtering entries by name and keyword
sections: grouped by the reader's task, not alphabetically by default
entry: name · one-line purpose · signature or values · one example · caveats (collapsed)
```

Group sections with `viz-nav__group` and `viz-nav__label` when there are more than twelve.

## Interaction

- Search filters entries live and shows match context; clearing it restores the full list.
- Every entry has an anchor; copying a link returns to the same entry.
- Examples expand in place (`details`), and code examples have a copy button.

## Components

`viz-matrix` for options against criteria (every `td` has `data-label` for the stacked phone layout); `viz-code` for examples; `viz-copy` for short definitions.

## Pitfalls

- A tutorial disguised as a reference; keep explanations in an explainer.
- Facts without the version they apply to.
- A search that hides the section context of its matches.
