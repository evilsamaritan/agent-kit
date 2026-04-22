---
name: design
description: Design UX and interaction patterns — user journeys, information architecture, cognitive load, design system governance, dashboard and data UX, onboarding flows. Use when designing or reviewing user flows, auditing IA, improving onboarding, governing a design system, or evaluating dashboards. Do NOT use for HTML/CSS implementation (use html/css), accessibility compliance (use accessibility), or frontend tooling (use frontend).
allowed-tools: Read, Glob, Grep
user-invocable: true
---

# UX & Interaction Design

Patterns for designing and reviewing user experiences from the code side. Focus on journeys, information architecture, cognitive load, and governance — not pixel decisions.

## Scope and boundaries

**This skill covers:**
- User journey mapping and flow reviews
- Information architecture (IA) — navigation, categorization, findability
- Cognitive load — how much the UI asks the user to hold in their head
- Dashboards and data visualization UX
- Forms and onboarding flows
- Design system governance — tokens, components, patterns, contribution flow
- Interaction patterns (disclosure, progressive enhancement, error states, empty states, loading states)

**This skill does not cover:**
- HTML semantics, CSS layout → `html/css`
- WCAG / ARIA / keyboard nav → `accessibility`
- Frontend framework / build tooling → `frontend`, `react`, `vue`
- SEO / content structure → `seo`
- Visual design / branding (out of scope for this skill set)

## Decision tree — IA shape

```
Is the user space bounded (< 50 distinct tasks)?
├─ yes → flat IA: single-level nav; lean on search if needed
└─ no → hierarchical IA with clear primary categories (max 7 items at each level)

Are tasks role-based (finance vs ops vs admin see different views)?
├─ yes → role-scoped nav (hide what the user can't do)
└─ no → single nav for everyone

Are tasks sequenced (wizard-like)?
├─ yes → linear flow with clear progress
└─ no → dashboard / hub, let user choose entry point
```

## Core patterns

### Cognitive load

Every screen has a budget. Rules of thumb:

- **One primary action per screen** — if there are two, one of them is secondary.
- **Max 7 ± 2 items at one level** (nav, grid of cards, filter list). Beyond that, group or collapse.
- **Don't ask the user to hold state in their head.** Breadcrumbs, inline summaries, persistent filters.
- **Defer decisions.** Settings → default to sensible, let users customize later.

### Empty / error / loading states

Every interactive view has four states. Design all four, don't only design "happy path":

| state | what the user needs |
|-------|---------------------|
| Empty | why it's empty + one next action to fix it |
| Loading | that something is happening + ETA if > 1s |
| Error | what went wrong (in plain language) + one next action |
| Filled | the actual content |

Missing empty and error states is the #1 UX debt.

### Progressive disclosure

Show the simple case by default, reveal advanced options only on demand. Applies to forms, settings, CLI help, API surface.

### Dashboard UX

- **Top-left = most important.** Reading starts there.
- **Every number has a comparison.** "42 errors" is noise; "42 errors (↑ 3× vs last week)" is signal.
- **Max 5 metrics above the fold.** More = dashboard becomes a dashboard of dashboards.
- **Clicking a number opens the underlying data.** Drill-down is non-optional.

### Form design

- **One column.** Two-column forms are slower even when they look compact.
- **Labels above inputs.** Side labels collapse on mobile and cost reading time.
- **Inline validation** on blur, not on each keystroke. Show error + fix, not just error.
- **Optional vs required** — mark only one of the two (whichever is less common in the form).

## Design system governance

Three axes of maturity:

1. **Tokens** — color, type, space, radius, shadow. Machine-readable (JSON / CSS custom properties). Single source of truth.
2. **Components** — named, versioned, documented. Not every UI element is a system component — only those with repeated use and stable semantics.
3. **Patterns** — composed flows (onboarding wizard, search-filter-list, confirm-destructive-action). Live as recipes, not as code.

**Contribution flow:** propose → accept as experimental → promote to stable after ≥ 3 use cases. Anything in "experimental" is not supported by docs — set expectations.

## Context adaptation

**As architect (shaping the product):** IA and flows are architecture. Early IA decisions cost 10× to change after shipping.

**As implementer (building a screen):** respect the design system — don't reinvent components. If the component doesn't exist, raise it, don't fork.

**As reviewer (auditing UX):** score against journeys, not screens. A beautiful screen inside a broken flow is still broken.

**As designer (the profession agent):** this is your home skill. Compose with `accessibility` and `html/css` for implementation-ready output.

## Anti-patterns

- **Dashboard theater** — lots of pretty charts, no decisions driven.
- **Feature toggle in UI** — checkboxes for every possible option instead of sensible defaults.
- **Progressive confusion** — multi-step wizards where the user can't tell which step they're on or what's left.
- **Design-system fork** — team ships their own "Button" alongside the system one; two drift immediately.
- **Testing only on clean data** — designs that look great on demo data and break on real data.
- **Orphan patterns** — a pattern used once, baked into code, never named. Two years later, nobody knows which instance is canonical.

## Related Knowledge

- `accessibility` — WCAG, ARIA, keyboard — non-negotiable baseline for any UX
- `html/css` — markup and layout implementation
- `frontend` — component patterns and build tooling
- `i18n` — translation and RTL affect every screen
- `seo` — content structure for search discoverability

## References

- [design-patterns.md](references/design-patterns.md) — interaction patterns and tradeoffs
