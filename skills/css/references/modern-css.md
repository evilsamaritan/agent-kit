# Modern CSS Features

## Contents

- [Cascade Layers](#cascade-layers)
- [Container Queries](#container-queries)
- [:has() Selector](#has-selector)
- [CSS Nesting](#css-nesting)
- [@scope](#scope)
- [Typography](#typography)
- [CSS Math Functions](#css-math-functions)
- [Color Functions](#color-functions)
- [Popover and anchor positioning](#popover-and-anchor-positioning)
- [Other features to guard](#other-features-to-guard)
- [Emerging CSS (Interop 2026)](#emerging-css-interop-2026)
- [Browser support](#browser-support)

Animation, `@starting-style`, scroll-driven animations, and View Transitions are in [animation.md](animation.md).

---

## Cascade Layers

Control specificity without hacks. Layer order determines priority — last declared layer wins.

```css
/* 1. Declare layer order first, then import third-party CSS into its own layer.
      @import must precede all other rules except @charset and @layer statements. */
@layer reset, vendor, base, components, utilities;
@import url("vendor.css") layer(vendor);

/* 2. Assign styles to layers */
@layer reset {
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
}

@layer base {
  body { font-family: system-ui, sans-serif; line-height: 1.5; }
  h1, h2, h3 { line-height: 1.2; }
  a { color: var(--color-link); }
}

@layer components {
  .btn { padding: 0.5em 1em; border-radius: var(--radius-m); }
  .btn-primary { background: var(--color-primary); color: white; }
  .card { padding: var(--space-m); border-radius: var(--radius-m); }
}

@layer utilities {
  .hidden { display: none !important; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  .text-center { text-align: center; }
}

/* Unlayered styles always beat layered styles (highest priority) */
```

**Key rules:**
- Layer order = priority order (last wins)
- Unlayered CSS beats all layers
- `!important` reverses layer order (first layer's `!important` wins)
- Nest layers: `@layer components.buttons { }`

---

## Container Queries

Component-scoped responsive design — respond to container size, not viewport.

```css
/* Define containment context */
.widget-wrapper {
  container-type: inline-size;    /* Track inline dimension */
  container-name: widget;         /* Optional name for targeting */
}

/* Query named container */
@container widget (min-width: 400px) {
  .widget { display: flex; gap: 1rem; }
}

@container widget (min-width: 700px) {
  .widget { grid-template-columns: 1fr 2fr 1fr; }
}

/* Container query units */
.widget-title {
  font-size: clamp(1rem, 3cqi, 2rem);   /* cqi = 1% of container inline size */
}

/* Style queries — limited support, check the support section */
@container style(--theme: dark) {
  .card { background: var(--color-surface-dark); }
}
```

**Container types:**
- `inline-size` — track width only (most common)
- `size` — track both width and height
- `normal` — no size containment (style queries only)

---

## :has() Selector

The "parent selector" — style ancestors based on descendants.

```css
/* Style parent based on child state */
.form-group:has(:invalid) {
  border-color: var(--color-error);
}

.form-group:has(:focus-visible) {
  outline: 2px solid var(--color-focus);
}

/* Conditional layouts */
.grid:has(> :nth-child(4)) {
  grid-template-columns: repeat(2, 1fr);  /* 2 cols when 4+ items */
}

.grid:has(> :nth-child(7)) {
  grid-template-columns: repeat(3, 1fr);  /* 3 cols when 7+ items */
}

/* Style sibling based on another sibling */
h2:has(+ .subtitle) { margin-bottom: 0.25em; }

/* Conditional feature — show label when checkbox checked */
input:checked + label:has(~ .details) { font-weight: bold; }

/* Navigation — highlight parent when child is current */
nav li:has(> a[aria-current="page"]) {
  background: var(--color-active);
}

/* Empty state — style differently when no items */
.list:not(:has(> .item)) {
  display: grid;
  place-items: center;
}
.list:not(:has(> .item))::after {
  content: "No items found";
  color: var(--color-muted);
}
```

---

## CSS Nesting

Native nesting — no preprocessor needed.

```css
.card {
  padding: var(--space-m);
  border-radius: var(--radius-m);

  /* Nested selectors */
  & .title {
    font-size: 1.25rem;
    font-weight: 600;
  }

  & .body {
    margin-top: var(--space-s);
    color: var(--color-text-secondary);
  }

  /* Pseudo-classes and pseudo-elements */
  &:hover { box-shadow: var(--shadow-m); }
  &:focus-within { outline: 2px solid var(--color-focus); }
  &::before { content: ""; /* decorative */ }

  /* Media queries nest inside rules */
  @media (prefers-color-scheme: dark) {
    background: var(--color-surface-dark);
  }

  /* Container queries nest too */
  @container (min-width: 500px) {
    display: flex;
    gap: var(--space-m);
  }

  /* Compound selectors */
  &.featured { border: 2px solid var(--color-accent); }
  &[data-size="large"] { padding: var(--space-l); }
}

/* No & needed for element selectors in modern browsers */
.nav {
  ul { list-style: none; }
  a { text-decoration: none; }
}
```

**Rules:**
- `&` represents the parent selector
- `&` is optional before class/attribute/pseudo selectors in modern browsers
- Nesting depth: stay under 3 levels for readability

---

## @scope

Limit style reach to a subtree — proximity-based scoping.

```css
/* Styles apply only within .card, stop at .card-footer */
@scope (.card) to (.card-footer) {
  p { color: var(--color-text); }        /* Only p inside card, above footer */
  a { color: var(--color-link-card); }
}

/* Component scoping */
@scope (.theme-dark) {
  :scope { background: var(--dark-bg); }  /* :scope = scoping root */
  a { color: var(--dark-link); }
  .btn { background: var(--dark-btn); }
}

/* Donut scope — style wrapper but not nested component */
@scope (.tabs) to (.tab-panel) {
  button { /* Tab buttons only, not buttons inside panels */ }
}
```

---

## Typography

```css
h1 { text-wrap: balance; }   /* even line lengths for headings */
p  { text-wrap: pretty; }    /* avoid orphans; ignored where unsupported */
```

---

## CSS Math Functions

```css
/* clamp(min, preferred, max) — responsive without media queries */
.container { width: clamp(320px, 90vw, 1200px); }
h1 { font-size: clamp(1.5rem, 1rem + 2vw, 3rem); }

/* min() / max() — pick the smaller/larger value */
.sidebar { width: min(300px, 30vw); }
.content { padding: max(1rem, 3vw); }

/* round() — snap to grid */
.element { width: round(nearest, 100%, 50px); }  /* Snap to nearest 50px */

/* abs() / sign() */
.offset { translate: calc(sign(var(--direction)) * 100px); }

/* mod() / rem() */
.striped > *:nth-child(odd) { background: var(--stripe-color); }
/* mod() for wrapping: mod(7, 3) = 1 */

/* Trigonometric — for circular layouts */
.item:nth-child(1) {
  --angle: calc(0 * 360deg / var(--total));
  translate: calc(cos(var(--angle)) * var(--radius))
             calc(sin(var(--angle)) * var(--radius));
}
```

---

## Color Functions

```css
/* oklch — perceptually uniform, wide gamut */
:root {
  --primary: oklch(55% 0.2 260);           /* Lightness, Chroma, Hue */
  --primary-light: oklch(75% 0.15 260);
  --primary-dark: oklch(35% 0.2 260);
}

/* color-mix() — blend colors */
.hover-bg {
  background: color-mix(in oklch, var(--primary) 80%, white);
}

/* Relative color syntax — derive colors from base */
.muted {
  color: oklch(from var(--primary) l c calc(h + 30));   /* Shift hue */
}
.transparent {
  background: oklch(from var(--primary) l c h / 50%);   /* 50% opacity */
}

/* light-dark() — automatic dark mode values */
:root { color-scheme: light dark; }
.card {
  background: light-dark(white, #1a1a1a);
  color: light-dark(#333, #eee);
}
```

---

## Popover and anchor positioning

```css
/* Popover API — top-layer popups without JS positioning */
[popover]::backdrop { background: oklch(0% 0 0 / 30%); }

/* Anchor positioning — place a floating element relative to an anchor */
.trigger { anchor-name: --my-anchor; }
.tooltip {
  position: absolute;
  position-anchor: --my-anchor;
  position-area: top;                 /* older drafts called this inset-area */
  position-try-fallbacks: flip-block; /* flip below when there is no room above */
}
```

Modal dialogs use `<dialog>` with `showModal()` (`html`); popover is for non-modal layers (menus, tooltips).

---

## Other features to guard

```css
/* text-box-trim: remove the half-leading above the cap height and below the baseline */
h1 {
  text-box-trim: trim-both;
  text-box-edge: cap alphabetic;
}

/* interpolate-size: animate to and from intrinsic sizes such as auto */
:root { interpolate-size: allow-keywords; }
.panel { transition: block-size 200ms; }
```

Both ship only in some engines (see support). Wrap in `@supports (text-box-trim: trim-both)` or `@supports (interpolate-size: allow-keywords)` and design the fallback as a complete layout.

---

## Emerging CSS (Interop 2026)

Features in active development across browsers. Track before using in production.

- **`if()` function** — conditional values inline: `transition-duration: if(media(prefers-reduced-motion: reduce): 0ms; else: 180ms);`
- **Container style queries** — `@container style(--theme: dark) { }`; Baseline newly available since May 2026 (custom-property queries); an Interop 2026 focus area
- **`contrast-color()`** — pick black or white text for a background: `color: contrast-color(var(--bg))`; it is not a WCAG check, so verify the resulting contrast; Baseline newly available since April 2026
- **`attr()` enhanced** — return typed attribute values: `width: attr(data-width px, 100px)`
- **`shape()`** — define complex clip paths declaratively; Baseline newly available since February 2026
- **Grid lanes (masonry)** — `display: grid-lanes` with grid track properties; the syntax changed while the spec was in flux, and only Safari 26.4 ships it in the Baseline data, so keep a column-based fallback

---

## Browser support

Checked 2026-10-06 against the web-features Baseline dataset (the data behind MDN and web.dev badges, version 3.40.1); re-check a feature on MDN or web.dev Baseline before relying on a row, and check the project's browserslist.

Rule: Baseline widely available features are safe. Newly available features are fine for evergreen audiences. Anything else goes behind `@supports` (or is ignored harmlessly) with a complete fallback.

| Feature | Status |
|---------|--------|
| `@layer`, container size queries, `:has()`, nesting, `color-mix()`, `oklch()` | Baseline, widely available |
| `light-dark()`, `@starting-style`, `transition-behavior: allow-discrete`, Popover API, `text-wrap: balance`, `@scope`, same-document View Transitions, `shape()`, `contrast-color()`, container style queries | Baseline, newly available (2024 to 2026) |
| Anchor positioning core (`anchor-name`, `position-area`, `position-try-fallbacks`) | Baseline newly available since Firefox 147 (January 2026); some later additions (for example `position-visibility`) are not in every engine yet |
| `text-wrap: pretty` | Chromium 117+ and Safari 26+; not Firefox; ignored where unsupported |
| Scroll-driven animations (`animation-timeline`) | Chromium and Safari 26+; not in stable Firefox, so guard with `@supports` |
| Cross-document View Transitions (`@view-transition`) | Chromium 126+ and Safari 18.2+; not Firefox; the opt-in is ignored there |
| `text-box-trim`, `text-box-edge` | Chromium 133+ and Safari 18.2+; not Firefox |
| `interpolate-size` | Chromium only |
| `if()`, typed `attr()`, grid lanes (masonry) | Emerging (`if()` and typed `attr()` Chromium-led, grid lanes Safari-only); not for production without a fallback |
