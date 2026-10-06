---
name: accessibility
description: "Implement or audit accessibility (a11y): WCAG 2.2, ARIA, keyboard and focus behavior, screen readers, color contrast, alt text, accessible forms and error states. Use for web conformance and ARIA patterns; native iOS/Android basics are in a reference. Markup is in html, styling in css."
user-invocable: true
---

# Accessibility

Target WCAG 2.2 Level AA. Legal requirements differ by jurisdiction and change; dates and penalties live in [enforcement-timeline.md](references/enforcement-timeline.md).

## Scope and boundaries

| Concern | Owner |
|---------|-------|
| Semantic markup, landmarks, labels, native controls, `<dialog>` | `html` |
| Focus styles, logical properties, reduced-motion and contrast media queries | `css` |
| Behavior: keyboard interaction, focus management, ARIA, live regions, conformance | this skill |
| User flows, error and empty states, cognitive load | `design` |
| Native iOS and Android semantics, Dynamic Type, screen reader testing | [native.md](references/native.md); app lifecycle and UX conventions in `mobile` |
| Component-level state wiring | `frontend`, `react`, `vue` |

WCAG is platform-neutral in goal; ARIA is the web mechanism only. On native platforms use the platform accessibility tree instead.

## ARIA decision tree

1. Native HTML element exists (`button`, `input`, `select`, `dialog`, `details`)? Use it; it brings semantics and keyboard behavior.
2. No native equivalent? Add role, states, and the full keyboard handling from the ARIA Authoring Practices pattern ([aria-patterns.md](references/aria-patterns.md)).
3. Native element needs extra state? Add the attribute (`aria-expanded`, `aria-pressed`, `aria-current`).

Rules: do not change native semantics (no `role="heading"` on `<h2>`); every ARIA control is keyboard operable and has an accessible name; never put `role="presentation"` or `aria-hidden="true"` on a focusable element; do not repeat a role the element already has.

## WCAG essentials

| Level | Meaning |
|-------|---------|
| A | Minimum: text alternatives, keyboard operable, no seizure triggers |
| AA | Standard target: contrast, 200% resize, visible focus, error identification, consistent navigation |
| AAA | Enhanced; adopt single criteria where feasible |

Four principles: Perceivable, Operable, Understandable, Robust. Criteria that most often fail are in [wcag-checklist.md](references/wcag-checklist.md).

New in WCAG 2.2:

| Criterion | Level | Requirement |
|-----------|-------|-------------|
| 2.4.11 Focus Not Obscured (Minimum) | AA | Focused element not entirely hidden behind sticky headers or footers |
| 2.5.7 Dragging Movements | AA | Non-dragging alternative for drag operations |
| 2.5.8 Target Size (Minimum) | AA | Targets at least 24 by 24 CSS px (44 px is a recommendation) |
| 3.2.6 Consistent Help | A | Help mechanisms in the same relative order across pages |
| 3.3.7 Redundant Entry | A | Do not ask for the same information twice in a process |
| 3.3.8 Accessible Authentication (Minimum) | AA | No cognitive function test without an alternative; allow password managers |

2.4.13 Focus Appearance and 3.3.9 Accessible Authentication (Enhanced) are AAA.

## Live regions and focus

- The live region element must exist in the DOM before its content changes; inserting a region together with its content is not announced reliably.
- `role="status"` (polite) for result counts, saved confirmations and toasts; `role="alert"` (assertive) only for urgent errors.
- Modal focus: prefer `<dialog>` with `showModal()`. A custom modal must trap Tab, close on Escape, make the background `inert`, move focus in on open, and return it to the trigger on close. Do not hand-roll a trap when `<dialog>` is available.
- Composite widgets (tabs, menus, trees, grids) use roving `tabindex` (one item at `0`, the rest `-1`, arrows move focus, Home and End jump).
- After a route change or deletion, move focus deliberately (heading, main content, neighboring item). Provide a skip link as the first focusable element.
- Keep `:focus-visible` outlines; never remove an outline without a replacement.

## Color and contrast

| Element | AA | AAA |
|---------|----|-----|
| Normal text | 4.5:1 | 7:1 |
| Large text (24 px, or 18.66 px bold, and up) | 3:1 | 4.5:1 |
| UI components and graphical objects | 3:1 | none |

Color is never the only indicator: add text, an icon, a pattern, or an underline. Honor `prefers-reduced-motion`, `prefers-contrast`, and `forced-colors` (do not rely on background images or box-shadow for essential boundaries; they vanish in forced-colors mode).

## Testing

Automated scanners (axe-core, Lighthouse) catch only a part of the issues (estimates vary by method), so manual passes are required: keyboard-only through each flow, screen reader (headings, landmarks, labels, dynamic updates), zoom to 200% and 400% (320 px, no horizontal scroll), text-spacing overrides, grayscale, reduced motion. Step list: [wcag-checklist.md](references/wcag-checklist.md#quick-testing-protocol).

Scanner selection: axe-core is the default engine. Use it at the layer where the failure is cheapest to catch: a component-test integration (for example jest-axe or vitest-axe) for names, roles, and contrast of isolated components; the e2e runner's axe integration (for example @axe-core/playwright) for full pages and states (open dialog, error state, route change); a Lighthouse or axe CLI step in CI as a regression gate on key routes, failing on new violations rather than a total score. Scanners cannot judge alt text quality, focus order, or whether a live region says something useful. Test frameworks, runners, and CI wiring: `testing` and `ci-cd`.

## Anti-patterns

1. **Overlay widgets** claiming to make a site compliant. They fix a minority of issues, interfere with assistive technology, and have drawn litigation. Fix the code.
2. **`tabindex` above 0**: breaks natural order; use `0` or `-1`.
3. **Hover-only, drag-only, or click-only interactions** with no keyboard or single-pointer alternative.
4. **`aria-label` that differs from visible text** (breaks voice control, WCAG 2.5.3); prefer `aria-labelledby` pointing at the visible text.
5. **`display: none` for content that should be read**: it hides from assistive technology too; use the visually-hidden pattern in the checklist.
6. **Auto-playing media** without pause, stop, or mute (1.4.2).
7. **Timed feedback** (auto-dismissing toasts, session timeouts) with no way to extend or pause (2.2.1).

## Context adaptation

- **Designer:** target sizes, focus appearance, color independence, reading order.
- **Backend:** human-readable error text (not only codes), `lang` on served documents, accessible generated PDFs.
- **QA:** the manual protocol above, ACR/VPAT evidence, regression checks for accessible names and keyboard paths.

## Related knowledge

- `html`: semantic markup, landmarks, forms, `<dialog>`
- `css`: focus styles, `prefers-*` queries, logical properties
- `design`: cognitive accessibility, flows, error states
- `mobile`: native app lifecycle and conventions
- `frontend`: component state and focus wiring

## References

- [wcag-checklist.md](references/wcag-checklist.md): high-frequency WCAG 2.2 criteria with code and the manual testing protocol
- [aria-patterns.md](references/aria-patterns.md): dialog, tabs, menu, combobox, tree, accordion, data table, tooltip with keyboard specs
- [native.md](references/native.md): iOS and Android accessibility basics and how they differ from the web
- [enforcement-timeline.md](references/enforcement-timeline.md): volatile regulatory dates, scope, and penalties by jurisdiction
