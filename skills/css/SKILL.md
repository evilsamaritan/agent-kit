---
name: css
description: "Build modern responsive CSS layouts and styles. Use for Grid/Flexbox, tokens, cascade, selectors, containers, nesting, color, transitions, or CSS animation."
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
- Handle `prefers-reduced-motion` per animation: drop large movement, keep or soften small opacity and color changes
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

Decide per feature; examples, patterns, and the dated support table are in [modern-css.md](references/modern-css.md).

| Need | Use |
|------|-----|
| Style a parent or sibling from child state (invalid group, empty list) | `:has()` |
| Component-level styles inside a rule | Native nesting, under three levels |
| Component adapts to its container, not the viewport | Container queries (`container-type: inline-size`) |
| Predictable specificity across resets, vendor CSS, components, utilities | `@layer`; unlayered CSS beats all layers |
| Limit a style's reach to a subtree | `@scope` |
| Light and dark values together | `color-scheme` plus `light-dark()` |
| Derive hover, muted, or alpha variants from a base color | `color-mix()` or relative color syntax in `oklch()` |
| Balanced headings, fewer orphans | `text-wrap: balance` / `pretty` |
| Popups, tooltips, menus | Popover API with anchor positioning (`position-area`) |
| Entry animation, animate to and from `display: none` | `@starting-style` + `transition-behavior: allow-discrete` |
| Animate to or from `auto` | `interpolate-size` (limited support, guard) |

**Support rule:** use Baseline widely available features freely; check the project's browserslist and current Baseline data for newer ones; guard anything else with `@supports` and make the fallback a complete design.

---

## Cascade Layers

Make specificity explicit instead of fighting `!important`: declare the order once (`@layer reset, tokens, base, components, utilities;`) and assign styles to layers. Later layers win regardless of selector specificity; unlayered styles beat all layers, so reserve them for truly critical overrides. Third-party CSS goes in its own layer. Examples: `modern-css.md`.

---

## Accessibility Boundary

CSS implements visible focus, reduced motion, contrast, and target size; the thresholds and testing come from `accessibility`.

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* 24px is the WCAG 2.2 AA minimum target size; 44px is the recommended size */
button { min-block-size: 44px; min-inline-size: 44px; }
```

Reduced motion is decided per animation (remove large movement, keep gentle opacity changes); a global duration reset is a last resort. Patterns: `animation.md`.

ARIA patterns, roles, and keyboard handling are **not** CSS — see `accessibility`.

---

## Animation

- Prefer CSS transitions for state changes; `@keyframes` for named sequences
- `@starting-style` for entry: write the end state as the base style, and the entry state inside `@starting-style`
- `transition-behavior: allow-discrete` when animating to or from `display: none`
- View Transitions for route-level and state-change animation (CSS syntax here, JavaScript API in `web`)
- Animate `transform` and `opacity` (compositor); avoid animating layout properties
- Reach for an animation library only for timelines, layout/exit animation, SVG morphing, or spring physics

→ Full patterns, scroll-driven animations, and reduced-motion handling: `references/animation.md`.

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
- **accessibility** — WCAG thresholds, ARIA, keyboard navigation, screen-reader support
- **development** — token and variant discipline: one source of truth for design values
- **i18n** — logical properties, `dir`, writing modes for RTL/vertical scripts
- **performance** — Core Web Vitals definitions, thresholds, and measurement (layout shift, font loading); **seo** — vitals as a ranking signal
- **web** — View Transitions JavaScript API, Popover and dialog behavior, scripting
- **design** — when the underlying decision is about design systems or UX, not CSS

---

## References

Load on demand for depth:

- `references/layout-patterns.md` — Grid templates, Flexbox patterns, holy grail, sidebar, card grids, aspect-ratio, gap
- `references/modern-css.md` — cascade layers, container queries, `:has()`, nesting, `@scope`, typography, color and math functions, popover and anchor positioning, dated browser-support table
- `references/animation.md` — transitions, `@keyframes`, `@starting-style`, scroll-driven animations, View Transitions, WAAPI, when a library earns its weight, `prefers-reduced-motion`, performance rules
