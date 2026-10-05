---
name: gamedev
description: "Design or review game code. Use for game loop, frame budget, gameplay code, simulation, ECS, scenes, assets, save games, replays, multiplayer netcode in Unity/Godot/Unreal/three.js/Phaser games. Do NOT use for network transport (realtime) or profiling method (performance)."
---

# Game Development

A game is a simulation that a renderer draws. The engine, language, or platform does not move the rules: TypeScript drawing to a browser canvas is still gameplay code when it decides who takes damage. This skill applies the ownership and extension analysis of `architecture` to games and adds what is specific to them: time, frames, scenes, assets, saves, determinism, and netcode.

**Rules:**

1. The simulation owns rules and state. Presentation projects state to visual parameters. The renderer draws them. Input and UI send intents; the simulation decides consequences.
2. Step the simulation at a fixed rate from an accumulator and interpolate rendering whenever motion, physics, networking, or replays affect outcomes.
3. Give every invariant one write path. Read APIs return snapshots or read-only views, never internal mutable references.
4. Prepare a new scene off to the side, commit it in one short step, and keep the previous scene when preparation fails. Reset loading flags in `finally`.
5. After every `await`, check that the owning session or scene is still alive before any effect.
6. Save the model, not render state — versioned, migrated, and written atomically.
7. Keep wall-clock reads and unseeded randomness out of the simulation.
8. Test the simulation headless, presentation as a pure mapping, and the renderer separately.

## Scope and boundaries

**Covers:** game loop and timing, layering of gameplay code, state ownership in a running game, entity models and variation, scene and asset lifecycle, async work across scene and session lifetimes, saves, determinism, netcode, gameplay testing, and how these patterns map onto engines.

**Does not cover:** rendering techniques (shaders, lighting, post-processing), game design (balance, level design, economy tuning), and art or audio production beyond loading and budgets.

| Need | Route |
|---|---|
| General boundaries, ownership, extension analysis, refactor proportion | `architecture` — this skill applies it, does not restate it |
| Profiling method, flame graphs, memory leak hunting | `performance` |
| WebSocket, WebTransport, or WebRTC connections, reconnection, relay scaling | `realtime` |
| TypeScript types, modules, workers, event loop | `javascript` |
| Test strategy, property-testing tools, flaky tests | `testing` |
| Menus and HUD built with a web UI framework | `frontend` plus its framework skill — they still send intents |
| Accounts, matchmaking, leaderboards, store backends | `backend`, `database`, `auth`, `payments` |

## Decision tree

### Where does this code belong?

```text
What does the code decide or produce?
├── Whether an action is allowed, what it costs, what it causes (damage, spawn, score, win, cooldown, AI choice)
│   → simulation. Plain data and functions; no engine node, GPU, DOM, audio, or clock types.
├── How current state looks or sounds (animation state, tint, scale, label text, camera target, sound cue)
│   → presentation. Reads snapshots and events; outputs neutral visual parameters.
├── Meshes, sprites, materials, scene-graph nodes, camera projection, picking, audio playback
│   → renderer / engine adapter. Applies visual parameters by entity id; knows no game kinds or stages.
├── A key press, click, tap, or menu choice
│   → input / UI. Translates it to an intent and submits it: { type: "Attack", unit: 7, target: 12 }.
└── Files, network, platform services, real time
    → platform adapters owned by the session; results enter the simulation as inputs at a tick.
```

### Fixed or variable timestep?

```text
Does continuous motion affect rules (physics, collisions, projectiles), or are there networking, replays, or deterministic tests?
├── Yes → fixed simulation step + accumulator + render interpolation.
├── No — turn-based or event-driven (cards, puzzles, tactics)
│   → no continuous step. The model resolves each command at once; presentation plays the resulting
│     events in order, and the UI accepts the next intent when playback ends.
└── No — motion is cosmetic only (idle bobbing, parallax, UI tweens)
    → variable delta, clamped to a maximum, is acceptable.
```

### Which entity model?

```text
What do the requirements say?
├── The engine already imposes a model (scene nodes, components, actors)
│   → use it for presentation and adapters; keep rules in plain modules it calls.
│     Add data-oriented storage only for a measured hot subset.
├── Thousands of similar entities; systems query "every entity with X and Y"; hot loops are memory-bound
│   → ECS or data-oriented arrays.
├── Tens to hundreds of entities mixing capabilities (damageable, burnable, carryable)
│   → composition: entity id + attached capabilities, behavior registered per kind.
├── A small family whose members honor one contract and never mix capabilities
│   → shallow inheritance or a closed union.
└── The team knows one model well and nothing above forces another
    → keep the familiar model; a rewrite for fashion buys nothing.
```

