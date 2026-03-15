# CSS Layout Patterns

## Contents

- [Grid Templates](#grid-templates)
- [Flexbox Patterns](#flexbox-patterns)
- [Responsive Patterns](#responsive-patterns)
- [Spacing and Sizing](#spacing-and-sizing)
- [Common Layouts](#common-layouts)

---

## Grid Templates

### Holy Grail Layout

```css
.page {
  display: grid;
  grid-template:
    "header  header  header" auto
    "sidebar content aside"  1fr
    "footer  footer  footer" auto
    / 250px   1fr     200px;
  min-height: 100dvh;
}

.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.content { grid-area: content; }
.aside   { grid-area: aside; }
.footer  { grid-area: footer; }

/* Collapse sidebar on mobile */
@media (max-width: 768px) {
  .page {
    grid-template:
      "header"  auto
      "content" 1fr
      "sidebar" auto
      "aside"   auto
      "footer"  auto
      / 1fr;
  }
}
```

### Auto-Fit Card Grid

```css
/* Cards fill available space, min 250px, auto-wrap */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-m);
}

/* auto-fill vs auto-fit:
   auto-fill: creates empty tracks (preserves grid structure)
   auto-fit:  collapses empty tracks (items stretch to fill) */
```

### Dashboard Grid

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: minmax(200px, auto);
  gap: var(--space-m);
}

.widget-wide    { grid-column: span 8; }
.widget-narrow  { grid-column: span 4; }
.widget-full    { grid-column: 1 / -1; }
.widget-half    { grid-column: span 6; }

@media (max-width: 768px) {
  .dashboard > * { grid-column: 1 / -1; }
}
```

### Masonry (CSS Subgrid Approach)

```css
/* Native CSS masonry — limited support, use with fallback */
.masonry {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-template-rows: masonry; /* Chrome 128+, Firefox 77+ behind flag */
  gap: var(--space-m);
}
```

### Subgrid — Align Nested Grid Children

```css
/* Card content aligns across cards */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-m);
}

.card {
  display: grid;
  grid-template-rows: subgrid;  /* Inherit parent row tracks */
  grid-row: span 3;             /* title, body, footer */
}
```

---

## Flexbox Patterns

### Centering

```css
/* Center anything — horizontal + vertical */
.center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Alternative with place-items (Grid) */
.center-grid {
  display: grid;
  place-items: center;
}

/* Center with margin auto (single child) */
.parent { display: flex; }
.child  { margin: auto; }
```

### Navigation Bar

```css
.navbar {
  display: flex;
  align-items: center;
  gap: var(--space-m);
  padding: var(--space-s) var(--space-m);
}

.navbar-logo { margin-right: auto; }  /* Push everything else right */
/* Or: .navbar-spacer { flex: 1; }    /* Explicit spacer */
```

### Media Object

```css
.media {
  display: flex;
  gap: var(--space-m);
  align-items: flex-start;
}

.media-image { flex-shrink: 0; }  /* Prevent image from shrinking */
.media-body  { flex: 1; }         /* Body takes remaining space */
```

### Wrapping Tags / Chips

```css
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.tag {
  padding: var(--space-xs) var(--space-s);
  border-radius: var(--radius-full);
  white-space: nowrap;
}
```

### Sticky Footer

```css
/* Footer sticks to bottom even with little content */
body {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

main { flex: 1; }
/* footer stays at bottom naturally */
```

---

## Responsive Patterns

### Container Queries with Layout Switch

```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Stack layout by default */
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-s);
}

/* Side-by-side when container is wide enough */
@container card (min-width: 500px) {
  .card {
    flex-direction: row;
    align-items: center;
  }
  .card-image { width: 200px; flex-shrink: 0; }
}
```

### Fluid Typography

```css
/* Scales between min and max based on viewport */
:root {
  --font-size-base: clamp(1rem, 0.5rem + 1vw, 1.25rem);
  --font-size-h1: clamp(2rem, 1rem + 3vw, 3.5rem);
  --font-size-h2: clamp(1.5rem, 0.75rem + 2vw, 2.5rem);
}
```

### Responsive Spacing

```css
:root {
  --space-unit: clamp(0.2rem, 0.15rem + 0.25vw, 0.3rem);
  --space-xs: calc(var(--space-unit) * 2);
  --space-s: calc(var(--space-unit) * 3);
  --space-m: calc(var(--space-unit) * 5);
  --space-l: calc(var(--space-unit) * 8);
  --space-xl: calc(var(--space-unit) * 13);
}
```

---

## Spacing and Sizing

### Aspect Ratio

```css
/* Modern — use aspect-ratio property */
.video-embed {
  aspect-ratio: 16 / 9;
  width: 100%;
}

.avatar {
  aspect-ratio: 1;    /* Perfect square */
  width: 48px;
  border-radius: 50%;
  object-fit: cover;
}
```

### Gap vs Margin

```css
/* Prefer gap — no collapsing issues, no last-child overrides */
.stack { display: flex; flex-direction: column; gap: var(--space-m); }
.cluster { display: flex; flex-wrap: wrap; gap: var(--space-s); }

/* Lobotomized owl — fallback for non-flex/grid contexts */
.flow > * + * { margin-block-start: var(--space-m); }
```

### Logical Properties

```css
/* Use logical properties for internationalization */
.card {
  margin-inline: auto;          /* left/right in LTR */
  padding-block: var(--space-m); /* top/bottom */
  padding-inline: var(--space-l); /* left/right */
  border-inline-start: 3px solid var(--color-accent); /* left in LTR, right in RTL */
}
```

---

## Common Layouts

### Sidebar + Content

```css
/* Sidebar that collapses below breakpoint */
.with-sidebar {
  display: grid;
  grid-template-columns: minmax(200px, 25%) 1fr;
  gap: var(--space-l);
}

@media (max-width: 768px) {
  .with-sidebar { grid-template-columns: 1fr; }
}

/* Intrinsic sidebar — no media query needed */
.intrinsic-sidebar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-l);
}
.intrinsic-sidebar > .sidebar { flex: 1 1 250px; }
.intrinsic-sidebar > .content { flex: 999 1 60%; }
```

### Full-Bleed Layout

```css
/* Content centered, some elements break out to full width */
.full-bleed-layout {
  display: grid;
  grid-template-columns:
    [full-start] 1fr
    [content-start] min(65ch, 100% - 2 * var(--space-l))
    [content-end] 1fr
    [full-end];
}

.full-bleed-layout > * { grid-column: content; }
.full-bleed-layout > .full-bleed { grid-column: full; }
```

### Pancake Stack (Header / Content / Footer)

```css
.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}
```

### Equal-Height Cards

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-m);
}

/* Cards stretch to tallest by default in grid */
.card {
  display: flex;
  flex-direction: column;
}

.card-body { flex: 1; }  /* Push footer to bottom */
```
