# Runtime Output Strategy

Treat rendering capabilities as runtime features, not assumptions embedded in the skill.

## Capability ladder

This skill produces a separate web artifact. Use the first available option that supports the required structure:

1. **Active host-native interactive artifact capability** — use when callable in the current session and it can preserve the visual and responsive contracts.
2. **Local HTML/CSS/JavaScript** — the portable fallback for web previews, multi-view navigation, progressive disclosure, code/diff views, and interaction.
3. **Embedded Mermaid or SVG inside that artifact** — use per view when its topology benefits from a diagram renderer or custom geometry.
4. **Raster preview** — use only as a review or delivery snapshot, never as the sole source of a long-lived technical artifact.

Do not assume that a named product always exposes the same tools, installed skills, renderer versions, publishing capability, or file access. Inspect the active session.

Every output must be theme-safe. Prefer automatic adaptation; when the medium is static, provide paired light/dark variants or a neutral print-safe version if the artifact will appear on both surface types.

## Host-native capability

When a native visualizer is available:

- pass it the selected entities, relationships, groups, states, labels, and status semantics;
- map the default visual-system tokens and relationship grammar as closely as the capability permits;
- request automatic light/dark adaptation or generate equivalent theme variants when supported;
- preserve the visual question and abstraction level;
- request or retain editable source when long-term maintenance matters;
- inspect the actual output rather than trusting generation success;
- keep publication distinct from creation.

A native capability may render the visual, but it does not replace source analysis, diagram selection, or readability review.

## Embedded Mermaid

Prefer stable syntax supported by the target environment. Flowchart, sequence, and state diagrams are broadly useful; newer or specialized syntax requires renderer verification.

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

## Local HTML

Default to a local artifact when no suitable host-native renderer is callable. An existing project design system takes precedence. For a standalone artifact, use Tailwind for the page shell, responsive layout, typography, navigation, and controls; copy [visualization-shell.css](../assets/visualization-shell.css) for theme tokens, diagrams, charts, code, and semantic relationship primitives.

For a one-off local preview or host Playground with network access, Tailwind's Play CDN is the low-setup default:

```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
```

Play CDN is a development tool. For a durable, offline, published, or production artifact, compile Tailwind through the repository's existing build path or serve generated CSS locally. Do not silently add a framework dependency to an established project, and do not require the network merely to read an archived artifact.

Keep model/data separate from rendering code when the artifact has several views or will evolve. Provide a static or textual fallback for essential content. Default to system theme preference; add an `Auto`/`Light`/`Dark` control only when the artifact benefits from a persistent override.

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
