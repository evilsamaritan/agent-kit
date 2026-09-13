# Code and Diff Views

## Contents

- [Boundary](#boundary)
- [Code view](#code-view)
- [Diff code view](#diff-code-view)
- [Selection](#selection)
- [Responsive behavior](#responsive-behavior)
- [Accessibility and evidence](#accessibility-and-evidence)
- [Failure modes](#failure-modes)

## Boundary

Code and diff views are implementation evidence, not architecture levels or substitutes for relationship diagrams.

- Architecture selects code evidence only when a public contract, dependency rule, type relationship, or migration mechanism materially supports the decision.
- Visualization selects the code/diff presentation, focus, annotations, responsive behavior, and theme-safe syntax palette.
- Code review owns whether the implementation is correct; a polished excerpt does not validate behavior.

Use a diagram to explain structure, time, state, ownership, or movement. Use a code view to show the exact implementation or contract. Use a diff view to show what changed.

## Code view

A focused code view includes:

- file path and optional symbol name;
- language;
- a small relevant excerpt with enough surrounding context;
- stable line numbers when they help discussion;
- one short annotation or highlighted range only when it answers the question;
- source status such as current, proposed, generated, or pseudocode.

Keep syntax color restrained. Color distinguishes token classes but does not replace readable text, emphasis, or annotations. Avoid editor chrome, minimaps, tab bars, fake window controls, and decorative terminal styling unless the environment itself is the subject.

Do not paste a whole file when a contract, branch, or function is the evidence. Preserve exact identifiers and formatting from authoritative source.

## Diff code view

Choose the form by the comparison task:

| Question | Preferred form |
|---|---|
| What changed in one small region? | unified diff |
| How do two implementations differ structurally? | aligned before/after |
| What moved or was renamed? | semantic change summary plus focused excerpts |
| What is the migration sequence? | evolution diagram plus per-step focused diff |

Always distinguish added, removed, and unchanged context with text prefixes or labels in addition to color. Preserve file path, hunk or symbol context, and enough unchanged lines to locate the change.

Do not manufacture a textual diff from semantically unrelated snippets. When formatting, import organization, or generated output overwhelms the intended change, show a focused semantic excerpt and state the omitted noise.

## Selection

```text
What must the reader verify?
├── exact current or proposed implementation
│   └── focused code view
├── exact textual change
│   └── unified diff view
├── structural difference between alternatives
│   └── aligned before/after code view
├── system/module relationship
│   └── diagram, with code only as linked evidence
└── behavioral correctness
    └── tests, trace, or review evidence; code visualization alone is insufficient
```

## Responsive behavior

Code preserves whitespace and line structure. Do not soft-wrap by default when wrapping would change readability or make a diff ambiguous.

- contain horizontal scrolling inside the code region, not the page;
- keep file path and status visible above the scroll region;
- use a unified diff on compact widths instead of side-by-side columns;
- shorten surrounding context before shrinking type;
- keep line numbers narrow and visually quiet;
- avoid sticky overlays that consume most of a mobile viewport.

## Accessibility and evidence

Expose code as selectable text, not only as an image. Use semantic `pre`/`code`, preserve a plain-text copy path, and label additions/removals without relying on red/green alone.

State whether the excerpt is copied from repository evidence, proposed code, pseudocode, or generated illustration. Link to the source file and line when available. A code view may be visually verified while its compilation, tests, and runtime behavior remain unverified; report those boundaries separately.

## Failure modes

- **Whole-file dump** — focus is lost in unrelated code.
- **IDE cosplay** — fake chrome consumes space without adding evidence.
- **Color-only diff** — additions and removals are indistinguishable without hue.
- **Wrapped ambiguity** — compact layout makes one line look like several changed lines.
- **Side-by-side mobile** — both columns become unreadable.
- **Code as architecture** — an excerpt replaces the missing system or module model.
- **Polish as proof** — syntax highlighting implies code was compiled or tested.
