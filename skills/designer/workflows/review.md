# Design Review Workflow

Step-by-step procedure for conducting a full UI/UX design review.

---

## Phase 1: Discover the Stack

Before auditing, discover what the project actually uses:

1. Scan for package manager files (`package.json`, `Cargo.toml`, `pyproject.toml`, `Gemfile`)
2. Identify the UI framework: React, Vue, Svelte, Angular, server-rendered templates, etc.
3. Identify the component library: shadcn/ui, Material UI, Ant Design, Chakra UI, Headless UI, custom, none
4. Identify the styling approach: Tailwind CSS, CSS Modules, styled-components, vanilla CSS, Sass, CSS-in-JS
5. Identify design token strategy: CSS custom properties, Sass variables, JS theme objects, design token files
6. Note the directory structure for components, pages, and styles

Record findings before proceeding. All subsequent phases adapt to the discovered stack.

---

## Phase 2: Component Inventory

Scan the frontend source directory:

1. Map all primitive/base components (UI library primitives or custom base components)
2. Map all domain-specific components (composed from primitives)
3. Map all pages or routes
4. Identify component hierarchy and composition patterns
5. Note which components are from a library vs custom-built

---

## Phase 3: Design System Audit

1. **Token usage vs hardcoded values** -- search for raw color hex/rgb, pixel values, and font sizes that bypass the token system
2. **Variant consistency** -- check that component variants follow a unified system (not ad-hoc per component)
3. **Color system coverage** -- verify semantic color tokens exist for: primary, secondary, destructive/error, warning, success, muted, accent
4. **Typography hierarchy** -- verify a clear scale from page headings to body text to captions
5. **Spacing consistency** -- check adherence to a spacing scale (4px/8px grid or equivalent)
6. **Border and radius tokens** -- verify unified border-radius and border-width values
7. **Elevation/shadow system** -- check for consistent depth hierarchy (cards, modals, popovers, dropdowns)

---

## Phase 4: Component Best Practices Check

Adapt this checklist to the discovered stack:

- [ ] UI primitives come from the chosen library (not reimplemented)
- [ ] Conditional class merging uses a utility (e.g., `cn()`, `clsx`, `classnames`)
- [ ] Component variants use a systematic approach (cva, variant props, BEM modifiers)
- [ ] Import paths are consistent (aliases, barrel files)
- [ ] Dialogs/modals include accessible descriptions
- [ ] Form controls have associated labels
- [ ] Buttons use semantic variants (not one default for everything)
- [ ] Loading skeletons match final content shape
- [ ] Transient feedback (toasts) vs persistent feedback (alerts) used correctly
- [ ] Icons come from a consistent icon set

---

## Phase 5: Dashboard & Data UX Audit

- [ ] Status indicators: color + icon + text (never color alone)
- [ ] Numbers: monospaced/tabular, formatted, right-aligned in tables
- [ ] Numeric trends: colored with directional indicator where meaningful
- [ ] Loading: skeleton per page section, matching final layout shape
- [ ] Error states: inline with retry action, not just styled text
- [ ] Empty states: descriptive message + call-to-action
- [ ] Stale data: "Updated N ago" or freshness indicator
- [ ] Destructive actions: confirmation dialog with clear consequences
- [ ] Card grids: uniform heights within a row
- [ ] Tables: column alignment (text left, numbers right, actions right)

---

## Phase 6: Accessibility Audit

- [ ] Semantic HTML (`nav`, `main`, `section`, `button` -- not div-only markup)
- [ ] ARIA labels on icon-only buttons and non-text interactive elements
- [ ] Visible focus indicator on all interactive elements
- [ ] Focus trap in modals and drawers
- [ ] Color contrast >= 4.5:1 for normal text, >= 3:1 for large text (WCAG AA)
- [ ] `aria-live` regions on dynamically updated content
- [ ] `role="status"` on status indicators
- [ ] Every form input has an associated label
- [ ] Skip-to-main-content link present
- [ ] `prefers-reduced-motion` respected for animations
- [ ] `prefers-color-scheme` support if dark mode exists
- [ ] Touch targets >= 44x44px for interactive elements on touch devices

---

## Phase 7: Responsive Design Audit

- [ ] Base styles target smallest supported viewport (mobile-first)
- [ ] Breakpoint strategy is documented or consistent (2-4 breakpoints sufficient)
- [ ] Layout adapts meaningfully: tables to cards, sidebar to bottom nav, dialog to sheet
- [ ] Touch targets adequate on mobile
- [ ] Information hierarchy shifts: desktop shows full detail, mobile shows summary with drill-down
- [ ] Container queries used where component-level responsiveness matters
- [ ] No horizontal overflow on small viewports

---

## Phase 8: Produce Report

Use this structure for the final report:

```
## Designer Review

### Summary
[2-3 sentences: stack discovered, design system maturity, consistency, key gaps]

### Stack
| Aspect | Discovered |
|--------|-----------|
| UI Framework | |
| Component Library | |
| Styling Approach | |
| Token Strategy | |

### Component Map
| Component | Type | Library Base | Variants | A11y Score |
|-----------|------|-------------|----------|------------|

### Design Token Coverage
| Category | Token Usage | Hardcoded Found | Status |
|----------|------------|-----------------|--------|
| Colors | | | |
| Typography | | | |
| Spacing | | | |
| Borders/Radius | | | |
| Elevation | | | |

### Page Analysis
| Page | Components | Loading | Error | Empty | Responsive | Dark Mode |
|------|-----------|---------|-------|-------|------------|-----------|

### Findings
| # | Severity | Area | Finding | Recommendation |
|---|----------|------|---------|----------------|

### Accessibility Score
| Criterion | Grade | Notes |
|-----------|-------|-------|
| Semantic HTML | | |
| Keyboard Nav | | |
| Screen Reader | | |
| Color Contrast | | |
| Focus Mgmt | | |
| Motion/Scheme | | |

### Priority Actions
1. [Most impactful improvements, ordered by effort-to-impact ratio]
```