### How much determinism?

```text
What must reproduce exactly?
├── The same outcome on different machines (lockstep, rollback netcode)
│   → full determinism: fixed step, seeded RNG, stable iteration order, controlled math
│     (fixed-point or a deterministic math library), inputs-only sync, per-tick checksums.
├── The same outcome on the same build (replays, bug reproduction, golden tests)
│   → fixed step, seeded RNG owned by the simulation, stable iteration order, no wall clock.
└── Nothing
    → still inject time and RNG into the simulation; it costs little and makes tests reproducible.
```

### Which multiplayer model?

```text
What kind of play?
├── Turn-based or asynchronous → server validates commands against authoritative state; no prediction.
├── Many units, few players, light input (strategy, simulation) → deterministic lockstep: send inputs, not state.
├── Fast action, many players → authoritative server, snapshot replication, client prediction and
│   reconciliation, interpolation of remote entities, lag compensation for hits.
├── Two to a few players, frame-precise (fighting, versus platformers) → rollback: predict remote input,
│   resimulate on correction.
└── Casual co-op among friends → host-authoritative: one client runs the server role; cheaper, host can cheat.
```

## Core rules / patterns

### Game loop and frame budget

```ts
const STEP = 1 / 60        // simulated seconds per tick
const MAX_FRAME = 0.25     // clamp after a stall to avoid the spiral of death
let accumulator = 0

function onFrame(frameSeconds: number) {
  accumulator += Math.min(frameSeconds, MAX_FRAME)
  while (accumulator >= STEP) {
    sim.step(intents.drainForTick(sim.tick))   // input enters at a tick boundary
    accumulator -= STEP
  }
  const alpha = accumulator / STEP             // position between previous and current tick
  renderer.apply(presentation.project(sim.previous(), sim.current(), alpha))
}
```

- Derive simulated time from `tick * STEP`. Nothing inside `sim.step` reads frame delta or a clock.
- Interpolate between the last two simulation states for display; it costs at most one step of latency. Extrapolate only when that latency hurts more than occasional overshoot.
- Pause by not stepping. Slow motion scales the time fed to the accumulator; `STEP` never changes.
- Budget each frame phase in writing. At 60 Hz the frame is 16.7 ms (8.3 ms at 120 Hz, 33.3 ms at 30 Hz); an example 60 Hz split is simulation 4 ms, presentation and UI 3 ms, render submission 6 ms, and 3 ms headroom for GC, OS, and spikes.
- Measure p95 and p99 frame time on the weakest target device, not average FPS.
- In garbage-collected runtimes, allocate nothing per frame on hot paths: reuse arrays, pool spawned objects, and avoid temporary vectors and closures in per-entity loops.

Depth: [game-loop-and-time.md](references/game-loop-and-time.md).

### Layers and owners

| Layer | Owns | Never knows | Output |
|---|---|---|---|
| Simulation (model) | rules, authoritative state, tick, commands, events, RNG | engine nodes, GPU handles, DOM, audio, clocks | snapshot + events: `UnitDamaged { id, amount }` |
| Presentation | mapping from state and events to looks and sounds; transient view state (tweens, shake, particles) | rule outcomes; GPU resources | neutral visual parameters: `{ id, sprite: "orc", animation: "hurt", tint: "#f44", scale: 1.1, label: "-12" }` |
| Renderer / engine adapter | GPU resources, scene graph, camera projection, picking, audio playback | game kinds, stages, rules | pixels; picking results as entity ids |
| Input / UI | device mapping, menus, HUD widgets | consequences of actions | intents: `{ type: "MoveTo", unit: 7, x: 4, y: 9 }` |

```text
device → intent → simulation.step → state + events → presentation.project → visual parameters → renderer.apply
                    ↑                                                                         │
                    └──────────── UI ← picking result (entity id) ←────────────────────────────┘
```

- Validate intents in the simulation. A disabled button is a hint; the model still rejects an unaffordable build.
- Map kinds to visuals through registered data (sprite sheet, animation names, sound cues), so a new kind adds a mapping entry, not a renderer branch.
- Let the renderer reconcile nodes by entity id (create, update, dispose) from visual parameters; it never reads the model.
- When engine physics owns transforms, declare it the owner: the simulation reads results through an adapter at a fixed point in the tick and gameplay code never writes the same transform.
- Treat "frontend" as where code runs, not what it owns. In a browser game, rules still live in the simulation module even when everything ships in one bundle.

