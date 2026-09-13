# Default Visual System

## Contents

- [Reproducible default](#reproducible-default)
- [Visual brief](#visual-brief)
- [Theme behavior](#theme-behavior)
- [Color tokens](#color-tokens)
- [Typography and spacing](#typography-and-spacing)
- [Shell selection](#shell-selection)
- [Diagram palette](#diagram-palette)
- [Relationships and arrows](#relationships-and-arrows)
- [Information disclosure](#information-disclosure)
- [Controlled exceptions](#controlled-exceptions)
- [Further reading](#further-reading)

## Reproducible default

Use this system whenever the user asks for a clean, polished, or consistent web visualization without supplying another visual language. It should produce a recognizable family across host-native interactive artifacts and local HTML with embedded Mermaid or SVG without requiring the same implementation.

The tone is a quiet Codex-like technical workspace. Treat this as a tonal reference, not brand imitation:

- warm near-white light surfaces and neutral charcoal dark surfaces;
- neutral navigation and selection; chroma belongs to information, not shell decoration;
- soft categorical fills only when categories carry meaning;
- crisp borders and labelled arrows instead of decoration;
- compact, breathable spacing and readable type;
- nearly flat surfaces with little or no shadow;
- no gradients, glass effects, pictorial icon sets, or presentation chrome;
- light and dark themes with equivalent semantics.

Do not imitate a supplied example pixel for pixel. Preserve its useful hierarchy, relationships, density, and interaction patterns within this shared system.

## Visual brief

Before rendering, define this compact contract internally:

| Field | Decision |
|---|---|
| question | one sentence the primary view answers |
| audience | expected technical depth and vocabulary |
| source status | current, inferred, proposed, transitional, or mixed |
| views | one job per view, ordered overview to detail |
| shell | inline, compact document, or explorer |
| categories | only distinctions that need stable visual identity |
| relationships | arrow direction and line-style meaning |
| disclosure | what is visible first and what moves to detail |
| themes | automatic light/dark plus any requested manual control |
| medium | native interactive artifact or HTML with semantic HTML, Mermaid, SVG, or canvas views |

This brief is a generation constraint, not mandatory prose in the delivered artifact.

## Theme behavior

Support both light and dark themes for every HTML or host-native artifact that can adapt to user preference.

1. Default to the operating-system preference.
2. Declare support for both schemes so browser-provided controls and scrollbars match.
3. Use semantic tokens; never invert the rendered page or diagram.
4. If a theme control is useful, offer `Auto`, `Light`, and `Dark`, default to `Auto`, persist only the explicit override, and place it in the navigation or a quiet utility area rather than beside the document title.
5. Update embedded diagrams and charts with the same token mapping when the theme changes.
6. Test both themes independently; passing contrast in one theme proves nothing about the other.
7. Keep node category and status meanings identical across themes.

For repository Mermaid rendered by an unknown host, avoid hard-coded light-only fills. For embedded Mermaid, initialize separate light/dark `themeVariables` and re-render on preference or explicit-theme changes.

A static artifact cannot switch automatically. When it must work on both light and dark surfaces, provide paired variants or use a deliberately neutral, print-safe treatment; state which strategy was used.

## Color tokens

Use semantic names so implementations can map the system to native capabilities. The values below are the portable HTML/SVG default and are implemented by [visualization-shell.css](../assets/visualization-shell.css).

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `bg` | `#fafaf8` | `#171716` | page/canvas backdrop |
| `surface` | `#ffffff` | `#1f1f1d` | primary content surface |
| `surface-subtle` | `#f5f5f2` | `#1b1b1a` | navigation and grouped background |
| `surface-raised` | `#ffffff` | `#272725` | overlay or selected details only |
| `text` | `#2f302d` | `#eeeeeb` | primary text |
| `text-muted` | `#666762` | `#aaa9a4` | supporting text |
| `border` | `#e3e3df` | `#383836` | quiet grouping borders |
| `border-strong` | `#858681` | `#858580` | essential diagram/UI boundaries |
| `accent` | `#343532` | `#f1f1ed` | selected state, links, primary scope |
| `accent-soft` | `#ecece8` | `#30302d` | selected background |
| `focus` | `#5267d7` | `#9ba8ff` | visible keyboard focus |

The primary text, muted text, accent, focus, and strong-border pairs are selected to meet or exceed common WCAG AA contrast targets on their adjacent default surfaces. Recheck contrast after any token change and for every actual adjacency.

After changing the shared CSS tokens, run `node scripts/check-theme-contrast.mjs` from the skill base directory. This checks both themes' primary text, muted text, accent, focus, essential boundary, code/diff text adjacencies, category line/fill pairs, and parity between explicit and automatic dark tokens.

## Typography and spacing

Use a system sans-serif stack with ordinary letterforms and stable metrics. Prefer `Inter` when already available; do not fetch a font only for a visualization.

| Role | Size / line height | Weight |
|---|---|---|
| page title | `clamp(1.5rem, 2vw, 1.875rem) / 1.12` | 700 |
| section title | `1.125rem / 1.25` | 700 |
| node title | `0.8125rem / 1.25` | 650 |
| body | `0.875–0.9375rem / 1.5` | 400 |
| diagram/label | `0.8125rem / 1.35` | 500 |
| kicker/status | `0.6875rem / 1.3`, `0.075em` tracking | 700 |

Use a 4px base spacing system: `4`, `8`, `12`, `16`, `20`, `24`, `32`, and `48px`. Default page gutters are `16px` on compact screens and `24px` on wide screens. Limit prose to about `72ch`; let diagrams use the available width. Prefer fewer wrappers and tighter section rhythm before reducing readable type.

Use radii of `7–8px` for controls and nodes and `10px` for panels and boundaries. Prefer one-pixel borders and surface contrast over shadows. Reserve a subtle shadow for overlays or a single raised details panel.

## Shell selection

Match navigation to information depth:

| Content | Default shell |
|---|---|
| one view | no application shell; title, takeaway, visual, legend |
| two or three peer views | compact header plus visible view switcher or in-page headings |
| four to twelve ordered sections | persistent side navigation on wide screens, explicit menu on narrow screens |
| more than twelve sections | group by domain/question and add search or quick navigation; do not show an unbounded flat list |

A full explorer uses:

```text
bounded navigation
  + source/status/scope header
  + section type, title, and one-sentence takeaway
  + one primary visual canvas
  + optional alternate representation of the same scope
  + compact legend, boundary note, or evidence footer
```

Keep global chrome visually quieter than the content. The first screen should show orientation and the primary visual, not an introduction wall.

## Diagram palette

Start neutral. Add categorical fills only when category is part of the explanation.

| Category | Light fill / line | Dark fill / line | Typical meaning |
|---|---|---|---|
| system/core | `#eef3f4` / `#607d85` | `#232b2d` / `#8da6ac` | shared runtime, platform, core mechanism |
| interface/orchestration | `#f3f0f4` / `#765f80` | `#2c282f` / `#b2a0ba` | UI shell, routing, coordination |
| domain/capability | `#eef4ef` / `#4f705b` | `#252d27` / `#90ad98` | business/game/feature module |
| data/state | `#f6f2e8` / `#857346` | `#302c23` / `#b9a478` | store, authoritative state, projection |
| external/neutral | `#f5f5f3` / `#747671` | `#292927` / `#a0a09a` | actor, dependency, environment, constraint |
| risk/failure | `#f8eeec` / `#8b4f49` | `#322826` / `#ca948c` | failure, forbidden path, unresolved risk |

Use the same category mapping in every view. Status is separate from category: show `Proposed`, `Transitional`, `Retiring`, `Inferred`, or `Unknown` as text badges and border treatments, not by replacing the category color.

For non-architecture visuals, reinterpret categories by semantic role rather than copying software labels. If category does not matter, use neutral nodes and one accent for the primary path.

## Relationships and arrows

Use one stable line grammar within an artifact:

| Treatment | Default meaning |
|---|---|
| solid `1.5–2px` arrow | direct call, dependency, transition, or primary flow |
| dashed `1.5–2px` arrow | asynchronous event, indirect influence, or mediated flow |
| dotted line without strong arrow | annotation, constraint, or non-flow association |
| stronger accent line | selected or primary path, not a new relationship type |
| risk-colored line plus label | failure, forbidden dependency, or violated rule |

Every important arrow has a verb phrase of roughly two to five words. Point the arrow in the semantic direction and state the convention in the legend when readers might expect the opposite. Place labels near the middle of the edge with an opaque theme-matched background when lines could pass behind text.

Use simple arrowheads around `8–10px`, consistent bends, and orthogonal routing when it reduces crossings. Avoid animated arrows unless motion itself is the subject and the animation can be paused.

## Information disclosure

Use this default depth:

```text
Level 1: orientation
  scope, status, primary takeaway, overview

Level 2: relationships
  selected dependency, flow, lifecycle, or comparison

Level 3: evidence
  contracts, API, ownership, rationale, edge cases, source links
```

Keep levels freely navigable. This is progressive disclosure, not a wizard. Preserve spatial identity when filtering or switching current/target views so readers can compare without rebuilding their mental map.

Tabs or segmented controls switch alternate representations of the same scope. Side navigation or headings move between topics. Details panels reveal selected-element evidence. Do not use all three mechanisms when one or two are sufficient.

## Controlled exceptions

Deviate from this system when:

- the consuming project has an established accessible visual system;
- the user supplies explicit brand or delivery requirements;
- the native renderer cannot express a token or interaction safely;
- a recognized notation requires different shapes or layout;
- print, projection, localization, or high-density data imposes a concrete constraint.

Keep the semantic grammar, information hierarchy, theme parity, and verification requirements even when token values change. Record the reason for a meaningful deviation.

## Further reading

- [C4 diagram checklist](https://c4model.com/diagrams/checklist) — titles, element types/responsibilities, legends, and labelled directional relationships
- [CSS Color Adjustment](https://www.w3.org/TR/css-color-adjust-1/) — `color-scheme` and user-preferred light/dark rendering
- [WCAG use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) — do not encode meaning through color alone
- [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) — contrast for essential graphics and controls
- [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — overview before secondary detail
- [Structurizr filtered views](https://docs.structurizr.com/ui/diagrams/filtered-view) — stable positions across filtered projections
- [GOV.UK tabs](https://design-system.service.gov.uk/components/tabs/) — use tabs for related alternate content, not page navigation
