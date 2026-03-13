# Design Patterns Reference

Universal UI/UX patterns independent of any specific framework or library.

## Contents

- [Design Token Architecture](#design-token-architecture)
- [Color Systems](#color-systems)
- [Typography Scale](#typography-scale)
- [Spacing Systems](#spacing-systems)
- [Component Composition](#component-composition)
- [Dark Mode Strategies](#dark-mode-strategies)
- [Modern CSS Patterns](#modern-css-patterns)
- [Dashboard Patterns](#dashboard-patterns)
- [Accessibility Patterns](#accessibility-patterns)
- [Responsive Patterns](#responsive-patterns)
- [Anti-Patterns](#anti-patterns)

---

## Design Token Architecture

Design tokens are named values that represent design decisions. They decouple design intent from implementation.

### Token tiers

| Tier | Purpose | Example |
|------|---------|---------|
| Global/primitive | Raw values | `--color-blue-500: #3b82f6` |
| Semantic/alias | Design intent | `--color-primary: var(--color-blue-500)` |
| Component | Scoped to component | `--button-bg: var(--color-primary)` |

### Implementation approaches

| Approach | When to use | Example |
|----------|------------|---------|
| CSS custom properties | Web projects, any framework | `--color-primary: #3b82f6;` |
| Sass/SCSS variables | Legacy projects, compile-time theming | `$color-primary: #3b82f6;` |
| JS theme objects | CSS-in-JS, styled-components, Emotion | `theme.colors.primary` |
| Design token files (JSON/YAML) | Multi-platform, design tool sync | Style Dictionary, Tokens Studio |
| Tailwind config | Tailwind CSS projects | `theme.extend.colors.primary` |

### Rules

- Semantic tokens over raw values -- code should reference `--color-primary`, never `#3b82f6`
- Token names describe purpose, not appearance -- `--color-destructive` not `--color-red`
- Limit token count: 50-100 covers most systems. More than 200 signals over-engineering.

---

## Color Systems

### Semantic color roles

Every design system needs these semantic color categories:

| Role | Purpose | Usage |
|------|---------|-------|
| Primary | Brand actions, key UI | Buttons, links, active states |
| Secondary | Supporting actions | Secondary buttons, less emphasis |
| Destructive | Danger, deletion | Delete buttons, error states |
| Warning | Caution | Warnings, pending states |
| Success | Confirmation | Success messages, positive indicators |
| Muted | Subdued elements | Disabled states, backgrounds, borders |
| Accent | Highlights | Badges, focus rings, selection |

### Color-scheme support

```css
:root {
  color-scheme: light dark;
}

/* Light defaults */
:root {
  --color-bg: #ffffff;
  --color-fg: #0a0a0a;
}

/* Dark overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0a0a0a;
    --color-fg: #fafafa;
  }
}
```

### Status color mapping

Map entity states to semantic colors consistently across the entire application:

| State | Semantic Role | Indicator Pattern |
|-------|--------------|------------------|
| Active/Running | Success | Green + check icon + "Active" text |
| Error/Failed | Destructive | Red + alert icon + "Error" text |
| Warning/Degraded | Warning | Yellow/amber + warning icon + "Warning" text |
| Disabled/Stopped | Muted | Gray + stop icon + "Disabled" text |
| Pending/Loading | Accent | Blue + spinner + "Loading" text |

Rule: Never rely on color alone. Always pair with icon + text for accessibility.

---

## Typography Scale

### Modular scale

Use a consistent ratio (1.125 minor third, 1.200 minor second, 1.250 major second) to generate font sizes:

| Level | Scale (1.25 ratio) | Typical use |
|-------|-------------------|-------------|
| xs | 0.75rem (12px) | Captions, footnotes |
| sm | 0.875rem (14px) | Secondary text, labels |
| base | 1rem (16px) | Body text |
| lg | 1.125rem (18px) | Lead paragraphs |
| xl | 1.25rem (20px) | Section headings |
| 2xl | 1.5rem (24px) | Page headings |
| 3xl | 1.875rem (30px) | Hero headings |

### Rules

- Set base font size on `html` or `:root` (typically 16px)
- Use `rem` for font sizes (scales with user preference)
- Use `em` for line-height and letter-spacing (relative to element font size)
- Limit to 5-7 distinct sizes in a project
- Pair sizes with consistent weight and line-height values

---

## Spacing Systems

### Base unit grid

Choose a base unit (4px or 8px) and derive all spacing from multiples:

| Token | 4px grid | 8px grid | Usage |
|-------|----------|----------|-------|
| space-1 | 4px | 8px | Tight gaps (icon-to-text) |
| space-2 | 8px | 16px | Default gap (between elements) |
| space-3 | 12px | 24px | Section padding |
| space-4 | 16px | 32px | Card padding |
| space-6 | 24px | 48px | Section margins |
| space-8 | 32px | 64px | Page-level spacing |

### Rules

- Pick one grid (4px or 8px) and use it everywhere
- Padding inside containers: consistent per container type (card, dialog, page)
- Gap between siblings: use CSS `gap` over margin where supported
- Avoid magic numbers: every spacing value should map to a token

---

## Component Composition

### Composition patterns (framework-agnostic)

| Pattern | Structure | Example |
|---------|-----------|---------|
| StatusBadge | Badge + semantic color + icon + text | Order status, build status |
| MetricCard | Card + formatted value + trend indicator + skeleton | KPI cards, dashboard metrics |
| EntityCard | Card + StatusBadge + data grid + action buttons | User card, project card |
| DataRow | Table row + badges + formatted values | Transaction row, log entry |
| ConfirmAction | Dialog + description + cancel + destructive action | Delete confirmation |
| DataTable | Table + sorting + empty state + skeleton rows | Any data listing |
| PageShell | Title + description + action buttons + content slot | Page layout wrapper |

### Composition rules

- Compose from primitives -- do not create monolithic components
- Props flow down, events flow up
- Each composed component owns its own layout
- Variants belong on the primitive, not the composition (e.g., Badge has color variants; StatusBadge selects the variant)

---

## Dark Mode Strategies

### Approach comparison

| Strategy | How | Best for |
|----------|-----|----------|
| CSS custom properties + class toggle | `.dark` class on root, swap token values | Most web projects |
| `prefers-color-scheme` media query | OS-level preference, no toggle needed | Simple sites, progressive enhancement |
| CSS `color-scheme` property | Browser-native dark mode for form controls | Baseline support |
| Theme provider (JS) | Runtime theme context, JS-driven swap | CSS-in-JS, React Native |

### Rules

- Support both system preference AND manual toggle
- Dark mode is not "invert everything" -- reduce contrast slightly, increase surface elevation
- Background layers: dark surfaces use subtle brightness differences (e.g., `#0a0a0a`, `#141414`, `#1e1e1e`)
- Shadows become less effective in dark mode -- use borders or subtle glows instead
- Test both modes for every component, not just after full implementation

---

## Modern CSS Patterns

### Container queries

Size components based on their container, not the viewport:

```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

Use when: components need to adapt in different layout contexts (sidebar vs main area).

### CSS custom property patterns

```css
/* Scoped theming */
.component {
  --_bg: var(--component-bg, var(--color-surface));
  --_fg: var(--component-fg, var(--color-foreground));
  background: var(--_bg);
  color: var(--_fg);
}

/* Overridable from parent */
.special-section {
  --component-bg: var(--color-primary);
  --component-fg: var(--color-primary-foreground);
}
```

### Logical properties

Use logical properties for internationalization support:

| Physical | Logical |
|----------|---------|
| `margin-left` | `margin-inline-start` |
| `padding-right` | `padding-inline-end` |
| `width` | `inline-size` |
| `height` | `block-size` |

---

## Dashboard Patterns

### Number formatting

- Use `font-variant-numeric: tabular-nums` for aligned columns
- Right-align numeric columns in tables
- Format with locale-appropriate separators: `Intl.NumberFormat` or equivalent
- Add sign prefix for directional values: `+2.5%`, `-1.3%`
- Color positive/negative values with semantic tokens (success/destructive)

### Real-time data

- Show freshness: "Updated 3s ago" with progressive staleness indicator
- Distinguish between "loading initial data" (skeleton) and "refreshing" (subtle indicator)
- Optimistic updates where appropriate, with rollback on failure

### Information density

- Progressive disclosure: summary view (cards) -> detailed view (expanded/modal)
- Collapsible sections for secondary information
- Tooltips/popovers for supplementary data (do not hide critical information behind hover)
- Dense mode toggle for power users (tighter spacing, smaller text)

---

## Accessibility Patterns

### WCAG AA requirements summary

| Criterion | Requirement |
|-----------|-------------|
| Text contrast | >= 4.5:1 normal text, >= 3:1 large text |
| Non-text contrast | >= 3:1 for UI components and graphical objects |
| Focus visible | Clear, visible focus indicator on all interactive elements |
| Target size | >= 44x44 CSS pixels for touch targets |
| Keyboard | All functionality available via keyboard |
| Labels | Every form control has a programmatic label |

### Focus management

- Visible focus ring: 2px+ outline with sufficient contrast against backgrounds
- Focus trap in modals: tab cycles within modal, escape closes
- Focus restoration: return focus to trigger element when modal closes
- Logical tab order: follow visual layout, use `tabindex` sparingly

### Screen reader patterns

- `aria-live="polite"` for status updates (data refreshes, notifications)
- `aria-live="assertive"` only for urgent alerts
- `role="status"` on status badges
- `aria-label` on icon-only buttons: "Close", "Delete", "Settings"
- `aria-describedby` linking error messages to form inputs
- Hidden text (`sr-only` / `visually-hidden`) for context that is visually implied

---

## Responsive Patterns

### Breakpoint strategy

Use 2-4 breakpoints aligned to common device categories:

| Breakpoint | Approximate width | Target |
|-----------|-------------------|--------|
| sm | 640px | Large phones, landscape |
| md | 768px | Tablets |
| lg | 1024px | Desktops |
| xl | 1280px | Large desktops (optional) |

### Layout adaptation patterns

| Desktop | Mobile |
|---------|--------|
| Data table | Card list |
| Sidebar navigation | Bottom navigation or hamburger |
| Dialog | Full-screen sheet |
| Multi-column grid | Single-column stack |
| Inline actions | Overflow menu |

### Rules

- Mobile-first: base styles for smallest viewport, enhance upward
- Container queries for component-level responsiveness
- Test at actual breakpoints AND between them
- No horizontal scrolling on any viewport

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Hardcoded colors/sizes | Breaks theming, dark mode, consistency | Use design tokens |
| Color-only indicators | Inaccessible to colorblind users | Color + icon + text |
| Div soup | No semantic meaning, poor accessibility | Semantic HTML elements |
| Reimplementing library primitives | Bugs, inconsistency, maintenance burden | Use library primitives, customize via theme |
| Magic spacing numbers | Inconsistent layout, hard to maintain | Spacing scale tokens |
| Z-index wars | Stacking context chaos | Defined elevation system |
| Inline styles for theming | Cannot be overridden by theme | CSS custom properties or class-based theming |
| Missing loading states | Perceived as broken | Skeleton matching final layout |
| Missing error states | User stuck with no path forward | Error message + retry action |
| Missing empty states | Blank screen confusion | Helpful message + CTA |
