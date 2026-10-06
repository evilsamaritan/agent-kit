# Template: Explorer

Use when the reader navigates a system, codebase, design, or document set across several distinct questions: an architecture explorer, a codebase map, a migration plan with current/target/transition views.

## Composition

Start from `assets/visualization-shell.html`.

| Views after the quality gate | Navigation mode |
|---|---|
| one | `switcher` without section entries |
| two or three peer views | `switcher` |
| four to twelve sections of a requested reference or atlas | `sidebar` |

Each section: kicker (view type), question as title, one-sentence takeaway, one primary visual in a `viz-panel`, the legend, and evidence or details on demand.

## View-set quality gate

Before building, write one line of job and takeaway for every candidate view, then:

1. merge views with the same question and abstraction level;
2. remove views whose takeaway is already visible in another;
3. move evidence inventories and exhaustive cases into details or linked sources;
4. split any view that mixes containment, dependencies, sequence, state, or authority without one reading rule;
5. return contradictions or an overloaded contract to the source owner.

More than three primary views needs an explicitly requested reference. Navigation organizes justified detail; it does not compress an oversized model.

## Page pattern

A document-like explorer, not a slide deck, on the explorer shell ([shell-components.md](../references/shell-components.md)): persistent section navigation, document status and scope, the current section's title and takeaway, a diagram / text-and-contracts switch when both help, one focused visual canvas, and a boundary note, legend, or evidence footer. Sections follow the reader's model (overview, ownership, structure, contracts, lifecycles, failure behavior), not a page count, and the page stays freely navigable.

The first viewport shows location, status, takeaway, and the primary visual; rationale, contracts, and evidence go into detail levels, not an introduction wall. Each section has a stable identifier and deep link, a type label (`Component graph`, `Lifecycle`, `Contract`), a precise title, a one-sentence takeaway, one primary visual or structured text view, and only the legend or caveat that section needs. Keep nouns identical across navigation, titles, diagram nodes, details, and data. Tabs are for complementary representations of the same scope, never for chapters, sequential steps, or views readers must compare side by side.

## View model

Keep content in one structured model and render every projection from it, so names and facts are never copied by hand. When an architecture owner supplies a view contract (the handoff in the `architecture` skill, architecture-views, "Handoff to the playground skill"), use its fields unchanged and keep its diagram source and language:

```text
views          id, question, audience, scope/level, status/priority, takeaway
entities       id, name, type, responsibility, boundary or authority, evidence status
relationships  source, kind, target, label, status, order or cardinality
```

Other sources (a codebase, a document set) map onto the same three lists.

## Interaction

Section navigation with deep links; `Diagram` / `Text and API` tabs only for complementary representations of the same scope; current/target toggles over one model; search or filters when entities are numerous.

## Review

For annotating a document or a diff, keep the source as the main column with an annotation rail: inline comments anchored to a line or element, accept/reject per item, a count of open items, and an export that lists each comment with its anchor. Code and diffs follow [code-views.md](../references/code-views.md).

## Deliver

The artifact, per-view question and takeaway, legend or textual equivalent, source and status, and the exact check status.
