# Template: Configurator or Simulation

Use when the reader learns by changing parameters and watching the effect: a rate limiter under load, cache hit ratios against key distributions, a layout tuned by spacing values, a game loop at different tick rates.

## Composition

Start from `assets/visualization-page.html`.

```text
header: what is simulated and what is simplified · theme control
controls: grouped by concern; presets first; advanced options collapsed
live view: the visual that changes, plus key readouts with units
explanation: one short paragraph per notable regime ("above 80% load, queueing dominates")
export: copyable configuration or summary of non-default choices
```

On wide screens controls sit beside the view; on narrow screens above it, with the view kept on screen while adjusting.

## State

One state object with frozen defaults; every control writes to it and every view renders from it (interactive-html, "State for tools"). A seed makes stochastic runs reproducible. Reset restores defaults; presets set several values coherently.

## Interaction

- Immediate re-render on input; heavy computation is throttled, not deferred to an Apply button.
- Play, pause, step, and speed for time-based simulations; reduced motion starts paused.
- Readouts show units and stay readable at every width.

## Honesty

State the model's assumptions next to the view. Compare against a known case (a closed-form result or documented benchmark) when one exists; label the simulation qualitative otherwise.

## Pitfalls

- Every parameter exposed at once.
- A chart that rescales its axis silently between runs.
- A simulation whose numbers look precise but come from an unexplained formula.
