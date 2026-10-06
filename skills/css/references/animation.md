# Animation & Motion

## Animation Decision Tree

```
What kind of animation?
├── Simple state transitions (hover, focus, show/hide)
│   └── CSS transitions + @starting-style
├── Scroll-based effects (parallax, reveal, progress)
│   └── CSS scroll-driven animations (animation-timeline), guarded by @supports
│       └── Fallback: IntersectionObserver + CSS class toggle
├── Page/route/state transitions
│   └── View Transitions (same-document; cross-document where supported)
│       └── Fallback: no animation, or a CSS class toggle
├── Programmatic animation, playback control
│   └── Web Animations API (WAAPI)
└── Needs a library? (see "When a library earns its weight")
    └── Timeline orchestration, layout/exit animation, SVG morphing, springs
```

---

## CSS Transitions

The simplest animation primitive. Use for interactive state changes — hover, focus, active, toggled.

```css
.button {
  background: var(--color-primary);
  transition: background 200ms ease, transform 150ms ease;
}

.button:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}
```

### transition-behavior: allow-discrete

By default, `display` and `visibility` are not transitionable. `allow-discrete` enables transitions for these discrete properties — required for animating elements in and out of `display: none`.

```css
.dialog {
  display: none;
  opacity: 0;
  transition: opacity 300ms ease, display 300ms allow-discrete;
}

.dialog[open] {
  display: block;
  opacity: 1;

  @starting-style {
    opacity: 0;   /* without this the entry jumps; only the exit animates */
  }
}
```

