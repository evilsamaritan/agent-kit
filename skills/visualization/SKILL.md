---
name: visualization
description: Build polished responsive HTML visualizations from an existing architecture model, document, code, diff, or dataset. Use when asked for an interactive explainer, web preview, navigable diagram set, architecture explorer, consistent light/dark themes, code view, diff view, or mobile-friendly visualization. Owns presentation, visual grammar, responsive composition, interaction, and render checks. Do NOT use to design or validate the source architecture, assess code correctness, or design product UI.
---

# Responsive Technical Visualization

Turn an agreed source model into a compact, consistent web artifact that is easier to inspect than a wall of text. This skill owns presentation, not domain truth: it never renames concepts, moves authority, adds dependencies, or makes a proposal look current.

## Scope and boundaries

Use this skill for a responsive multi-view technical explainer, an architecture explorer with navigation and progressive disclosure, focused code and diff views, and light/dark theming with browser-level checks. Do not invoke it because a design document contains one useful diagram-as-code block; the source skill draws that directly.

Combine it with the owner of the source model:

| Source | Owner | Visualization receives |
|---|---|---|
| system, module, contract, runtime, state, or migration design | `architecture` | an agreed model and view contract, optionally with diagram sources |
| technical documentation | `documentation` | hierarchy, prose, evidence, and navigation intent |
| UX or dashboard model | `design` | approved information and interaction model |
| implementation or patch | the code or review owner | exact source, status, and focus ranges |
| dataset or analysis | the analysis owner | verified measures, units, uncertainty, and takeaway |

When the owner supplies a view contract, its relationship semantics are fixed; this skill chooses layout, compact projections, and disclosure. If an architecture request has no agreed model, route to `architecture` first. If supplied views repeat a question, mix abstraction levels, or cannot be read independently, return the contract to its owner rather than hiding the problem behind navigation.

## Critical rules

1. **Render source truth.** Preserve authoritative entities, relationships, statuses, evidence, and unknowns.
2. **Start from the canonical shell; change content, not chrome.** Every standalone artifact uses the provided shell HTML, CSS, and JavaScript. Do not invent replacement navigation, theme controls, mobile menus, or tokens ([shell-components.md](references/shell-components.md)).
3. **Use the components that exist.** The stylesheet already provides nodes, boundaries, connectors, relationship lists, message lists, trees, timelines, matrices, code, and diff. Look them up before writing a new class.
4. **One question and one abstraction level per view.** Give every view a precise title, scope and status, a one-sentence takeaway, and a distinct job.
5. **Show relationships, not card walls.** A styled list is not a hierarchy, dependency, flow, sequence, state, or comparison.
6. **Curate before rendering.** A source may contain many facts and candidate views; they are not presentation requirements. Default to one overview and one consequential detail; add a third view only when it changes understanding.
7. **One source per view.** A wide diagram and its compact projection come from one model and must state the same entities, relationships, order, and status. Prefer re-running the same source in a compact direction over hand-writing a second projection.
8. **Be responsive by meaning.** Reflow or switch to a compact projection before scrolling. Never shrink a diagram until labels fall below reading size, and never allow page-level horizontal overflow.
9. **Never trap document scrolling.** Diagram and code regions may scroll horizontally; vertical wheel and touch gestures always continue the page.
10. **Support light and dark themes** with identical semantics; never invert the page as a shortcut.
11. **Use interaction only for disclosure.** Navigation, filters, details, and view switching must reduce cognitive load; decorative motion and fake application chrome do not.
12. **Show code as evidence.** Focused, selectable, highlighted with a plain-text fallback; unified diff for an exact patch, aligned before/after for structural comparison, non-color add/remove labels ([code-views.md](references/code-views.md)).
13. **Fail on visual ambiguity.** Overlapping labels, detached arrowheads, untraceable crossings, clipped content, duplicated identities, or a compact view that keeps an edge label without its named endpoints are unfinished work, not cosmetic defects.
14. **Check the artifact, then look at it.** Run `node scripts/check-shell-contract.mjs <artifact.html>`, then inspect the rendered result in both themes at wide, half-width, and mobile sizes. Valid HTML is not a verified visualization.
15. **Keep creation local by default.** Publishing, hosting, or external sharing requires explicit authorization.

## Flow selection

| Intent | Route |
|---|---|
| Create or revise a web visualization | [create.md](workflows/create.md) |
| Write artifact markup: shell, navigation mode, hooks, component classes | [shell-components.md](references/shell-components.md) |
| Choose a view, its renderer, and its compact projection | [diagram-selection.md](references/diagram-selection.md) |
| Draw flow, sequence, state, or ER diagrams with the provided graph renderer; decide when it is not enough | [mermaid-rendering.md](references/mermaid-rendering.md) |
| Define node, boundary, relationship, arrow, and label semantics | [visual-language.md](references/visual-language.md) |
| Fit half-width desktop, tablet, and mobile | [responsive-layout.md](references/responsive-layout.md) |
| Show implementation or an exact change | [code-views.md](references/code-views.md) |
| Plan multi-view navigation, disclosure, and interaction | [interactive-html.md](references/interactive-html.md) |
| Change tokens, palette, typography, or theme behavior | [visual-system.md](references/visual-system.md) |
| Deliver through a host-native artifact path, as a single file, or offline | [runtime-output.md](references/runtime-output.md) |

Load only the references the artifact needs. A typical architecture explorer needs the workflow, the shell and components, the view catalog, and the visual language.

## Output decision

```text
Is the requested result a separate polished or interactive web artifact?
├── No  -> leave the diagram with the source skill or document
└── Yes -> build responsive HTML on the canonical shell
          ├── a host-native artifact path can host the shell unchanged -> deliver through it
          └── otherwise -> deliver local HTML/CSS/JavaScript
```

