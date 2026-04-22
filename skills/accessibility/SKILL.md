---
name: accessibility
description: Provide accessibility expertise — WCAG 2.2 compliance, ARIA patterns, keyboard navigation, focus management, screen reader support. Use when implementing WCAG compliance, ARIA roles, keyboard navigation, accessibility auditing, or inclusive design. Do NOT use for UX decisions (design).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Accessibility

Expert-level accessibility knowledge. WCAG 2.2, ARIA patterns, keyboard interaction, compliance landscape, inclusive design.

---

## ARIA Decision Tree

Use this before writing any ARIA attribute:

1. **Can you use a native HTML element?** → Use it. `<button>`, `<input>`, `<select>`, `<dialog>`, `<details>` have built-in semantics and keyboard behavior.
2. **No native equivalent?** → Use ARIA roles + states + keyboard handling.
3. **Modifying native behavior?** → Add ARIA attributes (`aria-expanded`, `aria-pressed`, `aria-current`).

**First rule of ARIA:** Don't use ARIA if a native HTML element or attribute will do.

**Five rules of ARIA (W3C):**

1. Don't use ARIA if native HTML works
2. Don't change native semantics (don't add `role="heading"` to `<h2>`)
3. All interactive ARIA controls must be keyboard operable
4. Don't use `role="presentation"` or `aria-hidden="true"` on focusable elements
5. All interactive elements must have an accessible name

---

## WCAG 2.2 Levels

| Level | Requirement | What it means |
|-------|-------------|---------------|
| **A** | Minimum | Content is functionally accessible — text alternatives, keyboard operable, no seizure triggers |
| **AA** | Standard (legal target) | Usable — contrast ratios, resize to 200%, focus visible, error identification, consistent navigation |
| **AAA** | Enhanced | Optimal — sign language, extended audio description, no timing, reading level |

Target AA for all projects. AAA is aspirational; specific criteria can be adopted where feasible.

**Four principles (POUR):**

| Principle | Core question |
|-----------|--------------|
| **Perceivable** | Can everyone perceive the content? (alt text, captions, contrast) |
| **Operable** | Can everyone operate the interface? (keyboard, timing, navigation) |
| **Understandable** | Can everyone understand the content? (readable, predictable, error help) |
| **Robust** | Does it work with assistive technology? (valid markup, ARIA, name/role/value) |

### WCAG 2.2 New Criteria (AA)

| Criterion | ID | Key requirement |
|-----------|----|-----------------|
| Focus Not Obscured | 2.4.11 | Focused element not entirely hidden behind sticky headers/footers |
| Dragging Movements | 2.5.7 | Provide non-dragging alternative for drag operations |
| Target Size (Minimum) | 2.5.8 | Interactive targets at least 24x24 CSS pixels |
| Consistent Help | 3.2.6 | Help mechanisms in same relative order across pages |
| Redundant Entry | 3.3.7 | Don't ask for same info twice; auto-populate |
| Accessible Authentication | 3.3.8 | No cognitive function tests without alternative; support password managers |

---

## Compliance Landscape

| Framework | Scope | Standard |
|-----------|-------|----------|
| **EAA** (EU) | E-commerce, apps, digital services in EU | EN 301 549 / WCAG 2.1 AA |
| **ADA Title II** (US) | State and local government websites | WCAG 2.1 AA |
| **ADA Title III** (US) | Private sector websites (case law) | WCAG 2.1/2.2 AA |
| **Section 508** (US) | Federal agencies | WCAG 2.0 AA (updating) |

**Evergreen rule:** EAA applies to digital products/services offered to EU consumers; ADA Title III covers public accommodations in the US; ADA Title II covers US state and local government; Section 508 covers US federal agencies. Each jurisdiction sets its own effective dates, exemptions, and penalties.

**EAA key points:** Applies to any provider offering digital services to EU consumers regardless of location. Exempts micro-enterprises (<10 employees). Requires published accessibility statements. Each member state sets its own penalties.

**WCAG 2.2** is ISO/IEC 40500:2025 — the international reference standard.

