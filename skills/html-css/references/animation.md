# Animation & Motion

## Animation Decision Tree

```
What kind of animation?
├── Simple state transitions (hover, focus, show/hide)
│   └── CSS transitions + @starting-style
├── Scroll-based effects (parallax, reveal, progress)
│   └── CSS scroll-driven animations (animation-timeline)
│       └── Fallback: IntersectionObserver + CSS class toggle
├── Page/route transitions
│   └── View Transitions API
│       └── Fallback: CSS class toggle or Motion layout animations
├── Complex sequences, timeline-based
│   ├── Declarative (React/Vue/framework) → Motion
│   └── Imperative, cross-framework → GSAP
├── SVG morphing, path animation
│   └── GSAP (MorphSVG) or anime.js
├── Gesture-based (drag, swipe, pinch)
│   └── Motion (gesture support built-in)
└── Simple programmatic animation (no library)
    └── Web Animations API (WAAPI)
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
}
```

**Browser support:** Baseline 2024 (Chrome 117+, Firefox 129+, Safari 17.4+). ~88% global support as of 2025.

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

**Top-layer elements** (dialogs, popovers) — also include `overlay` in `transition` to ensure the element exits the top layer only after the transition completes.

```css
dialog[open] {
  opacity: 1;
  transition: opacity 300ms ease, display 300ms allow-discrete,
              overlay 300ms allow-discrete;

  @starting-style {
    opacity: 0;
  }
}
```

**Browser support:** Baseline 2024 (Chrome 117+, Firefox 129+, Safari 17.4+). ~88% global support as of 2025. Progressive enhancement by nature — unsupported browsers show elements instantly without animation.

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

**Browser support (2025-2026):**
- Chrome 115+, Edge 115+ — full support
- Firefox 110+ (partial, improving)
- Safari 18+ — added support
- Use `@supports` guard for production; ~80% global support

---

## View Transitions API

Animate between DOM states or page navigations with a cross-fade by default.

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

Enable for multi-page apps by opting in via meta or CSS:

```css
/* Opt in to cross-document view transitions */
@view-transition {
  navigation: auto;
}
```

No JavaScript needed — the browser handles snapshot capture across navigations automatically.

**Browser support (2025):**
- Same-document: Baseline Newly Available (October 2025). Chrome 111+, Edge 111+, Firefox 133+, Safari 18+. Safe to use with fallback.
- Cross-document: Chrome 126+, Edge 126+, Safari 18.2+. Firefox not yet supported. Use `@supports` guard.

```css
/* Progressive enhancement for cross-doc */
@supports (view-transition-name: none) {
  @view-transition {
    navigation: auto;
  }
}
```

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

**Browser support:** Baseline 2023. All major browsers. Safe to use.

---

## Motion (formerly Framer Motion)

**Version:** 12.x (latest as of 2026)
**Import:** `motion/react` (React), `motion/vue` (Vue), `motion` (vanilla JS)

Motion's hybrid engine runs animations using the Web Animations API and ScrollTimeline natively at 120fps, falling back to JavaScript for spring physics, interruptible keyframes, and gesture tracking.

### Core Usage (React)

```jsx
import { motion, AnimatePresence } from 'motion/react';

// Basic animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
/>

// Exit animation
<AnimatePresence>
  {isVisible && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>

// Gesture animations
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  drag="x"
  dragConstraints={{ left: -100, right: 100 }}
/>
```

### Layout Animations

Automatically animate layout changes using FLIP under the hood:

```jsx
<motion.div layout />

// Shared layout between routes/components
<motion.img layoutId="hero-image" src={src} />
```

### Scroll Animations

```jsx
import { useScroll, useTransform, motion } from 'motion/react';

function ParallaxSection() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-50%']);

  return <motion.div style={{ y }} />;
}
```

### Reduced Motion

Motion respects `prefers-reduced-motion` automatically. Override with `useReducedMotion()`:

```jsx
import { useReducedMotion } from 'motion/react';

function Component() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      animate={{ opacity: 1, x: shouldReduceMotion ? 0 : 100 }}
    />
  );
}
```

**Strengths:** declarative API, layout animations, exit animations, gesture support, spring physics by default
**Limitations:** React/Vue only (no Svelte/Angular first-party), bundle cost (~30-50kb)

---

## GSAP

**License change (2024-2025):** The entire GSAP ecosystem is now free — including previously paid plugins (ScrollTrigger, ScrollSmoother, Flip, MorphSVG, DrawSVG, SplitText). The standard "no charge" license applies to all products. Commercial use is permitted.

### Core API

```js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Tween
gsap.to('.box', { x: 200, duration: 1, ease: 'power2.out' });

// Timeline
const tl = gsap.timeline();
tl.from('.title', { opacity: 0, y: 30 })
  .from('.subtitle', { opacity: 0, y: 20 }, '-=0.2')
  .from('.cta', { opacity: 0, scale: 0.9 }, '-=0.1');
```

### ScrollTrigger

```js
gsap.to('.panel', {
  xPercent: -100 * (panels.length - 1),
  ease: 'none',
  scrollTrigger: {
    trigger: '.panels-container',
    pin: true,
    scrub: 1,
    snap: 1 / (panels.length - 1),
    end: () => '+=' + document.querySelector('.panels-container').offsetWidth,
  },
});
```

