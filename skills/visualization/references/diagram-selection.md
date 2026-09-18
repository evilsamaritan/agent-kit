# View Catalog: Question, View, Renderer, Compact Projection

One lookup per view: which view answers the reader's question, which renderer draws it, and what it becomes at compact width. Choose by the question, not by the tool's catalog or the source file format.

When a source owner has already fixed the view — an architecture view contract owns its System, Structure, Internal, Runtime, Data & State, Deployment, or Evolution projection — skip the first column and use the rest.

## Contents

- [Catalog](#catalog)
- [Notes on specific views](#notes-on-specific-views)
- [Combine views deliberately](#combine-views-deliberately)
- [Quantitative questions](#quantitative-questions)
- [When no diagram is needed](#when-no-diagram-is-needed)
- [Failure modes](#failure-modes)

## Catalog

| Reader question | View | Renderer | Compact projection | Avoid |
|---|---|---|---|---|
| What contains what, with no consequential edges? | tree or nested boundaries | semantic HTML (`viz-tree`, `viz-boundary`) | indented tree; stacked boundaries | arrows that imply flow where only containment exists |
| Who owns what, and what crosses the boundaries? | boundary map with directed edges | Mermaid flowchart with real subgraphs | named boundaries plus one relationship list | hiding edge geometry but keeping its labels |
| What depends on what? | directed dependency graph | Mermaid flowchart | same source top-to-bottom; filtered graph; relationship list | unfiltered generated hairballs |
| What happens next? | process flow | Mermaid flowchart | same source top-to-bottom, branch outcomes below the decision | numbered cards as steps |
| Who interacts in what order? | sequence | Mermaid sequence | ordered message list (`viz-message-list`) | internal calls that do not affect the decision |
| Which states are valid? | state | Mermaid state | vertical state view or transition list | mixing independent state dimensions |
| How are entities related? | logical data model | Mermaid ER | stacked entities plus textual cardinality | an ERD as a substitute for runtime flow |
| Where does information move, and who is authoritative? | data flow and authority | Mermaid flowchart with trust or authority subgraphs | vertical pipeline; boundaries stay named | unlabelled reads and writes |
| Where does it run and fail independently? | deployment | Mermaid flowchart when connections dominate; `viz-deployment` zones when placement dominates | vertical path; zones stay named | a cloud-resource inventory |
| What changes from current to target? | paired views and timeline | HTML `viz-subviews` and `viz-timeline`; Mermaid only inside a stage that needs topology | stacked views with identical vocabulary; vertical timeline | one overloaded red/green graph |
| How do options compare? | matrix | HTML table (`viz-matrix`) | one labelled block per option; local scroll only for dense exact data | decorative cards with uneven content |
| How large, how distributed, how related? | chart | inline SVG (`viz-chart`) or an established chart library | simplified labels; stacked small multiples; never a silent scale change | 3D, arbitrary area encoding, pies for continuous data |
| What exact implementation matters? | focused code view | `viz-code` | local horizontal scroll | whole-file dumps, editor chrome |
| What exact text changed? | diff | `viz-code viz-diff` | unified only | color-only or side-by-side on mobile |
| Navigation, prose, disclosure | — | the shared shell | bottom-sheet menu, stacked content | forcing prose into diagram nodes |

Use Mermaid because the relationship grammar fits, not because the source is architectural. A map layout is justified only when spatial location carries meaning.

## Notes on specific views

**Sequence at compact width.** Use one continuous rail and dense rows: `sender → receiver` as muted metadata, the verb or action as primary text, roughly 8–12px vertical padding per row. Do not keep desktop lane height, a card per message, or participant-colored prose. Mark failure or unknown status separately and write self-messages explicitly (`Room Manager ↻ self`).

**Ownership with several relations at compact width.** Keep the ownership blocks and replace the edge geometry with one relationship list. Every row names `source → target`, then the verb, then any proposed, unknown, asynchronous, or failure status. Fragments such as `command up` or `status down` identify nothing once the layout has reflowed.

**Reflow that would lie.** Do not reflow a graph when the new geometry would falsely change ownership, order, or direction. Use a compact projection over the same model and offer the detailed view separately.

**Code and diff.** They are implementation evidence, not architecture levels. Use them only after the source owner has established why the exact text matters; rules in [code-views.md](code-views.md).

## Combine views deliberately

Several views belong together only when they form a navigable explanation:

```text
overview
  -> one selected structure or dependency
       -> one selected interaction or lifecycle
            -> evidence and details
```

Good combinations: hierarchy plus dependency graph (ownership differs from usage); dependency graph plus sequence (static coupling differs from runtime order); process flow plus state (steps differ from lifecycle validity); current plus target plus transition (steady states differ from migration mechanics).

Weak combinations repeat the same boxes with slightly different styling. State the unique question beside every view; delete views without a distinct answer.

## Quantitative questions

Use position and length before angle, area, volume, or color intensity. Keep scales comparable across small multiples. Show units and meaningful baselines; distinguish missing data from zero.

- exact lookup matters → table;
- ranked magnitude → sorted bar or dot plot;
- time trend → line;
- distribution → histogram, box, or density plot;
- two-variable relationship → scatter plot;
- contribution over time → stacked area only when totals and composition both matter;
- uncertainty matters → interval, band, or distribution rather than one precise mark.

Histogram bins encode adjacent numeric intervals and must touch; separated bars encode discrete categories. Place direct value labels clear of the plotted path. Do not add a chart when one number and a sentence answer the question better.

## When no diagram is needed

Use concise text or a table when the content is a short unordered list, has no meaningful relationship, order, hierarchy, or quantity, depends on exact wording, or would merely place existing sentences inside boxes. If the user explicitly requested visualization, explain why a table is the right visual structure and render it cleanly rather than returning prose alone.

## Failure modes

- **Tool-first selection** — choosing a diagram because the renderer supports it.
- **Data-shape determinism** — assuming timestamps always need a timeline or categories always need a pie.
- **Mixed relationship types** — containment, runtime calls, data flow, and deployment appear as identical arrows.
- **False sequence** — layout suggests time although the items are unordered.
- **False hierarchy** — vertical alignment suggests ownership that does not exist.
- **Unfair comparison** — different scales, criteria, or denominators make options look comparable.
- **Complete-map bias** — including every available field instead of the evidence the question needs.
