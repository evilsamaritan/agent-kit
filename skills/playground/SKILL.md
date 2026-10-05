---
name: playground
description: "Build self-contained HTML playgrounds: visual explainers, explorers, references, presentations, simulations, comparisons, and review tools with shared light/dark themes. Use for 'explain this visually', an interactive explainer, architecture explorer, slides, or a parameter simulator. Not for diagram source (diagrams) or product UI (frontend)."
argument-hint: "[topic or source] [form]"
---

# Playground

Turn a topic, document, codebase, dataset, or model into a web artifact a reader can inspect or operate. It works on its own — explaining Redux needs no document and no architect — and it works from an existing source, whose facts, vocabulary, and diagram sources it keeps.

## Scope and boundaries

| This skill owns | Others own |
|---|---|
| choosing the form, composing the page, interaction and state, the shared visual system, themes, responsive projections, delivery, render checks | diagram notation and source text (`diagrams`), the technical model (`architecture` or the domain skill), durable prose (`documentation`), product UI (`frontend`, `design`) |

- **From a source:** keep its entities, relationships, statuses, names, and diagram language. Return contradictions to the owner instead of resolving them through layout.
- **From nothing:** research the facts the artifact states (code, docs, primary sources), mark assumptions and simplifications, and keep the claims checkable.
- **Not needed:** one diagram or one table that answers the question belongs in the reply or the document (`diagrams`).

## Decision tree

```text
Does a separate page help more than a diagram, table, or text in the answer?
├── No  -> answer directly; use diagrams for a diagram
└── Yes -> what should the reader do with it?
    ├── understand one concept or mechanism ......... explainer
    ├── navigate a system, codebase, or design ...... explorer (optional explorer shell)
    ├── tune parameters and watch the effect ........ configurator / simulation
    ├── look things up ................................ reference
    ├── follow a talk or a guided story ............. presentation
    ├── weigh options on the same criteria .......... comparison
    └── annotate a document or a diff ............... review
```

Load the matching template from `templates/`; when the request fits none cleanly, start from the closest and adapt. Templates are starting compositions, not fixed chrome or a closed list.

## Forms

| Form | Template | Useful interaction | Typical shape |
|---|---|---|---|
| explainer | [explainer.md](templates/explainer.md) | steps, highlight, a worked example the reader can change | one column, one or two diagrams, short sections |
| explorer | [explorer.md](templates/explorer.md) | section navigation, details on demand, search, filters | explorer shell with switcher or sidebar navigation |
| configurator / simulation | [simulation.md](templates/simulation.md) | controls, live preview, presets, reset, export of the result | controls beside or above a live view |
| reference | [reference.md](templates/reference.md) | search, anchors, expandable examples | sidebar or table of contents, dense typography |
| presentation | [presentation.md](templates/presentation.md) | slide or scene steps, keyboard, overview | full-viewport scenes with a printable/static fallback |
| comparison | closest: explainer or reference | criteria matrix, before/after toggle, linked views | aligned columns or small multiples |
| review | closest: explorer | inline comments, accept/reject, exported feedback | the source with an annotation rail |

## Core rules

1. **Facts first.** Every stated fact is verified or labelled as proposed, inferred, simplified, or unknown. Polish never implies certainty.
2. **Form follows the task.** Use the explorer shell only when section navigation helps. A small explainer stays small; a reference may be long; a presentation is a presentation when asked for one. Size follows content and the reader's task.
3. **One shared visual system.** Build on the shared stylesheet and theme runtime (`assets/visualization-shell.css`, `assets/visualization-shell.js`): tokens, typography, components, and controls. Task-specific classes get their own prefix and load after the shared stylesheet; do not fork tokens or the theme control ([shell-components.md](references/shell-components.md)).
4. **One state object for dynamic tools.** Controls write to it; every view renders from it. Defaults look right on first load, presets are named, and reset is explicit.
5. **Interaction must earn its place.** It helps the reader understand, explore, or decide. A static diagram does not need controls; decoration and fake app chrome are noise.
6. **Diagrams keep their source and language.** One source per view; a compact projection comes from the same source. Mermaid renders through the provided adapter; other languages embed their compiled SVG with per-theme variants ([mermaid-rendering.md](references/mermaid-rendering.md)). Never redraw a supplied diagram in another language.
7. **Light and dark, same meaning.** Follow the host's theme when it provides one, otherwise the reader's preference with a manual override. Never invert colors with a filter.
8. **Responsive by meaning.** Reflow or switch to a compact projection before shrinking text. No page-level horizontal overflow; diagram and code regions may scroll horizontally, and vertical gestures always reach the page.
9. **Accessible by default.** Keyboard access, visible focus, labelled controls, sufficient contrast, reduced-motion support, and a textual equivalent for essential visuals.
10. **Delivery follows the host.** Local files by default; a host-native artifact when the host's own instructions call for it; public publication only when the user asks ([runtime-output.md](references/runtime-output.md)).
11. **Check, then look.** Run `node scripts/check-shell-contract.mjs <artifact.html>`, then view both themes at wide, half-width, and phone sizes and exercise every control. Report exactly what was checked.

