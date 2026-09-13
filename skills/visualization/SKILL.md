---
name: visualization
description: Build polished responsive HTML or Playground-style technical visualizations from an existing architecture model, document, code, diff, or dataset. Use when asked for an interactive explainer, web preview, navigable diagram set, consistent light/dark themes, code view, diff view, or mobile-friendly visualization. Owns presentation, visual grammar, responsive composition, interaction, and render QA; does not design the underlying architecture or product UI.
user-invocable: true
---

# Responsive Technical Visualization

Turn an agreed source model into a compact, consistent web artifact that is easier to inspect than a wall of text. Prefer the host's native interactive-artifact capability when available; otherwise create local responsive HTML/CSS/JavaScript. This skill owns presentation, not domain truth.

## Scope and boundaries

Use this skill for:

- a responsive multi-view technical explainer or web preview;
- a Playground-style artifact with navigation and progressive disclosure;
- consistent architecture, lifecycle, dependency, data, comparison, or chart views in one shell;
- focused code and diff views;
- light/dark theming and browser-level visual QA.

Do not invoke it merely because a design document contains one useful Mermaid or host-native diagram. The source skill can draw that directly. Combine this skill with the owner of the source model:

| Source | Owner | Visualization receives |
|---|---|---|
| system, module, contract, runtime, state, or migration design | `architecture` | agreed view contract and optional draft diagrams |
| technical documentation | `documentation` | hierarchy, prose, evidence, and navigation intent |
| UX or dashboard model | `design` | approved information and interaction model |
| implementation or patch | code/review skill | exact source, status, and focus ranges |
| dataset or analysis | analysis owner | verified measures, units, uncertainty, and takeaway |

This skill may choose a clearer web layout or compact representation. When `architecture` supplies a view contract, its selected projection and relationship semantics are fixed: normalize them into a render model without redesigning them. If an architecture request has no agreed model or view contract, route to `architecture` first. Never rename domain concepts, move authority, add dependencies, reinterpret causality, or make an unverified proposal look current.

## Critical rules

1. **Render source truth.** Preserve authoritative entities, relationships, statuses, evidence, and unknowns from the owning skill or source.
2. **Use the shared visual system.** Apply the standard shell, tokens, category palette, arrow grammar, and disclosure levels unless an established project system takes precedence.
3. **Keep the shell subordinate.** Put theme and global controls in navigation or a quiet utility area; show orientation and the first visual in the initial viewport.
4. **Answer one question per view.** Give every view a precise title, scope/status, short takeaway, and distinct job.
5. **Show relationships, not card walls.** A styled list is not a hierarchy, dependency, flow, sequence, state, or comparison.
6. **Preserve one abstraction level per view.** Split overview and detail while keeping stable names and visual identities.
7. **Build from semantic blocks.** Compose nodes, boundaries, labelled relationships, groups, contracts, messages, evidence, and navigation per task; do not force every model through one coordinate generator.
8. **Be responsive by meaning.** Reflow or switch to a compact projection before scrolling. Never shrink a desktop poster until labels are unreadable or allow page-level horizontal overflow.
9. **Support automatic light and dark themes.** Keep semantics identical in both; persist only explicit overrides and never invert the page as a dark-mode shortcut.
10. **Use interaction only for disclosure.** Navigation, filters, details, view switching, and zoom must reduce cognitive load; decorative motion and fake application chrome do not.
11. **Show code as evidence.** Use focused selectable code, unified diff on compact widths, and non-color add/remove labels; do not imply compilation or correctness.
12. **Inspect the rendered artifact.** Verify themes, representative wide/half-width/mobile viewports, navigation, overflow, labels, contrast, and textual alternatives.
13. **Keep creation local by default.** Publishing, hosting, or external sharing requires explicit authorization.

## Flow selection

| Intent | Route |
|---|---|
| Create or revise a web visualization | Read [create.md](workflows/create.md) |
| Choose a projection when the source owner has not fixed one | Read [diagram-selection.md](references/diagram-selection.md); preserve an architecture view contract when supplied |
| Apply the shared tone, themes, density, and shell | Read [visual-system.md](references/visual-system.md) |
| Define node, boundary, relationship, arrow, and label semantics | Read [visual-language.md](references/visual-language.md) |
| Fit half-width desktop, tablet, and mobile | Read [responsive-layout.md](references/responsive-layout.md) |
| Show implementation or an exact change | Read [code-views.md](references/code-views.md) |
| Build multi-view navigation and disclosure | Read [interactive-html.md](references/interactive-html.md) |
| Adapt to host-native artifact capabilities | Read [runtime-output.md](references/runtime-output.md) |

Load only the references required by the artifact. Start from the source model and question, not from a renderer catalog.

## Output decision

