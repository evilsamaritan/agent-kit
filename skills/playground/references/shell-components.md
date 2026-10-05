# Shell and Components

This reference owns the canonical shell contract and the vocabulary of content components that `visualization-shell.css` provides. Read it before writing any artifact markup: if a component exists here, use it; do not invent a parallel class. The pattern gallery [_preview.html](../assets/_preview.html) shows every component rendered; this file is the index, so the gallery rarely needs to be read as source.

`scripts/check-shell-contract.mjs` verifies that this file and the stylesheet describe the same classes.

## Contents

- [Shared system and compositions](#shared-system-and-compositions)
- [Navigation modes](#navigation-modes)
- [Hooks](#hooks)
- [Explorer shell skeleton](#explorer-shell-skeleton)
- [Structure components](#structure-components)
- [Relationship components](#relationship-components)
- [Wide and compact projections](#wide-and-compact-projections)
- [Comparison, time, and charts](#comparison-time-and-charts)
- [Code and diff](#code-and-diff)
- [Small helpers](#small-helpers)
- [Task-specific styles](#task-specific-styles)
- [Revisions and copies](#revisions-and-copies)

## Shared system and compositions

Every playground uses the shared stylesheet and theme runtime: [visualization-shell.css](../assets/visualization-shell.css) and [visualization-shell.js](../assets/visualization-shell.js). They own the tokens, typography, components, and the `Auto` / `Light` / `Dark` theme control. Pick one starting composition:

| Composition | File | Use for |
|---|---|---|
| standalone page | [visualization-page.html](../assets/visualization-page.html) | explainer, simulation, presentation, comparison, small review: header with theme control, then content |
| explorer shell | [visualization-shell.html](../assets/visualization-shell.html) | explorer and reference: section navigation, desktop sidebar or header switcher, mobile bottom sheet, deep links |

Optional scripts are added only when their content exists: `visualization-mermaid.js`, `visualization-code.js`, `visualization-diff.js`.

| Shared assets own — do not replace, restyle, or duplicate | The artifact owns — change freely |
|---|---|
| theme tokens, the theme control, its persistence, and the host-theme bridge | page metadata, title, kicker, summary, sections, and everything inside the content region |
| component styles and breakpoints | diagrams, charts, tables, prose, code, diffs, controls, task-specific layout |
| in the explorer shell: navigation container, location tracking, deep links, back/forward, sidebar or header, mobile bottom sheet, backdrop, scroll lock, focus containment | in the explorer shell: navigation labels and targets |

### Standalone page

```html
<main class="viz-main" data-viz-page data-viz-shell-revision="5">
  <header class="viz-header">
    <div class="viz-page-head">
      <div> … viz-kicker, viz-title, viz-summary … </div>
      <div class="viz-theme-control"> … viz-segmented with data-viz-theme-value buttons … </div>
    </div>
  </header>
  <div class="viz-content"> … sections, panels, task-specific blocks … </div>
</main>
```

`viz-page-head` places the title block and the theme control on one row that wraps on narrow screens. Task-specific layout (slides, control panels, annotation rails) uses a task prefix and the shared tokens.

### Host theme

The runtime follows `data-theme="light|dark"` on `<html>` when a host sets it, without overwriting the reader's stored choice; otherwise it uses the stored choice or the system preference. Do not write `data-theme` from the artifact.

A new reusable capability is added to the shared assets, not to one artifact. Deviate only when the user explicitly asks to redesign the shared system or to integrate the playground into an existing product UI, and report the deviation.

## Navigation modes

Set one attribute on the shell root; everything else stays identical.

| Justified view set | `data-viz-navigation` | Notes |
|---|---|---|
| one view | `switcher` | omit the section navigation entries; title, takeaway, visual, legend remain |
| two or three peer views | `switcher` | compact header with a visible view switcher |
| four to twelve sections of an explicitly requested reference | `sidebar` | persistent side navigation on wide screens, bottom sheet on narrow |
| more than twelve reference sections | `sidebar` | group with `viz-nav__group` and `viz-nav__label`; never one flat list |

Navigation never justifies more views. Reduce the view set first ([explorer template](../templates/explorer.md), view-set quality gate).

## Hooks

| Hook | On | Purpose |
|---|---|---|
| `data-viz-shell`, `data-viz-shell-revision`, `data-viz-navigation` | explorer shell root | activates navigation; records the asset revision; selects the mode |
| `data-viz-page`, `data-viz-shell-revision` | standalone page `main` | marks a page without the explorer shell; records the asset revision |
| `data-viz-menu`, `data-viz-menu-toggle`, `data-viz-menu-panel`, `data-viz-menu-dismiss` | sidebar, menu button, panel, close button and backdrop | mobile bottom sheet |
| `data-viz-nav` | `nav` | location tracking and deep links to `section[id]` |
| `data-viz-theme-value="auto|light|dark"` | theme buttons | theme control; the root carries `data-viz-theme` |
| `data-viz-section` | each section | focus target after navigation |
| `data-viz-mermaid`, `data-viz-compact-direction`, `data-viz-compact-at` | Mermaid container | render a `script[type="text/plain"]` source; optional direction swap at a container width (default 720) |
| `data-viz-diagram="mermaid|d2|plantuml|graphviz"`, `data-viz-compact-at` | compiled figure | identifies source format; selects theme and optional compact SVG variants |
| `data-viz-diagram-output`, `data-viz-diagram-theme="light|dark"`, `data-viz-diagram-view="wide|compact"`, `data-viz-diagram-source` | output, SVG images, source link | precompiled diagram contract ([compiled-diagrams.md](compiled-diagrams.md)) |
| `data-viz-mermaid-loading` | `<html>` | hides content until diagrams are laid out; required whenever Mermaid is present |
| `data-viz-code`, `data-viz-language` | code region | syntax highlighting with plain-text fallback |
| `data-viz-diff`, `data-viz-diff-mode`, `data-viz-diff-mode-value` | diff region and its buttons | split / unified control |

Set by the runtime, read-only for authors: `data-viz-theme-current`, `data-viz-horizontal-scroll`, `data-viz-render-error`, `data-viz-code-status`. `data-viz-pan-zoom` is reserved: the shell ships no pan/zoom; a task that adds one must mark the region with it so gesture capture is explicit.

## Explorer shell skeleton

```html
<div class="viz-shell" data-viz-shell data-viz-shell-revision="5" data-viz-navigation="switcher">
  <aside class="viz-sidebar" data-viz-menu> … viz-brand, viz-menu, viz-sidebar__body › viz-sheet__head, viz-nav, viz-sidebar__footer viz-theme-control › viz-segmented … </aside>
  <div class="viz-sheet-backdrop" data-viz-menu-dismiss></div>
  <main class="viz-main">
    <header class="viz-header">
      <span class="viz-kicker">Target architecture · proposal</span>
      <h1 class="viz-title">…</h1>
      <p class="viz-summary">…</p>
    </header>
    <div class="viz-content">
      <section class="viz-section" id="overview" data-viz-section tabindex="-1" aria-labelledby="overview-title">
        <div class="viz-section__head"><div class="viz-section__heading">
          <span class="viz-kicker">Component flow</span>
          <h2 class="viz-section__title" id="overview-title">What is the primary path?</h2>
          <p class="viz-summary">One-sentence takeaway.</p>
        </div><span class="viz-section__index">01 / 03</span></div>
        <div class="viz-panel"><div class="viz-canvas"> … one primary visual … </div>
          <div class="viz-legend">Only what is needed to decode the view.</div>
        </div>
      </section>
    </div>
  </main>
</div>
```

Copy the sidebar block from the shell file unchanged; only `viz-brand__meta`, `viz-brand__title`, and the `viz-nav__link` entries are content. `viz-section__index` is optional. `viz-panel` is the one bordered surface per visual; `viz-canvas` is its padded drawing area and never a scroll container.

## Structure components

| Component | Meaning | Markup |
|---|---|---|
| `viz-node-card` + `--external` `--system` `--interface` `--domain` `--data` `--risk` | a node: name plus one responsibility | `<div class="viz-node-card viz-node-card--domain"><strong>Name</strong><small>responsibility</small></div>` |
| `viz-node-grid` + `--2` `--4` | peers without formal containment | wrapper around node cards |
| `viz-boundary` + `--neutral` `--risk`, `viz-boundary__label` | real containment, ownership, trust, or deployment scope | `<div class="viz-boundary"><span class="viz-boundary__label">Application boundary</span> … </div>` |
| `viz-boundary-note` | one-line note under a boundary view | `<div class="viz-boundary-note">…</div>` |
| `viz-contract-rail` | a shared interface or extension point that members attach to | `<div class="viz-contract-rail">Environment ports</div>` |
| `viz-tree`, `viz-tree__item` | containment-only hierarchy | nested `ul`; `<span class="viz-tree__item">Name <small>note</small></span>` |
| `viz-entity` | a logical data entity | `<article class="viz-entity"><h3>player</h3><dl><dt>PK</dt><dd>id</dd>…</dl></article>` |
| `viz-deployment`, `viz-deployment__zone` | request path across operational zones | flow of node cards, connectors, and `viz-boundary viz-deployment__zone` |

The six category modifiers mean the same thing everywhere; their palette and meanings are in [visual-system.md](visual-system.md#diagram-palette). Use a category only when it carries meaning; otherwise leave the node neutral.

## Relationship components

| Component | Use | Markup |
|---|---|---|
| `viz-flow` + `viz-connector`, `viz-connector__line`, `--async` `--risk` `--vertical` | a simple one-to-one chain that reflows | `<span class="viz-connector"><span>requests</span><span class="viz-connector__line" aria-hidden="true"></span></span>` between node cards |
| `viz-mermaid` (`__output` is generated) | supported diagrams in a project that selects Mermaid browser rendering | see [mermaid-rendering.md](mermaid-rendering.md) |
| `viz-compiled`, `__caption`, `__output`, `__description`, `__error` | precompiled Mermaid, D2, PlantUML, or Graphviz SVG with theme and compact variants | see [compiled-diagrams.md](compiled-diagrams.md) |
| `viz-relationship-list`, `__route`, `__label`, `__status` + `--risk` `--unknown` | compact or textual projection of edges | `<li><span class="viz-relationship-list__route">A → B</span><span class="viz-relationship-list__label">depends on</span></li>` |
| `viz-message-list` | compact projection of a sequence | `<ol class="viz-message-list"><li><div><strong>Client → Shell</strong><small>open(gameId)</small></div></li></ol>` |
| `viz-diagram`, `viz-node` + category modifiers, `viz-edge` + `--primary` `--indirect` `--annotation` `--risk` | hand-written inline SVG whose geometry carries meaning, and charts | `<svg class="viz-diagram" viewBox="…" role="img">` with `rect.viz-node`, `path.viz-edge` |

`viz-connector` is only for a simple chain. Anything that branches, joins, or loops uses the selected diagram renderer or one SVG coordinate system; never rebuild routing from borders and absolutely positioned fragments.

## Wide and compact projections

```html
<div class="viz-canvas">
  <div class="viz-responsive__wide viz-mermaid" data-viz-mermaid> … </div>
  <div class="viz-responsive__compact"><ul class="viz-relationship-list"> … </ul></div>
</div>
```

`viz-responsive__wide` shows above 720px of available container width and `viz-responsive__compact` below. Both projections must state the same entities, relationships, order, and status ([responsive-layout.md](responsive-layout.md)). Prefer `data-viz-compact-direction` alone when re-running the same Mermaid source top-to-bottom is enough; then no second projection exists to keep in sync. Compiled diagrams can select a compact SVG pair generated from the same source with presentation parameters ([compiled-diagrams.md](compiled-diagrams.md)).

## Comparison, time, and charts

| Component | Use | Markup |
|---|---|---|
| `viz-matrix`, `viz-score` + `--best` | options against fixed criteria | `<table class="viz-matrix">`; every `td` carries `data-label` for the stacked mobile form |
| `viz-timeline`, `viz-timeline__item` | ordered stages or migration phases | `<div class="viz-timeline__item"><strong>Stage</strong><small>note</small></div>` |
| `viz-subviews`, `viz-subview` | aligned small multiples such as current and target | `<article class="viz-subview"><h3>Current</h3><p>…</p> … </article>` |
| `viz-chart-grid`, `viz-chart` | one or several small charts | `<article class="viz-chart"><h3>Trend</h3><p>question</p><svg class="viz-diagram" …></svg></article>` |

## Code and diff

```html
<div class="viz-code" data-viz-code data-viz-language="typescript">
  <div class="viz-code__bar"><span>src/runtime/module.ts · GameModule</span><span>proposed</span></div>
  <div class="viz-code__scroll"><pre><code><span class="viz-code__line" data-line="1"><span>export interface GameModule {</span></span>
<span class="viz-code__line viz-code__line--focus" data-line="2"><span>  mount(ports: Ports): Mounted</span></span></code></pre></div>
</div>
```

A diff adds `viz-diff` and `data-viz-diff data-viz-diff-mode="split"` to the same root, a `viz-segmented viz-diff__mode` control in the bar, and two bodies over the same source: `viz-diff__split` with two `viz-diff__pane` (each with a `viz-diff__pane-title`) and `viz-diff__unified`. Lines use `viz-code__line--add`, `--remove`, and `--empty` for alignment gaps, with a leading `<span class="viz-diff-sign" aria-label="added">+</span>`. `viz-token--keyword`, `--string`, `--type`, and `--comment` are produced by the highlighter; do not write them by hand. Presentation rules: [code-views.md](code-views.md).

## Small helpers

| Component | Use |
|---|---|
| `viz-kicker`, `viz-status` | small uppercase type label or status word |
| `viz-summary`, `viz-copy` | takeaway sentence; prose block limited to a readable measure |
| `viz-legend` | legend row at the bottom of a panel |
| `viz-toolbar`, `viz-segmented` | a quiet row of view-local controls; a segmented group of buttons |
| `viz-renderer-map` | a row of small labels under the page header |
| `viz-space-top` + `--compact` | vertical spacing between stacked blocks inside one canvas |

## Task-specific styles

Put additional CSS after the shared stylesheet, scope it to the content region, use the shared tokens, and give new classes a task prefix (`atlas-…`), never `viz-…`. Before adding one, check the tables above: most "missing" components already exist.

## Revisions and copies

Artifacts carry a copy of the shell, so copies drift. The shell root records the revision it was built from in `data-viz-shell-revision`; the assets carry the same number in a header comment. The revision increases whenever a class, hook, or token is removed or renamed. To bring an old artifact up to date, copy the shared assets (and the composition it started from) again and re-run the check:

```bash
node scripts/check-shell-contract.mjs path/to/artifact.html
```

The check reports missing hooks, duplicate IDs, broken navigation targets, browser diagram blocks without accessible titles, a missing live-render loading gate, compiled diagrams without source links or complete theme/view pairs, code regions without a language, `viz-` classes the shell does not define, and an outdated revision.
