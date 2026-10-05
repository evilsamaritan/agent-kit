# Saves and Determinism

What a save contains, how it survives schema changes and crashes, and what it takes for the same inputs to produce the same game.

## Contents

- [What to save](#what-to-save)
- [Envelope and sections](#envelope-and-sections)
- [Section codecs and polymorphic records](#section-codecs-and-polymorphic-records)
- [Migration](#migration)
- [Atomic writes and slots](#atomic-writes-and-slots)
- [Autosave](#autosave)
- [Loading and validation](#loading-and-validation)
- [Cloud saves and conflicts](#cloud-saves-and-conflicts)
- [Determinism levels](#determinism-levels)
- [Seeded randomness](#seeded-randomness)
- [Time and ordering](#time-and-ordering)
- [Floating point](#floating-point)
- [Replays and desync detection](#replays-and-desync-detection)
- [Testing with determinism](#testing-with-determinism)

---

## What to save

| Data | Save? | Reason |
|---|---|---|
| Entity state: health, position, inventory, statuses with remaining ticks | yes | source of truth |
| Id allocator state and entity ids | yes | references and future spawns stay stable |
| Tick counter, RNG state per stream | yes | resumes deterministically |
| Progression: quest flags, unlocks, world changes | yes | source of truth |
| Derived indexes: spatial hash, team lists, lookup maps | no — rebuild on load | a second copy of the truth drifts |
| Data definitions: stat tables, prefabs | no — reference by id | balance patches apply; saves stay small |
| Scene nodes, animation frames, particles, camera smoothing | no | presentation rebuilds from the model |
| Settings: volume, key bindings, graphics | separate file | not part of a playthrough |
| Mid-resolution transient state (a combo half-applied) | avoid | save only at safe points |

## Envelope and sections

```ts
interface SaveFile {
  format: "save"                 // rejects files that are not saves at all
  version: number                // envelope schema version
  build: string                  // game build that wrote it, for diagnostics
  checksum: string               // over the serialized data
  data: {
    tick: number
    rng: Record<string, RngState>
    ids: IdAllocatorState
    sections: Record<string, { version: number; payload: unknown }>
  }
}
```

Per-section versions let each system evolve its schema on its own schedule. The envelope version changes only when the envelope itself does.

## Section codecs and polymorphic records

```ts
interface SectionCodec<T> {
  key: string                                // persisted identifier — stable, not a runtime class name
  version: number
  write(world: WorldView): T
  read(builder: WorldBuilder, payload: T): void
  migrations: Record<number, (old: unknown) => unknown>   // from version N to N + 1
  empty(): T                                 // default when an older save lacks this section
}
```

- The orchestrator iterates registered codecs: write all, read all. It knows keys and versions, never fields.
- A section missing from an older save (a system added later) reads from `empty()`.
- A section present in the save but unknown to the build (a removed system) is dropped with a log entry, or kept verbatim if the game supports downgrades.
- Polymorphic records (entities of many kinds) carry a stable kind tag (`"burrower"`). On read, the tag selects the registered kind codec; that codec owns the payload. Renaming a class must not change the tag.
- References between records are ids, never positions in an array that may reorder.

## Migration

- Migrations are pure functions over plain data (parsed JSON or equivalent), never over live runtime classes, which change with the code they would migrate.
- Chain them: v1 → v2 → v3. A save from any shipped version reaches the current one by applying each step.
- Commit a fixture save from every shipped version. The test loads each, migrates, validates, and steps the simulation 100 ticks without error.
- A save newer than the build (downgrade, rollback of a release, cloud sync from a newer device) is refused with a message and never overwritten.
- Keep the pre-migration file until the migrated save has been written successfully once.

## Atomic writes and slots

A crash, power loss, or forced quit during a write must leave the previous save loadable.

- **Files** — write `slot1.tmp`, flush to disk, rename over `slot1.sav`. Rename is atomic on common file systems; on platforms where replacing an existing file is not, use the platform's replace API. Keep the previous file as `slot1.bak`.
- **Two-slot rotation** — write to the older of two slots with a sequence number and checksum; load the newest slot whose checksum verifies.
- **Browser** — an IndexedDB transaction commits all-or-nothing; `localStorage` is synchronous and small, acceptable for tiny saves. Storage can be evicted under pressure: request persistent storage and offer export for long games.
- **Platform save APIs** (consoles, mobile cloud saves) — follow their commit semantics, size limits, and write-frequency rules; certification often specifies them.
- **Checksums** detect truncation and corruption; on mismatch, fall back to the backup and tell the player.

## Autosave

- Trigger at checkpoints, level ends, before risky moments (a boss door), on a play-time interval, and on app backgrounding on mobile.
- Take the snapshot only at a safe point: between ticks, outside scene transitions, with no multi-step resolution pending. If a trigger arrives at an unsafe moment, set `autosaveDue` and take it at the next safe point.
- Snapshot synchronously (cheap for small worlds; incremental or copy-on-write for large ones), then serialize, compress, and write off the main thread.
- Throttle, show a non-blocking indicator, and never overwrite the player's manual slots.
- After the write completes, check the session is still alive before showing status ([scene-and-asset-lifecycle.md](scene-and-asset-lifecycle.md#async-work-across-lifetimes)).

## Loading and validation

1. Parse the envelope; check `format` and the checksum.
2. Migrate each section to the current version.
3. Validate: ranges, required fields, every id reference resolves.
4. Build the simulation through codecs; rebuild derived indexes.
5. Run the invariant check.
6. Commit as the new session with the prepare/commit pattern; a failed load keeps the current session.

- References to content removed by a patch (a deleted item id) follow a written policy per codec: drop with compensation, or replace with a placeholder.
- Treat save files as untrusted input. Never use a serialization format that can instantiate arbitrary types or execute embedded code when reading a save; players edit, share, and download them.
- For online economies and competitive progress, the server owns the state; a local save is a cache.

## Cloud saves and conflicts

- Detect conflicts by comparing a per-device sequence or progress marker, not file timestamps.
- When two devices progressed independently, show both (play time, location, last played) and let the player choose. Never silently merge two playthroughs.
- Keep the losing save as a backup for a while.

## Determinism levels

| Level | Guarantees | Requires | Used for |
|---|---|---|---|
| None | nothing | still inject time and RNG | casual single-player |
| Same build, same platform | identical results from identical inputs | fixed step, seeded RNG owned by the simulation, stable iteration order, no wall clock, no data races | replays, bug reproduction, golden tests |
| Cross-machine | identical results on every player's machine | the above plus controlled math, identical builds and data, inputs-only sync, checksum exchange | lockstep, rollback netcode |

Decide the level early. Raising it later means auditing every system for time, randomness, ordering, and math.

## Seeded randomness

```ts
// mulberry32: a small seedable PRNG with 32-bit state; any PRNG with saveable state works
function createRng(seed: number) {
  let state = seed >>> 0
  return {
    next(): number {                          // [0, 1)
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    int(maxExclusive: number): number { return Math.floor(this.next() * maxExclusive) },
    save: (): number => state,
    restore(saved: number) { state = saved >>> 0 },
  }
}
```

- The simulation owns its generators and saves their state. Global generators (language or engine `random()`) are shared with code you do not control.
- Split streams per subsystem, each seeded from the match seed and a stream name (`hash(seed, "loot")`). Adding a roll to combat then leaves loot outcomes unchanged, which keeps replays and design tuning stable.
- Cosmetic randomness (particle spread, idle animation offsets) uses a separate generator that the simulation never reads.
- For larger state spaces or statistical quality, use a stronger PRNG (xoshiro, PCG); the ownership rules do not change.

## Time and ordering

- Time inside the simulation is the tick counter. Durations are tick counts, converted from design seconds once at load.
- Iterate entities in id order or in an insertion order the language guarantees. Hash-map iteration order is unspecified or randomized in many languages; sort keys or use ordered containers.
- Run systems in an explicit, fixed list. Registration order that depends on module import order is fragile.
- Sort with total comparators that break ties by id. Unstable sorts and equal keys reorder between runs or platforms.
- Do not sort or compare simulation strings with locale-aware comparison; results change with the player's locale.
- Parallel systems must not race on shared writes. Partition the data, or collect results and reduce them in a fixed order.
- Keep these out of the simulation: wall clock, frame delta, the completion order of async work (assets finishing loading), engine physics not built for determinism, and platform locale.

## Floating point

- The same binary on the same CPU family and instruction path usually reproduces float results. Different compilers, optimization flags (fused multiply-add contraction, fast-math), architectures, or JIT engines may not.
- In JavaScript, arithmetic and square root are correctly rounded and portable across engines; trigonometric, exponential, and power functions are implementation-approximated and can differ between browsers. Integer operations (`Math.imul`, bit operations) are exact.
- Cross-machine options: fixed-point integers for positions and velocities (for example 16.16), trigonometry from lookup tables or functions built only from basic arithmetic, or a deterministic math library. Integer-only physics is the common choice for lockstep strategy games.
- Engine physics is usually not deterministic across machines; check the engine's documented guarantees before building lockstep or rollback on it.

## Replays and desync detection

- Record the build id, data version, seed, starting state or level id, and intents per tick (only ticks that have intents).
- Replay by feeding the same intents into a fresh simulation on the same build; compare checksums every N ticks against the recorded ones.
- Compute checksums over a canonical serialization of simulation state (ordered, quantized), never over memory layout or presentation state.
- On a mismatch, dump per-system checksums at the failing tick to find which system diverged, then bisect by tick.
- In lockstep, peers exchange checksums every N ticks; a mismatch stops the match or triggers a resync, and the state dump goes to a bug report.
- Replays are tied to a build. Version-tag them; when rules change, regenerate golden replays deliberately rather than accepting a new checksum silently.

## Testing with determinism

- Run the same scenario twice in one process and in two processes; checksums must match.
- Run it at different render frame rates (or with random frame deltas fed to the loop); the simulation checksum must not change. This proves the simulation is frame-independent.
- Property tests report their seed on failure so the failing intent sequence replays exactly.
- Keep golden replays in CI; a changed checksum blocks the build until someone confirms the rule change was intended.
