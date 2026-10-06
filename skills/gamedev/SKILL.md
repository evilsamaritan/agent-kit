---
name: gamedev
description: "Design or review game code in any engine or framework (native, web, or custom). Use for game loop, frame budget, gameplay code, simulation, ECS, scenes, assets, save games, replays, and multiplayer netcode. Do NOT use for network transport (realtime) or profiling method (performance)."
---

# Game Development

A game is a simulation that a renderer draws. The engine, language, or platform does not move the rules: a C# component, a GDScript node, or a script drawing to a browser canvas is still gameplay code when it decides who takes damage. This skill applies the practice of `development` to games and adds what is specific to them: time, frames, scenes, assets, saves, determinism, and netcode. Code sketches in the references are TypeScript-flavored pseudo-code; the shapes are the same as C# classes, C++ structs, or GDScript classes, and [engines.md](references/engines.md) maps them onto engines.

**Rules:**

1. The simulation owns rules and state. Presentation projects state to visual parameters. The renderer draws them. Input and UI send intents; the simulation decides consequences.
2. Step the simulation at a fixed rate from an accumulator and interpolate rendering whenever motion, physics, networking, or replays affect outcomes.
3. Give every invariant one write path. Read APIs return snapshots or read-only views, never internal mutable references.
4. Prepare a new scene off to the side, commit it in one short step, and keep the previous scene when preparation fails. Derive loading state from one phase value that every exit path sets (`finally`, `defer`, a destructor or RAII guard), not from separate boolean flags.
5. After every suspension point (`await`, a coroutine `yield`, a callback), check that the owning session or scene is still alive before any effect.
6. Save the model, not render state — versioned, migrated, and written atomically.
7. Keep wall-clock reads and unseeded randomness out of the simulation.
8. Test the simulation headless, presentation as a pure mapping, and the renderer separately.

## Scope and boundaries

**Covers:** game loop and timing, layering of gameplay code, state ownership in a running game, entity models and variation, scene and asset lifecycle, async work across scene and session lifetimes, saves, determinism, netcode, gameplay testing, and how these patterns map onto engines.

**Does not cover:** rendering techniques (shaders, lighting, post-processing), game design (balance, level design, economy tuning), and art or audio production beyond loading and budgets.

| Need | Route |
|---|---|
| Code practice: ownership, variant families, explicit dependencies, async lifetime, refactoring | `development` — this skill applies it to games, does not restate it |
| Module and service boundaries, system design | `architecture` |
| Profiling method, flame graphs, memory leak hunting | `performance` |
| WebSocket, WebTransport, or WebRTC connections, reconnection, relay scaling | `realtime` |
| Language idioms: C#, C++, GDScript, TypeScript, Rust | the matching language skill where the kit has one (`javascript`, `rust`, …) |
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

## Core rules / patterns

### Game loop and frame budget

- Run the simulation from an accumulator at a fixed `STEP`; clamp real frame time, cap steps per frame, and drop the backlog after a stall. Render by interpolating the last two states with `alpha = accumulator / STEP`. Input enters at a tick boundary.
- Derive simulated time from `tick * STEP`. Nothing inside the step reads frame delta or a clock.
- Interpolate for display (at most one step of latency); extrapolate only when that latency hurts more than occasional overshoot.
- Pause by not stepping. Slow motion scales the time fed to the accumulator; `STEP` never changes.
- Budget each frame phase in writing. At 60 Hz the frame is 16.7 ms (8.3 ms at 120 Hz, 33.3 ms at 30 Hz); an example 60 Hz split is simulation 4 ms, presentation and UI 3 ms, render submission 6 ms, and 3 ms headroom for GC, OS, and spikes.
- Measure p95 and p99 frame time on the weakest target device, not average FPS.
- In garbage-collected runtimes, allocate nothing per frame on hot paths: reuse arrays, pool spawned objects, and avoid temporary vectors and closures in per-entity loops.

Depth and the reference loop: [game-loop-and-time.md](references/game-loop-and-time.md).

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

### How `development`'s rules land in games