## Flow selection

| Intent | Route |
|---|---|
| Create or revise a playground | [create.md](workflows/create.md) |
| Compose a page from the shared components; use the explorer shell | [shell-components.md](references/shell-components.md) |
| Pick a view and its compact projection inside an artifact | [diagram-selection.md](references/diagram-selection.md) |
| Render Mermaid sources in the page | [mermaid-rendering.md](references/mermaid-rendering.md) |
| Relationship, node, boundary, and label semantics | [visual-language.md](references/visual-language.md) |
| Fit half-width desktop, tablet, and phone | [responsive-layout.md](references/responsive-layout.md) |
| Show code or an exact change | [code-views.md](references/code-views.md) |
| Navigation, disclosure, state, and interaction | [interactive-html.md](references/interactive-html.md) |
| Tokens, palette, typography, theme behavior | [visual-system.md](references/visual-system.md) |
| Host-native artifact, single file, offline, host theme, CDN limits | [runtime-output.md](references/runtime-output.md) |
| Write or change diagram source | `diagrams` |

Load only what the artifact needs: the workflow, the template, and the references its components use.

## Context Adaptation

| Situation | Approach |
|---|---|
| Architecture model with a view contract | explorer or explainer; the contract fixes views and semantics ([architecture-views handoff](../architecture/references/architecture-views.md#handoff-to-the-playground-skill)) |
| Existing document | keep its structure, vocabulary, and diagram sources; add navigation or disclosure, not new claims |
| A concept with no source | research it, pick an explainer or simulation, cite or mark what was simplified |
| Code or a diff | exact source with paths and status; unified diff on narrow screens ([code-views.md](references/code-views.md)) |
| Dataset | charts with units, baselines, and uncertainty; the quantitative rules in [diagram-selection.md](references/diagram-selection.md#quantitative-questions) |
| Talk or workshop | presentation with keyboard steps and a static/print fallback |
| Host with its own artifact contract | follow the host's page contract and theme signal ([runtime-output.md](references/runtime-output.md)) |

## Anti-patterns

- **One chrome for every form** — a sidebar explorer wrapped around a single diagram, or slides when the reader needs a reference.
- **Invented facts** — plausible numbers, APIs, or relationships added to make the page feel complete.
- **Architecture by styling** — layout invents boundaries, dependencies, or ownership.
- **Language swap** — a supplied D2 or PlantUML diagram redrawn in Mermaid so the adapter can show it.
- **Duplicate truth** — wide and compact projections maintained as two designs.
- **Card wall** — relationships become a grid of prose blocks.
- **Scaled poster** — the diagram technically fits; its labels do not.
- **Navigation as compression** — tabs hide an oversized model instead of reducing it.
- **Control soup** — every parameter exposed at once; group by concern and hide advanced options.
- **Stale preview** — a control changes state but some view does not re-render from it.
- **Forked tokens** — a new palette or theme switch beside the shared one.
- **Unverified artifact** — valid HTML delivered without the check or a look at both themes.

## Related Knowledge

- `diagrams` — notation choice, diagram source, and compilation
- `architecture` — the technical model and which architecture views matter
- `documentation` — durable prose and document structure
- `design` and `accessibility` — user-facing interaction and inclusive design beyond the built-in contract
- `frontend`, `html`, `css` — production implementation when a playground becomes application UI

## References

- [create.md](workflows/create.md) — research → form → build → check → deliver
- Templates: [explainer](templates/explainer.md), [explorer](templates/explorer.md), [reference](templates/reference.md), [presentation](templates/presentation.md), [simulation](templates/simulation.md)
- [shell-components.md](references/shell-components.md) — shared components, theme control, optional explorer shell, hooks, revisions
- [diagram-selection.md](references/diagram-selection.md) — views inside an artifact, compact projections, quantitative rules
- [mermaid-rendering.md](references/mermaid-rendering.md) — Mermaid browser adapter
- [visual-language.md](references/visual-language.md), [visual-system.md](references/visual-system.md) — semantics, tokens, palette, typography
- [responsive-layout.md](references/responsive-layout.md), [interactive-html.md](references/interactive-html.md), [code-views.md](references/code-views.md)
- [runtime-output.md](references/runtime-output.md) — delivery, host contracts, single file, dependencies
- Assets: `assets/visualization-shell.css`, `assets/visualization-shell.js`, explorer shell `assets/visualization-shell.html`; optional `visualization-mermaid.js`, `visualization-code.js`, `visualization-diff.js`; gallery `assets/_preview.html`
- Scripts: `scripts/check-shell-contract.mjs` (components, themes, explorer contract when used), `scripts/check-theme-contrast.mjs` (token contrast)
