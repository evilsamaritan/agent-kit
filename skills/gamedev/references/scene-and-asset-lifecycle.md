# Scene and Asset Lifecycle

Who owns what for how long: sessions, scenes, assets, GPU resources, and async work that outlives its owner.

## Contents

- [Lifetimes and owners](#lifetimes-and-owners)
- [Prepare, commit, roll back](#prepare-commit-roll-back)
- [Ownership transfer and cleanup stacks](#ownership-transfer-and-cleanup-stacks)
- [Loading state instead of loading flags](#loading-state-instead-of-loading-flags)
- [Async work across lifetimes](#async-work-across-lifetimes)
- [Asset manifests and loaders](#asset-manifests-and-loaders)
- [Leases and reference counting](#leases-and-reference-counting)
- [GPU resources and context loss](#gpu-resources-and-context-loss)
- [Streaming large worlds](#streaming-large-worlds)
- [Budgets](#budgets)
- [Pools and generational ids](#pools-and-generational-ids)
- [Hot reload in development](#hot-reload-in-development)

---

## Lifetimes and owners

| Lifetime | Typical contents | Owner that disposes |
|---|---|---|
| Application | settings, asset cache, audio engine, platform services, renderer device | app shell, on quit |
| Session or match | simulation, save slot, network connection, session event bus | session manager, on leaving to the menu |
| Scene or level | scene graph, asset leases, pools, scene timers, physics world | scene manager, after the next scene commits |
| Entity | its components, presentation node, pooled object | the operation that destroys it |
| Frame | scratch buffers, per-frame allocations | reused next frame |

Every resource belongs to exactly one row and one owner. A resource that no row claims is a leak; a resource two rows dispose is a double free.

## Prepare, commit, roll back

```text
ready(previous) ──changeScene──▶ preparing ──success──▶ committing ──▶ ready(next)  → dispose previous
                                     │
                                     └──failure or superseded──▶ dispose candidate → ready(previous)
```

- **Prepare** off to the side: read the manifest, acquire leases, decode, build the scene graph detached from the live one, create the simulation for the level, warm shaders if the engine allows. Nothing the player sees changes.
- **Commit** in one short synchronous step: swap the active scene reference, attach the graph, hand input to the new scene. Code that can fail runs during preparation, not here.
- **Dispose the previous** scene after commit, not before: a failed preparation leaves it intact and interactive.
- **Roll back** on failure or supersession: dispose the candidate and everything it acquired, report the error in the still-active scene.

Variants:

- **Loading screen** — an app-owned overlay shown during preparation, not a scene that both sides must coordinate with. It hides when the commit completes or the preparation fails.
- **Additive scenes and sublevels** — the same rules per chunk: prepare detached, attach in one step, detach and dispose on unload.
- **Restart level** — prepare a fresh simulation from the level data rather than resetting the live one field by field; partial resets leave stale state behind.

## Ownership transfer and cleanup stacks

Collect cleanups as they are acquired so a failure at any step releases exactly what was taken.

```ts
class CleanupStack {
  #items: (() => void)[] = []
  add(cleanup: () => void) { this.#items.push(cleanup) }
  dispose() { while (this.#items.length) this.#items.pop()!() }   // reverse acquisition order
  transfer(): CleanupStack { const next = new CleanupStack(); next.#items = this.#items; this.#items = []; return next }
}

async function prepareScene(id: SceneId, signal: AbortSignal): Promise<Scene> {
  const cleanup = new CleanupStack()
  try {
    const manifest = await manifests.get(id, signal)
    const leases = await acquireAll(manifest.assets, signal)
    cleanup.add(() => leases.forEach(lease => lease.release()))
    const graph = buildDetachedGraph(manifest, leases)
    cleanup.add(() => graph.dispose())
    const sim = createSimulation({ level: manifest.level, seed: manifest.seed })
    return new Scene(graph, sim, cleanup.transfer())   // the scene now owns every cleanup
  } catch (error) {
    cleanup.dispose()                                   // nothing transferred: release what was acquired
    throw error
  }
}
```

Parallel acquisition needs the same care. `Promise.all` rejects on the first failure and drops the leases that already succeeded:

```ts
async function acquireAll(keys: readonly string[], signal: AbortSignal): Promise<Lease[]> {
  const results = await Promise.allSettled(keys.map(key => assets.acquire(key, signal)))
  const leases = results.flatMap(r => (r.status === "fulfilled" ? [r.value] : []))
  const failure = results.find(r => r.status === "rejected")
  if (failure) { leases.forEach(lease => lease.release()); throw (failure as PromiseRejectedResult).reason }
  return leases
}
```

Language equivalents: `DisposableStack` and `using` declarations in modern JavaScript, `try/finally` or `IDisposable` in C#, destructors and RAII in C++ and Rust. The rule is the same: one holder at a time, transfer exactly once.

## Loading state instead of loading flags

Booleans multiply: `isLoading`, `isTransitioning`, `inputLocked`, `spinnerVisible`, each reset (or forgotten) on a different path. Derive them from one state value set in one place:

```ts
type SceneState =
  | { phase: "ready"; active: Scene }
  | { phase: "preparing"; active: Scene; target: SceneId; generation: number }
  | { phase: "failed"; active: Scene; error: LoadError }

const inputLocked = (s: SceneState) => s.phase === "preparing"
```

Every exit from `preparing` — success, failure, cancellation, supersession — goes through `finally` and sets the phase.

## Async work across lifetimes

An `await` is a point where the owner may have died. Sessions end, scenes change, entities are destroyed, matches restart.

**Detecting departure:**

- A `disposed` flag on a session or scene object that never restarts.
- A generation counter on a long-lived manager whose subject changes (the scene manager, a session that restarts a level in place). Capture it before the await, compare after.
- A cancellation signal (`AbortSignal`, cancellation token) passed into the work, aborted by the owner's `dispose`.
- Engine validity checks for engine objects ([engines.md](engines.md)).

**What to do when the owner is gone:**

| Effect after the await | Action |
|---|---|
| Durable I/O already started (save write, cloud upload) | let it finish; skip everything after it |
| UI status, toast, sound, haptics | skip |
| Event onto the session bus | skip — the bus may already belong to a new session |
| Mutating session, scene, or entity state | skip — the object is disposed |
| Result useful beyond the owner (asset now cached) | keep it in the app-level cache; the departed scene's lease is released |
| Network reply tagged with an old session or match id | drop; count it in development metrics |

**Scene-scoped scheduling:** create timers, tweens, and coroutines through the scene (`scene.timers.after(...)`) so disposal cancels them. A raw global timer started by a scene outlives it.

## Asset manifests and loaders

- A manifest lists each scene's assets and their dependencies (a material's textures, a prefab's meshes), generated by the build, so preparation knows the full set and can report real progress.
- The loader deduplicates in-flight requests: the second request for a key gets the first one's promise.
- Failure policy per asset class: a missing required mesh fails the scene; a missing optional cosmetic falls back to a placeholder and logs.
- Retries with backoff for network-loaded assets (web, streamed content); a failed entry is evicted so the next attempt reloads instead of returning the cached rejection.
- Decoding (images, audio, compressed geometry) runs off the main thread where the platform allows.

## Leases and reference counting

```ts
interface Lease<T = Asset> { readonly asset: T; release(): void }

class AssetCache {
  #entries = new Map<string, { refs: number; value: Promise<Asset> }>()

  async acquire(key: string, signal?: AbortSignal): Promise<Lease> {
    let entry = this.#entries.get(key)
    if (!entry) {
      entry = { refs: 0, value: this.loader.load(key) }      // one load per key
      this.#entries.set(key, entry)
    }
    entry.refs++
    try {
      const asset = await entry.value
      signal?.throwIfAborted()
      let released = false
      return { asset, release: () => { if (!released) { released = true; this.#release(key) } } }
    } catch (error) {
      this.#release(key)                                     // a failed or cancelled acquire returns its reference
      throw error
    }
  }

  #release(key: string) {
    const entry = this.#entries.get(key)
    if (entry && --entry.refs === 0) this.#scheduleUnload(key)   // grace period, then dispose and delete
  }
}
```

- Releasing twice is harmless for the same lease and impossible to do by accident across leases.
- A grace period (or a small LRU of zero-reference assets) avoids unloading and reloading shared assets between adjacent scenes.
- In development, report outstanding leases by owner when a scene disposes; a non-empty report is a leak with a name attached.
- Engine reference systems (asset handles, streamable handles, resource caches) are the same mechanism; wrap them so scene code holds leases, not raw handles ([engines.md](engines.md)).

## GPU resources and context loss

- GPU memory (textures, vertex and index buffers, render targets, shader programs) is not reliably reclaimed by garbage collection. Dispose explicitly when the owning lease or node goes away.
- Removing a node from the scene graph detaches it; it does not free its GPU resources in most rendering libraries.
- Graphics contexts can be lost (driver reset, tab backgrounded on mobile, device change). Stop rendering on loss; on restore, recreate GPU resources from CPU-side asset data or reload them. The simulation is unaffected — one more reason it holds no GPU handles.
- Render targets sized to the window are recreated on resize; dispose the old ones.

## Streaming large worlds

- Partition the world into regions or cells with their own manifests.
- Load cells within a load radius and unload beyond a larger unload radius (hysteresis) so a player on a boundary does not thrash.
- Prioritize by distance and direction of travel; cancel requests for cells that left the load radius before they finished.
- Budget commits per frame (instantiate N objects per frame) so streaming never spikes frame time.
- Decide what the simulation does in unloaded cells: freeze, run a coarse simulation, or compute the result from elapsed ticks on reload (crops grown, timers expired). Write the decision down per system.

## Budgets

| Budget | Measured by | Typical enforcement |
|---|---|---|
| Memory per platform (textures dominate) | asset reports from the build, runtime counters | per-scene limits checked in CI; texture compression and mip settings per platform |
| Download or install size | build output | per-release limit; streamed or on-demand packs |
| Draw calls, triangles, materials | renderer statistics in a benchmark scene | per-scene limits; batching, atlases, instancing |
| Load time | timed scene transitions on target hardware | per-transition limit; preloading during menus |

Numbers come from the weakest target device. Measure, then set the budget with headroom; profiling method → `performance`.

## Pools and generational ids

- Pool objects spawned and destroyed often (projectiles, hit effects, enemies in waves). The pool belongs to the scene and disposes with it.
- Reset pooled objects completely through one reset function per pooled type; a field left from the previous use is a bug that appears only after reuse.
- Use generational ids (slot index plus generation) for pooled entities: reusing slot 12 increments its generation, so a stale reference to the previous occupant fails the lookup instead of hitting the new one.

## Hot reload in development

- Watch asset and data-definition files; on change, reload into the cache under the same key and let renderers rebind.
- Reference data definitions by id from instances. Instances that copied stats at spawn keep old values after a reload; decide per field whether it is live (read from the definition each time) or captured.
- Keep simulation state as plain data so reloaded code can keep running against it.
- Gate watchers and reload hooks behind development builds; a file watcher in a shipped build is wasted work and an attack surface.