**WCAG 3.0** (W3C Accessibility Guidelines): Working Draft stage. Bronze/Silver/Gold scoring model replacing A/AA/AAA. Not for compliance — expected final recommendation ~2028+. Continue using WCAG 2.2 AA.

Specific compliance dates, deadlines, and penalty ranges are volatile — see [enforcement-timeline.md](references/enforcement-timeline.md).

---

## Landmark Regions

| Element | Implicit role | Purpose |
|---------|--------------|---------|
| `<main>` | `main` | Primary content (one per page) |
| `<nav>` | `navigation` | Navigation links |
| `<aside>` | `complementary` | Supporting content |
| `<header>` (top-level) | `banner` | Site header |
| `<footer>` (top-level) | `contentinfo` | Site footer |
| `<form>` (with name) | `form` | Named form region |
| `<section>` (with name) | `region` | Generic named region |

Label duplicate landmarks: `<nav aria-label="Main">`, `<nav aria-label="Footer">`.

---

## Live Regions

```html
<!-- Status messages — polite, waits for idle -->
<div aria-live="polite" aria-atomic="true">3 results found</div>

<!-- Urgent alerts — assertive, interrupts -->
<div role="alert">Session expiring in 1 minute</div>

<!-- Log — polite, appends -->
<div role="log" aria-live="polite">Chat messages here</div>
```

| Attribute | Values | Effect |
|-----------|--------|--------|
| `aria-live` | `polite`, `assertive`, `off` | When to announce |
| `aria-atomic` | `true`, `false` | Announce entire region or just changes |
| `aria-relevant` | `additions`, `removals`, `text`, `all` | What changes to announce |

**Gotcha:** The live region element must exist in DOM before content changes. Dynamically inserting a live region with content does not trigger announcement in all screen readers.

---

## Keyboard Patterns

### Roving Tabindex

```html
<!-- Only one item in tab order at a time; arrow keys move focus -->
<div role="tablist">
  <button role="tab" tabindex="0" aria-selected="true">Tab 1</button>
  <button role="tab" tabindex="-1">Tab 2</button>
  <button role="tab" tabindex="-1">Tab 3</button>
</div>
```

Arrow keys move `tabindex="0"` between items. `Home`/`End` jump to first/last.

### Focus Trap (Modals)

Prefer `<dialog>` with `showModal()` — focus trap, `Escape` handling, and backdrop are built-in.

For custom implementations:

```typescript
function trapFocus(modal: HTMLElement) {
  const focusable = modal.querySelectorAll<HTMLElement>(
    'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });
  first.focus();
}
```

---

## Focus Management

- **`:focus-visible`** — browser shows focus ring only for keyboard users (not mouse clicks)
- **Skip link** — first focusable element, hidden until focused: `<a href="#main" class="skip-link">Skip to content</a>`
- **Programmatic focus** — after route change, focus heading or main content; after delete action, focus previous/next item
- **Return focus** — when closing modal/popover, return focus to the trigger element

---

## Color & Contrast

| Element | Minimum ratio (AA) | Enhanced ratio (AAA) |
|---------|-------------------|---------------------|
| Normal text (<24px / <18.66px bold) | 4.5:1 | 7:1 |
| Large text (>=24px / >=18.66px bold) | 3:1 | 4.5:1 |
| UI components & graphical objects | 3:1 | n/a |

Never use color as the sole indicator. Add icons, patterns, text labels, or underlines alongside color cues.

---

## Accessible Content Patterns

### Images

```html
<!-- Informative — describe content -->
<img src="chart.png" alt="Q3 revenue increased 23% to $4.2M" />

<!-- Decorative — empty alt -->
<img src="divider.png" alt="" />

<!-- Complex — long description -->
<figure>
  <img src="org-chart.png" alt="Organization chart" aria-describedby="org-desc" />
  <figcaption id="org-desc">CEO reports to board. Three VPs report to CEO...</figcaption>
</figure>
```

### Forms

```html
<label for="email">Email address</label>
<input type="email" id="email" autocomplete="email" aria-describedby="email-hint" />
<p id="email-hint">We'll never share your email</p>

<!-- Error state -->
<input type="email" id="email" aria-invalid="true" aria-describedby="email-error" />
<p id="email-error" role="alert">Enter a valid email address</p>
```