Depth: [model-presentation-renderer.md](references/model-presentation-renderer.md).

### State ownership

- Give each invariant one write path: the operation that changes a fact also updates every index derived from it.

```ts
class Inventory {
  #slots: (ItemId | null)[] = []
  #slotOf = new Map<ItemId, number>()        // derived index, written only by add/remove
  add(item: ItemId): AddResult { /* writes #slots and #slotOf together */ }
  slots(): readonly (ItemId | null)[] { return [...this.#slots] }   // a copy, never the field
}
```

- Treat `readonly` as shallow. `ReadonlyArray<Unit>` still hands out mutable `Unit` objects; return copies, frozen snapshots, ids plus query functions, or view types read-only all the way down.
- Rebuild derived indexes (spatial hash, team lists, parent links) on load from saved source facts instead of saving both.
- Keep data definitions (stat tables, prefab templates) read-only at runtime; per-instance state lives in the simulation.

### Variation and extension

- **Closed protocol** — a fixed set of wire messages, save record versions, input command types, or match phases changed together by one owner: an exhaustive `switch` over a discriminated union at the protocol owner (decoder, phase machine) is correct and clearest.
- **Open family** — enemy behaviors, abilities, items, game modes that keep growing: each variant owns its rules, presentation mapping, and save codec, registered once at the composition root.
- **Numbers only** — variants that differ only in values are data definitions run by one algorithm.

Trace one concrete extension before approving a structure:

| Change | Expected touches | Structure is wrong if it also touches |
|---|---|---|
| New prefab of an existing kind (a stronger orc) | one definition file, its assets | any code |
| New kind in an open family (a burrowing enemy) | its behavior module, presentation mapping, save codec if it has state, one registration | renderer, save orchestrator, session, unrelated kinds |
| New capability (freezable) | the capability's rules and storage, visual mapping, codec, the kinds that opt in | every kind, or the renderer |
| New visual asset for existing state | the asset, the presentation mapping | simulation |

This table is the game-specific shape of the extension test in `architecture`.

### Scene and resource lifecycle

```ts
async function changeScene(id: SceneId) {
  if (state.loading) return
  state.loading = true
  const generation = ++state.generation
  let candidate: Scene | undefined
  let previous: Scene | undefined
  try {
    candidate = await prepareScene(id)          // load, build, acquire leases; detached and invisible
    if (generation !== state.generation) return // session disposed while preparing
    previous = state.active
    state.active = candidate                    // commit: short and synchronous
    candidate = undefined                       // ownership moved to state.active
  } catch (error) {
    if (generation === state.generation) showLoadError(error)  // previous scene stays active
  } finally {
    candidate?.dispose()                        // disposes only an uncommitted candidate
    state.loading = false
  }
  previous?.dispose()
}
```

- Whoever holds the candidate disposes it; ownership moves exactly once, at commit.
- Disposal releases asset leases, GPU resources (textures, buffers, render targets), listeners, timers, and pooled objects owned by the scene.
- Reset every loading flag, spinner, and input lock in `finally`.

### Async work after await

```ts
async function save(session: Session) {
  const snapshot = session.sim.snapshot()                    // capture synchronously, before awaiting
  await storage.writeAtomic(session.slot, encode(snapshot))  // let started I/O finish
  if (session.disposed) return                               // no toast, sound, or event for a departed session
  session.ui.showStatus("Saved")
}
```

- Apply the same check after loads, network replies, asset fetches, timers, and animation completions.
- Tag requests and messages with the session or match id; drop replies whose id is no longer current.
- Cancel work that has no value after departure (an asset fetch for a scene the player left) with a cancellation signal; let atomic writes complete.

Depth for this and the previous section: [scene-and-asset-lifecycle.md](references/scene-and-asset-lifecycle.md).

### Saves

- Wrap data in a versioned envelope: `{ format: "save", version: 4, data }`.
- Save the simulation — entity state, ids, tick, RNG state, quest flags. Leave out scene nodes, animation frames, particles, and camera smoothing; presentation rebuilds them on load.
- Let each owner (system or variant) read and write its own section through a codec; the orchestrator collects sections without knowing their fields.
- Migrate with a chain of pure functions (v1 → v2 → v3) and keep a fixture save from every shipped version in tests. Refuse saves newer than the build without overwriting them.
- Write atomically: temporary file, flush, rename over the old one — or alternate two slots with a checksum. A crash mid-write must leave the previous save loadable.
- Autosave at safe points (between ticks, after a checkpoint, never mid-transition), throttled; snapshot synchronously, write asynchronously.

