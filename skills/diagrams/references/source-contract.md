# Source Contract and Handoff

How a diagram source is stored, varied, compiled, reviewed, and passed to other skills. Notation choice lives in [selection.md](selection.md); language syntax in the per-language references.

## Contents

- [Where the source lives](#where-the-source-lives)
- [Variants from one source](#variants-from-one-source)
- [Generated output](#generated-output)
- [Markdown hosts](#markdown-hosts)
- [Context around a diagram](#context-around-a-diagram)
- [Responsibility and handoff](#responsibility-and-handoff)
- [Verification](#verification)

## Where the source lives

| Situation | Source |
|---|---|
| Diagram belongs to one document and the host or build renders the fence | language-labelled fence in that document |
| Host cannot render the language, or several documents reuse the view | sidecar file beside the main consumer (`diagrams/module-map.d2`) |
| Standalone diagram with no document | sidecar next to the artifact that uses it; no document needed |
| Graph extracted from code | the extractor plus its filter; the emitted `.dot` is regenerated, not edited |

A build may extract a fence and compile it; then the fence stays authoritative and no sidecar duplicates it. Never keep the same topology in two languages to satisfy two renderers.

## Variants from one source

Theme (light/dark) and layout (wide/compact) variants are compiler parameters or presentation-only overrides applied to the same source:

- D2: `--theme` / `--dark-theme`, and a `direction: down` override for compact output.
- Mermaid: theme configuration and the flowchart direction (`LR` → `TB`).
- PlantUML: shared skin parameters selected per theme.
- Graphviz: `-G`, `-N`, `-E` attribute overrides and `rankdir`.

Renaming entities or changing endpoints, direction of a relationship, cardinality, order, or failure paths is not a variant; it is a different model and needs the owner.

## Generated output

- SVG (or PNG) is derived. Change the source or the parameters, then recompile.
- Pin the compiler version in the project's existing tooling when outputs are committed; a version change can move every edge.
- Check the compiler's exit status, not just the presence of an output file; some compilers write an error drawing.
- If outputs are committed, the build should detect stale output (compile and diff in CI).

## Markdown hosts

- Mermaid fences render natively on several code hosts and documentation generators; D2, PlantUML, and DOT usually need a build step or a committed SVG.
- When the target cannot render the chosen language, embed the compiled SVG and link the source directly beneath it.
- Check the actual target (repository host, docs site, IDE preview). "Markdown supports diagrams" is not a guarantee for every language.
- Never convert the language to satisfy a preview.

## Context around a diagram

Place next to every consequential diagram:

- a precise title phrased as the question it answers;
- scope and abstraction level;
- status: current, proposed, transitional, or retiring;
- one-sentence takeaway;
- a legend when line styles or colors carry meaning;
- a textual equivalent of consequential relationships, cardinality, or failure paths (screen readers and plain-text diffs depend on it).

A diagram of a proposal says it is proposed. Status is a word, not only a color.

## Responsibility and handoff

```text
Does the request change owners, boundaries, contracts, or behavior?
├── Yes -> architecture or the relevant domain owner resolves the model first
└── No  -> draw from the supplied model and verified evidence

What is the requested output?
├── a diagram (in chat, a file, a doc, a comment, a PR)   -> this skill
├── durable prose around it                              -> documentation
└── a separate explorable or themed web page             -> playground
```

Handoff to a writer or to `playground` includes the existing source blocks or files (not screenshots), the view question, status, authoritative vocabulary, entities and relationships, and open questions. The receiver keeps the language and topology; layout and theme are theirs. Contradictions with code or the model go back to the owner before they are presented as fact.

## Verification

1. Compare entities, endpoints, direction, relationship kinds, labels, order or cardinality, status, and failure paths with the model or the code.
2. Validate syntax; compile with the project's pinned tool and check the exit status.
3. Look at the output: overlapping labels, detached arrowheads, untraceable crossings, and clipped text are defects.
4. Check links, image paths, and rendering in the real documentation target.
5. Report exactly which of these ran. Missing tooling means the source is kept and the render is reported as unverified.
