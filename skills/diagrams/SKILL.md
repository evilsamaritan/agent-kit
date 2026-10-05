---
name: diagrams
description: "Author diagrams as code: pick the view and notation, write Mermaid, D2, PlantUML, or Graphviz source that keeps the model's meaning, and compile SVG locally. Use for 'draw this', sequence, state, ER, dependency, or architecture diagrams in Markdown. Not for interactive HTML (playground) or design decisions (architecture)."
argument-hint: "[what to draw] [language]"
---

# Diagrams as Code

A diagram is a second way to state a model: its entities, relationships, order, and boundaries. This skill owns the question → view → notation choice, the editable source, its semantic check, and local compilation. The model itself belongs to its technical owner.

## Scope and boundaries

| Concern | Owner |
|---|---|
| Which owners, boundaries, contracts, and states exist; which architecture views matter | `architecture` or the relevant domain skill |
| The document around the diagram: reader, structure, prose, links | `documentation` |
| View, notation, source text, semantic fidelity, compiler commands, Markdown placement | **this skill** |
| A separate web artifact: themes, responsive projections, navigation, interactivity, browser rendering | `playground` |
| Quantities, distributions, trends | a chart, not a graph language |

Every skill can draw a small diagram for its own work using this skill's conventions. Drawing does not require a document, an architect, or a web artifact, and none of them requires a diagram.

When describing existing code, confirm entities and edges from the code. Mark proposals and unknowns. New technical design goes through `architecture`, not through diagram edits.

## Decision tree

```text
1. Is there a relationship, order, state, boundary, or containment to inspect?
   ├── No  -> text or a table; do not put paragraphs in boxes
   └── Yes -> 2

2. Which question must the reader answer?  (references/selection.md)
   structure · dependencies · process · interaction order · valid states ·
   data relationships · data/authority flow · deployment · change over time

3. Which language?  first match wins
   a. the user named one (including an explicit conversion)
   b. the source being shown or updated already has one
   c. the project's stated convention for new diagrams
   d. the established practice and documentation build of the repository
   e. none: choose by required notation, source readability, host support,
      and available tooling, then record the convention where the project
      keeps its instructions

4. Can that language state this view without losing meaning?
   ├── Yes -> use it; cosmetic preference is not a reason to switch
   └── No  -> name the missing capability and use the specialized notation
              (detailed UML -> PlantUML; extracted graph or layout algorithm -> Graphviz)
```

Mermaid and D2 are both reasonable primary languages; no language is a global default. A project with mixed formats keeps them. Changing the primary language does not convert old sources.

## Core rules

1. **One editable source per view.** A fenced block in Markdown or a sidecar file (`.mmd`, `.d2`, `.puml`, `.dot`) next to its consumer. SVG is generated output; never edit it by hand.
2. **Stable IDs, readable labels.** Keys identify endpoints; labels are display text. Renaming a label must not rewire an edge.
3. **Preserve the model exactly.** Entities, endpoints, direction, relationship kind, label, order, cardinality, status, and failure paths come from the owner. A layout or theme change never alters them.
4. **Variants come from the same source.** Light/dark and wide/compact outputs differ only in presentation parameters such as theme or `direction`. A second hand-written topology for a narrow screen is a second model that will drift.
5. **Label consequential edges with a verb** (`calls`, `publishes`, `reads`, `owns`). One relationship kind per line style in a diagram.
6. **Containment means containment.** Use nesting or subgraphs only for real ownership, trust, or deployment scope.
7. **One question, one dominant direction.** Arrows that must cross repeatedly usually mean two views.
8. **Say what it is.** Put a precise title or question, scope, status (current, proposed, transitional), a one-sentence takeaway, and a textual equivalent for consequential relationships next to the diagram.
9. **Never switch languages silently.** If a host cannot render the chosen language, compile SVG and link the source; do not rewrite D2 as Mermaid to make a preview appear.
10. **Compile locally.** Use the project's pinned tool. Do not send source to a public rendering service unless the user asks for it.
11. **Report what was verified.** Syntax checked, compiled with exit status 0, and rendered output inspected are three different claims.