### Screen Reader Only Text

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

Use `sr-only` for text that provides context to screen readers without visual display. Never use `display: none` or `visibility: hidden` for content that should be read — those hide from assistive technology too.

---

## Testing Strategy

| Approach | Coverage | Use for |
|----------|----------|---------|
| Automated scanners (axe-core, Lighthouse) | ~30-40% of issues | Programmatic checks: missing alt, contrast, ARIA validity |
| Keyboard-only testing | Manual | Tab through entire flow — can you reach everything without a mouse? |
| Screen reader testing | Manual | Headings navigation, landmarks, form labels, dynamic updates |
| Zoom testing (200% and 400%) | Manual | Layout reflow, no clipping, no horizontal scroll at 320px |
| Color/contrast testing | Manual/automated | Grayscale view, contrast ratios, color independence |
| Reduced motion | Manual | Enable `prefers-reduced-motion` — animations must respect it |
| Text spacing | Manual | Apply WCAG text spacing overrides — content must remain readable |

Automated testing catches only ~30-40% of accessibility issues. Manual testing with keyboard and screen reader is essential.

---

## Anti-Patterns

1. **Accessibility overlays** — overlay widgets (any vendor) do not provide WCAG compliance. They fix ~20-40% of issues at best, interfere with assistive technology, and have attracted regulatory fines and lawsuits. Fix the underlying code instead.
2. **ARIA on everything** — semantic HTML first; ARIA is a last resort, not a first choice
3. **`tabindex` > 0** — breaks natural tab order; use 0 or -1 only
4. **Removing focus outlines** — `outline: none` without `:focus-visible` replacement makes keyboard navigation invisible
5. **Mouse-only interactions** — hover menus, drag-only, click-only without keyboard alternative
6. **Color as sole indicator** — red/green for valid/invalid excludes color-blind users; add text or icons
7. **`div` soup** — `<div onclick>` instead of `<button>` loses semantics, keyboard support, and screen reader announcement. Use native interactive elements.
8. **`aria-label` overuse** — don't use `aria-label` when visible text already provides the name. Prefer `aria-labelledby` to reference visible text.
9. **`display: none` for screen reader content** — hides from assistive technology. Use `sr-only` CSS pattern for visually hidden but accessible content.
10. **Auto-playing media** — audio/video that plays automatically without user control violates WCAG 1.4.2. Provide pause/stop/mute controls.

---

## Context Adaptation

**Frontend developer:** ARIA implementation, keyboard event handlers, focus traps, skip navigation, live regions, programmatic focus management, accessible component patterns (APG), `prefers-reduced-motion` and `prefers-contrast` media queries.

**Designer:** Inclusive design thinking, cognitive accessibility, motion sensitivity, touch targets (24x24px minimum per WCAG 2.2, 44x44px recommended), reading order, content hierarchy, color independence, focus indicator design.

**Backend developer:** Accessible error messages in API responses (human-readable, not just codes), form validation messages, language attributes in HTML responses, proper HTTP status codes for screen reader-friendly error pages, PDF/document accessibility.

**QA/Tester:** Accessibility test protocols, automated scanning integration, screen reader test scripts, keyboard navigation checklists, VPAT/ACR documentation, regression testing for accessibility.

**Content author:** Alt text writing, heading hierarchy, link text ("click here" → descriptive), reading level, plain language, caption quality, document structure.

---

## Related Knowledge

- **html/css** — semantic markup, landmark elements, focus styles, `:focus-visible`, `prefers-reduced-motion`
- **design** — inclusive design thinking, cognitive accessibility, information hierarchy
- **frontend** — component accessibility, keyboard handling, state management for screen readers

---

## References

Load on demand for detailed patterns and deep-dive knowledge:

- `references/wcag-checklist.md` — WCAG 2.2 criteria organized by principle, with code examples and quick testing protocol
- `references/aria-patterns.md` — dialog, menu, tabs, combobox, tree, accordion, data table, tooltip — full ARIA patterns with keyboard interaction specs
