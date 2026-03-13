# Frontend Patterns & Domain Knowledge

Universal frontend patterns applicable to any framework or library.

## Contents

- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [Styling & Design Tokens](#styling--design-tokens)
- [Dashboard & Data-Rich UI Patterns](#dashboard--data-rich-ui-patterns)
- [Responsive Design](#responsive-design)
- [Accessibility](#accessibility)
- [Performance & Web Vitals](#performance--web-vitals)
- [CSS Architecture](#css-architecture)
- [Progressive Enhancement](#progressive-enhancement)
- [Common Anti-Patterns](#common-anti-patterns)
- [Framework Quick Reference](#framework-quick-reference)

---

## Component Architecture

Principles apply regardless of framework (React, Vue, Svelte, Angular, Web Components, Solid).

- **Composition over inheritance**: small, focused components composed together
- **Separation of concerns**: data-fetching logic separate from presentation
- **Minimal interface**: typed props/inputs, avoid passing more data than needed
- **Colocation**: component + styles + tests + types in the same directory
- **Clean exports**: expose only the public API from component directories
- **Descriptive naming**: PascalCase components, domain-specific names (`OrderStatusBadge` not `Badge`)
- **Single responsibility**: one component = one purpose, under 150 lines of template/JSX
- **Slot/children patterns**: use content projection for flexible composition

### Component Hierarchy

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

---

## State Management

Choose patterns based on state type, not framework preference.

| State Type | Description | Pattern |
|------------|-------------|---------|
| Server state | Data from APIs | Async data library (TanStack Query, SWR, Apollo, RTK Query) |
| Local UI state | Toggle, form input | Component-level state (useState, ref, signal) |
| Shared UI state | Theme, sidebar open | Context/store (Context API, Pinia, Svelte stores, signals) |
| Form state | Complex forms | Form library (React Hook Form, VeeValidate, Formly) |
| URL state | Filters, pagination | Router query params |

**Rules:**
- Server state belongs in an async data layer, not component state
- Avoid prop drilling beyond 2 levels — use composition, context, or stores
- Colocate state as close to where it's consumed as possible
- Derived/computed state should be calculated, not stored separately

### Async Data Patterns for Dashboards

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

## Styling & Design Tokens

These principles apply whether using Tailwind, CSS Modules, Styled Components, vanilla CSS, or any other approach.

- **Semantic tokens over raw values**: `--color-destructive` not `#ef4444`
- **Consistent spacing scale**: use a 4px or 8px grid system
- **Typography scale**: tie font sizes to purpose (`text-sm` for secondary, `text-base` for body)
- **Border radius tokens**: consistent rounding via design tokens
- **Shadow/elevation system**: depth hierarchy for layered UI
- **Consistent transitions**: standardized durations for animations
- **Dark mode**: use CSS custom properties for theming, not hardcoded colors

### Design Token Structure

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

---

## Dashboard & Data-Rich UI Patterns

- **Status indicators**: color-coded badges with text labels (never color alone — colorblind users)
- **Number formatting**: consistent decimals, locale-aware thousands separators
- **Tables**: sortable, filterable, with pagination; right-align numeric columns
- **Summary cards**: key metrics with comparison/trend indicators
- **Actions**: confirmation dialogs for destructive actions
- **Loading states**: skeleton screens matching final layout shape, not spinners
- **Error states**: inline error messages with retry action, not just red text
- **Empty states**: helpful message + call-to-action when no data exists
- **Real-time data**: polling with staleness indicators, optimistic updates

---

## Responsive Design

- **Mobile-first**: base styles for mobile, progressive enhancement for larger screens
- **Breakpoint strategy**: 3 breakpoints usually sufficient — small (~640px), medium (~768px), large (~1024px)
- **Layout adaptation**: sidebar collapses to bottom nav on mobile, tables become cards
- **Touch targets**: minimum 44x44px for interactive elements on mobile
- **Information density**: desktop shows more columns/data, mobile shows summary + drill-down
- **Container queries**: use component-level responsiveness where supported
- **Viewport units**: use `dvh`/`svh` for mobile viewport issues, not `vh`

---

## Accessibility

WCAG 2.1 AA as minimum standard for all projects.

- **Semantic HTML**: `<nav>`, `<main>`, `<section>`, `<button>` — not div soup
- **ARIA labels**: meaningful labels for icon-only buttons, status indicators
- **Keyboard navigation**: all interactive elements reachable via Tab, activated via Enter/Space
- **Focus management**: visible focus rings, logical tab order, focus trap in modals
- **Color contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for large text/UI components)
- **Screen reader support**: meaningful content order, live regions for real-time updates
- **Reduced motion**: respect `prefers-reduced-motion` for users with vestibular disorders
- **Form accessibility**: every input has an associated `<label>`, error messages linked with `aria-describedby`
- **Alt text**: meaningful descriptions for informative images, `aria-hidden` for decorative ones

---

## Performance & Web Vitals

Target Core Web Vitals thresholds:

| Metric | Target | What it measures |
|--------|--------|------------------|
| LCP (Largest Contentful Paint) | < 2.5s | Loading performance |
| INP (Interaction to Next Paint) | < 200ms | Responsiveness |
| CLS (Cumulative Layout Shift) | < 0.1 | Visual stability |

**Optimization patterns:**
- Lazy-load routes and heavy components (code splitting)
- Optimize images: use `<picture>` with modern formats (WebP, AVIF), proper sizing
- Minimize bundle size: tree-shake, analyze with bundler tools
- Defer non-critical JavaScript and CSS
- Use `loading="lazy"` for below-fold images
- Avoid layout shifts: set explicit dimensions for images/embeds, use font `size-adjust`
- Prefetch likely navigation targets
- Virtual scrolling for large lists (100+ items)

---

## CSS Architecture

Regardless of methodology, maintain these principles:

- **One source of truth**: design tokens defined in one place, consumed everywhere
- **Scoped styles**: avoid global style leaks (CSS Modules, scoped styles, BEM, utility classes)
- **Minimal specificity**: avoid `!important`, keep selectors flat
- **Extract repeated patterns**: only when a pattern appears 3+ times
- **Layer organization**: base (reset/tokens) > components > utilities > overrides

| Approach | Best for | Trade-off |
|----------|----------|-----------|
| Utility-first (Tailwind) | Rapid prototyping, design systems | Verbose markup, learning curve |
| CSS Modules | Component-scoped isolation | More files, explicit imports |
| CSS-in-JS | Dynamic styles, theme-aware | Runtime cost, bundle size |
| BEM | Large teams, strict conventions | Verbose class names |
| Vanilla CSS (custom properties) | Small projects, standards-first | Manual scoping needed |

---

## Progressive Enhancement

- **HTML first**: core content and functionality works without JavaScript
- **CSS second**: enhance layout, interactions, animations
- **JS third**: add interactivity, dynamic behavior, client-side routing
- **Feature detection**: use `@supports` for CSS, capability checks for JS APIs
- **Graceful degradation**: if a feature is unavailable, fall back to simpler version
- **No-JS fallback**: critical forms and navigation should work without JS where possible

---

## Common Anti-Patterns

| # | Anti-Pattern | Problem | Fix |
|---|-------------|---------|-----|
| 1 | Spinners everywhere | Jarring, no layout hint | Skeleton screens matching final layout |
| 2 | Raw numbers | `50123.45000000` displayed as-is | Locale-aware formatting, consistent decimals |
| 3 | Color-only status | Inaccessible to colorblind users | Add text label or icon alongside color |
| 4 | No error recovery | Error message with no retry action | Inline error + retry button |
| 5 | Desktop-only tables | Tables overflow on mobile | Responsive: cards on small screens |
| 6 | Stale data without indicator | Showing old data without warning | Timestamp or "Updated Xs ago" text |
| 7 | Div soup | `<div onClick>` — no keyboard support | Use `<button>`, semantic HTML |
| 8 | Inconsistent spacing | Arbitrary margins/padding | Use spacing scale from design tokens |
| 9 | Hardcoded colors | `#3b82f6` in markup instead of token | Use semantic design tokens |
| 10 | No empty states | Blank page when list is empty | Helpful message + call-to-action |
| 11 | No loading states | Content pops in, layout shifts | Skeleton or placeholder matching layout |
| 12 | Blocking renders | Large bundle delays first paint | Code splitting, lazy loading |

---

## Framework Quick Reference

Examples of how universal patterns map to specific frameworks. Use your project's framework conventions.

| Concept | React | Vue 3 | Svelte 5 | Angular | Solid |
|---------|-------|-------|----------|---------|-------|
| Component model | Function + JSX | SFC (.vue) | .svelte files | @Component class | Function + JSX |
| Local state | `useState` | `ref()` / `reactive()` | `$state` | Signals / class fields | `createSignal` |
| Derived state | `useMemo` | `computed()` | `$derived` | `computed()` | `createMemo` |
| Side effects | `useEffect` | `watch` / `watchEffect` | `$effect` | `effect()` / lifecycle | `createEffect` |
| Context/DI | Context API | `provide` / `inject` | Context API | DI system | Context API |
| Server state | TanStack Query | TanStack Query / VueQuery | TanStack Query | HttpClient + signals | TanStack Query |
| Styling | Tailwind / CSS Modules | Scoped styles / Tailwind | Scoped styles / Tailwind | ViewEncapsulation / Tailwind | Tailwind / CSS Modules |
| Component lib | shadcn/ui, Radix | PrimeVue, Headless UI | Skeleton, Melt UI | Angular Material, PrimeNG | Kobalte |
| Routing | React Router, TanStack Router | Vue Router | SvelteKit routing | Angular Router | Solid Router |