**State ownership.** One writer per invariant; the operation that changes a fact also updates every index derived from it (an inventory's slot list and its item-to-slot map change together).

- Read-only must be read-only all the way down. A read-only list of mutable units (`ReadonlyArray<Unit>`, `IReadOnlyList<Unit>`, a `const` array of pointers) still hands out mutable units; return copies, snapshots, ids plus query functions, or view types that are read-only throughout.
- Rebuild derived indexes (spatial hash, team lists, parent links) on load from saved source facts instead of saving both.
- Keep data definitions (stat tables, prefab templates) read-only at runtime; per-instance state lives in the simulation.

**Variation.** Families usually fall like this:

- **Closed protocols** — wire messages, save record versions, input command types, match phases: exhaustive dispatch at the protocol owner (decoder, phase machine).
- **Open families** — entity kinds, enemy behaviors, abilities, items, traps, game modes: each kind owns its rules, presentation mapping, and save codec, registered once at the composition root.
- **Numbers only** — a stronger orc, another goblin variant: data definitions run by one algorithm.

A level or save format that lists today's kinds closes the format, not the family. Expected touches per change, the game form of the extension trace:

| Change | Expected touches | Structure is wrong if it also touches |
|---|---|---|
| New prefab of an existing kind (a stronger orc) | one definition file, its assets | any code |
| New kind in an open family (a burrowing enemy) | its behavior module, presentation mapping, save codec if it has state, one registration | renderer, save orchestrator, session, unrelated kinds |
| New capability (freezable) | the capability's rules and storage, visual mapping, codec, the kinds that opt in | every kind, or the renderer |
| New visual asset for existing state | the asset, the presentation mapping | simulation |

Run the trace from `development` before approving a structure; a consumer outside this table is a finding.

### Scene and resource lifecycle

- Prepare the candidate scene detached and invisible (load, build, acquire leases); commit in one short synchronous step; dispose the previous scene only after commit.
- Whoever holds the candidate disposes it; ownership moves exactly once, at commit. A failed or superseded preparation disposes the candidate and leaves the previous scene active.
- Disposal releases asset leases, GPU resources (textures, buffers, render targets), listeners, timers, and pooled objects owned by the scene.
- Derive "loading", input lock, and spinner from one phase value (`ready`, `preparing`, `failed`) that every exit path sets in `finally`; separate flags get forgotten on one path.

**Async work after await.** The owners are the session, the match, and the scene (`development` covers the principle).

- After every suspension point, check that the owner is alive (disposed flag, generation counter, cancellation signal, or the engine's validity check) before any effect: a toast, sound, or event from a departed session must not reach the next one.
- Capture state synchronously before awaiting; let started durable I/O (a save write) finish; cancel work that has no value after departure (an asset fetch for a scene the player left).
- Tag requests and messages with the session or match id; drop replies whose id is no longer current.

Depth: [scene-and-asset-lifecycle.md](references/scene-and-asset-lifecycle.md).

### Saves

- Versioned envelope; save the simulation (entity state, ids, tick, RNG state, quest flags), not scene nodes, animation frames, particles, or camera smoothing.
- Each owner reads and writes its own section through a codec; migrate with a chain of pure functions and keep a fixture save from every shipped version. Refuse saves newer than the build without overwriting them.
- Write atomically (temp file, flush, rename, or alternating slots with a checksum); autosave at safe points, snapshotting synchronously and writing asynchronously.

Depth: [saves-and-determinism.md](references/saves-and-determinism.md).

### Assets and loading

- Load from manifests that list each scene's dependencies, so preparation knows the full set before commit.
- Hold assets through leases: `const atlas = await assets.acquire("orc.atlas")`, then `atlas.release()` when the scene disposes. The cache unloads at zero references, optionally after a grace period that avoids reload thrash between adjacent scenes.
- Deduplicate in-flight loads: two requests for one asset share one in-flight load.
- Set budgets per target (memory, texture size, download size, draw calls) and check them with asset reports.
- Stream large worlds by region with hysteresis: the load radius is larger than the unload radius.
- Hot reload assets and data definitions in development only; keep entity ids stable and re-project presentation.

### Determinism

- A seeded RNG that is part of saved state, split per subsystem; cosmetic randomness uses a separate generator.
- The tick counter is time: a cooldown is `readyAtTick`, not a timestamp or timer callback.
- Defined iteration order (entity id or guaranteed insertion order); never unordered hash iteration or engine "find all objects" queries.
- Cross-machine lockstep needs fixed-point or a deterministic math library; checksum state every N ticks in replays and tests.

Depth: [saves-and-determinism.md](references/saves-and-determinism.md#determinism-levels).

### Multiplayer

A WebSocket with reconnection is a transport. Netcode is the simulation contract over it: who is authoritative, what crosses the wire per tick, and how clients hide latency. Choose the model with the decision tree in [netcode.md](references/netcode.md#choosing-an-authority-model) before the first networked feature; retrofitting authority or determinism means rewriting the simulation boundary.

- Clients send intents; the authority validates and rate-limits them and owns every outcome.
- Share simulation code between client and server so prediction runs the same rules.
- Transport selection and connection handling → `realtime`. Tick and send rates, prediction, reconciliation, interpolation buffers, lag compensation, bandwidth → [netcode.md](references/netcode.md).

### Testing gameplay

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
- **Activation outside try** — `const scene = await prepare(id); activate(scene); loading = false`. Symptom: one failed load leaves the game on the loading screen, the half-built candidate leaks GPU memory, and the previous scene is already torn down. Fix: prepare, commit in one short step, dispose the uncommitted candidate and set the phase in `finally`.
- **God session file** — one `GameSession` holds turns, saves, audio, UI, and networking. Size is a signal, not a verdict: trace one independent change (a new enemy kind, a new save field). If it touches unrelated parts of the file, or every variant edits it, split along the owners the trace reveals; if changes stay local and cohesive, leave it.
- **Frame-dependent physics** — `velocity *= 0.98` per frame, or collisions stepped with variable delta. Symptom: jumps go higher at 144 Hz, projectiles tunnel through walls at 20 FPS, outcomes differ by machine. Fix: fixed simulation step with render interpolation.
- **Wall clock in the simulation** — cooldowns read from the system clock (`Date.now()`, `Time.time`, `Time.get_ticks_msec()`), unseeded random numbers (`Math.random()`, `Random.Range`) in rules. Symptom: pause does not pause cooldowns, replays and lockstep desync, tests flake. Fix: tick-based time and the simulation's seeded RNG.
- **Saving render state** — saves hold node transforms or animation frames. Symptom: changing a model or rig breaks old saves. Fix: save model state; presentation rebuilds visuals on load.

## Related Knowledge

- `development` — ownership, variant families, async lifetime, and change practice; this skill applies them to games and does not restate them
- `architecture` — module and service boundaries for game backends and tools
- `performance` — profiling, frame-time investigation, memory leaks, budgets on target hardware
- `realtime` — transport selection, connection lifecycle, reconnection, relay scaling beneath netcode
- language skills (`javascript`, `rust`, …) — idioms of the language the game is written in; `javascript` also covers workers and the event loop for web games
- `testing` — test strategy, property-based and golden tests, flake diagnosis
- `mobile` — app lifecycle, backgrounding, process death, and restoration on phones and tablets
- `backend` — game services: matchmaking, leaderboards, accounts

## References

- [game-loop-and-time.md](references/game-loop-and-time.md) — reference loop, loop phases, accumulator and interpolation, tick rates, input timing, time scaling, frame budgets, background and suspend
- [model-presentation-renderer.md](references/model-presentation-renderer.md) — layer contracts as code, events, read views, write paths, entity models, variant registration
- [scene-and-asset-lifecycle.md](references/scene-and-asset-lifecycle.md) — lifetimes, prepare/commit/rollback, ownership transfer, async lifetime, leases, GPU disposal, streaming, hot reload
- [saves-and-determinism.md](references/saves-and-determinism.md) — save schema, codecs, migration, atomic writes, autosave, RNG streams, ordering, floating point, replays
- [netcode.md](references/netcode.md) — authority models, tick and send rates, snapshots, prediction and reconciliation, interpolation, lag compensation, lockstep, rollback, bandwidth
- [engines.md](references/engines.md) — how these patterns map onto Unity, Godot, Unreal, web libraries, and custom or code-first engines
