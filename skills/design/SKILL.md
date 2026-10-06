---
name: design
description: "Design or review UX and interaction: user journeys, information architecture, forms, empty/error/loading states, onboarding, dashboards, cognitive load, design-system governance. Not markup or CSS (html, css), not WCAG conformance (accessibility), not touch and platform conventions (mobile)."
user-invocable: true
---

# UX and Interaction Design

Patterns for designing and reviewing user experiences from the code side: journeys, information architecture, cognitive load, states, forms, and governance, not pixel decisions. Numbers below are starting points to test with real users, not laws.

## Scope and boundaries

**Covers:** user journeys and flow reviews, information architecture (navigation, categorization, findability), cognitive load, forms and onboarding, empty/error/loading states, dashboard and data-display UX, design-system governance.

**Does not cover:**
- Markup and layout implementation: `html`, `css`
- Design token implementation (CSS custom properties, token pipelines): `css`, `frontend`; this skill owns only governance
- Conformance, ARIA, keyboard behavior: `accessibility`
- Touch gestures and platform conventions: `mobile`
- Framework and build tooling: `frontend`, `react`, `vue`
- Content structure for search: `seo`
- Relationship and flow diagrams as code: `diagrams`; interactive chart pages: `playground`
- Visual identity and branding

## Decision tree: IA shape

```
How many distinct destinations or tasks does the user space hold?
├─ Few (a handful to a few dozen) → flat IA; one level of navigation, search if findability suffers
└─ Many → hierarchical IA with clear primary categories; group so that each level is scannable
   (novices need fewer top-level choices; expert tools may carry density if grouping, search,
   and a command palette keep items findable)

Do roles see different tasks (finance, ops, admin)?
├─ Yes → role-scoped navigation (hide what the user cannot do, or explain why it is unavailable)
└─ No → one navigation for everyone

Is the task sequenced?
├─ Yes → linear flow with visible progress and a way back
└─ No → hub or dashboard; the user picks the entry point
```

Validate the structure with card sorting or tree testing when the audience is unfamiliar; early IA changes are expensive to make after shipping.

## Core patterns

### Cognitive load

- One primary action per screen; a second competing action is secondary.
- Do not make users hold state in their heads: breadcrumbs, inline summaries, persistent filters.
- Defer decisions with sensible defaults; let users customize later.
- Limit simultaneous choices for novices (group, collapse, or progressively disclose); dense expert dashboards are acceptable when grouped and searchable. Hick's law (more options, slower choice) is a reason to structure choices, not a numeric cap.

### States

Design the four core states for every data-driven view, not only the happy path:

| State | What the user needs |
|-------|---------------------|
| Empty | Why it is empty and one next action |
| Loading | A sign that work is happening; progress when it runs long |
| Error | What went wrong in plain language and one next action |
| Ideal | Full data, everything works |

Real products also have partial, stale, and forbidden states. Full state table, timing thresholds, and empty-state and error anatomy: [design-patterns.md](references/design-patterns.md). Missing empty and error states are the most common UX debt.

### Progressive disclosure

Show the common case by default and reveal advanced options on demand: forms, settings, command help, API surface.

### Dashboards

- Place the most important signal where reading starts.
- Give every number a comparison (a baseline, prior period, or target); a bare number is noise.
- Keep the first view to the few metrics that drive decisions; push the rest behind drill-down.
- Let clicking a number open the underlying data.
- Choose the chart by the question: comparison across categories (bars), change over time (lines), part of a whole (a few segments at most, otherwise bars), relationship between measures (scatter), exact values (a table). Do not rely on color alone to separate series.

### Forms

- A single column usually reads and completes faster than multi-column for linear forms; related short fields (city and postcode) can share a row.
- Labels above inputs hold up on narrow screens. Validate on blur or submit rather than every keystroke; state the problem and the fix.
- Mark the less common of required or optional, not both. Accessible labels, errors, and autocomplete behavior: `accessibility` and `html`.

## Design-system governance

1. **Tokens**: color, type, space, radius, shadow, as machine-readable values with a single source of truth.
2. **Components**: named, versioned, documented. Only elements with repeated use and stable semantics become system components.
3. **Patterns**: composed flows (onboarding, search-filter-list, confirm-destructive-action) kept as recipes, not code.

Contribution flow: propose, accept as experimental, promote to stable after repeated real use. Say clearly that experimental parts are unsupported.

## Context Adaptation

- **Architect (shaping the product):** IA and flows are architecture; changing them after shipping is costly.
- **Implementer (building a screen):** use the design system's components; if one is missing, raise it rather than fork.
- **Reviewer (auditing UX):** score against journeys, not single screens; a polished screen inside a broken flow is still broken.
- **Designer:** compose with `accessibility`, `html`, and `css` for implementation-ready output.

## Anti-Patterns

- **Dashboard theater**: many charts, no decisions driven.
- **Option overload**: a checkbox for every possible choice instead of sensible defaults.
- **Progressive confusion**: wizards where the user cannot tell the current step or what remains.
- **Design-system fork**: a team ships its own Button next to the system's.
- **Clean-data-only design**: layouts that break with long names, empty values, or thousands of rows.
- **Orphan patterns**: a pattern used once, baked into code, never named.

## Related Knowledge

- `accessibility`: conformance baseline for any UX
- `html`, `css`: markup and layout implementation
- `frontend`: component patterns and tooling
- `mobile`: touch gestures and platform conventions
- `i18n`: translation and RTL affect every screen

## References

- [design-patterns.md](references/design-patterns.md): interaction patterns, journey mapping, states, empty-state and error design, feedback and timing
