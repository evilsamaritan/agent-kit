# WCAG 2.2 Checklist

Organized by principle (POUR). Focus on AA criteria — the legal and practical standard.

## Contents

- [Perceivable](#perceivable)
- [Operable](#operable)
- [Understandable](#understandable)
- [Robust](#robust)
- [Quick Testing Protocol](#quick-testing-protocol)

---

## Perceivable

### 1.1 Text Alternatives

**1.1.1 Non-text Content (A)**

```html
<!-- Informative image — describe content -->
<img src="chart.png" alt="Q3 revenue increased 23% to $4.2M" />

<!-- Decorative image — empty alt -->
<img src="divider.png" alt="" />

<!-- Complex image — long description -->
<img src="org-chart.png" alt="Organization chart" aria-describedby="org-desc" />
<div id="org-desc" class="sr-only">CEO reports to board. Three VPs report to CEO...</div>

<!-- Icon button — accessible name from aria-label -->
<button aria-label="Close dialog"><svg>...</svg></button>

<!-- Input with purpose -->
<label for="email">Email address</label>
<input type="email" id="email" autocomplete="email" />
```

### 1.2 Time-based Media

- **1.2.1 Audio/Video (prerecorded) (A)** — provide captions for video, transcript for audio
- **1.2.2 Captions (A)** — synchronized captions for all prerecorded audio content in video
- **1.2.3 Audio Description (A)** — describe visual content not conveyed by audio track
- **1.2.5 Audio Description (AA)** — audio description for all prerecorded video

### 1.3 Adaptable

**1.3.1 Info and Relationships (A)**

```html
<!-- Use semantic markup — not visual styling — for structure -->
<table>
  <caption>Quarterly Revenue</caption>
  <thead><tr><th scope="col">Quarter</th><th scope="col">Revenue</th></tr></thead>
  <tbody><tr><td>Q1</td><td>$3.1M</td></tr></tbody>
</table>

<!-- Lists for list content -->
<ul><li>Item 1</li><li>Item 2</li></ul>

<!-- Headings in order — no skipping levels -->
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
```

**1.3.5 Identify Input Purpose (AA)**

```html
<!-- autocomplete enables autofill and input purpose identification -->
<input type="text" autocomplete="given-name" />
<input type="text" autocomplete="family-name" />
<input type="email" autocomplete="email" />
<input type="tel" autocomplete="tel" />
```

### 1.4 Distinguishable

**1.4.1 Use of Color (A)** — never use color alone to convey information

```html
<!-- Bad: red/green only -->
<span style="color: red">Error</span>

<!-- Good: color + icon + text -->
<span class="error"><svg aria-hidden="true">...</svg> Error: email is required</span>
```

**1.4.3 Contrast (Minimum) (AA)** — 4.5:1 normal text, 3:1 large text

**1.4.4 Resize Text (AA)** — content usable at 200% zoom, no horizontal scrolling

**1.4.10 Reflow (AA)** — no horizontal scroll at 320px viewport width (equivalent to 400% zoom)

**1.4.11 Non-text Contrast (AA)** — UI components and graphics at 3:1 ratio

**1.4.12 Text Spacing (AA)** — content works with user-adjusted spacing:
- Line height ≥ 1.5x font size
- Paragraph spacing ≥ 2x font size
- Letter spacing ≥ 0.12x font size
- Word spacing ≥ 0.16x font size

**1.4.13 Content on Hover or Focus (AA)** — tooltips/popovers must be dismissible (Escape), hoverable (user can move pointer to it), and persistent (stays until dismissed)

---

## Operable

### 2.1 Keyboard Accessible

**2.1.1 Keyboard (A)** — all functionality available via keyboard

**2.1.2 No Keyboard Trap (A)** — user can Tab away from every component

```html
<!-- Modal — trap focus but allow Escape to close -->
<dialog>
  <!-- Focus cycles within dialog -->
  <!-- Escape closes dialog -->
  <!-- Focus returns to trigger on close -->
</dialog>
```

### 2.4 Navigable

**2.4.1 Bypass Blocks (A)** — skip navigation link

```html
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <nav>...</nav>
  <main id="main">...</main>
</body>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  z-index: 100;
}
.skip-link:focus { top: 0; }
</style>
```

**2.4.3 Focus Order (A)** — logical tab order matches visual order

**2.4.6 Headings and Labels (AA)** — headings and labels describe purpose

**2.4.7 Focus Visible (AA)** — keyboard focus indicator is visible

```css
/* Custom focus indicator — visible and accessible */
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* Never remove focus entirely */
/* BAD: :focus { outline: none; } */
```

**2.4.11 Focus Not Obscured (Minimum) (AA) [NEW in 2.2]** — focused element is not entirely hidden behind sticky headers/footers

**2.4.13 Focus Appearance (AAA) [NEW in 2.2]** — focus indicator is at least 2px perimeter

### 2.5 Input Modalities

**2.5.7 Dragging Movements (AA) [NEW in 2.2]** — provide non-dragging alternative (buttons to reorder)

**2.5.8 Target Size (Minimum) (AA) [NEW in 2.2]** — interactive targets at least 24x24 CSS pixels (44x44 recommended)

---

## Understandable

### 3.1 Readable

**3.1.1 Language of Page (A)**

```html
<html lang="en">
```

**3.1.2 Language of Parts (AA)**

```html
<p>The French word <span lang="fr">bonjour</span> means hello.</p>
```

### 3.2 Predictable

**3.2.1 On Focus (A)** — no context change on focus (no auto-submit, no navigation)

**3.2.2 On Input (A)** — no unexpected context change on input unless user is warned

**3.2.6 Consistent Help (A) [NEW in 2.2]** — if help mechanisms (contact info, chat, FAQ links) appear on multiple pages, they must be in the same relative order

### 3.3 Input Assistance

**3.3.1 Error Identification (A)** — identify and describe errors in text

```html
<label for="email">Email</label>
<input type="email" id="email" aria-describedby="email-error" aria-invalid="true" />
<p id="email-error" role="alert">Please enter a valid email address</p>
```

**3.3.2 Labels or Instructions (A)** — labels for all inputs, instructions for complex formats

**3.3.3 Error Suggestion (AA)** — suggest corrections when known

**3.3.7 Redundant Entry (A) [NEW in 2.2]** — don't ask for same info twice; auto-populate from previous entry

**3.3.8 Accessible Authentication (Minimum) (AA) [NEW in 2.2]** — don't require cognitive function tests (CAPTCHAs) without alternative; support password managers

---

## Robust

### 4.1 Compatible

**4.1.2 Name, Role, Value (A)** — custom components expose name, role, state to AT

```html
<!-- Custom toggle — expose state via ARIA -->
<button role="switch" aria-checked="false" aria-label="Dark mode">
  <span class="toggle-track"><span class="toggle-thumb"></span></span>
</button>
```

**4.1.3 Status Messages (AA)** — status messages announced without focus change

```html
<!-- Search results count announced automatically -->
<div role="status" aria-live="polite">42 results found</div>

<!-- Toast notification -->
<div role="alert">Item saved successfully</div>
```

---

## Quick Testing Protocol

1. **Keyboard-only** — Tab through entire page. Can you reach everything? Is focus order logical? Can you escape modals?
2. **Zoom 200%** — does layout reflow? Any clipping or overlap?
3. **Zoom 400% (320px)** — no horizontal scroll for main content?
4. **Screen reader** — headings navigation (`H` key in NVDA/VO), landmarks, form labels, dynamic updates
5. **Color** — view in grayscale. Can you still use the interface?
6. **axe DevTools** — run automated scan for programmatic issues
7. **Text spacing** — apply WCAG text spacing overrides. Content still readable?
8. **Reduced motion** — enable `prefers-reduced-motion`. Animations respect it?