Support: see [modern-css.md](modern-css.md#browser-support).

---

## @keyframes

For multi-step animations not triggered by state changes.

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.toast {
  animation: fade-in 300ms ease forwards;
}
```

Key properties:
- `animation-fill-mode: forwards` — retain end-state after animation completes
- `animation-iteration-count: infinite` — loop (use sparingly; respect reduced motion)
- `animation-direction: alternate` — ping-pong loop
- `animation-play-state: paused | running` — controllable via JS

---

## @starting-style (Entry Animations)

Defines the initial style for an element's first rendered frame, enabling entry animations from `display: none` without JavaScript timing hacks.

**Use case:** animating elements appearing in the DOM, dialog/popover open transitions.

```css
/* Fade-in when element first renders or becomes display: block */
.popover {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 250ms ease, transform 250ms ease,
              display 250ms allow-discrete,
              overlay 250ms allow-discrete;

  @starting-style {
    opacity: 0;
    transform: translateY(-8px);
  }
}

/* Exit: set final state when not visible */
.popover:not(:popover-open) {
  opacity: 0;
  transform: translateY(-8px);
}
```

**Top-layer elements** (dialogs, popovers) — also include `overlay` in `transition` so the element leaves the top layer only after the transition completes. `overlay` ships only in Chromium; elsewhere the declaration is ignored and the exit animation may not play, which is still a complete (instant) design.

```css
dialog {
  opacity: 0;
  /* On the base rule, so the transition still applies when [open] is removed */
  transition: opacity 300ms ease, display 300ms allow-discrete,
              overlay 300ms allow-discrete;
}

dialog[open] {
  opacity: 1;

  @starting-style {
    opacity: 0;
  }
}
```

Progressive enhancement by nature — unsupported browsers show elements instantly without animation. Support: [modern-css.md](modern-css.md#browser-support).

---

## Scroll-Driven Animations

Tie animation progress to scroll position using `animation-timeline`. No JavaScript required.

### scroll() — Scroll Progress Timeline

Animates relative to the scroll position of a container (default: nearest scrollable ancestor).

```css
@keyframes progress-bar {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  transform-origin: left;
  animation: progress-bar linear;
  animation-timeline: scroll(root block);
}
```

Parameters: `scroll([scroller] [axis])`
- `scroller`: `root` (document), `nearest` (default), or `self`
- `axis`: `block` (default, vertical), `inline` (horizontal), `x`, `y`

### view() — View Progress Timeline

Animates relative to an element's visibility within its scroll container. Triggers as the element enters and exits the viewport.

```css
@keyframes reveal {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

.section {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 30%;
}
```

`animation-range` controls which part of the view timeline triggers the animation:
- `entry 0% entry 100%` — animate as element enters viewport
- `exit 0% exit 100%` — animate as element leaves viewport
- `contain 0% contain 100%` — animate while fully in viewport

### Named Timelines

Share a timeline across elements using `view-timeline-name` and `scroll-timeline-name`:

```css
.scroll-container {
  scroll-timeline: --my-scroll block;
}

.child-element {
  animation: slide-in linear both;
  animation-timeline: --my-scroll;
}
```

### Feature Detection

Always wrap in `@supports` for progressive enhancement:

```css
@supports (animation-timeline: view()) {
  .section {
    animation: reveal linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 30%;
  }
}
```

Not supported in every stable browser (see [modern-css.md](modern-css.md#browser-support)): keep the `@supports` guard, and make the unanimated state a complete design, not a broken one.

---

## View Transitions

Animate between DOM states or page navigations with a cross-fade by default. This section owns the CSS syntax. The JavaScript API (lifecycle promises, transition types, skipping, framework integration) → `web`.

### Same-Document Transitions

Wrap DOM mutations in `document.startViewTransition()`:

```js
async function navigateTo(newContent) {
  if (!document.startViewTransition) {
    // Fallback for unsupported browsers
    updateDOM(newContent);
    return;
  }

  const transition = document.startViewTransition(() => updateDOM(newContent));
  await transition.finished;
}
```

The default is a cross-fade. Override with CSS pseudo-elements:

```css
/* Target the entire snapshot layer */
::view-transition-old(root) {
  animation: slide-out 300ms ease both;
}
::view-transition-new(root) {
  animation: slide-in 300ms ease both;
}

@keyframes slide-out {
  to { transform: translateX(-100%); }
}
@keyframes slide-in {
  from { transform: translateX(100%); }
}
```

### Named View Transitions

Assign `view-transition-name` to elements that should animate individually (not as part of the page snapshot):

```css
.hero-image {
  view-transition-name: hero;
}

.page-title {
  view-transition-name: page-title;
}
```

Named elements get their own `::view-transition-old(hero)` / `::view-transition-new(hero)` pseudo-elements, enabling FLIP-style transitions between pages.

**Important:** `view-transition-name` must be unique per document. Do not assign the same name to multiple elements.

### Cross-Document Transitions (MPA)

Enable for same-origin multi-page apps by opting in with CSS on both pages:

```css
/* Opt in to cross-document view transitions */
@view-transition {
  navigation: auto;
}
```

No JavaScript needed — the browser handles snapshot capture across navigations automatically.

The opt-in is ignored by browsers without cross-document support, so pages simply navigate without animation. Support: [modern-css.md](modern-css.md#browser-support).

---

## CSS animation-composition

Controls how multiple animations compositing on the same property interact.

```css
.element {
  animation-composition: replace;   /* Default — last animation wins */
  animation-composition: add;       /* Additive — values sum */
  animation-composition: accumulate; /* Cumulative — values merge mathematically */
}
```

**Use case:** layering a hover animation on top of an existing entrance animation without canceling it:

```css
.card {
  animation: enter 400ms ease forwards;
}

.card:hover {
  animation: lift 200ms ease forwards;
  animation-composition: add; /* add translateY(-4px) on top of existing transform */
}
```

Widely supported.

---

## Web Animations API (WAAPI)

Native browser API — no library required. Returns a controllable `Animation` object.

```js
// Basic animation
const animation = element.animate(
  [
    { opacity: 0, transform: 'translateY(20px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  { duration: 300, easing: 'ease', fill: 'forwards' }
);

// Control
animation.pause();
animation.play();
animation.reverse();
animation.cancel();

// Await completion
await animation.finished;
```

### KeyframeEffect (Reusable Animations)

```js
const keyframes = [
  { transform: 'scale(1)', offset: 0 },
  { transform: 'scale(1.1)', offset: 0.5 },
  { transform: 'scale(1)', offset: 1 },
];

const options = { duration: 600, iterations: Infinity };

// Reuse across elements
document.querySelectorAll('.pulse').forEach(el => {
  const effect = new KeyframeEffect(el, keyframes, options);
  new Animation(effect, document.timeline).play();
});
```

### Composable Animations

Multiple animations on the same element compose by default; control compositing with `composite`:

```js
element.animate(
  [{ transform: 'rotate(90deg)' }],
  { duration: 1000, composite: 'add' } // adds to existing transform
);
```

**Strengths:** zero bundle cost, full playback control, awaitable, composable
**Limitations:** no timeline orchestration, no scroll trigger, verbose for complex sequences, no spring physics

**Browser support:** All modern browsers. Widely available.

---

## When a library earns its weight

Prefer CSS transitions, keyframes, view transitions, scroll-driven timelines, and WAAPI. Add an animation library when you need one of:

- **Timeline orchestration** — many animations sequenced, staggered, or scrubbed together
- **Layout and exit animation** — animating elements as they reorder or leave the tree, which CSS cannot do without view transitions
- **SVG morphing or path animation**
- **Spring physics or gesture-driven motion** (drag, swipe, interruptible animation)

Before adopting one, check its current maintenance, license, bundle cost, and framework fit. Whatever the library, handle reduced motion yourself unless its documentation says it does: some libraries honor `prefers-reduced-motion` automatically, others need a `matchMedia` check that skips or shortens animations.

---

## Accessibility: prefers-reduced-motion

**Non-negotiable.** Users enable reduced motion for vestibular disorders, epilepsy, cognitive load, or personal preference. Ignoring this is an accessibility violation.

### Per-Animation Pattern (primary)

Decide per animation: remove large movement (slides, parallax, zoom, autoplay loops) and keep or soften small opacity or color changes, which rarely cause harm. Write the motion inside `no-preference`, or replace it with a gentler alternative:

```css
@keyframes slide-in {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}

.sidebar {
  animation: slide-in 400ms ease;

  @media (prefers-reduced-motion: reduce) {
    animation: fade-in 150ms ease; /* softer alternative */
  }
}
```

### Blunt reset (last resort)

When an existing codebase has too many animations to audit, a global reset is better than nothing, but it also kills harmless feedback and can break code that waits for `transitionend`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### JavaScript Check

For JS-driven animations:

```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  // Run animation
  element.animate([...], { duration: 500 });
} else {
  // Apply final state immediately
  element.style.opacity = '1';
}

// React to changes (user can toggle in OS settings)
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  if (e.matches) cancelAllAnimations();
});
```

---

## Performance Rules

**The compositor mainly handles `transform` and `opacity`.** Most other properties trigger layout or paint — avoid animating those.

| Property | Cost | Alternative |
|----------|------|-------------|
| `transform: translate/scale/rotate` | Compositor (free) | — |
| `opacity` | Compositor (free) | — |
| `width`, `height` | Layout + Paint | `transform: scale()` |
| `top`, `left`, `margin` | Layout + Paint | `transform: translate()` |
| `background-color` | Paint | Use `opacity` or `color-mix()` |
| `box-shadow` | Paint | Pre-render and use `opacity` on pseudo-element |
| `filter` (some) | Paint or Compositor | Depends on GPU/driver |

### will-change

Hints the browser to promote an element to its own compositor layer before animation starts:

```css
/* Apply BEFORE the animation starts (e.g., on parent hover) */
.card:hover .card-image {
  will-change: transform;
}

/* Remove after animation ends — do NOT leave on permanently */
.animating {
  will-change: transform, opacity;
}
```

**Do NOT apply `will-change` globally** or to static elements. Each promoted layer consumes GPU memory. On low-end devices this causes more harm than good.

### Additional Rules

- Keep the number of simultaneously animating elements small and measure on target devices
- Use `contain: layout` on animated containers to limit reflow scope
- Avoid `requestAnimationFrame` loops that read then write layout properties in the same frame (layout thrashing)
- Batch DOM reads before DOM writes
- Use `IntersectionObserver` to pause off-screen animations
- Test on mid-range mobile — animation that runs at 120fps on desktop may drop to 30fps on mobile

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Animating `width`, `height`, `top`, `left` | Triggers layout and paint, causes jank | Use `transform: translate/scale` |
| No `prefers-reduced-motion` handling | Accessibility violation; can cause harm | Handle it per animation (see above) |
| JS animation for CSS-achievable effects | JS animates on main thread; CSS can use GPU compositor | Use CSS transitions/keyframes for simple state changes |
| `will-change` on everything | Wastes GPU memory, can degrade performance | Apply only to elements about to animate, remove after |
| Auto-playing looping animations | Cognitive load, distraction, battery drain | Pause by default; play on user interaction or viewport entry |
| `setTimeout` / `setInterval` for animation | Imprecise timing, misses frame budget | Use `requestAnimationFrame` or CSS |
| Animating too many elements simultaneously | Frame drops, especially on mobile | Virtual windows, stagger, limit concurrent animations |
| `view-transition-name` collision | Two elements with same name breaks the transition | Assign unique names; use JS to set dynamically if needed |
| Library animation without a `prefers-reduced-motion` check | Many libraries do not honor it automatically | Check `matchMedia` and skip or reduce animations |
| Leaving `will-change` on after animation | Permanent GPU layer promotion wastes memory | Remove `will-change` after animation completes |

---

## Sources

- [CSS scroll-driven animations — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
- [View Transitions API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [What's new in view transitions (2025) — Chrome for Developers](https://developer.chrome.com/blog/view-transitions-in-2025)
- [Same-document view transitions — Baseline Newly Available — web.dev](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available)
- [@starting-style — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style)
- [Now in Baseline: animating entry effects — web.dev](https://web.dev/blog/baseline-entry-animations)
- [animation-composition — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-composition)
- [Web Animations API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
