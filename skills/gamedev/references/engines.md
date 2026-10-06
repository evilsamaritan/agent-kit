# Engines

How the patterns in this skill map onto common engines and web rendering libraries. These are mappings, not tutorials: each section names where the simulation, presentation, renderer, fixed step, scene lifecycle, leases, saves, and RNG live in that engine. API names change between engine versions; confirm them against the version in use. Mappings were written against: Unity 6, Godot 4.x (2D physics interpolation since 4.3, 3D since 4.4), Unreal Engine 5.x, current three.js, Babylon.js 8 and 9, PixiJS 8, and Phaser 3 and 4 (the scene lifecycle is shared; Phaser 4 replaces the renderer and filter system). Engines not listed (Bevy, MonoGame, Defold, Love2D, custom C++) follow the same mapping; see the last section.

## Contents

- [Full engine or rendering library?](#full-engine-or-rendering-library)
- [Unity](#unity)
- [Godot](#godot)
- [Unreal Engine](#unreal-engine)
- [three.js](#threejs)
- [Babylon.js](#babylonjs)
- [PixiJS](#pixijs)
- [Phaser](#phaser)
- [Web platform notes](#web-platform-notes)
- [Lifetime check after await in C# and GDScript](#lifetime-check-after-await-in-c-and-gdscript)
- [Code-first and custom engines](#code-first-and-custom-engines)
- [Mapping table](#mapping-table)

---

## Full engine or rendering library?

```text
Does the engine own the loop, the scene model, and the asset pipeline?
├── Yes — full engine (Unity, Godot, Unreal, Phaser; Babylon.js largely)
│   → run the simulation from the engine's fixed-step hook; treat nodes, components, and actors as
│     presentation and adapters; wrap the engine's async load and release APIs as leases.
└── No — rendering library (three.js, PixiJS)
    → you own the loop, the fixed step, the asset cache, and disposal. Write them once, outside gameplay code.

Either way: rules live in plain modules that run headless in tests.
```

## Unity

- **Loop.** `FixedUpdate` is the fixed step (`Time.fixedDeltaTime`; the maximum allowed timestep setting caps catch-up). `Update` samples input and drives presentation; `LateUpdate` follows cameras. Rigidbody interpolation smooths physics visuals between fixed steps.
- **Input.** Sample in `Update`, queue intents, consume them in `FixedUpdate`. Reading "pressed this frame" input directly inside `FixedUpdate` misses or doubles presses because fixed steps and frames do not align.
- **Layers.** Keep the simulation in plain C# classes with no `MonoBehaviour` dependency, driven by one runner component. `MonoBehaviour`s on prefabs are presenters and adapters. This also makes edit-mode tests possible without scenes.
- **Data definitions.** `ScriptableObject` assets are read-only templates. Writing to them at runtime persists in the Editor (the asset on disk changes) and resets in builds; copy values into runtime state.
- **Time and RNG.** `Time.time` and `UnityEngine.Random` are global; the simulation uses its tick and its own seeded `System.Random` or `Unity.Mathematics.Random` instance.
- **Entity model.** GameObjects with components are composition. The Entities (DOTS) packages provide ECS for hot sets.
- **Scenes.** `SceneManager.LoadSceneAsync` with `allowSceneActivation = false` loads up to activation (progress stops at 0.9): that is preparation; setting it to `true` is the commit. Additive scenes plus `UnloadSceneAsync` handle chunks. `Awake` and `OnEnable` run at activation, so keep them light — heavy initialization in them lands in the commit step.
- **Assets.** Addressables handles are reference counted: every load or instantiate needs a matching release. Hold handles in the scene's cleanup stack. `Resources.UnloadUnusedAssets` is a sweep, not ownership.
- **Async lifetime.** Async methods continue after a `MonoBehaviour` is destroyed. Pass `destroyCancellationToken` into the work and check `this == null` (Unity's destroyed-object check) after each await.
- **Saves.** Serialize plain data classes to `Application.persistentDataPath`, write a temp file, then replace. Do not serialize `MonoBehaviour`s or `ScriptableObject`s as saves, and avoid `BinaryFormatter`, which is insecure for untrusted input.
- **Determinism and netcode.** Built-in physics is not deterministic across machines. Unity's netcode packages and third-party libraries cover replication; check which of prediction, reconciliation, interpolation, and lag compensation the chosen one provides against [netcode.md](netcode.md).

## Godot

- **Loop.** `_physics_process(delta)` runs at the physics ticks-per-second setting: the fixed step. `_process(delta)` runs per frame for presentation. The physics interpolation project setting smooths rendering between ticks; a custom simulation gets its alpha from `Engine.get_physics_interpolation_fraction()`. The maximum physics steps per frame setting caps catch-up.
- **Input.** Convert input events into intents queued for the next physics tick; the simulation reads the queue, not the `Input` singleton.
- **Layers.** Keep the simulation in classes that do not extend `Node` (`RefCounted` scripts or C# classes); nodes are presenters and adapters. Signals carry simulation events to presentation; rules do not live in signal handlers on visual nodes.
- **Autoloads.** Global autoload scripts easily become the god session. Keep them as composition roots and narrow services.
- **Data definitions.** Loaded `Resource`s are cached and shared: changing one changes it for every user. Use them as read-only definitions; per-instance state lives in the simulation (or in a `duplicate()` when a node truly needs its own copy).
- **Scenes.** `ResourceLoader.load_threaded_request` with status polling loads in the background; `PackedScene.instantiate()` builds the node tree without adding it — together, preparation. Adding it to the tree and freeing the old scene is the commit. `change_scene_to_packed` is a one-step switch without a rollback point.
- **Async lifetime.** After `await`, check `is_instance_valid(node)` and that the node is still inside the tree and belongs to the current scene.
- **Saves.** Write JSON or a custom format with `FileAccess` under `user://`, to a temp file, then rename over the old one (check rename behavior on each target platform). Resource files (`.tres`, `.res`) can embed scripts that run on load — never load them from player-editable or downloaded saves.
- **RNG.** Use a seeded `RandomNumberGenerator` instance owned by the simulation, not the global random functions.
- **Multiplayer.** The high-level multiplayer API provides RPCs, spawning, and property synchronization over ENet, WebSocket, or WebRTC peers. Prediction, reconciliation, interpolation buffers, and lag compensation are project code or add-ons.

## Unreal Engine

- **Gameplay framework as layers.** `GameMode` exists only on the server and owns match rules. `GameState` and `PlayerState` hold replicated state. `PlayerController` turns input into server RPCs — intents. Pawns and Characters embody entities and drive presentation. Keep rules in the mode, subsystems, and components rather than in Blueprints of visual actors.
- **Loop.** Actor ticks run per frame with variable delta, ordered by tick groups (pre-physics, during, post-physics). Physics substepping or the fixed-step async physics tick stabilizes physics; a custom fixed-step simulation runs from a subsystem with its own accumulator.
- **Input.** Enhanced Input actions map devices to actions; the controller converts actions into intents.
- **Entity models.** Actors with components are composition. The Gameplay Ability System is a registered-variant model for abilities, attributes, and effects, with its own prediction keys. Mass provides ECS-style processing for crowds.
- **Data definitions.** Data Assets and Data Tables are read-only definitions; primary asset ids reference them from saves.
- **Assets.** Soft object references plus `FStreamableManager` async loads return a streamable handle that keeps assets resident until released — a lease. The Asset Manager and its bundles act as manifests; World Partition and level streaming handle regions.
- **Async lifetime.** Callbacks and latent actions capture `TWeakObjectPtr` and check validity before effects; actors are destroyed and worlds torn down during map travel while work is pending.
- **Saves.** A `USaveGame` subclass with `SaveGameToSlot` or its async variant. Store a version field and migrate in load code; store stable ids, not object pointers.
- **RNG.** `FRandomStream` with a seed owned by the simulation, not the global random functions.
- **Networking.** Property replication and Server, Client, and Multicast RPCs on a server-authoritative model. `CharacterMovementComponent` implements client prediction and server correction for characters; custom movement needs its own saved-move prediction, and hitscan lag compensation is project code. Physics is not deterministic across machines by default.

## three.js

- A renderer and scene graph, not a game engine: the project owns the loop (`renderer.setAnimationLoop`), the fixed-step accumulator, the asset cache, and disposal.
- Removing an object from the scene does not free GPU memory. Dispose geometries, materials, textures, and render targets explicitly through the scene's cleanup stack.
- Loaders return object trees; record every disposable they create so the owning scene can release them.
- Build the next level's object tree detached, then add it to the live scene in one step — prepare and commit.
- Picking with a raycaster returns objects; store the entity id in `userData` and send the id to the UI.

## Babylon.js

- The engine owns the render loop (`engine.runRenderLoop`); `scene.onBeforeRenderObservable` is the per-frame presentation hook. Run the fixed-step accumulator there, or configure the physics plugin's time-step settings instead of stepping with raw frame delta.
- `AssetContainer` loads meshes, materials, and animations without adding them to the scene: `addAllToScene()` is the commit, `dispose()` drops a failed candidate, `removeAllFromScene()` detaches without destroying.
- Dispose meshes, materials, and textures explicitly; check `isDisposed()` on engine objects captured before an await.

## PixiJS

- A 2D renderer and scene graph. The `Ticker` delivers variable frame delta: build the accumulator on it and step the simulation from there.
- `Assets.load` and `Assets.unload` manage a keyed cache without per-scene reference counts; wrap them in leases so shared textures survive scene changes and unused ones unload.
- Destroy display objects and their textures explicitly (destroy options control whether textures and sources go too).
- Pointer events on display objects return the object; map it to the entity id for intents.

## Phaser

- Scenes have a lifecycle (`init`, `preload`, `create`, `update(time, delta)`) and their own loader, clock, and event emitter. `update` delta is variable: accumulate it for a custom simulation step.
- Arcade Physics steps at a fixed rate set in the physics config, independent of rendering; use it, or keep rules in your own fixed-step simulation and use physics only for queries.
- `scene.start` shuts the current scene down and runs the target at the next Scene Manager update, not immediately, so the old scene cannot be kept as a fallback. For a rollback point, load the next scene's assets first (a loading scene or a loader queue) and start the target scene only after loading succeeded.
- The texture manager is global: textures outlive the scene that loaded them until removed. Release scene-owned keys on the scene's `shutdown` event.
- Scene timers and tweens are scene-owned (cleared at shutdown) but run on the scene clock, not simulation ticks; use them for presentation only.
- `Phaser.Math.RandomDataGenerator` accepts seeds; give the simulation its own instance.

## Web platform notes

- `requestAnimationFrame` supplies a high-resolution timestamp and pauses in hidden tabs; handle `visibilitychange` ([game-loop-and-time.md](game-loop-and-time.md#background-visibility-and-suspend)).
- A heavy simulation can run in a Web Worker: intents go in, snapshots come out (transfer `ArrayBuffer`s for large state). `OffscreenCanvas` moves rendering to a worker too.
- Saves: IndexedDB transactions are atomic; request persistent storage for long games and offer export.
- An `AudioContext` starts suspended until a user gesture; resume it on the first input.
- There is no API for GPU memory use; track texture and buffer sizes in the asset cache against your own budget.
- JavaScript numbers are doubles: basic arithmetic and integer bit operations are portable across engines; `Math` trigonometric and exponential functions are not guaranteed identical across browsers.

## Lifetime check after await in C# and GDScript

The same rule as the TypeScript sketch in [scene-and-asset-lifecycle.md](scene-and-asset-lifecycle.md#async-work-across-lifetimes): capture before the suspension point, check the owner after it, then run effects.

```csharp
// Unity: the token cancels when the component is destroyed
async Awaitable SaveAsync(Session session, CancellationToken ct) {
    var snapshot = session.Sim.Snapshot();                 // capture first
    await storage.WriteAtomicAsync(session.Slot, snapshot); // let the write finish
    if (ct.IsCancellationRequested || session.Disposed) return;
    session.Ui.ShowStatus("Saved");
}
```

```gdscript
# Godot
func save(session: Session) -> void:
    var snapshot := session.sim.snapshot()
    await storage.write_atomic(session.slot, snapshot)
    # Godot never resumes a coroutine whose own instance was freed; check what the effect touches.
    if session.disposed or not is_instance_valid(session.ui) or not session.ui.is_inside_tree():
        return
    session.ui.show_status("Saved")
```

## Code-first and custom engines

Bevy, MonoGame, Defold, Love2D, and in-house C++ engines usually give a loop callback and leave scenes, assets, and saves to the project, so the "rendering library" branch of the first decision tree applies: write the accumulator, the asset leases, and disposal once, outside gameplay code. Bevy's fixed-timestep schedule is the fixed step and its ECS world holds the simulation; MonoGame calls `Game.Update` at a fixed `TargetElapsedTime` by default (`IsFixedTimeStep`) but provides no interpolation alpha, so keep the previous and current states and interpolate in `Draw` yourself, or switch to a variable step and run your own accumulator; after an await or deferred command, re-query the entity or handle, since a despawned entity makes the lookup fail instead of returning stale data.

## Mapping table

| Pattern | Unity | Godot | Unreal | three.js / PixiJS | Phaser | Babylon.js |
|---|---|---|---|---|---|---|
| Fixed simulation step | `FixedUpdate` | `_physics_process` | physics substeps or own accumulator in a subsystem | own accumulator | Arcade fixed step or own accumulator | physics plugin step or own accumulator |
| Presentation hook | `Update`, `LateUpdate` | `_process` | post-physics tick | animation-loop callback / `Ticker` | `update` | `onBeforeRenderObservable` |
| Prepare, then commit a scene | `LoadSceneAsync` with activation held, then allowed | threaded load + `instantiate`, then add to tree | async load + streaming, then spawn | build detached, then add | loader queue, then `scene.start` | `AssetContainer`, then `addAllToScene` |
| Lease and release | Addressables handle + release | resource references held by the scene | streamable handle | own cache + `dispose` / `destroy` | texture manager remove on `shutdown` | container and asset `dispose` |
| Lifetime check after await | `destroyCancellationToken`, `this == null` | `is_instance_valid` | `TWeakObjectPtr` validity | own disposed flag | scene shutdown flag | `isDisposed()` |
| Seeded simulation RNG | `System.Random` or `Unity.Mathematics.Random` instance | `RandomNumberGenerator` instance | `FRandomStream` | own PRNG | `RandomDataGenerator` instance | own PRNG |