**Key ScrollTrigger options:**
- `pin: true` — pin element in place while scrolling
- `scrub: 1` — link animation to scroll position (number = smoothing lag in seconds)
- `snap` — snap to animation waypoints
- `markers: true` — debug mode (remove before production)

### Text Animation with SplitText

```js
import { SplitText } from 'gsap/SplitText';
gsap.registerPlugin(SplitText);

const split = new SplitText('.headline', { type: 'words,chars' });
gsap.from(split.chars, {
  opacity: 0,
  y: 40,
  stagger: 0.02,
  ease: 'back.out',
});
```

**Strengths:** powerful timeline control, ScrollTrigger, SVG morphing, text animation, works with any framework or vanilla JS
**Limitations:** larger bundle than Motion or anime.js, requires plugin registration

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

## anime.js

**Version:** 4.x (released April 2025, latest 4.3.x as of late 2025)
**Size:** ~17kb (modular — import only what you need)
**License:** MIT

v4 is a full rewrite: modular API, native TypeScript, WAAPI integration, scroll-linked animations, draggables, additive animations.

```js
import { animate, stagger } from 'animejs';

// Basic animation
animate('.box', {
  x: 200,
  opacity: [0, 1],
  duration: 600,
  ease: 'outExpo',
});

// Stagger
animate('.item', {
  translateY: [-20, 0],
  opacity: [0, 1],
  delay: stagger(80),
});

// Timeline
import { createTimeline } from 'animejs';

const tl = createTimeline();
tl.add('.title', { opacity: [0, 1], y: [20, 0] })
  .add('.subtitle', { opacity: [0, 1] }, 200);
```

### SVG Path Animation

```js
import { animate, createMotionPath } from 'animejs';

animate('.dot', {
  ...createMotionPath('#path'),
  duration: 2000,
  ease: 'linear',
  loop: true,
});
```

**Strengths:** lightweight, MIT license, SVG morphing, stagger effects, TypeScript-native in v4, scroll-linked animations
**Limitations:** smaller ecosystem than GSAP, fewer built-in physics options than Motion

---

## Accessibility: prefers-reduced-motion

**Non-negotiable.** Users enable reduced motion for vestibular disorders, epilepsy, cognitive load, or personal preference. Ignoring this is an accessibility violation.

### CSS Global Reset

Apply as a baseline reset:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Per-Animation Pattern (Preferred)

Rather than killing all motion, replace with a subtle or instant alternative:

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

### Motion Library Handling

- **Motion:** respects `prefers-reduced-motion` automatically; use `useReducedMotion()` hook for fine control
- **GSAP:** does NOT handle this automatically — check manually or use `gsap.globalTimeline.pause()`
- **anime.js:** does NOT handle this automatically — check via `matchMedia` and conditionally skip

---

## Performance Rules

**The GPU compositor handles only `transform` and `opacity`.** Everything else triggers layout or paint — avoid animating these properties.

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

- Limit simultaneous animations to under ~100 DOM elements
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
| No `prefers-reduced-motion` check | Accessibility violation; can cause harm | Add `@media (prefers-reduced-motion: reduce)` reset |
| JS animation for CSS-achievable effects | JS animates on main thread; CSS can use GPU compositor | Use CSS transitions/keyframes for simple state changes |
| `will-change` on everything | Wastes GPU memory, can degrade performance | Apply only to elements about to animate, remove after |
| Auto-playing looping animations | Cognitive load, distraction, battery drain | Pause by default; play on user interaction or viewport entry |
| `setTimeout` / `setInterval` for animation | Imprecise timing, misses frame budget | Use `requestAnimationFrame` or CSS |
| Animating too many elements simultaneously | Frame drops, especially on mobile | Virtual windows, stagger, limit concurrent animations |
| `view-transition-name` collision | Two elements with same name breaks the transition | Assign unique names; use JS to set dynamically if needed |
| GSAP without `prefers-reduced-motion` check | GSAP does not auto-respect this | Check `matchMedia` and skip or reduce animations |
| Leaving `will-change` on after animation | Permanent GPU layer promotion wastes memory | Remove `will-change` after animation completes |

---

## Quick Reference: Library Comparison

| | Motion | GSAP | anime.js v4 | WAAPI |
|--|--------|------|-------------|-------|
| **Bundle** | ~30-50kb | ~60kb+ | ~17kb | 0kb |
| **License** | MIT | Free (no-charge) | MIT | — |
| **Framework** | React, Vue, JS | Any | Any | Any |
| **Spring physics** | Yes (default) | No (easing only) | Yes (v4) | No |
| **Timeline** | Yes | Yes (powerful) | Yes | No |
| **Scroll trigger** | Yes (scroll hooks) | Yes (plugin) | Yes (v4) | No |
| **Layout animations** | Yes (FLIP) | Yes (Flip plugin) | No | No |
| **Exit animations** | Yes (AnimatePresence) | No | No | No |
| **SVG morphing** | No | Yes (MorphSVG) | Yes | No |
| **Reduced motion** | Auto | Manual | Manual | Manual |
| **TypeScript** | Yes | Yes | Yes (native v4) | Yes (native) |

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
- [Motion documentation](https://motion.dev/docs)
- [GSAP pricing (now free)](https://gsap.com/pricing/)
- [anime.js v4 — What's new](https://github.com/juliangarnier/anime/wiki/What's-new-in-Anime.js-V4)
