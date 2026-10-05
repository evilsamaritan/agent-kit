# Game Loop and Time

How a frame is structured, how simulated time advances independently of the display, and how to keep the work inside a frame budget.

## Contents

- [Frame anatomy](#frame-anatomy)
- [Fixed step with interpolation](#fixed-step-with-interpolation)
- [Choosing a tick rate](#choosing-a-tick-rate)
- [Input timing](#input-timing)
- [Variable and semi-fixed steps](#variable-and-semi-fixed-steps)
- [Pause, slow motion, hitstop, fast-forward](#pause-slow-motion-hitstop-fast-forward)
- [Multi-rate updates and time slicing](#multi-rate-updates-and-time-slicing)
- [Timers inside the simulation](#timers-inside-the-simulation)
- [Frame budget and pacing](#frame-budget-and-pacing)
- [Background, visibility, and suspend](#background-visibility-and-suspend)

---

## Frame anatomy

One display frame, in order:

1. **Pump platform events** — window, input devices, network receive queue, file and asset completions.
2. **Collect input** — convert device events and held state into intents stamped with the tick they apply to.
3. **Step the simulation** — zero, one, or several fixed ticks, depending on accumulated time.
4. **Presentation** — consume simulation events, advance tweens and particles on the real clock, project state with the interpolation factor.
5. **UI** — HUD and menus read views and queue intents for the next tick.
6. **Render submission** — the renderer reconciles nodes and issues draw calls.
7. **Present** — swap or wait for vsync; this is where frame pacing is decided.

Engines run the same phases under their own names; [engines.md](engines.md) maps them.

## Fixed step with interpolation

```ts
interface MonotonicClock { seconds(): number }

class FixedStepLoop {
  timeScale = 1                  // 0 pauses the simulation, 0.25 is slow motion
  #accumulator = 0
  #last: number

  constructor(
    private sim: Simulation,
    private presentation: Presentation,
    private renderer: Renderer,
    private input: IntentQueue,
    private clock: MonotonicClock,
    private step = 1 / 60,
    private maxStepsPerFrame = 5,
  ) { this.#last = clock.seconds() }

  frame() {
    const now = this.clock.seconds()
    const real = Math.min(now - this.#last, this.step * this.maxStepsPerFrame)
    this.#last = now
    this.#accumulator += real * this.timeScale

    let steps = 0
    while (this.#accumulator >= this.step && steps < this.maxStepsPerFrame) {
      const events = this.sim.step(this.input.takeForTick(this.sim.tick))
      this.presentation.onEvents(this.sim.tick, events)
      this.#accumulator -= this.step
      steps++
    }
    if (steps === this.maxStepsPerFrame) this.#accumulator = Math.min(this.#accumulator, this.step)

    const alpha = this.#accumulator / this.step
    this.presentation.update(real)                  // real time: menus animate while paused
    this.renderer.apply(this.presentation.project(this.sim.previous(), this.sim.current(), alpha))
  }
}
```

Design points:

- **Clamp and cap.** A debugger pause, a hitch, or a returning background tab produces a huge delta. Clamping real time and capping steps per frame keeps one slow frame from scheduling more simulation work than the next frame can afford (the spiral of death). Dropping the backlog is correct for single-player; networked clients resynchronize instead (see [netcode.md](netcode.md)).
- **Monotonic clock.** Measure frames with a monotonic clock, never wall time, which jumps with system clock changes.
- **Interpolation buffers.** Keep the previous and current values only for fields that render continuously (position, rotation, scale). A full deep copy per tick is rarely needed.
- **Teleports.** Mark discontinuous moves (respawn, portal) so presentation snaps instead of sliding across the map.
- **Angles.** Interpolate rotations along the shortest arc; quaternions with normalized lerp or slerp in 3D.
- **Spawns and despawns.** An entity present only in the current state renders at its current value; a removed entity may keep a presentation-only ghost for its death animation.
- **Event timing.** Events from a tick play when the display reaches that tick. With interpolation the display lags the newest tick by up to one step; queue one-shot effects by tick if that offset is visible (rhythm, fighting games).

**Interpolation vs extrapolation.** Interpolation shows a state that has already happened: correct, smooth, up to one step late. Extrapolation predicts from velocity: no added latency, but overshoots on sudden turns and collisions. Prefer interpolation; extrapolate only remote entities in networked games when data is late, and only briefly.

## Choosing a tick rate

| Game | Typical tick | Why |
|---|---|---|
| Turn-based, puzzle, card | none | the model advances per command |
| Strategy, simulation, casual action | 20–30 Hz | many entities, rules tolerate coarse time; presentation interpolates |
| Most action games | 60 Hz | responsive input, stable physics for common speeds |
| Fighting, rhythm, precision platformers, fast physics | 60–120+ Hz | frame-exact inputs, small steps for fast or stiff bodies |

- Tie the tick rate to rules, not to the display. A 144 Hz monitor with a 60 Hz simulation needs interpolation; without it, motion judders.
- Fast projectiles and stiff springs need smaller steps, physics substeps, or continuous collision detection; raising the global tick rate is the expensive option.
- Simulation cost times tick rate must fit the budget at the worst-case entity count, not the average.
- In networked games the simulation tick, snapshot send rate, and client input rate are separate numbers ([netcode.md](netcode.md)).

## Input timing

- **Events and held state are different.** Queue press and release events in order; sample held axes and buttons once per frame. Both become intents for a specific tick.
- **No lost or doubled presses.** When a high-refresh frame runs zero ticks, queued presses wait for the next tick. When a frame runs several ticks, the first tick consumes the press; later ticks see only held state.
- **Windows in ticks.** Jump buffering, coyote time, combo windows, and parry windows are tick counts: `jumpBufferedUntil = tick + 6`. Millisecond windows make outcomes depend on frame rate.
- **World data, not screen data.** The UI resolves screen positions through the renderer's picking and sends world coordinates or entity ids. Screen coordinates never enter the simulation.
- **Latency chain.** Device → OS → poll → tick → render → display. Sample input as late as possible before stepping, avoid deep render queues in latency-sensitive games, and measure end-to-end latency with a high-speed camera or the platform's latency tools when it matters.
- **Rebinding.** Map devices to actions in the input layer; the simulation sees actions (`Jump`), never keys.

## Variable and semi-fixed steps

Variable delta is acceptable when no outcome depends on it: cosmetic motion, UI animation, camera smoothing. When variable delta drives gameplay anyway (small single-player prototypes), write frame-rate-independent forms:

| Frame-dependent | Frame-independent |
|---|---|
| `velocity *= 0.98` per frame | `velocity *= Math.exp(-damping * dt)` |
| `x += speed` per frame | `x += speed * dt` |
| `timer -= 1` per frame | `timer -= dt` |
| explicit Euler with large `dt` | semi-implicit Euler (update velocity, then position) with clamped `dt` |

Even frame-independent formulas give different collision results at different deltas. **Semi-fixed** stepping (variable frames split into substeps no larger than a maximum) is a middle ground for single-player games without replays; it is not deterministic.

## Pause, slow motion, hitstop, fast-forward

- **Pause** — stop feeding time to the accumulator. Presentation and UI keep running on the real clock so menus animate.
- **Slow motion** — scale the real time fed to the accumulator. The step size never changes, so physics stays stable and replays (recorded per tick) stay valid.
- **Hitstop** — if it changes gameplay timing (attack windows freeze too), the simulation owns it as a freeze counter in ticks; if it is purely visual, presentation holds the pose while the simulation continues.
- **Per-entity time scale** (bullet time for enemies only) — a simulation concept: each entity accumulates fractional ticks and acts when it crosses a whole tick. Keep it in integer or fixed-point math if determinism matters.
- **Fast-forward** — run several ticks per frame within budget, or run headless ticks with rendering skipped.

## Multi-rate updates and time slicing

- Run expensive systems at lower rates: AI decisions at 10 Hz, pathfinding requests amortized, physics every tick.
- Stagger by entity: `if ((tick + entityId) % 6 === 0) think(entity)` spreads load and stays deterministic.
- Budget simulation slices in **work units** (nodes expanded, entities processed), not milliseconds. A pathfinder that runs "until 2 ms elapsed" produces machine-dependent outcomes. Millisecond budgets are fine for loading, streaming, and presentation.
- Long jobs that cannot fit in a tick run as resumable tasks whose state is part of the simulation (and of saves), or on worker threads whose results enter the simulation at a defined tick.

## Timers inside the simulation

- Store deadlines as ticks: `readyAtTick`, `expiresAtTick`. Convert design-time seconds once when loading data: `Math.round(seconds / STEP)`.
- Schedule future simulation events in a priority queue keyed by tick, then by insertion sequence, so equal-tick events run in a stable order.
- Step scripted sequences (cutscene logic, scripted encounters) per tick. Save only at points where no script is mid-flight, or make script state serializable.
- Engine timers, platform timeouts, and animation-finished callbacks never decide rules. An animation may tell presentation it ended; the simulation already knows when the action resolves.

## Frame budget and pacing

| Target refresh | Frame time |
|---|---|
| 30 Hz | 33.3 ms |
| 60 Hz | 16.7 ms |
| 90 Hz (common VR minimum) | 11.1 ms |
| 120 Hz | 8.3 ms |
| 144 Hz | 6.9 ms |

- Write a per-phase budget and instrument each phase with named markers so a profiler shows which phase overran.
- Reserve headroom (15–25 percent) for GC, OS work, driver stalls, and content spikes.
- Pacing beats peak rate: steady 30 feels better than 45 to 60 with stutter. On a fixed-refresh display, a frame that misses vsync shows the previous image twice — a visible hitch even when the average is fine.
- In garbage-collected runtimes, track allocation rate per frame. Pool spawned objects, reuse scratch vectors and arrays, rebuild HUD strings only when values change, and avoid closures in per-entity loops.
- Move long work off the frame: decode assets and compute paths on workers or threads; the main thread only commits results.
- Benchmark with a scripted worst-case scene on the weakest target device and report p95, p99, and the worst frames. Profiling method → `performance`.

## Background, visibility, and suspend

- **Browser tabs** — animation frames stop or throttle when a tab is hidden, and timers are throttled. On return the delta is huge: the clamp handles it. Pause single-player games on `visibilitychange`; networked clients request a fresh snapshot instead of simulating the gap.
- **Mobile** — backgrounding may be followed by process death without another callback. Save on the background event, release audio focus, and pause the simulation.
- **Consoles** — suspend and resume can drop network sessions and change the signed-in user; revalidate both on resume and follow platform certification rules for save timing.
- **Desktop** — minimized windows may keep running; throttle rendering when not visible to save power, but keep networked simulation ticking.
- **Debuggers** — breakpoints look like multi-second frames; the clamp keeps a debugging session from fast-forwarding the game.