### Assets and loading

- Load from manifests that list each scene's dependencies, so preparation knows the full set before commit.
- Hold assets through leases: `const atlas = await assets.acquire("orc.atlas")`, then `atlas.release()` when the scene disposes. The cache unloads at zero references, optionally after a grace period that avoids reload thrash between adjacent scenes.
- Deduplicate in-flight loads: two requests for one asset share one promise.
- Set budgets per target (memory, texture size, download size, draw calls) and check them with asset reports.
- Stream large worlds by region with hysteresis: the load radius is larger than the unload radius.
- Hot reload assets and data definitions in development only; keep entity ids stable and re-project presentation.

### Determinism

- Give the simulation a seeded RNG that is part of saved state. Split streams per subsystem (combat, loot, AI) so one added roll does not shift every later outcome. Cosmetic randomness (particles, idle variation) uses a separate generator.
- Use the tick counter as time. A cooldown is `readyAtTick`, not a timestamp or a timer callback.
- Iterate in a defined order (entity id, or insertion order the language guarantees). Unordered hash iteration and engine "find all objects" queries are not ordered.
- Floating point varies across CPUs, compilers, and JavaScript engines (notably transcendental functions); cross-machine lockstep needs fixed-point or a deterministic math library.
- Checksum simulation state every N ticks in replays and tests to catch divergence at the tick it starts.

Depth for saves and determinism: [saves-and-determinism.md](references/saves-and-determinism.md).

### Multiplayer

A WebSocket with reconnection is a transport. Netcode is the simulation contract over it: who is authoritative, what crosses the wire per tick, and how clients hide latency. Choose the model from the decision tree before the first networked feature; retrofitting authority or determinism means rewriting the simulation boundary.

- Clients send intents; the authority validates and rate-limits them and owns every outcome.
- Share simulation code between client and server so prediction runs the same rules.
- Transport selection and connection handling → `realtime`. Tick and send rates, prediction, reconciliation, interpolation buffers, lag compensation, bandwidth → [netcode.md](references/netcode.md).

### Testing gameplay

```ts
test("burning stops at water", () => {
  const sim = createSimulation({ seed: 7, level: fixtures.riverCrossing })
  runTicks(sim, 120, [{ tick: 0, intent: { type: "Ignite", unit: 3 } }])
  expect(sim.view().unit(3).statuses).not.toContain("burning")
})
```

- Run the simulation headless with a seed and fixtures, feed scripted intents, step N ticks, and assert state and events. No engine, window, or GPU.
- Write scenario tests in player terms: given this level, when the player holds right for 90 ticks, the door opens.
- Property-test invariants over random intent sequences: HP stays in bounds, the inventory index matches its slots, currency is conserved in trades.
- Keep golden replays (seed plus intents) and compare checksums on every build.
- Test presentation as a pure function from state to visual parameters; test the renderer with smoke or screenshot tests on its own; playtest for feel.
- Measure frame-time budgets on target hardware with `performance`.

## Context Adaptation

- **Prototype or game jam** — one file is fine. Keep simulation and drawing as separate functions even inside it, use a fixed step if anything moves under physics, and skip save migration and ECS.
- **Shipping title** — versioned saves with fixtures, asset budgets, headless and replay tests in CI, crash-safe writes, and platform lifecycle handling (suspend, resume, quit during save).
- **Single-player** — the client is the authority; add tamper resistance only where scores or economies leave the device.
- **Multiplayer** — choose authority and determinism level first; every rule runs where the authority is.
- **2D web** — animation frames stop or throttle in hidden tabs: pause or clamp on return. Audio starts only after a user gesture. Download size is a budget, GC pauses dominate frame spikes, and a heavy simulation can move to a worker that posts snapshots to the main thread.
- **3D engine** — the engine imposes scene, component, and loop models. Put rules in plain modules the engine's fixed-step hook calls and treat engine objects as adapters; per-engine mapping is in [engines.md](references/engines.md).
- **Mobile and console** — fixed frame targets (30 or 60), thermal throttling in long sessions, hard memory caps, suspend that may end in process death (save on backgrounding), touch or controller input, and platform certification rules for saving and quitting. App lifecycle and process death → `mobile`; budgets and on-device measurement → `performance`.