```text
Is the requested result a separate polished or interactive web artifact?
├── No
│   └── leave the visualization with the source skill or document
└── Yes
    Is a host-native interactive artifact available and suitable?
    ├── Yes -> use it, preserving this skill's visual contract
    └── No  -> build local responsive HTML/CSS/JavaScript

Inside a non-architecture artifact, or when the source owner has not fixed the projection, what answers the agreed question?
├── containment or ownership -> nested boundary / hierarchy
├── dependency or connection -> directed graph
├── decisions or transformation -> process flow
├── participants over time -> sequence or compact message log
├── lifecycle validity -> state view
├── data relationships or movement -> ERD / data-flow / authority view
├── current-to-target change -> paired views / transition timeline
├── exact implementation or change -> code / diff view
└── quantity, distribution, or comparison -> appropriate chart / matrix
```

One artifact may contain several views only when each answers a different question over the same stable vocabulary.

## Composition contract

Before implementation, establish:

1. **Source contract** — facts, proposals, unknowns, vocabulary, and owner.
2. **View contract** — question, audience, scope, status, entities, relationships, and takeaway per view.
3. **Visual contract** — shell depth, semantic categories, arrow grammar, disclosure, themes, and compact projection.
4. **Evidence contract** — source links, code/diff status, units, uncertainty, and textual equivalent.

For architecture work the handoff is:

```text
architecture
  -> coherent model
  -> selected and optionally drafted diagrams
  -> semantic view contract
visualization
  -> responsive projections
  -> consistent HTML shell and themes
  -> interaction and rendered QA
```

The HTML layer may rearrange or aggregate for a narrow viewport, but it must preserve ownership, direction, order, status, failure paths, and authoritative names.

## Validation

Follow the render-and-inspect stages in [create.md](workflows/create.md). At minimum, verify automatic/light/dark theme behavior, page-level and local overflow, every meaningful view and interaction, and representative `390`, `768`, `960`, and wide-desktop widths. Report untested browsers or states explicitly.

## Required output

For a non-trivial artifact, deliver:

1. the local artifact or host-native result;
2. a concise question/scope and one takeaway per view;
3. stable section navigation when there are four or more views;
4. an essential legend or textual equivalent;
5. source and current/proposed/unknown status;
6. exact validation status for themes, viewports, interactions, and render path.

Keep maintainable source with the consuming documentation. A screenshot can demonstrate the result but must not be the only source of a long-lived technical visualization.

## Context adaptation

**One compact diagram:** usually keep it in the source skill or document. Use this skill only when visual polish, responsive embedding, or a web artifact is explicitly useful.

**Architecture explorer:** accept architecture facts and views; preserve their semantics while adding compact navigation, responsive projections, themes, and evidence detail.

**Code or diff explainer:** preserve exact source, paths, line structure, and status. Prefer unified diff on narrow screens and local scrolling inside the code region.

**Large view set:** group sections by reader question, keep overview before detail, and add search/filtering only when it helps locate known content.

**Uncertain source:** label inferred, proposed, transitional, and unknown elements. Polish must never imply certainty.

## Anti-patterns

- **Architecture by styling** — the renderer silently invents boundaries or dependencies.
- **Card wall** — relationships become a grid of prose blocks.
- **Scaled poster** — one fixed SVG technically fits but its labels do not.
- **Responsive chrome only** — the menu collapses while the diagram remains desktop-only.
- **Universal generator** — one script hard-codes topology and coordinates for unrelated tasks.
- **Mixed grammar** — the same color, shape, or line changes meaning between views.
- **Unlabelled arrows** — readers must guess direction, action, or causality.
- **Slide reflex** — next/previous pages replace semantic navigation.
- **IDE cosplay** — fake editor chrome overwhelms focused code evidence.
- **Unverified artifact** — valid HTML or SVG is delivered without inspecting the rendered result.

## Related Knowledge

- `architecture` — owns architecture reasoning, view selection, and concise architecture diagrams
- `documentation` — owns durable prose, explanation, and reference structure
- `design` — owns user-facing information and interaction design
- `accessibility` — deep accessibility review beyond the built-in contract
- `frontend`, `html`, and `css` — production implementation when a visualization becomes application UI
- `presentations` and `imagegen` — slide narratives and illustrative raster assets, outside this skill

## References

- [create.md](workflows/create.md) — source-to-artifact workflow
- [diagram-selection.md](references/diagram-selection.md) — agreed question to concrete web projection
- [visual-system.md](references/visual-system.md) — tone, light/dark tokens, density, shell, and disclosure
- [visual-language.md](references/visual-language.md) — semantic nodes, boundaries, arrows, labels, and layout
- [responsive-layout.md](references/responsive-layout.md) — half-width/mobile composition and topology-preserving alternatives
- [code-views.md](references/code-views.md) — focused code and responsive diff presentation
- [interactive-html.md](references/interactive-html.md) — multi-view explorer structure and validation
- [runtime-output.md](references/runtime-output.md) — host-native capability and local HTML delivery
- [visualization-shell.css](assets/visualization-shell.css) — theme tokens and semantic diagram blocks; copy as an output asset
- [_preview.html](assets/_preview.html) — Tailwind-based local gallery of structural, behavioral, change, chart, code, and diff views
- [check-theme-contrast.mjs](scripts/check-theme-contrast.mjs) — deterministic light/dark token contrast check
