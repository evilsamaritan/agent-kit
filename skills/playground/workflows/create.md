# Create or Revise a Playground

Scale each step to the request: a one-concept explainer passes through this in minutes; a multi-view explorer needs every step.

## Contents

- [1. Frame the reader's task](#1-frame-the-readers-task)
- [2. Establish the facts](#2-establish-the-facts)
- [3. Choose the form](#3-choose-the-form)
- [4. Shape the content](#4-shape-the-content)
- [5. Choose delivery](#5-choose-delivery)
- [6. Build](#6-build)
- [7. Check, render, and inspect](#7-check-render-and-inspect)
- [8. Simplify and deliver](#8-simplify-and-deliver)

## 1. Frame the reader's task

1. State what the reader must understand, find, decide, tune, present, or review.
2. Identify the audience and where they will view it (repository, browser, host artifact, projector).
3. Fix scope, abstraction level, and status (current, proposed, simplified).
4. Confirm a separate page helps more than a diagram, a table, or text in the reply.
5. Ask only when a missing choice materially changes scope, publication, cost, or compatibility; otherwise choose the smallest useful result.

Do not start with colors, components, or layout.

## 2. Establish the facts

- **From a source** (document, architecture view contract, code, diff, dataset): read it, keep its vocabulary, statuses, and diagram sources, and separate facts, requirements, inferences, proposals, and unknowns. Contradictions go back to the owner. An architecture request without an agreed model goes to `architecture` first.
- **From nothing**: research the topic in primary sources (official docs, the code, specifications). Note simplifications in the page ("simplified: middleware omitted").

Source completeness is not a display requirement; reduce editorially before navigation.

## 3. Choose the form

Use the SKILL.md decision tree and load one template from `templates/`. Mixed requests take the form of the reader's main task (a reference with one embedded simulation is still a reference).

## 4. Shape the content

1. Write one line of job and takeaway per section, view, slide, or tool panel. Merge duplicates and drop sections whose takeaway is already visible.
2. For diagrams, pick views with [diagram-selection.md](../references/diagram-selection.md); keep supplied sources and their language; write new sources with `diagrams`.
3. For tools, define the state object, its defaults, presets, and what the reader exports (see [interactive-html.md](../references/interactive-html.md#state-for-tools)).
4. Decide the compact projection of each wide element before building it ([responsive-layout.md](../references/responsive-layout.md)).
5. Assign meaning before style: categories, relationship grammar, and legend ([visual-language.md](../references/visual-language.md)).

## 5. Choose delivery

Follow the host's page contract when its instructions provide an artifact or preview tool; otherwise build local files, and a single file when sharing needs one ([runtime-output.md](../references/runtime-output.md)). Public publication and external sharing need the user's request.

## 6. Build

1. Copy the shared stylesheet and theme runtime, and the composition the template names: `visualization-page.html` or `visualization-shell.html` ([shell-components.md](../references/shell-components.md)).
2. Replace the example content. Keep the theme control, hooks, and early theme bootstrap.
3. Compose from documented components first; new classes get a task prefix and load after the shared stylesheet.
4. Add `visualization-mermaid.js`, `visualization-diagram.js`, `visualization-code.js`, or `visualization-diff.js` only when their content exists. Non-Mermaid sources (and pre-rendered Mermaid) are compiled locally to light and dark SVG, with compact variants when needed, and embedded as a compiled figure with its source link ([compiled-diagrams.md](../references/compiled-diagrams.md)).
5. Wire controls through the single state object; every view renders from it.
6. Add accessible names, keyboard paths, focus handling, and textual equivalents.

## 7. Check, render, and inspect

**Check.** `<skill-dir>` is this skill's absolute directory; scripts and assets do not resolve from the consuming project.

```bash
node <skill-dir>/scripts/check-shell-contract.mjs path/to/artifact.html
```

**Compile** diagram sources first when the page embeds compiled SVG: check the compiler's exit status and output; a missing compiler leaves the render unverified and the source unchanged.

**Render** in the target or the closest available browser at wide, half-width, and phone sizes, in light and dark, with automatic preference and a manual override (and the host's theme signal when there is one).

**Inspect** every section and state:

1. The title states the question, scope, and status; the takeaway reads without narration.
2. Elements have names; important lines are directional and labelled; line styles keep one meaning.
3. Text stays at reading size; nothing was shrunk to fit; no page-level horizontal overflow.
4. Vertical wheel and touch over diagrams and code still scroll the page; local horizontal scroll works separately.
5. Each compact projection matches its wide source relationship by relationship.
6. Every control updates every dependent view; reset restores defaults; export contains what it claims.
7. Keyboard alone reaches and operates everything; focus is visible; reduced motion is respected.
8. Proposed, simplified, and unknown facts cannot be mistaken for current facts.

Overlapping labels, detached arrowheads, clipped content, a stale view after a control change, or an unreadable compact projection is a failed render. Fix and re-inspect that state. If no browser is available, say so; a passing check is not an inspection.

## 8. Simplify and deliver

Remove anything that does not serve the reader's task, split overloaded views instead of shrinking them, and re-render after structural changes. Deliver the page with its question and scope, a short takeaway, the editable source paths (page and diagram sources), a legend or textual equivalent, any deviation from the shared visual system, and the exact verification status: check result, themes, sizes, interactions inspected, and what was not.
