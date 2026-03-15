# Frontend Patterns & Domain Knowledge

Universal frontend patterns applicable to any framework or library. Loaded on demand — SKILL.md covers the essentials.

## Contents

- [Component Hierarchy](#component-hierarchy)
- [Async Data Patterns](#async-data-patterns)
- [Design Token Structure](#design-token-structure)
- [Dashboard & Data-Rich UI Patterns](#dashboard--data-rich-ui-patterns)
- [CSS Architecture](#css-architecture)
- [Progressive Enhancement](#progressive-enhancement)
- [Rendering Strategy Decision Tree](#rendering-strategy-decision-tree)
- [Framework Quick Reference](#framework-quick-reference)

---

## Component Hierarchy

```
src/
  components/
    ui/              <-- primitives (Button, Card, Badge, Table, Dialog)
    Layout.*         <-- shell (nav + main + sidebar)
    StatusBadge.*    <-- composed (primitive + variant mapping)
    DataTable.*      <-- composed (Table + sorting + pagination)
    MetricCard.*     <-- composed (Card + number formatting)
    ConfirmDialog.*  <-- composed (Dialog + destructive action)
  pages/ (or views/, routes/)
    DashboardPage.*  <-- composes MetricCard[], DataTable
    DetailPage.*     <-- composes cards + tables
    ListPage.*       <-- composes DataTable or Card grid
    SettingsPage.*   <-- composes Form components
  composables/ (or hooks/, stores/)
    useData.*        <-- server state hooks/composables
    useTheme.*       <-- dark mode toggle
  lib/ (or utils/)
    utils.*          <-- className merge, formatNumber, formatDate
    constants.*      <-- status colors, breakpoints
```

- Clean exports: expose only the public API from component directories
- Slot/children patterns: use content projection for flexible composition
- Under 150 lines per component file — split if larger

---

## Async Data Patterns

```
Polling intervals by data freshness needs:
  Summary/aggregate:  30s
  List views:         15s
  Detail views:       10s
  History/logs:       60s

Staleness indicators:
  Fresh (<5s):   no indicator
  Stale (5-30s): subtle "Updated Xs ago" text
  Error:         red banner with retry button

Optimistic updates:
  State toggles: immediately update UI, revert on error
  Create:        add to list with "creating..." state
```

---

## Design Token Structure

```css
/* Framework-agnostic CSS custom properties */
:root {
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
  --color-primary: #1d4ed8;
  --color-primary-foreground: #ffffff;
  --color-destructive: #ef4444;
  --color-muted: #f5f5f5;
  --color-muted-foreground: #737373;
  --color-border: #e5e5e5;
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --font-sans: "Inter", system-ui, sans-serif;
}

.dark, [data-theme="dark"] {
  --color-background: #0a0a0a;
  --color-foreground: #fafafa;
  /* ... dark overrides */
}
```

Shadow/elevation system: use consistent depth tokens for layered UI.
Border radius tokens: consistent rounding via design tokens.
Transition tokens: standardized durations for animations.

---

## Dashboard & Data-Rich UI Patterns

- **Status indicators**: color-coded badges with text labels (never color alone)
- **Number formatting**: consistent decimals, locale-aware thousands separators
- **Tables**: sortable, filterable, with pagination; right-align numeric columns
- **Summary cards**: key metrics with comparison/trend indicators
- **Actions**: confirmation dialogs for destructive actions
- **Loading states**: skeleton screens matching final layout shape, not spinners
- **Error states**: inline error messages with retry action
- **Empty states**: helpful message + call-to-action when no data exists
- **Real-time data**: polling with staleness indicators, optimistic updates

---

## CSS Architecture

Regardless of methodology, maintain these principles:

- **One source of truth**: design tokens defined once, consumed everywhere
- **Scoped styles**: avoid global leaks (CSS Modules, scoped styles, BEM, utility classes)
- **Minimal specificity**: avoid `!important`, keep selectors flat
- **Extract repeated patterns**: only when a pattern appears 3+ times
- **Layer organization**: base (reset/tokens) > components > utilities > overrides

| Approach | Best for | Trade-off |
|----------|----------|-----------|
| Utility-first | Rapid prototyping, design systems | Verbose markup, learning curve |
| CSS Modules | Component-scoped isolation | More files, explicit imports |
| CSS-in-JS | Dynamic styles, theme-aware | Runtime cost, bundle size |
| BEM | Large teams, strict conventions | Verbose class names |
| Vanilla CSS (custom properties) | Small projects, standards-first | Manual scoping needed |

Popular choices: Tailwind CSS, CSS Modules, vanilla CSS with custom properties, Panda CSS.

---

## Progressive Enhancement

- **HTML first**: core content works without JavaScript
- **CSS second**: enhance layout, interactions, animations
- **JS third**: add interactivity, dynamic behavior, client-side routing
- **Feature detection**: use `@supports` for CSS, capability checks for JS APIs
- **Graceful degradation**: if a feature is unavailable, fall back to simpler version
- **No-JS fallback**: critical forms and navigation should work without JS where possible

---

## Rendering Strategy Decision Tree

```
What does the page need?
├── Static content, rarely changes?
│   └── Static Site Generation (SSG) — build-time HTML
│
├── SEO-critical + dynamic data?
│   └── Server-Side Rendering (SSR) — request-time HTML
│       └── Consider streaming SSR for faster TTFB
│
├── Mostly static + some dynamic sections?
│   └── Incremental Static Regeneration or partial prerendering
│
├── Authenticated app, no SEO needs?
│   └── Client-Side Rendering (SPA) — lighter server
│
└── Mixed — some pages static, some dynamic?
    └── Hybrid rendering — per-route strategy
        Popular meta-frameworks: Next.js, Nuxt, SvelteKit, Astro, Analog
```

---

## Framework Quick Reference

How universal patterns map to specific frameworks. Use your project's conventions.

| Concept | React | Vue 3 | Svelte 5 | Angular | Solid |
|---------|-------|-------|----------|---------|-------|
| Component model | Function + JSX | SFC (.vue) | .svelte files | @Component class | Function + JSX |
| Local state | `useState` | `ref()` / `reactive()` | `$state` | Signals / class fields | `createSignal` |
| Derived state | `useMemo` | `computed()` | `$derived` | `computed()` | `createMemo` |
| Side effects | `useEffect` | `watch` / `watchEffect` | `$effect` | `effect()` / lifecycle | `createEffect` |
| Context/DI | Context API | `provide` / `inject` | Context API | DI system | Context API |
| Styling | CSS Modules / Tailwind | Scoped styles / Tailwind | Scoped styles / Tailwind | ViewEncapsulation / Tailwind | CSS Modules / Tailwind |
| Routing | React Router, TanStack Router | Vue Router | SvelteKit routing | Angular Router | Solid Router |
