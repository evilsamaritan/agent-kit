# Delivery and Host Contracts

Rendering, hosting, and publishing are capabilities of the active session, not assumptions of the skill. The artifact is the same responsive page on the shared assets in every case; only the delivery path and the host's page contract change.

## Contents

- [Choose the delivery path](#choose-the-delivery-path)
- [Host-native artifacts](#host-native-artifacts)
- [Local files](#local-files)
- [Single-file delivery](#single-file-delivery)
- [Host theme](#host-theme)
- [Dependencies and content security](#dependencies-and-content-security)
- [Authority](#authority)

## Choose the delivery path

```text
Do the host's own instructions define how pages are delivered (an artifact or preview tool)?
├── Yes -> follow them: build the page to the host's contract and use its tool
└── No  -> local HTML/CSS/JavaScript in the repository or the requested location
           └── one file needed for sharing or the host? -> single-file delivery
```

A raster snapshot may accompany a review, never replace the source of a long-lived artifact.

## Host-native artifacts

Some hosts render or publish HTML through their own tool and attach a page contract: a title rule, theme tokens on `:root`, a `data-theme` signal, a content security policy with an allowed CDN list, size limits, a phone-width layout rule. When such a host is active:

- read and follow its contract; it takes precedence over this skill's defaults where they differ;
- keep the shared tokens and components inside the host's page rules rather than adding a second token set;
- deliver one self-contained file when the host accepts only one;
- follow the host's rules on when its artifacts may be published. A private artifact the host's instructions call for is not public publication; public sharing still requires the user's request.

Inspect the actual output in the host rather than trusting that generation succeeded. If the host's contract cannot carry a required capability, say which, and deliver local HTML instead.

## Local files

Start from the composition that fits the form ([shell-components.md](shell-components.md)): copy the shared stylesheet and theme runtime, plus `visualization-page.html` or `visualization-shell.html`. Keep a model or data object separate from rendering code when the artifact has several views or will evolve. Provide a static or textual fallback for essential content. An existing product design system replaces the shared assets only when the user explicitly asks to integrate the playground into that product's UI.

## Single-file delivery

1. Build and check the artifact as separate files first.
2. Inline `visualization-shell.css` into `<style>` and each script into `<script>` in the original order: theme/shell runtime, then optional diff, code, Mermaid, and compiled-SVG (`visualization-diagram.js`) scripts (`type="module"` where the original had it).
3. Keep every hook, the early theme bootstrap, `data-viz-shell-revision`, and — when Mermaid is present — the loading gate and its `<noscript>` fallback.
4. Embed compiled diagram SVG inline or as `data:` URLs per theme; keep the editable diagram source available separately and linked.
5. Run the contract check on the combined file; it reads inline content the same way.

## Host theme

The theme runtime follows `data-theme="light|dark"` on `<html>` when a host sets it, and keeps the reader's stored choice untouched; without a host signal it uses the stored choice or the system preference. The early bootstrap in both compositions applies the host value before first paint. Do not write `data-theme` from the artifact and do not add a second token set; if a host uses a different signal, map it to a click on the matching `[data-viz-theme-value]` button.

Compiled SVG does not follow CSS variables when loaded through `<img>`: ship a light and a dark variant (or one SVG with embedded dark-mode styles) and switch by theme. Never fake dark mode with a color-inverting filter.

## Dependencies and content security

| Dependency | Used by | Connected preview | Durable, offline, or published output |
|---|---|---|---|
| Mermaid | `visualization-mermaid.js` | pinned module from `cdn.jsdelivr.net/npm` | vendor or bundle through the consuming repository |
| syntax highlighter | `visualization-code.js` | pinned module from `cdn.jsdelivr.net/npm`; source text stays readable if loading fails | vendor or bundle |
| D2, PlantUML, Graphviz, or pre-rendered Mermaid | compiled SVG shown by `visualization-diagram.js` | compile locally (`diagrams`) with theme and compact variants ([compiled-diagrams.md](compiled-diagrams.md)) | the same SVG, inline or adjacent |
| a utility CSS framework | task-specific content only | an opt-in browser build for a one-off prototype | compile through the repository's build |

A host with a content security policy allows only listed origins: check that every external module comes from one of them, or inline it. Runtime diagram compilers (WASM builds) are optional; pre-compiled SVG is always enough for D2, PlantUML, and Graphviz. Do not require the network merely to read an archived artifact, and do not load a browser-side CSS compiler to restyle the shared assets.

## Authority

| Action | Default authority |
|---|---|
| create or edit local source in scope | allowed by an implementation request |
| render or preview locally | allowed as validation |
| deliver through the host's artifact or preview tool as its instructions direct | allowed |
| install new dependencies | follows the normal environment and approval policy |
| publish publicly, host, share, or send externally beyond the host's private default | requires explicit user authorization |

Report the exact boundary reached: source created, contract check passed, rendered, light and dark inspected, browser-tested, delivered through a host, or published. These are different claims.
