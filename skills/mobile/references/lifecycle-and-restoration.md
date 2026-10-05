# Lifecycle and State Restoration

Platform-neutral depth for SKILL.md rules 1–3. Platform APIs: [android.md](android.md), [ios.md](ios.md), [cross-platform.md](cross-platform.md).

## Contents

- [Lifecycle guarantees](#lifecycle-guarantees)
- [Why processes die](#why-processes-die)
- [Configuration changes and multiple windows](#configuration-changes-and-multiple-windows)
- [Scope hierarchy](#scope-hierarchy)
- [Designing what to save](#designing-what-to-save)
- [Navigation restoration](#navigation-restoration)
- [Drafts and in-flight work](#drafts-and-in-flight-work)
- [Async ownership patterns](#async-ownership-patterns)
- [Worked scenario implementation](#worked-scenario-implementation)
- [Testing process death](#testing-process-death)

---

## Lifecycle guarantees

| The OS normally provides | The OS does not promise |
|---|---|
| A background-entry callback before UI stops running | A terminate callback when it kills a backgrounded or suspended process |
| A short grace period after background entry | Any CPU time once the app is suspended or cached |
| A chance to write saved-instance state when UI may be destroyed | That the same process is alive when the user returns |
| Persisted scheduled work that survives process death (usually reboot too) | When that work runs, or that it runs before the user returns |
| Delivery of display notifications while the app is not running | Delivery or execution of silent/data messages |

Subscribe to lifecycle **states** ("at least visible") rather than single events. A component that attaches late reads the current state instead of waiting for an event it already missed.

## Why processes die

| Cause | Typical moment | What survives |
|---|---|---|
| Memory pressure | App backgrounded while the user opens the camera, a game, or a video call | Saved-instance state, persisted data, scheduled work |
| Permission revoked in Settings | User toggles a permission while the app is backgrounded; several platforms kill the process | Same as above; the restored screen now lacks the permission |
| OS or app update | Overnight install | Persisted data, scheduled work (job identifiers must stay stable) |
| User force-quit | Swipe away in the app switcher, or Force Stop | Persisted data; restoration state and scheduled work may be discarded |
| Crash | Anywhere | Persisted data only; saved-instance state may be stale |

The camera hand-off is the classic trap: on a low-memory device, returning from an external camera app lands in a fresh process. The result handler must be registered during screen creation, and the screen's state must come from saved state, not memory.

## Configuration changes and multiple windows

Triggers: rotation, window resize (split screen, freeform, desktop-style windowing), fold and unfold, dark mode, locale, font scale, display density, hardware keyboard attach.

- Rebuild views on every trigger; keep state in a holder that survives or restores.
- Read layout decisions from the current window size, not from a device type captured at launch.
- In multi-window, "visible but not focused" is common. Pause on *not visible* for media and live updates; pause on *not focused* only for input-sensitive work (games, capture).
- Key per-window state by window or scene instance. Process-wide singletons hold only process-wide things: database, HTTP client, signed-in session.

## Scope hierarchy

| Scope | Lives as long as | Put here | Keep out |
|---|---|---|---|
| View / composable | It is on screen | Animation state, focus, local toggles | Network calls |
| Screen state holder | The screen is in the back stack (survives configuration change) | Screen loads, form state, observation of repositories | References to views or windows |
| Navigation flow | A multi-step flow is active | State shared by flow steps (checkout, onboarding) | Data other flows need |
| Signed-in session | Sign-in to sign-out | User repositories, sync engine, per-user caches | Anything that must survive sign-out |
| App process | The process | Database, HTTP client, dependency graph | User data not keyed by user |
| Background job | Independent of the process | Persisted work definitions with IDs | References to in-memory objects |

A longer-lived scope must not hold a reference to a shorter-lived one. E.g., a repository that stores a screen's callback leaks the screen and later calls into a dead view.

## Designing what to save

For each screen, list its fields and classify them. Example — a "compose message" screen:

| Field | Category | Where it lives |
|---|---|---|
| Recipient IDs | Persisted (draft) | Draft row in the local database |
| Body text | Persisted (draft) | Draft row, written on debounce |
| Attachments | Persisted | Files copied into app storage, paths in the draft row |
| Cursor position | UI | Saved-instance state |
| "Sending" indicator | Derived | Computed from the outbox entry's status |
| Contact suggestions | Derived | Re-queried |

- Keep saved-instance state in the low kilobytes: IDs, short strings, enum values. Large saves fail at runtime or slow every background transition.
- Restore by ID, then validate:
  - not found (deleted elsewhere) → navigate up with a short message;
  - session expired → auth gate with the pending destination stored;
  - permission revoked → re-check before using the feature.
- Version anything persisted across app updates (drafts, saved routes) so a new build can read or discard an old shape deliberately.

## Navigation restoration

Restore the stack as a list of routes with ID arguments, never as view objects. Choose a policy per flow:

| Flow | Policy | Reason |
|---|---|---|
| Browsing (list → detail) | Restore | Cheap and expected |
| Multi-step form | Restore to the last completed step with the draft | Protects user effort |
| Payment confirmation | Restart at review; query the operation status by idempotency key first | External state may have advanced |
| One-time code or magic-link sign-in | Restart | Secrets expire |
| Camera or scanner | Restore the screen, not the capture session | The hardware session is gone |

After a long absence (hours or days), returning to the home screen can be less confusing than restoring a deep stack; pick a staleness threshold and apply it consistently. Some platforms already reset stale tasks on their own.

## Drafts and in-flight work

- Draft lifecycle: create on first edit → update on debounce → delete after the outbox accepts the send → keep on failure.
- One user action creates exactly one persisted operation. Repeat taps find the existing operation by key instead of creating another.
- A network request launched from a screen is lost with the process. If its effect matters after the screen is gone, it belongs in the outbox or background work, not in the screen.

## Async ownership patterns

Neutral sketch of a screen state holder:

```text
class OrderScreenState(scope, repository, savedState) {
  orderId = savedState["orderId"]                    // survives process death

  uiState = repository.observeOrder(orderId)         // stream from the local database
              .map(toUiState)
              .shareWhile(scope, visible)            // stops collecting when not visible

  refresh() = scope.launch { repository.refresh(orderId) }       // cancelled with the screen; result lands in the DB
  submit()  = repository.enqueueSubmit(orderId, newIdempotencyKey())  // outbox entry; outlives the screen
}
```

| Need | Pattern |
|---|---|
| A result should reach the UI if the UI still exists | Write it to the store; the UI observes |
| One-shot UI effect after async work (navigate, toast) | Model it as state the UI consumes and clears, so it is neither lost while invisible nor replayed on rotation |
| Wrap a callback-based platform API | Register in a cancellable wrapper whose cancellation unregisters the callback |
| Parallel loads for one screen | Structured child tasks with an explicit failure policy (fail all vs keep partial) |
| Slow or hanging calls | A timeout per call, sized to the operation |
| Work that outlives the screen | App or session scope while foregrounded; platform background work otherwise |

## Worked scenario implementation

Upload record state machine:

```text
queued ──▶ uploading(offset) ──▶ finalizing ──▶ done
   │            │    ▲
   │            ▼    │
   │      waiting_for_network
   ▼
failed(reason)          any active state ──▶ cancelled (user action)
```

| Field | Purpose |
|---|---|
| `id` | Local primary key; also the unique background-work name |
| `localPath`, `sizeBytes`, `contentHash` | The copied file and its integrity check |
| `idempotencyKey` | Sent on session creation and finalize; the server deduplicates |
| `serverSessionUrl`, `confirmedOffset` | Resumable session; the server's offset is authoritative, the local one a hint |
| `state`, `attempts`, `lastError` | Drives UI and retry policy |
| `ownerUserId` | Prevents uploading under another account after an account switch |

Background job, per run:

1. Load the record; stop if it is `done` or `cancelled`, or if its owner is not the signed-in user.
2. Stop with `failed(file_missing)` if the local file is gone.
3. Create a server session with the idempotency key if none exists; the server returns the same session for the same key.
4. Ask the server for the committed offset.
5. Send chunks from that offset; persist `confirmedOffset` after each acknowledged chunk; check cancellation between chunks.
6. Finalize with the idempotency key; store the server media ID; set `done`; delete the local copy per retention policy.
7. Return "retry" to the scheduler for transient errors (it applies backoff); set `failed(reason)` for permanent ones.

| Edge case | Handling |
|---|---|
| Double tap on Upload | Unique work name per record plus a disabled button; the second tap finds the existing record |
| Sign-out mid-upload | Cancel that user's jobs; decide discard vs resume at next sign-in; never send with another account's token |
| App updated mid-upload | Persisted job identifiers and worker names stay stable across releases, or a migration re-enqueues them |
| Source deleted from the gallery | The copy made at enqueue time protects it |
| Server session expired | New session with the same idempotency key; restart from offset 0 |
| Metered network | Constraint or user setting ("Wi-Fi only"); UI shows "waiting for Wi-Fi" |
| User force-quit | Some platforms cancel scheduled work and system transfers; reconciliation re-enqueues on next launch |
| Disk full while copying | Fail before creating the record and tell the user |

**Launch reconciliation** is the safety net: a startup task compares records in active states with the platform's scheduled work and re-enqueues orphans. It absorbs most platform quirks in one place.

## Testing process death

1. Open the screen and create state: scroll, type a draft, advance to step 3.
2. Send the app to the background.
3. Kill the process the way the OS does — not a user force-quit, which discards restoration state on some platforms. Commands: [android.md](android.md#testing-commands), [ios.md](ios.md#testing-commands).
4. Relaunch from recents or the app switcher.
5. Assert: same screen and IDs, draft present, content reloaded, no duplicate operations.

Automate at three levels:

| Level | What it proves |
|---|---|
| Unit | The state holder round-trips its saved state and reloads by ID |
| UI test with a restoration tester | Saveable UI state survives save-and-restore |
| Device or emulator script in CI | Background, kill, relaunch, assert — the full path including navigation |

A configuration-change test ("recreate", rotation) keeps the process alive, so in-memory singletons survive it; it never substitutes for step 3.
