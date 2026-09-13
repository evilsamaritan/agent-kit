# View Selection by Question

## Contents

- [Start with the relationship](#start-with-the-relationship)
- [Selection table](#selection-table)
- [Combine views deliberately](#combine-views-deliberately)
- [Quantitative questions](#quantitative-questions)
- [Code and change evidence](#code-and-change-evidence)
- [When no diagram is needed](#when-no-diagram-is-needed)
- [Failure modes](#failure-modes)

## Start with the relationship

Choose a visual by the reader's question, not by the tool's catalog or the source file format.

This selection logic applies when the source owner has not already fixed the projection. An architecture view contract owns its System, Structure, Runtime, Data & State, Deployment, or Evolution projection; visualization chooses only the responsive layout and compact representation that preserve it.

```text
What relationship carries the meaning?
├── contains / belongs to / owns
│   └── hierarchy or nested boundary map
├── depends on / connects to / influences
│   └── directed graph or network
├── follows / branches / transforms
│   └── flowchart
├── sends / receives / waits / retries
│   └── sequence diagram
├── enters / leaves / permits transition
│   └── state diagram
├── changes across time
│   └── timeline, slope, or before/after views
├── compares across fixed criteria
│   └── matrix or aligned small multiples
└── measures magnitude, distribution, composition, or correlation
    └── quantitative chart
```

Use a map when spatial location is meaningful. Do not use geographic layouts merely because data has region names.

## Selection table

| Reader question | Preferred view | Include | Avoid |
|---|---|---|---|
| What contains what? | tree or nested boundary map | levels, owners, scope | arrows that imply flow when only containment exists |
| What depends on what? | directed dependency graph | direction, relationship intent, cycles/status | unfiltered generated hairballs |
| What happens next? | flowchart | decisions, branches, terminal outcomes | using numbered cards as steps |
| Who interacts in what order? | sequence | participants, messages, failures, waits | internal calls that do not affect the decision |
| What states are valid? | state diagram | events, guards, terminal states | mixing independent state dimensions |
| Where does information move? | data-flow map | source, authority, transformations, trust boundaries | ERD as a substitute for runtime flow |
| What changed or will change? | paired views or timeline | stable identities, status, transition points | one overloaded red/green graph |
| How do options compare? | matrix or aligned small multiples | same criteria and scale | decorative cards with different content density |
| How are values distributed? | histogram or density plot | bins/scale/sample context | pie chart for continuous data |
| How do values change over time? | line or area chart | time scale, units, meaningful baseline | unordered category bars |
| How do categories compare? | sorted bar or dot plot | units, baseline, uncertainty | 3D shapes or arbitrary area encoding |
| How do parts compose a whole? | stacked bar or restrained part-to-whole chart | total and category labels | many tiny slices or unrelated totals |
| Are two values related? | scatter plot | scales, sample size, uncertainty | implying causation from correlation |
| What exact implementation matters? | focused code view | path, symbol, status, relevant context | whole-file dump or fake editor chrome |
| What exact text changed? | unified diff or aligned before/after | path, hunk/symbol, add/remove labels | color-only or side-by-side mobile diff |

Tables are often the clearest comparison when exact values matter more than shape. A matrix becomes visual through alignment and concise encoding; it does not need ornamental cards.

## Combine views deliberately

Several views belong together only when they form a navigable explanation:

```text
overview
  -> one selected structure or dependency
       -> one selected interaction or lifecycle
            -> evidence and details
```

Good combinations:

- hierarchy plus dependency graph: ownership differs from usage;
- dependency graph plus sequence: static coupling differs from runtime order;
- process flow plus state diagram: steps differ from lifecycle validity;
- overview plus small multiples: one shared context, several comparable cases;
- current plus target plus transition: steady states differ from migration mechanics.

Weak combinations repeat the same boxes with slightly different styling. State the unique question beside every view; delete views without a distinct answer.

## Quantitative questions

Use position and length before angle, area, volume, or color intensity. Keep scales comparable across small multiples. Show units and meaningful baselines; distinguish missing data from zero.

Selection shortcuts:

- exact lookup matters → table;
- ranked magnitude → sorted bar or dot plot;
- time trend → line;
- distribution → histogram, box, or density plot;
- two-variable relationship → scatter plot;
- contribution over time → stacked area only when totals and composition both matter;
- uncertainty matters → interval, band, or distribution rather than a single precise mark.

Histogram bins encode adjacent numeric intervals and must touch. Separated bars encode discrete categories; do not style a histogram like a category bar chart.
Place direct value labels outside the plotted path or mark with deliberate clearance. A label that crosses its own line is not readable evidence.

Do not add a chart when one number and a sentence answer the question better.

## Code and change evidence

Code and diff views are not architecture levels. Use them only when the reader must inspect an exact contract, implementation, or change after the source owner has established why it matters.

```text
exact implementation -> focused code view
exact textual change -> unified diff
structural alternative -> aligned before/after at wide widths, unified excerpts on mobile
system or module relationship -> diagram first, code as linked evidence
```

Read [code-views.md](code-views.md) before rendering code or diffs.

## When no diagram is needed

Use concise text or a table when:

- the content is a short unordered list;
- there is no meaningful relationship, order, hierarchy, or quantity;
- exact wording is more important than visual pattern;
- the visual would merely place existing sentences inside boxes;
- accessibility or delivery constraints make the proposed visual less usable than a table.

If the user explicitly requests visualization, explain why a table is the appropriate visual structure and render it cleanly rather than returning prose alone.

## Failure modes

- **Tool-first selection** — choosing a diagram because the renderer supports it.
- **Data-shape determinism** — assuming timestamps always require a timeline or categories always require a pie.
- **Mixed relationship types** — containment, runtime calls, data flow, and deployment appear as identical arrows.
- **False sequence** — layout suggests time although the items are unordered.
- **False hierarchy** — vertical alignment suggests ownership that does not exist.
- **Unfair comparison** — different scales, criteria, or denominators make options look comparable.
- **Complete-map bias** — including every available field instead of the evidence needed for the question.