## Anti-Patterns

- **Game policy in the renderer** — the renderer or engine adapter branches on game kinds or stages: `if (unit.kind === "boss" && stage === 3) mesh.scale.set(2, 2, 2)`. Symptom: every new kind or stage edits rendering code, and visuals drift from rules. Fix: presentation maps state to visual parameters through per-kind data; the renderer applies parameters by id.
- **UI decides consequences** — a click handler subtracts gold and spawns the unit. Symptom: rules duplicated across UI, AI, and network paths; replays miss UI-made changes. Fix: the handler submits an intent; the simulation validates and applies it.
- **Getters return internal mutable state** — `get units() { return this.#units }`, or `readonly Unit[]` holding mutable units. Symptom: state changes with no writer in the stack trace; derived indexes go stale. Fix: return a snapshot, a deep read-only view, or ids plus queries; mutate only through commands.
- **Activation outside try** — `const scene = await prepare(id); activate(scene); loading = false`. Symptom: one failed load leaves the game on the loading screen, the half-built candidate leaks GPU memory, and the previous scene is already torn down. Fix: prepare, commit in one short step, dispose the uncommitted candidate and reset flags in `finally`.
- **Effects after await on a disposed session** — Symptom: a "Saved" toast or victory sound on the main menu; an event from the old match reaches the new one. Fix: capture state before the await, check lifetime or generation after it, then run effects.
- **Scattered variant knowledge** — one item kind lives as a case in the save switch, the presentation switch, the tooltip switch, and the session. Symptom: adding a kind needs synchronized edits across unrelated files, and a missed case corrupts saves. Fix: the variant owns its rules, mapping, and codec, registered once. A closed protocol's single exhaustive decoder is not this.
- **God session file** — one `GameSession` holds turns, saves, audio, UI, and networking. Size is a signal, not a verdict: trace one independent change (a new enemy kind, a new save field). If it touches unrelated parts of the file, or every variant edits it, split along the owners the trace reveals; if changes stay local and cohesive, leave it.
- **Frame-dependent physics** — `velocity *= 0.98` per frame, or collisions stepped with variable delta. Symptom: jumps go higher at 144 Hz, projectiles tunnel through walls at 20 FPS, outcomes differ by machine. Fix: fixed simulation step with render interpolation.
- **Wall clock in the simulation** — `Date.now()` cooldowns, `Math.random()` in rules. Symptom: pause does not pause cooldowns, replays and lockstep desync, tests flake. Fix: tick-based time and the simulation's seeded RNG.
- **Saving render state** — saves hold node transforms or animation frames. Symptom: changing a model or rig breaks old saves. Fix: save model state; presentation rebuilds visuals on load.

## Related Knowledge

- `architecture` — boundaries, ownership, extension and change analysis; this skill applies them to games
- `performance` — profiling, frame-time investigation, memory leaks, budgets on target hardware
- `realtime` — transport selection, connection lifecycle, reconnection, relay scaling beneath netcode
- `javascript` — read-only and union types, workers, and the event loop for web games
- `testing` — test strategy, property-based and golden tests, flake diagnosis
- `mobile` — app lifecycle, backgrounding, process death, and restoration on phones and tablets
- `backend` — game services: matchmaking, leaderboards, accounts

## References

- [game-loop-and-time.md](references/game-loop-and-time.md) — loop phases, accumulator and interpolation, tick rates, input timing, time scaling, frame budgets, background and suspend
- [model-presentation-renderer.md](references/model-presentation-renderer.md) — layer contracts as code, events, read views, write paths, entity models, variant registration
- [scene-and-asset-lifecycle.md](references/scene-and-asset-lifecycle.md) — lifetimes, prepare/commit/rollback, ownership transfer, async lifetime, leases, GPU disposal, streaming, hot reload
- [saves-and-determinism.md](references/saves-and-determinism.md) — save schema, codecs, migration, atomic writes, autosave, RNG streams, ordering, floating point, replays
- [netcode.md](references/netcode.md) — authority models, tick and send rates, snapshots, prediction and reconciliation, interpolation, lag compensation, lockstep, rollback, bandwidth
- [engines.md](references/engines.md) — how these patterns map onto Unity, Godot, Unreal, and web engines (three.js, Phaser, PixiJS, Babylon.js)
