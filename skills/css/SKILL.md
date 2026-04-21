---
name: css
description: Design modern CSS — Grid, Flexbox, custom properties, cascade layers, container queries, :has(), CSS nesting, @scope, scroll-driven animations, View Transitions, color functions, logical properties. Use when writing styles, building layout primitives, theming (light/dark), responsive design, or animation. Do NOT use for semantic markup (use html), ARIA (use accessibility), UX decisions (use design), or component architecture (use frontend).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# CSS

Modern layout and visual systems. Logical properties by default. No `outline: none` without a visible replacement. No `px` for font sizes — use `rem`. No layout with floats — use Grid or Flexbox.

---

## Hard Rules

- Font sizes in `rem` (never `px`) — respects user's root size preference
- Text size controlled with `clamp(min, fluid, max)` — never raw `vw`
- Focus indicators **always visible** — if you remove the native outline, replace it
- Use logical properties: `margin-inline`, `padding-block`, `inset-inline-start` — not `margin-left`/`right`
- Color in `oklch()` when defining new palettes — perceptually uniform, gamut-aware
- Respect `prefers-reduced-motion` for any animation > 100ms
- Token-first: semantic custom properties, not magic numbers
- Every theme pair should use `light-dark()` or a single `color-scheme: light dark` strategy — not two entire sheets

---

## Layout: Grid vs Flexbox

| Use Grid when | Use Flexbox when |
|---------------|------------------|
| 2D layout (rows AND columns) | 1D layout (row OR column) |
| Page-level structure | Component-level alignment |
| Precise cell placement needed | Content-driven sizing |
| Named areas simplify reasoning | Simple centering or distribution |
| Overlapping elements (`grid-area` overlap) | Wrapping item lists |

**Compose them.** Grid for page, Flexbox inside grid cells for component alignment.

```css
/* Holy grail layout — five lines */
.page {
  display: grid;
  grid-template: "header header" auto
                 "nav    main"   1fr
                 "footer footer" auto / 250px 1fr;
  min-height: 100dvh;
}
```

→ Full layout recipes: `references/layout-patterns.md`.

---

## Custom Properties (Design Tokens)

```css
:root {
  color-scheme: light dark;

  --color-primary: oklch(55% 0.2 260);
  --color-surface: light-dark(oklch(98% 0.01 260), oklch(15% 0.01 260));
  --color-text:    light-dark(oklch(25% 0.02 260), oklch(92% 0.02 260));

  --space-unit: 0.25rem;
  --space-s: calc(var(--space-unit) * 2);
  --space-m: calc(var(--space-unit) * 4);
  --space-l: calc(var(--space-unit) * 6);

  --radius-s: 0.25rem;
  --radius-m: 0.5rem;

  --shadow-s: 0 1px 2px oklch(0% 0 0 / 0.1);
  --shadow-m: 0 4px 12px oklch(0% 0 0 / 0.15);
}

/* Component tokens — map semantic names to primitives */
.card {
  background: var(--color-surface);
  color: var(--color-text);
  padding: var(--space-m);
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-s);
}
```

**Fallbacks:** `var(--color, hotpink)` — always provide a fallback for optional properties; the hotpink makes missing tokens obvious during development.

**Two-layer token system:** primitives (`--color-blue-500`, `--space-unit`) → semantic (`--color-primary`, `--space-m`). Components reference only the semantic layer.

---

## Modern CSS Features

| Feature | What it does | Status (early 2026) |
|---------|-------------|---------------------|
| `:has()` | Parent selector — style parent by children | Baseline 2024 |
| CSS nesting | `& .child { }` inside parent rule | Baseline 2024 |
| `color-mix()` | Blend colors in any color space | Baseline 2024 |
| `@starting-style` | Define initial state for entry animations | Baseline 2024 |
| Popover API `::backdrop` | Top-layer popovers with backdrop | Baseline 2024 |
| `light-dark()` | Pick value by `color-scheme` | Baseline 2024 |
| `text-wrap: balance/pretty` | Even line lengths, avoid orphans | Baseline 2024 |
| Container queries | Size queries relative to container | Baseline 2023 |
| Cascade layers (`@layer`) | Explicit specificity ordering | Baseline 2023 |
| `@scope` | Limit style reach to a DOM subtree | Baseline late 2025 |
| View Transitions (same-doc) | Animate DOM state changes | Baseline 2024 |
| View Transitions (cross-doc) | Animate MPA navigations | Chromium, Safari TP |
| Anchor positioning | Position relative to anchors | Chromium + Safari; Firefox behind flag |
| Scroll-driven animations | `animation-timeline: scroll()`/`view()` | Chromium + Firefox; Safari partial |
| `text-box-trim` | Trim text leading/trailing whitespace | Chromium + Safari |
| `interpolate-size: allow-keywords` | Animate to/from `auto`/`min-content` | Chromium only (experimental) |