## Languages at a glance

| Language | Strong fit | Local compile (check the installed version's help) | Reference |
|---|---|---|---|
| Mermaid | flowchart, sequence, state, ER; hosts that render fenced blocks natively | `mmdc -i view.mmd -o view.svg` | [mermaid.md](references/mermaid.md) |
| D2 | architecture, containment, dependencies, process, sequence, SQL tables | `d2 --layout=elk view.d2 view.svg` | [d2.md](references/d2.md) |
| PlantUML | detailed UML: activation, fragments, composite states, multiplicities | `java -jar plantuml.jar -tsvg view.puml` | [plantuml.md](references/plantuml.md) |
| Graphviz / DOT | extracted graphs; explicit layout algorithm | `dot -Tsvg view.dot -o view.svg` | [graphviz.md](references/graphviz.md) |

The language, the layout engine, and the delivery path are three separate choices. A different engine can remove crossings without changing the model; a different language cannot fix a model problem.

## Markdown placement

````markdown
## Module dependencies

Game modules depend only on the environment ports the host provides.

```d2
direction: right
host: Application host
ports: Environment ports
module: Game module
host -> ports: provides
module -> ports: depends on
```
````

- The fence is the source when the documentation host renders it or the build compiles it. Otherwise keep a sidecar and embed its output with a source link: `![Module dependencies](diagrams/module-map.svg)` plus `[Source](diagrams/module-map.d2)`.
- Code comments get at most a short text diagram of a local invariant; link a larger view from the comment.
- A PR description may include a diagram when it clarifies the change, under the same source rules.

Details, handoff, and review checklists: [source-contract.md](references/source-contract.md).

## Context Adaptation

| Situation | Approach |
|---|---|
| Repository docs on a host that renders Mermaid fences | Mermaid fences are the simplest durable source when Mermaid is the convention |
| Project convention is D2 or PlantUML | sidecar source plus compiled SVG committed or built in CI; never a Mermaid stand-in |
| Architecture brief or ADR | `architecture` picks the views; this skill writes them |
| Answer in chat | a fenced source the user can paste; compile only if asked |
| Generated dependency graph | Graphviz with a reproducible extractor; filter to the question |
| Separate explorable web page | hand the same sources to `playground` |
| No compiler installed | keep the source, state that the render is unverified |

## Anti-Patterns

- **Tool-first selection** — the view is chosen because the renderer supports it. Start from the reader's question.
- **Renderer-driven design** — boxes are merged or edges dropped because a layout looked crowded. Split the view instead.
- **Silent conversion** — supplied D2 becomes Mermaid for a preview. Compile the original.
- **Two topologies** — a hand-made compact diagram next to the real one. Re-run the same source with `direction: down` or a compact layout parameter.
- **Hand-edited SVG** — fixes vanish at the next compile and the source lies. Change the source or the parameters.
- **Hairball** — a full generated graph nobody can read. Filter to the decision.
- **Mixed arrows** — calls, data flow, containment, and deployment drawn with one line style.
- **False order or hierarchy** — layout implies sequence or ownership that does not exist.
- **Prose in boxes** — sentences arranged as nodes with no relationships between them.
- **Flattened UML** — guards, fragments, or multiplicities approximated with generic arrows when the model needs them.
- **Remote rendering by default** — architecture source sent to a public service to avoid installing a tool.

## Related Knowledge

- `architecture` — owns the model and which architecture views to draw; see its architecture-views reference.
- `documentation` — document mode, structure, and prose around diagrams.
- `playground` — web artifacts that embed these sources: browser adapters, theming, responsive projections.

## References

- [selection.md](references/selection.md) — reader question → view → notation, specialized cases, when not to draw
- [source-contract.md](references/source-contract.md) — source files, variants, Markdown handoff, review and verification
- [mermaid.md](references/mermaid.md), [d2.md](references/d2.md), [plantuml.md](references/plantuml.md), [graphviz.md](references/graphviz.md) — syntax, semantics, compilation, limits
- [workflows/author.md](workflows/author.md) — draft, check, compile, and hand off one diagram
