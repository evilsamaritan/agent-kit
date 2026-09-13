# Create or Revise a Visualization

Follow this workflow for a new web explainer, an unclear existing technical artifact, or a multi-view visualization package. Preserve the sequence while adapting the amount of work to the request.

## 1. Frame the visual question

1. State what the reader must understand, decide, compare, or remember.
2. Identify the audience and the context in which they will view the result.
3. Define scope, abstraction level, current/target status, and required fidelity.
4. Confirm that the requested result is a separate polished or interactive web artifact rather than one diagram inside the source document.
5. Extract explicit output constraints such as host-native artifact, HTML, repository file, or local preview.
6. Ask only when a missing choice materially changes scope, publishing, cost, or compatibility. Otherwise choose the smallest useful web shell.

Do not begin by choosing colors, components, or a presentation layout.

## 2. Establish source truth

1. Inspect the source material, code, data, or design that owns the facts. If an owning skill produced a semantic view contract, use it as the handoff.
2. Separate verified facts, user requirements, inferences, proposals, and unknowns.
3. Preserve exact names and terminology from authoritative sources.
4. Treat example visuals as style or interaction evidence unless the user explicitly adopts their content as requirements.
5. Resolve contradictions before rendering polish over them.
6. For architecture input, require an agreed model and view contract. If either is missing, route the design question to `architecture` before continuing.

## 3. Build the visual model

1. Normalize the source owner's minimal entities into a render model; do not silently add domain entities.
2. Preserve supplied relationship semantics such as contains, depends on, calls, emits, transitions to, transforms, compares with, or changes into. Define them here only when the source owner has not already done so.
3. Record groups, boundaries, order, quantities, status, and evidence metadata.
4. Remove details that do not affect the question.
5. Give every repeated element a stable identity across views.

If the model is only a list with no relationship, use a table or concise structured text. Do not force it into a graph.

## 4. Select the view set

1. Read [diagram-selection.md](../references/diagram-selection.md).
2. Preserve the primary projection selected by an architecture view contract. Otherwise choose one primary view that directly answers the question.
3. Add another view only when it answers a different consequential question or abstraction level.
4. Separate current, target, and transition views when combining them would create ambiguity.
5. Define one sentence describing the job of every selected view.

Prefer an overview plus one selected detail over an exhaustive atlas.

## 5. Choose the output medium

1. Inspect the active runtime for native visualization or artifact capabilities.
2. Prefer a suitable host-native interactive artifact when available.
3. Otherwise use local responsive HTML/CSS/JavaScript.
4. Embed Mermaid or SVG only for views whose topology needs it; prefer semantic HTML/CSS for structures that reflow cleanly.
5. Use a static image only as a requested delivery snapshot, not the maintainable source.
6. Request authorization before publishing, hosting, or changing external state.

Read [runtime-output.md](../references/runtime-output.md) before assuming a runtime-specific feature exists.

## 6. Apply one visual language

1. Read [visual-system.md](../references/visual-system.md), [visual-language.md](../references/visual-language.md), and [responsive-layout.md](../references/responsive-layout.md) for HTML, multi-view, or compact-width output.
2. Write the compact visual brief: question, views, shell, categories, relationship grammar, disclosure, themes, and medium.
3. Apply the default token values and category palette unless an established project system takes precedence.
4. Assign types and responsibilities to nodes before styling them.
5. Label important relationships with direction and intent; preserve the shared arrow grammar.
6. Choose one reading direction and arrange the primary path first.
7. Use grouping and whitespace for boundaries; use color as a secondary status or type cue.
8. Keep labels readable at the final viewport and output size.
9. Add only the legend needed to decode non-obvious semantics.

## 7. Build the artifact

1. Create the selected source and output in the user's requested location or the repository's established documentation structure.
2. For standalone HTML without an existing design system, use Tailwind for the page shell, layout, typography, and controls; copy [visualization-shell.css](../assets/visualization-shell.css) for theme tokens and semantic diagram blocks. Follow [runtime-output.md](../references/runtime-output.md) to choose Play CDN or compiled CSS.
3. Keep data/model definitions separate from layout code for multi-view or long-lived HTML.
4. Add accessible names, descriptions, keyboard behavior, and a textual equivalent appropriate to the medium.
5. Compose semantic blocks that reflow at compact widths. Split the view or provide a compact projection before falling back to local horizontal scrolling.
6. Keep the visual source reviewable and avoid duplicating facts across manually synchronized views.

For interactive output, read [interactive-html.md](../references/interactive-html.md).

## 8. Render and inspect

1. Render the artifact in the actual or closest available target medium.
2. Inspect light and dark themes, including automatic preference and any explicit override.
3. Inspect the default view and every meaningful state, tab, filter, or responsive layout, including half-width desktop and mobile when the artifact has a shell.
4. Verify titles, labels, arrows, boundaries, legends, status, contrast, and text size.
5. Trace the primary relationship or scenario without using the supporting prose.
6. Check that keyboard and non-color cues preserve essential meaning.
7. Record any validation that could not be performed.

Syntax checks are necessary but insufficient. If rendering tooling is unavailable, report that boundary explicitly.

## 9. Simplify

1. Remove every element that does not help answer the stated question.
2. Split overloaded views rather than reducing font size or adding interaction to hide complexity.
3. Reduce crossing lines, duplicated nodes, decorative containers, and repeated labels.
4. Confirm that each remaining view has a distinct job.
5. Re-render after structural changes.

## 10. Deliver

Return the artifact with:

1. its question and scope;
2. a one- or two-sentence takeaway;
3. the editable source or path when relevant;
4. a compact legend or textual equivalent;
5. any intentional deviation from the default visual system;
6. the exact render, theme, viewport, interaction, and validation status.

Do not claim that an unrendered diagram is visually verified.
