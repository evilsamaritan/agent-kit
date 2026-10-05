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

## Inputs from an architecture owner

Use the handoff form from the `architecture` skill (architecture-views, "Handoff to the playground skill"): per view the question, audience, scope, status, entities, relationships, canonical diagram source, compact projection, and textual equivalent. Keep the diagram source and its language.

## Interaction

Section navigation with deep links; `Diagram` / `Text and API` tabs only for complementary representations of the same scope; current/target toggles over one model; search or filters when entities are numerous.

## Deliver

The artifact, per-view question and takeaway, legend or textual equivalent, source and status, and the exact check status.
