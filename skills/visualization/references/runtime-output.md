# Delivery and Runtime Output

Rendering and hosting capabilities are features of the active session, not assumptions of the skill. The artifact is the same in every case: responsive HTML on the canonical shell. Only the delivery path changes.

## Contents

- [Delivery paths](#delivery-paths)
- [Host-native artifact paths](#host-native-artifact-paths)
- [Local files](#local-files)
- [Single-file delivery](#single-file-delivery)
- [Optional dependencies](#optional-dependencies)
- [Authority](#authority)

## Delivery paths

Use the first option that supports the required structure:

1. **A host-native interactive artifact path** — when it is callable in the current session and can host the canonical shell unchanged.
2. **Local HTML, CSS, and JavaScript** — the portable default for previews, multi-view navigation, disclosure, code and diff views, and interaction.
3. **A raster snapshot** — only as a review or delivery snapshot, never as the sole source of a long-lived artifact.

Do not assume a named product always exposes the same tools, renderer versions, publishing ability, or file access. Inspect the active session. Running inside a different agent, preview tool, or repository is not a reason to change the chrome.

## Host-native artifact paths

When the host can render or publish HTML:

- give it the artifact built on the shared shell; do not accept host-generated replacement navigation, theme controls, or responsive wrappers;
- if the host accepts only one file, use [single-file delivery](#single-file-delivery);
- if the host controls light and dark itself, bridge its signal to the shell's control instead of adding a second theme mechanism (below);
- inspect the actual output rather than trusting that generation succeeded;
- keep publication distinct from creation.

If the host cannot preserve the shell contract, deliver local HTML instead.

## Local files

Copy the three shell files together and build inside them ([shell-components.md](shell-components.md)). Keep the model or data separate from rendering code when the artifact has several views or will evolve. Provide a static or textual fallback for essential content. An existing product design system replaces the shell only when the user explicitly asks to integrate the visualization into that product's UI.

## Single-file delivery

Some hosts and some sharing paths need one self-contained HTML file.

1. Build and check the artifact as separate files first.
2. Inline `visualization-shell.css` into a `<style>` element and each script into a `<script>` element, in the original order: shell, then optional diff, code, and Mermaid modules (`type="module"` where the original had it).
3. Keep every hook, the early theme bootstrap, `data-viz-shell-revision`, and — when Mermaid is present — the loading gate and its `<noscript>` fallback.
4. Run the contract check on the combined file; it reads inline content the same way.

**Bridging a host theme.** When the host sets its own theme signal, translate it into the shell's control so persistence, tokens, and diagram re-rendering all follow the one path:

```js
function followHostTheme(theme /* "light" | "dark" | "auto" */) {
  document.querySelector(`[data-viz-theme-value="${theme}"]`)?.click()
}
```

Do not write theme attributes directly and do not add a second set of tokens.

## Optional dependencies

| Dependency | Used by | Connected preview | Durable, offline, or published output |
|---|---|---|---|
| Mermaid | `visualization-mermaid.js` | pinned CDN module | vendor or bundle through the consuming repository ([mermaid-rendering.md](mermaid-rendering.md#dependencies-and-durability)) |
| syntax highlighter | `visualization-code.js` | pinned CDN module; source text stays readable if loading fails | vendor or bundle |
| a utility CSS framework | task-specific content only | an opt-in browser build for a one-off prototype | compile through the repository's build or serve generated CSS |

The shared CSS already owns tokens, themes, navigation, responsive chrome, and components. Do not load a browser-side CSS compiler merely to restyle the shell: runtime compilation causes a flash of unstyled, reflowing content. Do not silently add a framework dependency to an established project, and do not require the network merely to read an archived artifact.

## Authority

| Action | Default authority |
|---|---|
| create or edit local source in scope | allowed by an implementation request |
| render or preview locally | allowed as validation |
| open or show the result in the active workspace | allowed when useful |
| install new dependencies | follows the normal environment and approval policy |
| publish, host, share, or send externally | requires explicit user authorization |

Report the exact boundary reached: source created, contract check passed, rendered, light and dark inspected, browser-tested, or published. These are different claims.
