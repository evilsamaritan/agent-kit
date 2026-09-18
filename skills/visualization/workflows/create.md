# Create or Revise a Visualization

Follow this workflow for a new web explainer, an unclear existing technical artifact, or a multi-view visualization. Keep the sequence; scale the work to the request.

## Contents

- [1. Frame the visual question](#1-frame-the-visual-question)
- [2. Establish source truth](#2-establish-source-truth)
- [3. Build the model](#3-build-the-model)
- [4. Select the view set](#4-select-the-view-set)
- [5. Choose delivery](#5-choose-delivery)
- [6. Decide the visual language](#6-decide-the-visual-language)
- [7. Build the artifact](#7-build-the-artifact)
- [8. Check, render, and inspect](#8-check-render-and-inspect)
- [9. Simplify](#9-simplify)
- [10. Deliver](#10-deliver)

## 1. Frame the visual question

1. State what the reader must understand, decide, compare, or remember.
2. Identify the audience and where they will view the result.
3. Define scope, abstraction level, current or target status, and required fidelity.
4. Confirm that a separate web artifact is wanted rather than one diagram inside the source document.
5. Extract explicit output constraints: a repository file, a local preview, a host-native artifact, a single file.
6. Ask only when a missing choice materially changes scope, publishing, cost, or compatibility. Otherwise choose the smallest useful result.
7. Set a view budget: one overview and one consequential detail; a third view only when its takeaway is distinct.

Do not begin by choosing colors, components, or a layout.

## 2. Establish source truth

1. Inspect the material, code, data, or design that owns the facts. If an owning skill produced a view contract, that is the handoff.
2. Separate verified facts, user requirements, inferences, proposals, and unknowns.
3. Preserve exact names and terminology from authoritative sources.
4. Treat example visuals as style evidence unless the user adopts their content as requirements.
5. Resolve contradictions before rendering polish over them.
6. For architecture input, require an agreed model and view contract; if either is missing, route the design question to `architecture` first.

Source completeness is not a display requirement. A long document or large view contract is reduced editorially before it becomes navigation.

## 3. Build the model

1. Normalize the owner's entities, relationships, and views into one model, using the field names of the architecture handoff ([interactive-html.md](../references/interactive-html.md#implementation-shape)). Do not add domain entities.
2. Preserve supplied relationship semantics; define them only when the owner has not.
3. Record groups, boundaries, order, quantities, status, and evidence.
4. Give every repeated element a stable identity across views.

Every projection — wide diagram, compact list, textual equivalent — is derived from this one model. If the content is only a list with no relationships, use a table or structured text; do not force it into a graph.

## 4. Select the view set

1. Use the [view catalog](../references/diagram-selection.md) to pick the view for each question, keeping any view an architecture contract has already fixed.
2. Apply the view-set quality gate in SKILL.md: one sentence of job and takeaway per view; merge, remove, or return to the owner.
3. Separate current, target, and transition views when combining them would be ambiguous.

Prefer an overview plus one selected detail over an exhaustive atlas.

## 5. Choose delivery

Pick the delivery path with [runtime-output.md](../references/runtime-output.md): a host-native artifact path only when it can host the shell unchanged, otherwise local files; a single combined file when the host or the sharing path needs one. Request authorization before publishing, hosting, or changing external state.

## 6. Decide the visual language

1. Read [visual-language.md](../references/visual-language.md) for any view with nodes and relationships.
2. Fix the navigation mode, the categories that carry meaning, the relationship grammar, the disclosure levels, and the compact projection of each view — the catalog names the default for each.
3. Assign types and responsibilities to nodes before styling them.
4. Choose one reading direction and arrange the primary path first.
5. Use grouping and whitespace for boundaries; color is a secondary cue.
6. Add only the legend needed to decode non-obvious semantics.

## 7. Build the artifact

1. Create the artifact where the user asked, or in the repository's established documentation structure.
2. Copy the three shell files together and set the navigation mode. Replace the example content and navigation entries; leave the shell's structure, hooks, theme control, and behavior alone ([shell-components.md](../references/shell-components.md)).
3. Compose each view from the documented components. Before writing a new class, check that the component does not already exist; new task-specific classes get their own prefix and sit after the shared stylesheet.
4. Use `viz-connector` only for a simple one-to-one chain. Branches, joins, loops, multi-edge graphs, state, sequence, and ER views are Mermaid ([mermaid-rendering.md](../references/mermaid-rendering.md)).
5. For each view, prefer the same source in a compact direction; add a separate compact projection only when the catalog calls for one.
6. Add the optional Mermaid, code, and diff scripts only when their content exists.
7. Add accessible names, descriptions, keyboard behavior, and a textual equivalent.

For multi-view navigation and interaction, read [interactive-html.md](../references/interactive-html.md); for code and diffs, [code-views.md](../references/code-views.md).

## 8. Check, render, and inspect

This is the one delivery checklist for the skill.

**Check.** Run the contract check on the artifact and fix every failure:

```bash
node scripts/check-shell-contract.mjs path/to/artifact.html
```

**Render** in the actual or closest available target, at the viewports in [responsive-layout.md](../references/responsive-layout.md#validation-viewports), in light and dark, including automatic preference and an explicit override.

**Inspect** every view and every meaningful state:

1. The title states the question, scope, and status; the takeaway is readable without narration.
2. Every element has a name and type; important lines are directional and labelled; line styles match the relationship grammar.
3. Containment, ownership, and trust boundaries are unambiguous; the primary path is visually dominant.
4. Text is at reading size at every viewport — nothing was shrunk to fit.
5. Trace the primary relationship or scenario without the supporting prose.
6. With the pointer over every diagram and code region, a vertical wheel or touch gesture still moves the page; test local horizontal movement separately.
7. Where a compact projection differs from the wide one, compare every relationship: source, target, kind, label, order or cardinality, status, failure path.
8. Unknown, inferred, proposed, and current facts cannot be confused; keyboard and non-color cues preserve essential meaning.
9. The artifact still uses the canonical shell — no replacement menu, theme switch, or responsive wrapper.

Any overlapping label, detached arrowhead, clipped node, ambiguous crossing, duplicated identity, unreadable compact projection, or page-level horizontal overflow is a failed render. Fix it and inspect that viewport again. If rendering tooling is unavailable, say so; a syntax check is not an inspection.

## 9. Simplify

1. Remove every element that does not help answer the stated question.
2. Split overloaded views rather than reducing font size or hiding complexity behind interaction.
3. Reduce crossing lines, duplicated nodes, decorative containers, and repeated labels.
4. Confirm each remaining view has a distinct job; re-render after structural changes.
5. Editorial pass: can the reader identify the question, the answer, the owners, and the critical relationship without opening every detail section?

## 10. Deliver

Return the artifact with its question and scope, a one- or two-sentence takeaway, the editable source path, a compact legend or textual equivalent, any intentional deviation from the default visual system, and the exact status: contract check result, themes, viewports, and interactions inspected, and what was not. Do not claim an unrendered diagram is visually verified.
