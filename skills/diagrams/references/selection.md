# View and Notation Selection

Choose the view from the reader's question, then check that the project's language can state it. This is the single notation table for Agent Kit; other skills link here instead of repeating it.

## Contents

- [Decision tree](#decision-tree)
- [What to draw with what](#what-to-draw-with-what)
- [Specialized cases](#specialized-cases)
- [Combining views](#combining-views)
- [When not to draw](#when-not-to-draw)
- [Failure modes](#failure-modes)

## Decision tree

```text
What must the reader be able to answer?
├── who owns what / what crosses a boundary      -> structure or containment
├── what depends on what                         -> directed dependency graph
├── what happens next, including branches        -> process
├── who interacts in which order                 -> sequence
├── which transitions are valid                  -> state
├── how data entities relate                     -> ER / tables with cardinality
├── where data or authority moves                -> data flow with trust/authority scopes
├── where things run and fail independently      -> deployment
├── what changes from current to target          -> paired views or timeline
├── which option is better on equal criteria     -> table or matrix
├── how large / how distributed / how it trends  -> chart (not a graph language)
└── what exactly the code is or changed          -> code block or unified diff

Then: language from the project (SKILL.md decision tree, step 3).
Can it express the view faithfully?
├── Yes -> use it
└── No  -> specialized notation below; name the gap you hit
```

## What to draw with what

| Reader question | View | Primary path | When a specialized notation is required |
|---|---|---|---|
| Who owns what, what crosses boundaries? | structure / containment | project language (Mermaid subgraphs, D2 nesting) | formal component or deployment UML is mandated → PlantUML |
| What depends on what? | directed graph | project language | graph extracted from code, or a specific layout algorithm → Graphviz |
| What happens next? | process | project language | UML activity semantics (swimlanes with fork/join rules) → PlantUML |
| Who interacts in which order? | sequence | project language when it has native sequences | activation bars, nested `alt`/`par`/`loop` fragments, timing → PlantUML |
| Which transitions are valid? | state | project language for flat or lightly nested machines | composite states with history, orthogonal regions, entry/exit actions → PlantUML |
| How are entities related? | ER / SQL tables | Mermaid ER or D2 `sql_table`, cardinality explicit | a notation the language cannot show without losing constraints |
| Where does data or authority move? | data flow | project language with labelled reads/writes and scopes | domain-formal notation required by the project |
| Where does it run? | deployment | project language when connections dominate; a table when placement dominates | formal deployment UML → PlantUML |
| Current vs target | paired views with identical vocabulary, plus a transition view | project language | a schedule → table or Gantt the host supports |
| Options on equal criteria | table / matrix | Markdown table | never a graph |
| Quantities, distributions, trends | chart | plotting tool or the host's charting | never a graph language |
| Exact implementation or change | code / diff | fenced code, unified diff | diagrams complement evidence, they do not replace it |

The table routes notation, not a renderer's feature list. A language that *can* draw something (D2 can draw states as nodes) does not thereby carry all of a specialized notation's meaning; check the specific construct the model needs, in the installed version.

## Specialized cases

- **Detailed UML** across several views (class with multiplicities, sequence with fragments, composite states) — PlantUML, whichever language the project prefers elsewhere. Keep the project language for the other views.
- **Extracted graphs** — Graphviz with a reproducible extractor and filter. The extractor's output is the source of edges; style and layout are separate.
- **Large interactive graph exploration** — a dedicated viewer through `playground`, built from the same extracted data.
- **Architecture zoom levels** — `architecture` chooses System / Structure / Internal / Runtime / Data & State / Deployment / Evolution views; this table only chooses how to draw each.

## Combining views

Several views belong together only when each answers a different question:

```text
overview -> one structure or dependency view -> one interaction or lifecycle -> evidence
```

Good pairs: hierarchy plus dependency graph (ownership differs from usage); dependency graph plus sequence (static coupling differs from runtime order); process plus state (steps differ from lifecycle validity); current plus target plus transition. Keep identities, names, and relative placement stable across the set. Delete a view whose takeaway repeats another.

## When not to draw

Use text or a table when the content is a short unordered list, depends on exact wording, has no relationships or order, or would just place sentences inside boxes. If a diagram was explicitly requested, say why a table is the better structure and render the table well.

## Failure modes

- **Data-shape determinism** — timestamps do not always need a timeline; categories do not always need a pie.
- **Mixed relationship types** — containment, calls, data flow, and deployment as identical arrows.
- **False sequence** — layout suggests time where items are unordered.
- **False hierarchy** — vertical alignment suggests ownership that does not exist.
- **Complete-map bias** — every available node instead of the evidence the question needs.
- **Unfair comparison** — options drawn at different scales or with different criteria.
