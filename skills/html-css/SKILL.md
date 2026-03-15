---
name: html-css
description: Build semantic HTML5 markup and modern CSS layouts. Use when working with CSS Grid, Flexbox, custom properties, cascade layers, container queries, :has(), CSS nesting, @scope, or responsive design. Do NOT use for design decisions (use product-design) or component logic (use frontend).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# HTML & CSS

Semantic markup, modern layout, progressive enhancement. Never `outline: none` without replacement. Never `px` for font sizes — use `rem`. Never layout with floats — use Grid/Flexbox.

---

## Semantic HTML5 Decision Tree

| Need | Element | NOT |
|------|---------|-----|
| Independent, self-contained content | `<article>` | `<div>` |
| Thematic grouping within a page | `<section>` (with heading) | `<div>` |
| Sidebar, tangential content | `<aside>` | `<div class="sidebar">` |
| Site-wide navigation | `<nav>` | `<div class="nav">` |
| Page/section header | `<header>` | `<div class="header">` |
| Page/section footer | `<footer>` | `<div class="footer">` |
| Primary content | `<main>` (one per page) | `<div id="main">` |
| No semantic meaning | `<div>` / `<span>` | n/a |

Landmark roles are implicit: `<nav>` = `role="navigation"`, `<main>` = `role="main"`, `<aside>` = `role="complementary"`. Do NOT add redundant ARIA roles to semantic elements.

---

## CSS Layout: Grid vs Flexbox

| Use Grid when | Use Flexbox when |
|---------------|------------------|
| 2D layout (rows AND columns) | 1D layout (row OR column) |
| Page-level structure | Component-level alignment |
| Precise cell placement needed | Content-driven sizing |
| Named areas simplify reasoning | Simple centering or distribution |
| Overlapping elements (`grid-area` overlap) | Wrapping item lists |

**Both together:** Grid for page layout, Flexbox inside grid cells for component alignment.

```css
/* Holy grail layout — 5 lines */
.page {
  display: grid;
  grid-template: "header header" auto
                 "nav    main"   1fr
                 "footer footer" auto / 250px 1fr;
  min-height: 100dvh;
}
```

---

## Custom Properties

```css
:root {
  --color-primary: oklch(55% 0.2 260);
  --color-surface: oklch(98% 0.01 260);
  --space-unit: 0.25rem;
  --space-m: calc(var(--space-unit) * 4);  /* 1rem */
  --space-l: calc(var(--space-unit) * 6);  /* 1.5rem */
  --radius-m: 0.5rem;
}

/* Dark mode — prefer light-dark() for simple swaps */
:root { color-scheme: light dark; }
.card {
  background: light-dark(white, #1a1a1a);
  color: light-dark(#333, #eee);
}

/* Complex theming — custom properties + prefers-color-scheme */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: oklch(75% 0.15 260);
    --color-surface: oklch(15% 0.01 260);
  }
}

/* Component tokens — map semantic names to primitives */
.card {
  background: var(--color-surface);
  padding: var(--space-m);
  border-radius: var(--radius-m);
}
```

**Fallbacks:** `var(--color, hotpink)` — always provide fallback for optional properties.

---

## Modern CSS Features

| Feature | What it does | Status |
|---------|-------------|--------|
| `:has()` | Parent selector — style parent based on children | Baseline 2024 |
| CSS nesting | `& .child { }` inside parent rule | Baseline 2024 |
| `color-mix()` | Blend colors in any color space | Baseline 2024 |
| `@starting-style` | Define initial state for entry animations | Baseline 2024 |
| Popover API | `popover` attribute + `::backdrop` | Baseline 2024 |
| `light-dark()` | Pick value based on color-scheme | Baseline 2024 |
| `text-wrap: balance/pretty` | Even line lengths, avoid orphans | Baseline 2024 |
| `@scope` | Limit style reach to a DOM subtree | Baseline Dec 2025 |
| View Transitions | Animate between DOM states/pages | Same-doc: Baseline 2024. Cross-doc: Chromium only |
| Anchor positioning | Position elements relative to anchors | Chromium + Safari; Firefox behind flag |
| Scroll-driven animations | `animation-timeline: scroll()/view()` | Chromium + Firefox; Safari partial |
| `text-box-trim` | Trim text leading/trailing whitespace | Chromium + Safari; no Firefox |

```css
/* :has() — style parent when child matches */
.form-group:has(:invalid) { border-color: var(--color-error); }

/* Nesting — cleaner component styles */
.card {
  padding: var(--space-m);
  & .title { font-size: 1.25rem; }
  &:hover { box-shadow: var(--shadow-m); }
}

/* text-wrap — typographic control */
h1 { text-wrap: balance; }   /* Even line lengths for headings */
p  { text-wrap: pretty; }    /* Avoid orphans in paragraphs */
```

---

## Accessibility Markup

- Semantic elements first — ARIA only when no native equivalent exists
- All images need `alt` (empty `alt=""` for decorative images)
- Form inputs need associated `<label>` (explicit `for`/`id` or implicit wrapping)
- Skip link as first focusable element: `<a href="#main" class="skip-link">Skip to content</a>`
- Visible focus indicators — never `outline: none` without replacement
- `prefers-reduced-motion` — respect user's motion preference
- Logical properties (`margin-inline`, `padding-block`) for RTL support

---

## Anti-Patterns

1. **Div soup** — use semantic elements; they convey meaning to assistive technology and improve SEO
2. **`!important` chains** — use cascade layers to manage specificity instead
3. **Magic numbers** — `margin-top: 37px` is unmaintainable; use custom properties and spacing scales
4. **Layout with float/position** — use Grid/Flexbox; float is for text wrapping only
5. **`px` for font sizes** — use `rem` for accessibility; users may change default font size
6. **Deep nesting** — stay under 3 levels of CSS nesting for readability
7. **Viewport units for text** — `font-size: 5vw` is inaccessible; use `clamp()` with rem base

---

## Related Knowledge

- **accessibility** — ARIA patterns, focus management, screen reader support
- **frontend** — component architecture that uses these layout patterns
- **i18n** — CSS logical properties for RTL support, `lang` attribute
- **seo** — semantic markup for structured data, meta tags
- **web-platform** — HTTP, service workers, browser APIs

## References

Load on demand for detailed patterns and deep-dive knowledge:

- `references/layout-patterns.md` — Grid templates, Flexbox patterns, holy grail, sidebar, card grids, aspect-ratio, gap
- `references/modern-css.md` — cascade layers, container queries, :has() patterns, nesting, @scope, view transitions, anchor positioning, scroll-driven animations, color functions, CSS math functions
