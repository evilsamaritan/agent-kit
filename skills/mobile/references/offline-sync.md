# Offline-First Sync

Depth for SKILL.md rule 4 and the conflict-policy decision tree. Server-side contracts (change feeds, versioning) are designed with `api-design`; collaborative data types with `realtime`. The outbox pattern itself (transactional write plus relay) is in `architecture` ([integration-patterns.md](../../architecture/references/integration-patterns.md)); this reference covers the client side.

## Contents

- [Architecture](#architecture)
- [Write path and the outbox](#write-path-and-the-outbox)
- [Idempotency](#idempotency)
- [Ordering and dependencies](#ordering-and-dependencies)
- [Retry and backoff](#retry-and-backoff)
- [Sync triggers and scheduling](#sync-triggers-and-scheduling)
- [Read sync and delta pulls](#read-sync-and-delta-pulls)
- [Conflict resolution](#conflict-resolution)
- [Local schema migrations](#local-schema-migrations)
- [Sync status UX](#sync-status-ux)
- [Storage, eviction, and multiple users](#storage-eviction-and-multiple-users)
- [Testing sync](#testing-sync)

---

## Architecture

```text
            observe                       apply pulled changes
   UI ◀────────────────── Local store ◀──────────────────────┐
    │                    (source of truth)                     │
    │ write                    ▲                               │
    ▼                          │ same transaction        Sync engine ◀──▶ Server
 Repository ───────────────────┴──▶ Outbox ───── drain ──────▶ │
                                                               ▲
                     triggers: write, foreground, connectivity, schedule, push hint
```

- The repository is the only writer on the app side; screens never write the store or call the network directly for synced entities.
- The sync engine has two halves: **push** drains the outbox; **pull** applies server changes. One engine instance per signed-in user.

## Write path and the outbox

In one local transaction:

1. Apply the change to the entity table and mark the row `pending`.
2. Insert an outbox row describing the operation.

| Outbox column | Purpose |
|---|---|
| `id` (monotonic) | Ordering |
| `idempotencyKey` | Server-side deduplication; generated here, reused on every retry |
| `entityType`, `entityId` | Grouping, coalescing, per-entity ordering |
| `operation` | `create`, `update`, `delete`, or a domain command |
| `payload` | The intent, versioned like any persisted format |
| `baseVersion` | Server version the edit was based on — conflict detection |
| `dependsOn` | Cross-entity ordering (parent before child) |
| `status` | `pending`, `in_flight`, `failed`, `conflict`, `blocked` |
| `attempts`, `nextAttemptAt`, `lastError` | Retry policy and user-visible errors |
| `userId` | Account isolation |

**Commands over snapshots.** Send intent ("add item X, quantity 2") instead of final state ("cart = [...]") when the server can apply commands; commands merge where snapshots conflict.

**Coalescing** entries that are not yet in flight:

| Sequence | Becomes |
|---|---|
| update + update | One update with the latest field values |
| create + update | One create with final values |
| create + delete (create never sent) | Nothing |
| update + delete | One delete |

## Idempotency

The pattern (claim first, then process; keys derived from intent, never from time) is owned by [idempotency-patterns.md](../../message-queues/references/idempotency-patterns.md); the client rules:

- Generate the key when the operation is created, not when it is sent; a retry after a crash must reuse it.
- The server stores key → result for longer than the client's maximum retry age and returns the stored result on a repeat.
- Prefer client-generated entity IDs (UUIDs). They remove temporary-ID remapping. If the server assigns IDs, keep a temporary → server ID map and rewrite dependent outbox entries when the create succeeds.
- Finalize steps of multi-step operations (upload finalize, checkout confirm) carry the same key as the start step.

## Ordering and dependencies

- Keep FIFO order per entity; across entities, honor `dependsOn`.
- Block only the dependents of a failed entry, not the whole queue. Head-of-line blocking lets one bad record stop all sync.
- Allow one in-flight operation per entity, with bounded parallelism across entities (two to four).
- When the server offers a batch endpoint, expect per-item results and handle partial success.

## Retry and backoff

| Outcome | Class | Action |
|---|---|---|
| No route, DNS failure | Offline | Wait for the connectivity trigger; do not burn attempts |
| Timeout, connection reset, 502/503/504, 408, 429 | Transient | Backoff; honor `Retry-After` |
| 401 | Auth | Refresh the token once and retry; if refresh fails, pause sync and ask the user to sign in |
| 409, 412 | Conflict | Run the entity's conflict policy |
| Other 4xx (400, 422, 413) | Permanent | Mark `failed`; show the error with an action (edit, discard) |
| 403 | Permanent | Mark `failed`; usually a permission change on the server |
| 404 on update or delete | Domain decision | Delete: treat as done. Update: conflict with a server-side delete |

Retry policy (which errors, jitter, budgets, the idempotency precondition) is owned by `reliability`; the mobile mapping:

Backoff with full jitter: `delay = random(0, min(cap, base × 2^attempt))`. Typical values: base of a few seconds, cap of 15–60 minutes, stop after a maximum attempt count or age (e.g., several days) and surface the failure.

Platform job schedulers already apply backoff to retried jobs. Use one backoff loop — either the scheduler's or the engine's — not both nested.

## Sync triggers and scheduling

| Trigger | Action |
|---|---|
| Local write | Debounce briefly, then push |
| App foreground | Push, then pull |
| Connectivity regained | Push and pull, debounced — connectivity callbacks flap |
| Scheduled background job (network constraint) | Push and pull |
| Push notification | Pull; treat as a hint, not data |
| Pull-to-refresh | Pull and report the result |

- Run a single sync at a time; a trigger during a run sets a "run again" flag.
- "Connected" does not mean "reachable" (captive portals, dead Wi-Fi). Treat request outcomes as the truth and connectivity events as hints.

## Read sync and delta pulls

- Pull changes since a server-issued cursor: the response contains upserts, tombstones, and the next cursor. Store the cursor in the same transaction that applies the page.
- Require tombstones for deletes; without them deleted rows live forever on devices. If the client's cursor is older than the server's tombstone retention, fall back to a full resync.
- Keep a full-resync path for cursor expiry, local schema changes, and detected corruption.
- Never overwrite a row that has pending outbox entries. Rebase: take the server version as the new base, re-apply the pending intent, or mark a conflict.
- Apply pages atomically; a crash mid-page restarts from the stored cursor.
- Scope what syncs (recent items, subscribed folders); fetch the rest on demand when online.

## Conflict resolution

Detect conflicts with optimistic concurrency: the client sends `baseVersion`; the server rejects the write when its current version differs. Use server-assigned versions or hybrid logical clocks — device clocks are wrong or user-adjustable and must not decide order.

| Policy | Mechanism | Fits | Cost |
|---|---|---|---|
| Last-writer-wins | Server orders writes by its own version | Settings, single-owner records | Concurrent edits silently lost |
| Server-authoritative | Reject stale writes; client refetches and revalidates; user retries | Stock, balances, bookings, invariants | Friction on conflict |
| Field-level merge | Per-field versions; non-overlapping fields merge; overlapping fields use LWW or ask | Profiles, forms | Metadata per field |
| Command merge | Server applies commutative commands (increment, add-to-set) | Counters, carts, tags | Command design on both sides |
| CRDT | Convergent data types merge without coordination | Collaborative text, shared lists edited offline | Library and storage overhead; see `realtime` |
| Ask the user | Show both versions with a choice | High-value documents | UX effort |

Decide explicitly whether an edit resurrects a deleted record or the delete wins, and apply the rule on both client and server.

## Local schema migrations

- Ship incremental migrations (version N → N+1). Run them at startup before any query, off the main thread, with a progress screen when they can be slow.
- Keep a fixture database for every schema version still installed in the field; CI migrates each to the current version and checks integrity and pending outbox entries.
- Reserve destructive "drop and recreate" fallbacks for pure caches; on user data they delete unsynced work.
- Version the outbox payload format too; a new build must read entries written by the previous one.
- Detect a database newer than the code (downgrade via sideload or enterprise rollback) and fail safe rather than corrupt it.
- Run large data migrations in resumable batches.

## Sync status UX

| State | Item | Global |
|---|---|---|
| Synced | Nothing | Optional "last synced" time |
| Pending | Subtle pending marker | Count of unsent changes |
| Syncing | — | Unobtrusive progress |
| Failed | Error marker with edit / retry / discard | Banner with count |
| Conflict | Marker leading to a resolution view | Banner |
| Offline | — | Offline banner; local actions still allowed |

- Keep reads and local edits available offline; disable only actions that need a live answer (payment, availability check) and say why.
- Warn before sign-out when changes are unsent.

## Storage, eviction, and multiple users

- Bound caches and evict least-recently-used entries; never evict pending outbox entries or unsynced user data.
- Store media as files with metadata rows; sweep orphaned files on a schedule.
- Partition by user (a database file per user, or `userId` on every row). Delete the partition on sign-out; never mix accounts on switch.
- Encrypt at rest when the threat model requires it, with the key in secure storage. Exclude device-key-encrypted databases from cloud backups — restored ciphertext is unreadable on a new device.

## Testing sync

| Scenario | Expected |
|---|---|
| Write offline, reconnect | Exactly one server record |
| Timeout after the server committed, then retry | No duplicate (idempotency key) |
| Process killed with a request in flight | Relaunch retries with the same key |
| Two devices edit the same record offline | The entity's policy produces the documented result |
| Delete on one device, edit on another | The documented delete/edit rule holds |
| Permanent validation failure | Visible to the user; other entries keep syncing |
| 401 mid-drain | Token refresh, then continuation |
| Expired cursor | Full resync without data loss |
| Upgrade from each shipped schema with pending entries | Entries survive and send |
| Flapping connectivity | One sync run at a time, no request storms |
| Device clock set years off | Ordering unaffected |

Drive these with a fake server that injects latency, errors, and dropped responses after commit.
