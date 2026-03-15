# Modern CSS Features

## Contents

- [Cascade Layers](#cascade-layers)
- [Container Queries](#container-queries)
- [:has() Selector](#has-selector)
- [CSS Nesting](#css-nesting)
- [@scope](#scope)
- [View Transitions](#view-transitions)
- [CSS Math Functions](#css-math-functions)
- [Color Functions](#color-functions)
- [Baseline Features](#baseline-features)
- [Progressive Enhancement Features](#progressive-enhancement-features)
- [Emerging CSS (Interop 2026)](#emerging-css-interop-2026)

---

## Cascade Layers

Control specificity without hacks. Layer order determines priority — last declared layer wins.

```css
/* 1. Declare layer order (first line of stylesheet) */
@layer reset, base, components, utilities;

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

/* 3. Third-party CSS in its own layer — never overrides your utilities */
@import url("vendor.css") layer(vendor);
/* Updated order: reset, vendor, base, components, utilities */
@layer reset, vendor, base, components, utilities;

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

/* Style queries (limited support — Chromium only) */
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

**Support:** Baseline Newly Available Dec 2025 — Chromium 118+, Safari 17.4+, Firefox 146+.

---

## View Transitions

Animate between DOM states (same-document) or pages (cross-document).

```css
/* Same-document transitions */
::view-transition-old(root) {
  animation: fade-out 200ms ease-out;
}

::view-transition-new(root) {
  animation: fade-in 200ms ease-in;
}

/* Named transitions for specific elements */
.hero-image { view-transition-name: hero; }

::view-transition-old(hero) { animation: slide-out 300ms ease; }
::view-transition-new(hero) { animation: slide-in 300ms ease; }
```

```javascript
// Trigger same-document transition
document.startViewTransition(() => {
  updateDOM();  // Make DOM changes inside callback
});

// With async
document.startViewTransition(async () => {
  const data = await fetchNewContent();
  container.innerHTML = renderContent(data);
});
```

```css
/* Cross-document transitions (MPA) */
@view-transition { navigation: auto; }

/* Per-page customization */
::view-transition-old(root) { animation-duration: 150ms; }
::view-transition-new(root) { animation-duration: 150ms; }
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

## Baseline Features

```css
/* Popover API — native popup without JS positioning (Baseline 2024) */
[popover] { /* inherits popover behavior */ }
[popover]::backdrop { background: oklch(0% 0 0 / 30%); }

/* @starting-style — entry animations (Baseline 2024) */
dialog[open] {
  opacity: 1;
  translate: 0;

  @starting-style {
    opacity: 0;
    translate: 0 20px;
  }
}
dialog[open] { transition: opacity 200ms, translate 200ms; }

/* text-wrap: balance / pretty (Baseline 2024) */
h1 { text-wrap: balance; }   /* Even line lengths for headings */
p  { text-wrap: pretty; }    /* Avoid orphans in paragraphs */

/* Discrete property transitions (Baseline 2024) */
.modal {
  transition: opacity 200ms, display 200ms allow-discrete;
  opacity: 0;
  display: none;
}
.modal.open {
  opacity: 1;
  display: block;
}
```

---

## Progressive Enhancement Features

These features lack full cross-browser support. Use with fallbacks.

```css
/* Anchor positioning — Chromium 125+, Safari 26+, Firefox behind flag */
.trigger { anchor-name: --my-anchor; }
.tooltip {
  position: absolute;
  position-anchor: --my-anchor;
  inset-area: top;                  /* Position above the anchor */
  position-try-fallbacks: bottom;   /* Fall back to below if no space */
}

/* Scroll-driven animations — Chromium 115+, Firefox 110+, Safari partial */
@keyframes reveal { from { opacity: 0; } to { opacity: 1; } }
.element {
  animation: reveal linear both;
  animation-timeline: view();      /* Triggers as element scrolls into view */
  animation-range: entry 0% entry 100%;
}

/* text-box-trim — Chromium 133+, Safari 18.2+, no Firefox */
h1 {
  text-box-trim: both;              /* trim top and bottom */
  text-box-edge: cap alphabetic;    /* from cap-height to alphabetic baseline */
}
```

---

## Emerging CSS (Interop 2026)

Features in active development across browsers. Track before using in production.

- **`if()` function** — conditional values inline: `transition-duration: if(media(prefers-reduced-motion: reduce): 0ms; else: 180ms);`
- **Container style queries** — `@container style(--theme: dark) { }` — Interop 2026 focus area
- **`contrast-color()`** — auto-pick accessible text color: `color: contrast-color(var(--bg))`
- **`attr()` enhanced** — return typed attribute values: `width: attr(data-width px, 100px)`
- **`shape()`** — define complex clip paths declaratively
- **CSS masonry** — `grid-template-rows: masonry` or `display: masonry` — spec in flux, limited support