Which view answers the question, which renderer draws it, and what it becomes at compact width are one lookup in [diagram-selection.md](references/diagram-selection.md). An architecture view contract has already made the first of those choices.

## View-set quality gate

Before building, write a one-line job and takeaway for every candidate view. Then:

1. merge views with the same question and abstraction level;
2. remove views whose takeaway is already visible in another view;
3. move evidence inventories and exhaustive cases to textual details or linked source material;
4. separate any view that mixes containment, dependencies, sequence, state, or authority without a single reading rule;
5. return semantic contradictions or an overloaded contract to the source owner instead of resolving them through layout.

More than three primary views needs an explicitly requested reference deliverable. Navigation, tabs, and collapsible sections organize justified detail; they never make an oversized view set concise.

## Inputs to establish

1. **Source** — facts, proposals, unknowns, vocabulary, and owner.
2. **Views** — question, audience, scope, status, entities, relationships, and takeaway per view. For architecture input use the handoff form in the `architecture` skill's [architecture-views.md](../architecture/references/architecture-views.md#handoff-to-the-visualization-skill) instead of inventing another schema.
3. **Visual decisions** — navigation mode, semantic categories, relationship grammar, disclosure, compact projection per view.
4. **Evidence** — source links, code or diff status, units, uncertainty, textual equivalents.

The HTML layer may rearrange or aggregate for a narrow viewport, but it preserves ownership, direction, order, status, failure paths, and authoritative names.

## Required output

For a non-trivial artifact, deliver:

1. the artifact, with maintainable source kept beside the documentation that consumes it;
2. the question, scope, and one takeaway per view;
3. an essential legend or textual equivalent;
4. source and current, proposed, or unknown status;
5. the exact check status: contract check result, themes, viewports, interactions, and anything not inspected.

A screenshot can demonstrate the result but is never the only source of a long-lived visualization.

## Context adaptation

**One compact diagram:** keep it in the source skill or document. Use this skill only when a separate web artifact is explicitly useful.

**Architecture explorer:** accept architecture facts and views; preserve their semantics while adding navigation, compact projections, themes, and evidence detail.

**Code or diff explainer:** preserve exact source, paths, line structure, and status. Unified diff on narrow screens; local horizontal scrolling inside the code region.

**Large view set explicitly requested:** first remove repeated or non-visual material, then group the remaining sections by reader question. Keep the overview before details.

**Uncertain source:** label inferred, proposed, transitional, and unknown elements. Polish must never imply certainty.

## Anti-patterns

- **Architecture by styling** — the renderer silently invents boundaries or dependencies.
- **Invented component** — a new class or control is written although the shell already provides one.
- **Forked chrome** — a task-specific menu, theme switch, or responsive wrapper replaces the shell's.
- **Card wall** — relationships become a grid of prose blocks.
- **Scaled poster** — one fixed diagram technically fits but its labels do not.
- **Responsive chrome only** — the menu collapses while the diagram stays desktop-only.
- **Duplicate truth** — wide and compact projections are maintained as two independent designs.
- **Atlas by default** — every section, scenario, or relationship gets its own view.
- **Navigation as compression** — tabs or a menu hide an oversized model without reducing it.
- **Mixed grammar** — the same color, shape, or line changes meaning between views.
- **Unlabelled arrows** — readers must guess direction, action, or causality.
- **Slide reflex** — next/previous pages replace semantic navigation.
- **Unverified artifact** — valid HTML is delivered without running the check or looking at the render.

## Related Knowledge

- `architecture` — owns architecture reasoning, view selection, and concise architecture diagrams
- `documentation` — owns durable prose, explanation, and reference structure
- `design` — owns user-facing information and interaction design
- `accessibility` — deep accessibility review beyond the built-in contract
- `frontend`, `html`, and `css` — production implementation when a visualization becomes application UI

## References

- [create.md](workflows/create.md) — source-to-artifact workflow, including the render-and-inspect checklist
- [shell-components.md](references/shell-components.md) — shell contract, navigation modes, hooks, component vocabulary, revisions
- [diagram-selection.md](references/diagram-selection.md) — view catalog: question, view, renderer, compact projection
- [mermaid-rendering.md](references/mermaid-rendering.md) — Mermaid source contract, theming, loading, responsive behavior, escalation
- [visual-language.md](references/visual-language.md) — meaning of nodes, boundaries, relationships, labels; density and consistency
- [responsive-layout.md](references/responsive-layout.md) — compact-width strategy, local scrolling rules, validation viewports
- [code-views.md](references/code-views.md) — focused code and responsive diff presentation
- [interactive-html.md](references/interactive-html.md) — when HTML earns its cost, information architecture, interaction, render model
- [visual-system.md](references/visual-system.md) — tone, light/dark tokens, typography, palette, disclosure levels, exceptions
- [runtime-output.md](references/runtime-output.md) — delivery paths, single-file and offline output, dependencies, authority
- Assets: [visualization-shell.html](assets/visualization-shell.html), [visualization-shell.css](assets/visualization-shell.css), [visualization-shell.js](assets/visualization-shell.js); optional [visualization-mermaid.js](assets/visualization-mermaid.js), [visualization-code.js](assets/visualization-code.js), [visualization-diff.js](assets/visualization-diff.js); rendered gallery [_preview.html](assets/_preview.html)
- Scripts: [check-shell-contract.mjs](scripts/check-shell-contract.mjs) — assets, component vocabulary, and produced artifacts; [check-theme-contrast.mjs](scripts/check-theme-contrast.mjs) — light/dark token contrast