```css
/* :has() — style parent when child matches */
.form-group:has(:invalid) { border-color: var(--color-error); }

/* Nesting — cleaner component styles */
.card {
  padding: var(--space-m);
  & .title { font-size: 1.25rem; }
  &:hover { box-shadow: var(--shadow-m); }

  @media (prefers-reduced-motion: no-preference) {
    transition: box-shadow 200ms;
  }
}

/* text-wrap — typographic control */
h1 { text-wrap: balance; }   /* Even lines for headings */
p  { text-wrap: pretty;  }   /* Avoid orphans in paragraphs */

/* Container queries — component-level responsive */
.grid { container-type: inline-size; }
@container (min-width: 40rem) {
  .card { grid-template-columns: 1fr 2fr; }
}
```

→ Deeper patterns: `references/modern-css.md`.

---

## Cascade Layers

Make specificity explicit instead of fighting `!important`.

```css
@layer reset, tokens, base, components, utilities;

@layer reset       { /* normalize */ }
@layer tokens      { :root { --color-primary: ... } }
@layer base        { body { font-family: ... } }
@layer components  { .card { ... } }
@layer utilities   { .u-hidden { display: none !important; } }
```

Later layers win over earlier ones regardless of selector specificity. Unlayered styles win over all layers — reserve them for truly critical overrides.

---

## Accessibility Boundary

CSS owns visible-focus, reduced-motion, color contrast, and target size.

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

button { min-block-size: 44px; min-inline-size: 44px; } /* WCAG 2.2 target size */
```

ARIA patterns, roles, and keyboard handling are **not** CSS — see `accessibility`.

---

## Animation

- Prefer CSS transitions for state changes; `@keyframes` for named sequences
- `@starting-style` for entry animations on elements that enter the DOM
- `transition-behavior: allow-discrete` when animating to/from `display: none`
- View Transitions API for route-level animation — `document.startViewTransition()`
- Animate `transform` and `opacity` (compositor) — avoid animating layout properties

```css
.card {
  opacity: 0;
  transition: opacity 300ms;
  @starting-style { opacity: 0; }
  &.is-visible { opacity: 1; }
}
```

→ Full animation patterns and libraries: `references/animation.md`.

---

## Anti-Patterns

1. **`!important` chains.** Use cascade layers — `@layer` makes specificity intentional.
2. **Magic numbers.** `margin-top: 37px` — use `--space-*` tokens on a consistent scale.
3. **Layout with float/position.** Float is for text wrapping; absolute is for overlays. Grid/Flexbox is for structure.
4. **`px` for font sizes.** Breaks user font-size preference; use `rem`.
5. **Deep nesting.** Stay under three levels — anything deeper is a refactor signal.
6. **Viewport units for text without `clamp`.** `font-size: 5vw` is inaccessible at extreme widths.
7. **`outline: none` without replacement.** Kills keyboard users; see Hard Rules.
8. **Two whole stylesheets for dark mode.** Use `color-scheme` + `light-dark()` or scoped custom properties; don't fork.
9. **Animating layout properties.** `width`/`height`/`top`/`left` trigger reflow — animate `transform`/`opacity`.
10. **Untokenized colors.** A hex literal in a component is a future migration.

---

## Related Knowledge

- **html** — semantic elements that these styles target
- **accessibility** — WCAG, ARIA, keyboard navigation, screen-reader support
- **i18n** — logical properties, `dir`, writing modes for RTL/vertical scripts
- **seo** — CLS impact of layout shifts; font-loading strategies
- **web** — View Transitions, Popover API, CloseWatcher, scroll-linked animations integration
- **design** — when the underlying decision is about design systems or UX, not CSS

---

## References

Load on demand for depth:

- `references/layout-patterns.md` — Grid templates, Flexbox patterns, holy grail, sidebar, card grids, aspect-ratio, gap
- `references/modern-css.md` — cascade layers, container queries, `:has()` patterns, nesting, `@scope`, view transitions, anchor positioning, scroll-driven animations, color functions, CSS math functions
- `references/animation.md` — CSS transitions, `@keyframes`, `@starting-style`, scroll-driven animations, View Transitions API, Motion, GSAP, anime.js, WAAPI, `prefers-reduced-motion`, performance rules
