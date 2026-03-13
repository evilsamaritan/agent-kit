# Frontend Review Workflow

Step-by-step procedure for auditing any frontend project. Framework-agnostic.

---

## Step 1: Project Scan

Map the frontend project structure. Discover and adapt to whatever stack is used.

1. Identify framework and build tool (React+Vite, Next.js, Vue+Vite, SvelteKit, Angular, Astro, etc.)
2. Identify styling approach (Tailwind, CSS Modules, CSS-in-JS, scoped styles, BEM, vanilla)
3. Identify component library (shadcn/ui, PrimeVue, Angular Material, Headless UI, custom, none)
4. Map component inventory: what exists in `src/components/` (or equivalent)
5. Identify state management: server state library, client state approach
6. Identify routing solution and page/view structure
7. Identify API layer: client abstraction, types, error handling
8. Check test coverage: what's tested, testing library used

## Step 2: Component Analysis

### Component Quality

- [ ] Components are small and focused (under 150 lines of template/JSX)
- [ ] Props/inputs are typed (TypeScript interfaces, PropTypes, or framework equivalent)
- [ ] No prop drilling beyond 2 levels (use composition, context, or stores)
- [ ] Presentational components have no side effects
- [ ] Data fetching is in composables/hooks/services, not in render/template
- [ ] Components handle loading, error, and empty states
- [ ] List rendering uses stable, unique keys

### Styling Consistency

- [ ] Single styling approach used consistently (no mixed CSS strategies)
- [ ] Design tokens used instead of hardcoded values
- [ ] Consistent spacing scale (4px or 8px grid)
- [ ] Color usage is semantic (status-based, not arbitrary hex)
- [ ] Dark mode works if enabled (no hardcoded colors bypassing tokens)
- [ ] Responsive breakpoints applied consistently
- [ ] No `!important` or unnecessary specificity overrides

### Component Library Integration

- [ ] Primitives from the project's component library are used (not reimplemented)
- [ ] Domain components compose library primitives
- [ ] Variant systems used for component variations (size, color, state)
- [ ] Class/style merging utility used for conditional styles
- [ ] Accessibility features from the library are preserved (not overridden)
- [ ] Import paths are consistent across the project

### Dashboard-Specific (if applicable)

- [ ] Status badges use consistent color mapping with text labels
- [ ] Numbers are formatted consistently (decimals, thousands separator)
- [ ] Tables have proper column alignment (numbers right-aligned)
- [ ] Loading states use skeletons matching final layout
- [ ] Error boundaries catch and display component failures
- [ ] Real-time data has staleness indicators
- [ ] Destructive actions have confirmation dialogs

## Step 3: Accessibility Audit

- [ ] Semantic HTML elements used appropriately (`<nav>`, `<main>`, `<button>`)
- [ ] All images have alt text (or `aria-hidden` for decorative)
- [ ] Form inputs have associated labels
- [ ] Color is not the sole indicator of meaning (add icons or text)
- [ ] Focus is visible on all interactive elements
- [ ] Modal dialogs trap focus
- [ ] Tab order follows visual order
- [ ] ARIA roles/labels on custom widgets
- [ ] Live regions for dynamic content updates
- [ ] `prefers-reduced-motion` respected

## Step 4: Performance Check

- [ ] Routes and heavy components are lazy-loaded
- [ ] Images use modern formats and proper sizing
- [ ] No unnecessary re-renders or reactivity triggers
- [ ] Bundle size is reasonable (check for large dependencies)
- [ ] Layout shifts minimized (explicit dimensions for media)
- [ ] Large lists use virtual scrolling if 100+ items

## Step 5: Report

```
## Frontend Assessment

### Summary
[2-3 sentences: overall UI health, consistency, accessibility]

### Stack
| Aspect | Technology |
|--------|-----------|
| Framework | |
| Styling | |
| Component Library | |
| State Management | |
| Build Tool | |

### Component Inventory
| Component | Type | Lines | Props | Tests | Issues |
|-----------|------|-------|-------|-------|--------|

### Design Token Usage
| Token Category | Used? | Hardcoded Alternatives Found |
|----------------|-------|------------------------------|

### Page Analysis
| Page | Components | Loading | Error | Empty | Responsive | A11y |
|------|-----------|---------|-------|-------|------------|------|

### Findings
| # | Area | Severity | Finding | Recommendation |
|---|------|----------|---------|----------------|

### Accessibility Score
| Criterion | Score | Notes |
|-----------|-------|-------|
| Semantic HTML | | |
| Keyboard nav | | |
| Screen reader | | |
| Color contrast | | |
| Focus management | | |

### Performance
| Metric | Status | Notes |
|--------|--------|-------|
| Code splitting | | |
| Image optimization | | |
| Bundle size | | |
| Layout stability | | |

### Recommendations
1. [Priority order — what to fix/improve first]
```
