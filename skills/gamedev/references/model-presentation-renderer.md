# Model, Presentation, Renderer

Contracts between the simulation, the layer that decides how it looks, and the layer that talks to the GPU or engine. Sketches are TypeScript-flavored and engine-neutral; the same shapes work as C# classes, C++ structs, or GDScript classes.

## Contents

- [Contracts at a glance](#contracts-at-a-glance)
- [Simulation contract](#simulation-contract)
- [Intents and validation](#intents-and-validation)
- [Events](#events)
- [Presentation contract](#presentation-contract)
- [Renderer adapter contract](#renderer-adapter-contract)
- [Camera, audio, and HUD](#camera-audio-and-hud)
- [Read views and snapshots](#read-views-and-snapshots)
- [Write paths and derived indexes](#write-paths-and-derived-indexes)
- [Engine-owned state](#engine-owned-state)
- [Entity models](#entity-models)
- [Registering variants](#registering-variants)
- [Review questions](#review-questions)

---

## Contracts at a glance

```text
simulation/      rules, state, intents, events, RNG, tick        → depends on nothing below
presentation/    state + events → VisualFrame (neutral data)     → depends on simulation read types
renderer/        VisualFrame → engine nodes, GPU, audio           → depends on presentation output types only
input/, ui/      devices and widgets → intents                    → depends on simulation intent and view types
game.ts          composition root: builds all of the above, registers variants, runs the loop
```

Dependencies point toward the simulation. The renderer does not import simulation types; if it needs a fact, presentation puts it into the visual parameters.

## Simulation contract

```ts
type EntityId = number & { readonly brand: "EntityId" }

type Intent =
  | { type: "MoveTo"; unit: EntityId; x: number; y: number }
  | { type: "Attack"; unit: EntityId; target: EntityId }
  | { type: "UseAbility"; unit: EntityId; ability: AbilityId; target?: EntityId }
  | { type: "Build"; player: PlayerId; blueprint: BlueprintId; x: number; y: number }

type GameEvent =
  | { type: "UnitDamaged"; id: EntityId; amount: number; source: EntityId }
  | { type: "UnitDied"; id: EntityId }
  | { type: "IntentRejected"; intent: Intent; reason: "unaffordable" | "blocked" | "not-owner" | "cooldown" }

interface Simulation {
  readonly tick: number
  step(intents: readonly Intent[]): readonly GameEvent[]
  snapshot(): WorldSnapshot      // deep, serializable, safe to keep across ticks
  view(): WorldView              // cheap read-only queries, valid for the current frame
}
```

`Intent` is a closed protocol: one owner changes the set, and the simulation's dispatcher switches over it exhaustively. Abilities are an open family behind one intent (`UseAbility`), so a new ability registers its rules without touching the intent union, the dispatcher, or the UI. Closed protocol on the outside, open family behind it.

## Intents and validation

- An intent carries ids and world data, never object references, engine nodes, or screen coordinates.
- Every producer uses the same path: player input, AI, network, replays, and tests all submit intents. A rule enforced only in the UI is missing for the other four.
- The simulation validates ownership, cost, range, cooldown, and state. Rejection is a result or an event with a reason, not an exception; the UI decides how to show it.
- AI reads a view and emits intents. It may run inside the simulation for determinism, but it still goes through the same validation, so it cannot cheat by writing state.
- The UI asks the simulation's queries to decide what to enable (`canAfford(player, blueprint)`) instead of reimplementing cost rules.

## Events

- Events are facts in past tense, emitted during a step, in a defined order.
- Continuous visuals derive from state (health bars, positions); one-shot effects derive from events (hit spark, damage number, sound).
- Events are not requests. A presentation handler never calls back into the simulation to change state; if something must happen as a rule consequence, the simulation does it in the same step.
- After a load, presentation rebuilds from the snapshot and receives no history. Anything that must survive a load is state, not an event.
- Keep the event union closed per simulation module. Variant-specific detail goes in a payload owned by the variant (`{ type: "AbilityResolved", ability, data }`) so the union does not grow with every ability.

## Presentation contract

```ts
interface VisualState {
  id: EntityId
  visual: VisualKey              // "orc", "tower.arrow" — resolved to assets by the renderer's table
  animation: string              // "idle", "walk", "hurt"
  x: number; y: number; z?: number; rotation: number
  tint?: string; scale?: number; opacity?: number
  label?: string                 // names, damage numbers
  layer: number
}

interface VisualFrame {
  entities: readonly VisualState[]
  effects: readonly EffectState[]     // particles, decals, screen shake
  cues: readonly SoundCue[]           // { cue: "hit.metal", x, y, volume }
  camera: CameraTarget                // what to look at; projection is the renderer's job
}

interface Presentation {
  onEvents(tick: number, events: readonly GameEvent[]): void
  update(realSeconds: number): void   // tweens, particle lifetimes, shake decay
  project(previous: WorldSnapshot, current: WorldSnapshot, alpha: number): VisualFrame
}
```

- Presentation owns transient view state the simulation never needs: tween progress, particle systems, screen shake, hover highlights, death ghosts.
- Map kinds to visuals with registered data or small functions per kind (see [Registering variants](#registering-variants)). The projector iterates entities and calls the mapping for each kind; it holds no per-kind branches.
- Presentation may be stateful but never authoritative. Deleting all presentation state and re-projecting from a snapshot must produce a correct, if less animated, picture.

## Renderer adapter contract

```ts
interface Renderer {
  apply(frame: VisualFrame): void     // reconcile nodes by id: create, update, dispose
  pick(screenX: number, screenY: number): EntityId | null
  resize(width: number, height: number): void
  dispose(): void                     // releases every GPU and engine resource it created
}
```

- **Reconcile by id.** Keep `Map<EntityId, Node>`. Create nodes for new ids, update parameters on existing ones, dispose nodes whose ids disappeared (or hand them to presentation for a death animation).
- **Asset table.** `VisualKey` resolves through a table to meshes, atlases, and animation clips. An unknown key renders a visible placeholder and logs in development; it does not crash.
- **No game vocabulary.** Search the renderer module for kind names, stage names, and rule terms; each hit is policy that belongs in presentation data.
- **Picking returns ids.** Store the entity id on the node (user data, metadata, tag); the UI turns a picked id into an intent.

## Camera, audio, and HUD

| Concern | Simulation | Presentation | Renderer / adapter |
|---|---|---|---|
| Camera | gameplay viewpoint when it affects rules (fog of war, spawn culling, what AI can see) | follow target, smoothing, shake, zoom feel | projection, viewport, culling |
| Audio | nothing (or a rule-relevant "noise" value AI can hear) | which cue, where, how loud; music state from game state | mixer, voices, streaming, platform audio session |
| HUD | queries: resources, cooldown remaining, valid targets | formatting, animation of values | widgets drawn by an engine UI or DOM |

Music that follows combat state is presentation projecting simulation state ("enemies engaged" → combat stem), not a simulation concern.

## Read views and snapshots

A snapshot is a deep, serializable copy: use it for saves, interpolation buffers, network messages, and posting to a worker. A view is a set of read-only queries over live state: use it for UI and presentation in the current frame. Neither may expose internal mutable objects.

```ts
class World {
  #units: Unit[] = []
  get units(): readonly Unit[] { return this.#units }   // defect: units[0].hp = 9999 compiles and runs
}
```

`readonly` on the array stops `push`, not writes to the elements. Choose one of:

```ts
// 1. Runtime-safe copy of exactly what the reader needs
unit(id: EntityId): UnitSnapshot { const u = this.#get(id); return { id, hp: u.hp, x: u.x, y: u.y, statuses: [...u.statuses] } }

// 2. Compile-time deep read-only view (zero copy; a cast still mutates)
type DeepReadonly<T> =
  T extends readonly (infer R)[] ? ReadonlyArray<DeepReadonly<R>> :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T
unitsView(): DeepReadonly<Unit[]> { return this.#units }

// 3. Ids plus queries
unitIds(): readonly EntityId[] { return [...this.#ids] }
hp(id: EntityId): number { return this.#get(id).hp }
```

Option 2 is enough inside one codebase with trusted callers; add `Object.freeze` in development builds to catch casts at runtime. Use option 1 across trust or thread boundaries (UI written by another team, workers, network, mods).

## Write paths and derived indexes

The operation that changes a fact also updates everything derived from it.

```ts
class World {
  #pos = new Map<EntityId, Vec2>()
  #grid = new SpatialHash<EntityId>(32)
  #byTeam = new Map<TeamId, Set<EntityId>>()
  #events: GameEvent[] = []                // drained by step() and returned to the caller

  move(id: EntityId, to: Vec2) {          // the only way a position changes
    const from = this.#pos.get(id)!
    this.#pos.set(id, to)
    this.#grid.update(id, from, to)
  }

  destroy(id: EntityId) {                  // removes the entity from every index it is in
    this.#grid.remove(id, this.#pos.get(id)!)
    this.#byTeam.get(this.teamOf(id))?.delete(id)
    this.#pos.delete(id)
    this.#events.push({ type: "UnitDied", id })
  }
}
```

- A direct `unit.x = 5` bypasses the grid; collision queries then miss the unit. Make positions writable only through `move`.
- UI-owned sets that reference entities (selection, hover) listen for removal events and clean themselves; the simulation does not know about selection.
- Relationships (attachments, parent and child, carried items) change through one operation that updates both ends.
- Run `world.checkInvariants()` after every tick in tests and debug builds: every entity in the grid exists, team sets match team fields, links are symmetric.

## Engine-owned state

When an engine's physics or animation system is the authority for some state, declare it and structure the tick around it:

```text
tick:
  1. pre-physics   — rules read intents and apply forces, impulses, or target velocities
  2. physics step  — the engine integrates and resolves contacts (owner of transforms and velocities)
  3. post-physics  — rules read contacts and transforms and apply consequences (damage, triggers, scoring)
```

- Gameplay code changes physics-owned transforms only through the physics API (an explicit teleport), never by writing node transforms.
- Root motion from animation is the same: if animation drives movement, the animation system is the owner and rules read the result.
- Engine physics is usually not deterministic across machines; this choice rules out lockstep and rollback on top of it ([saves-and-determinism.md](saves-and-determinism.md)).
- Reading the scene graph as the source of truth is acceptable in a prototype. In a shipping game, a node's transform is a projection unless the engine's physics was declared the owner.

## Entity models

The decision tree in SKILL.md picks a model from requirements; the costs below explain the tradeoffs.

| Model | Fits | Costs |
|---|---|---|
| ECS / data-oriented | thousands of similar entities; systems over component queries; data-parallel or cache-bound loops; serialization per component store | indirection for one-off logic; explicit system order; relationships and events need design; debugging spans systems |
| Composition (entity + capabilities or engine components) | tens to hundreds of entities mixing capabilities; designers assemble prefabs; engine component models | per-object overhead and scattered memory at large counts |
| Inheritance | small closed family, every subtype substitutable, capabilities never combine | combinations explode (`FlyingShootingBurrowingEnemy`); base classes accumulate unrelated features |
| Hybrid | engine objects for presentation and one-offs, data-oriented storage for a hot set (projectiles, crowds, particles with gameplay effect) | two models to explain; a clear rule for which entities live where |

Signals the model is fighting the requirements:

- ECS systems check `has(entity, Boss)` to special-case kinds — the same scatter as a type switch. Give the special behavior its own component and system.
- Composition objects reach into siblings by concrete type (`getComponent(FireDamage)` inside `Health`) — introduce an event or a narrow interface the owner exposes.
- Inheritance trees gain flags (`canFly`, `isBurrowing`) on the base class — the family is not closed; move to composition.

## Registering variants

Each variant owns its simulation behavior, presentation mapping, and save codec. The simulation registry and the presentation registry are separate, keyed by the same kind id, and filled at the composition root, so the simulation never depends on presentation.

```ts
// simulation/kinds/burrower.ts
export const burrower: EnemyBehavior<BurrowerState> = {
  kind: "burrower",
  spawn: (world, at, def) => world.spawn({ kind: "burrower", at, hp: def.hp, state: { underground: false } }),
  think: (view, self, rng) => decideBurrow(view, self, rng),   // returns intents
  codec: burrowerCodec,                                        // owns its save section
}

// presentation/kinds/burrower.ts
export const burrowerVisual: VisualMapping<BurrowerView> = {
  kind: "burrower",
  project: e => ({ visual: "burrower", animation: e.state.underground ? "dig" : "walk", opacity: e.state.underground ? 0.4 : 1 }),
}

// game.ts — composition root
simulationKinds.register(burrower)
visualKinds.register(burrowerVisual)
assertEveryKindHasVisual(simulationKinds, visualKinds)   // fail fast at startup in development
```

Adding a kind touches its two modules, its assets, and two registration lines. The renderer, save orchestrator, session, and other kinds stay unchanged — the extension trace in SKILL.md confirms it.

## Review questions

- Can the simulation run with the renderer, engine scene, and UI removed?
- Does the renderer source contain any kind, stage, or rule names?
- Does any UI handler change state directly or compute a rule outcome?
- Does any read API return an internal collection or a mutable nested object?
- For each derived index, which single operation maintains it?
- If engine physics or animation owns some state, is that written down, and does gameplay code avoid writing it?
- Adding one kind: which files change? Does the list match the extension trace?
