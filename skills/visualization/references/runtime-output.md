# Runtime Output Strategy

Treat rendering capabilities as runtime features, not assumptions embedded in the skill.

## Capability ladder

This skill produces a separate web artifact. Use the first available option that supports the required structure:

1. **Active host-native interactive artifact capability** — use when callable in the current session and it can emit or host the canonical visualization shell unchanged.
2. **Local HTML/CSS/JavaScript** — the portable fallback for web previews, multi-view navigation, progressive disclosure, code/diff views, and interaction.
3. **Embedded Mermaid or SVG inside that artifact** — use per view when its topology benefits from a diagram renderer or custom geometry.
4. **Raster preview** — use only as a review or delivery snapshot, never as the sole source of a long-lived technical artifact.

Do not assume that a named product always exposes the same tools, installed skills, renderer versions, publishing capability, or file access. Inspect the active session.

Every output must be theme-safe. Prefer automatic adaptation; when the medium is static, provide paired light/dark variants or a neutral print-safe version if the artifact will appear on both surface types.

## Host-native capability

When a native visualizer is available:

- use the shared shell assets for navigation, themes, responsive chrome, and interaction; do not accept runtime-generated replacement chrome;
- pass it the selected entities, relationships, groups, states, labels, and status semantics;
- map the default visual-system tokens and relationship grammar as closely as the capability permits;
- request automatic light/dark adaptation or generate equivalent theme variants when supported;
- preserve the visual question and abstraction level;
- request or retain editable source when long-term maintenance matters;
- inspect the actual output rather than trusting generation success;
- keep publication distinct from creation.

A native capability may render the visual, but it does not replace the canonical shell, source analysis, diagram selection, or readability review. If the capability cannot preserve the shell contract, use local HTML instead.

## Embedded Mermaid

Prefer stable syntax supported by the target environment. Flowchart, sequence, and state diagrams are broadly useful; newer or specialized syntax requires renderer verification.

Read [renderer-selection.md](renderer-selection.md) before choosing Mermaid. Mermaid owns standard diagram topology only; the shared HTML shell continues to own navigation, prose, disclosure, themes, responsive alternatives, charts, and code/diff content.

Use:

- stable identifiers separate from display labels;
- directional flow appropriate to the question;
- action labels on important edges;
- subgraphs only for real groups or boundaries;
- accessible title and description syntax where supported;
- minimal styling so semantics remain portable;
- the default palette when custom theming is supported without making the source host-specific.

Render or preview changed diagrams when tooling exists. If it does not, report syntax-only validation explicitly.

For a simple diagram living directly in an architecture document, let the `architecture` skill own it without invoking this skill. When Mermaid is embedded in HTML, use the modifiable base theme, map separate light/dark `themeVariables`, set `darkMode` correctly, and re-render when the active theme changes.

For standalone HTML that renders Mermaid after load, add `data-viz-mermaid-loading` to the root element before first paint, keep the no-script visibility fallback from `_preview.html`, and set `history.scrollRestoration = "manual"` in the early head bootstrap. The renderer commits completed SVGs together, restores the requested hash once, and then reveals the main content. Without that loading gate, asynchronous layout can make refresh and deep links visibly jump.

The provided renderer imports a pinned Mermaid build from a CDN for connected local previews. Treat that as a preview dependency, not an archival guarantee. For durable, offline, published, or production artifacts, vendor or bundle Mermaid through the consuming repository's existing build while preserving the same source and rendering contract. Essential content still needs the textual fallback because network and renderer failure are valid states.

## Local HTML

Default to a local artifact when no suitable host-native renderer is callable. For a standalone artifact, copy the canonical [visualization-shell.html](../assets/visualization-shell.html), [visualization-shell.css](../assets/visualization-shell.css), and [visualization-shell.js](../assets/visualization-shell.js) together. Keep the shell DOM and hooks; choose only `switcher` or `sidebar`, replace its example views and navigation entries, and add content-specific code without duplicating shell behavior. Add [visualization-mermaid.js](../assets/visualization-mermaid.js) only when the artifact contains Mermaid source. Its optional `data-viz-compact-direction` hook changes layout direction at compact viewport widths without changing the canonical graph. Tailwind may extend content layout and typography, while the shared CSS owns tokens, themes, responsive chrome, diagram semantics, and connectors.

An existing product design system replaces this shell only when the user explicitly asks to integrate the visualization into that product UI. Merely running inside a different agent, Playground, or repository is not an exception.

Do not load Tailwind's browser compiler merely to style the canonical shell or reproduce utilities already present in the shared CSS. Runtime compilation can create a flash of unstyled or reflowing content during refresh. If a one-off content prototype genuinely benefits from Tailwind and network access is acceptable, Play CDN remains an opt-in development tool:

```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
```

Keep those utilities inside the content region; the canonical CSS still owns shell layout, themes, navigation, and responsive chrome. For a durable, offline, published, or production artifact, compile Tailwind through the repository's existing build path or serve generated CSS locally. Do not silently add a framework dependency to an established project, and do not require the network merely to read an archived artifact.

Keep model/data separate from rendering code when the artifact has several views or will evolve. Provide a static or textual fallback for essential content. Add [visualization-diff.js](../assets/visualization-diff.js) only when a diff view needs a split/unified control; keep it separate from the content-neutral shell runtime. Default to system theme preference; add an `Auto`/`Light`/`Dark` control only when the artifact benefits from a persistent override.

## Delivery boundary

| Action | Default authority |
|---|---|
| create or edit local source in scope | allowed by an implementation request |
| render or preview locally | allowed as validation |
| open/show the result in the active workspace UI | allowed when useful |
| install new dependencies | requires the normal environment/approval policy |
| publish, host, share, or send externally | requires explicit user authorization |

Report the exact boundary: source created, syntax checked, rendered, light/dark inspected, browser-tested, or published. These are different claims.

## Further reading

- [Tailwind Play CDN](https://tailwindcss.com/docs/installation/play-cdn) — development-only browser setup and current script source
- [Mermaid diagram syntax](https://mermaid.js.org/intro/getting-started.html) — supported diagram types and rendering guidance
- [Mermaid accessibility](https://mermaid.js.org/config/accessibility.html) — accessible titles and descriptions
