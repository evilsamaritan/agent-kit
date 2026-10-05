---
name: mobile
description: "Build or review mobile apps (Android, iOS, React Native, Flutter, KMP). Use for app lifecycle, background/foreground, process death, state restoration, offline sync, push notifications, deep links, permissions. Do NOT use for language idioms (kotlin, javascript), accessibility, or UX (design)."
user-invocable: true
---

# Mobile Engineering

The operating system owns the process. It starts, pauses, freezes, and kills the app on its own schedule — memory pressure, battery policy, a permission revoked in Settings — often with no callback. A feature is correct only when it survives the process disappearing at any moment while in the background. Every rule below follows from that contract.

## Scope and boundaries

**Covers:** platform-neutral mobile engineering — lifecycle, state restoration, async ownership and cancellation, offline-first sync, navigation and deep links, runtime permissions, push and background execution, device constraints, on-device security, store releases, and mobile-specific testing. Platform APIs and framework mappings live in references.

| Question | Owner |
|---|---|
| Which module owns this state, where the boundary goes | `architecture` — apply it here, do not restate it |
| Coroutines, Flow, sealed types, KMP source sets | `kotlin` |
| Promises, event loop, TypeScript | `javascript` |
| Hooks and component patterns shared with React Native | `react` |
| Screen readers, touch targets, font-scale compliance | `accessibility` |
| Flows, onboarding, permission-priming copy, IA | `design` |
| Threat model, secrets beyond the device, pinning policy | `security` |
| OAuth/OIDC from a native app, token refresh, MFA | `auth` |
| Test strategy, fixtures, flake diagnosis | `testing` |
| Startup traces, memory leaks, jank profiling | `performance` |
| Feature flag lifecycle, staged rollout mechanics | `release-engineering` |
| Crash, ANR, and telemetry pipelines | `observability` |
| Live sockets, presence, CRDT collaboration | `realtime` |
| Resumable upload protocols, signed URLs | `file-storage` |

## Decision tree

### Where does this work run?

```
Does the work matter only while this screen is visible?
├─ yes → screen / state-holder scope; cancelled when the screen is destroyed
│        e.g., search-as-you-type, loading a detail view
└─ no → must it finish after the user leaves the screen?
   ├─ only while the app is in the foreground → app or session scope owned by a long-lived component
   │        e.g., keeping the inbox fresh while any inbox screen is open
   └─ must finish even if the app is backgrounded or killed
      → persist the intent first, then hand it to the platform background-work facility
      ├─ deferrable, constraint-based (network, charging) → scheduled background job
      ├─ user-initiated and user-visible (upload, export) → user-visible long-running work
      │        or a system transfer session, with progress shown
      └─ must happen at a time (reminder, alarm) → system alarm or scheduled local notification
```

### Where does this state live?

```
Can it be recomputed cheaply from other state or a fresh read?
├─ yes → derive it; do not save it
└─ no → what is lost if the process dies?
   ├─ view detail (scroll offset, expanded row, selected tab)
   │     → UI state: platform saved-instance mechanism, small primitives only
   ├─ what the screen shows (item ID, query, filter, wizard step)
   │     → screen state: saved state of the state holder; reload content by ID
   └─ user work or domain data (draft, cart, pending upload, settings)
         → persisted state: local database or file, written as it changes
```

### Native or shared code?

```
Does the product depend on deep or brand-new platform APIs
(camera pipelines, widgets, watch/car, background modes, platform-grade accessibility)?
├─ yes, on both platforms → native UI per platform; share only non-UI logic if anything
└─ no → what does the team already know, and how custom is the UI?
   ├─ web/JS team, mostly standard UI → shared-UI framework on a JS runtime
   ├─ custom, pixel-identical UI on every platform → shared-UI framework with its own renderer
   └─ Kotlin/Android team, native feel on iOS matters → share domain and data layers,
      keep UI native or share it incrementally
```

Whatever the choice, lifecycle signals, background work, push, and secure storage stay platform-specific — budget native code for them. Framework mapping: [cross-platform.md](references/cross-platform.md).

### Which sync conflict policy?

```
Is a record edited by one user on one device at a time?
├─ yes → last-writer-wins on a server-assigned version
└─ no → is the server the authority on validity (stock, balance, booking)?
   ├─ yes → server-authoritative: reject stale writes, refetch, let the user retry
   └─ no → do concurrent edits touch different fields?
      ├─ yes → field-level merge with per-field versions
      └─ no (same text, same list) → domain merge or CRDT (see `realtime`), or ask the user
```

## Core rules / patterns

### 1. Lifecycle is the contract

| State | User sees | App may | Do on entry |
|---|---|---|---|
| Active | interactive UI | everything | start screen-scoped observation |
| Inactive | visible, not focused (call overlay, unfocused window, system sheet) | render | pause input-sensitive work (games, capture) |
| Background | nothing | finish short work in a bounded window | persist user work; release camera, sensors, locks; stop UI-bound work |
| Suspended / cached | nothing | nothing — frozen | — |
| Terminated | nothing | — | nothing runs; the last chance was background entry |

- Persist user work on background entry, and earlier when redoing it is expensive — a terminate callback is not guaranteed. E.g., save the draft on each debounced edit, not in a "will terminate" handler.
- Treat configuration changes as routine: rotation, dark mode, locale, font scale, window resize, fold/unfold. State holders survive or restore; views rebuild. E.g., do not lock orientation to hide a state-loss bug — font scale and resize trigger the same path.
- Expect several windows or scenes of one app: per-window state belongs to the window, not to a global singleton. E.g., two documents side by side on a tablet each own their screen state.
- Map work to the narrowest scope that covers its purpose: view → screen state holder → navigation flow → signed-in session → app process → background job.
- Treat cold start from a notification, deep link, or restored task as a normal entry path; it runs without the screens a user would normally pass through.

### 2. State restoration

| Category | Example | Mechanism | Survives process death? |
|---|---|---|---|
| UI state | scroll position, open sheet | saved-instance state, small primitives | yes, if saved |
| Screen state | `orderId`, search query, wizard step | state holder's saved state | yes, if saved |
| Persisted state | draft, cart, outbox, settings | local database or file | yes |
| In-memory cache | decoded images, last response | memory | no — rebuild from persisted state |

- Restore from process death, not just rotation: state holders that survive a configuration change die with the process. Test both paths separately (rule 11).
- Save identifiers, not payloads. E.g., save `orderId` and reload the order; platform saved-state buffers are small and oversized saves crash.
- Decide per flow whether to restore or restart. E.g., restore a half-filled checkout to the payment step with the cart from the database; restart a one-time-code login because the code expired.
- Persist drafts as the user types and delete them on send; show the restored draft visibly so the user knows it was kept.
- Validate restored state as input, not truth: the item may be deleted, the session expired, the permission revoked.
- Some platforms discard restoration state when the user force-quits; persisted domain state must survive regardless.

Depth: [lifecycle-and-restoration.md](references/lifecycle-and-restoration.md).

### 3. Async work and cancellation

- Give every coroutine, task, promise, and subscription an owner scope tied to a lifecycle; ending the scope cancels the work. E.g., load screen data in the state holder's scope, not a process-global scope.
- Write results to the source of truth and let the UI observe it, instead of pushing results into a view from a callback. E.g., after `await upload()` the screen may be gone — the repository records the result; whichever screen exists renders it.
- When an effect after an await must touch the UI, check the owner is still alive or rely on structured cancellation to skip it. E.g., a Flutter `context.mounted` check, a cancelled coroutine never resuming.
- Collect UI streams only while the screen is at least visible; collecting in the background wastes battery and can crash on detached views.
- Make long loops and blocking calls cooperative: check cancellation between chunks; give network and disk calls timeouts.
- Hand work that must outlive the screen to an app-scoped owner (foreground only) or to the platform background facility with constraints — not to a detached task that leaks.
- Keep the main thread for UI. Move disk, network, parsing, crypto, image decoding, and database work off it. E.g., parsing a large JSON file on the main thread causes jank, ANRs, and launch-watchdog kills.
- Cancel the previous request when newer input supersedes it (latest-wins), and debounce user-triggered requests.

### 4. Offline-first and sync

- Make the local store the source of truth for the UI: screens read local data; the network fills the store. E.g., the list renders cached rows instantly, then updates when a refresh lands.
- Apply a write locally and append an outbox entry in the same transaction; a sync worker drains the outbox. A crash between the two must be impossible.
- Give each outbox entry a client-generated idempotency key the server deduplicates on. E.g., a create retried after a timeout must not create a second order.
- Retry transient failures with exponential backoff, jitter, and a cap on attempts or age; mark permanent failures (validation, forbidden) as failed and show them. Retrying a permanent error forever drains battery.
- Trigger sync on connectivity regained, app foreground, local write, and a scheduled background job — not on a tight polling loop.
- Choose a conflict policy per entity with the decision tree above, and record it next to the entity.
- Migrate the local schema with versioned migrations tested from every shipped version; reserve destructive recreation for pure caches.
- Show sync status: per-item pending / failed / conflict markers and a "last synced" time. Never block reading on the network.
- Wipe or partition local data on sign-out and account switch; decide explicitly whether unsent outbox entries are flushed or discarded.

Online-only apps still cache last-known reads, render an explicit offline state, and send idempotency keys on any submit that costs money or creates records. Depth: [offline-sync.md](references/offline-sync.md).

### 5. Navigation and deep links

- Give each window one back-stack owner (navigator, router, navigation controller); screens request navigation through it instead of manipulating the stack.
- Treat deep links as untrusted external input: parse, validate, then route through the same auth gate as in-app navigation. E.g., `/orders/123` on a signed-out device → sign in → land on order 123; store the pending destination instead of dropping it.
- Synthesize a sensible back stack for deep entry. E.g., back from a deep-linked order goes to the order list, following the platform's back convention.
- Prefer verified web links (universal links, app links) over custom URL schemes for anything sensitive — another app can claim a custom scheme. Test installed, not-installed (web fallback), and already-running cases.
- Pass IDs as navigation arguments, not objects; restored and deep-linked entries only have the ID.
- Reuse the existing screen for a link or notification that targets what is already shown (single-top / replace) instead of stacking duplicates.

### 6. Permissions

- Request at the moment of use with in-context rationale. E.g., ask for the camera when the user taps "Scan receipt", not at first launch.
- Prefer permissionless alternatives: system photo and document pickers, share sheets, approximate location.
- Handle every outcome: granted, denied, permanently denied, limited or partial (selected photos, approximate location), and granted only while in use.
- After a permanent denial, explain the value once and offer a link to the app's Settings page; do not re-prompt in a loop.
- Degrade the feature, not the app. E.g., without notification permission the in-app inbox still works.
- Re-check status on every resume: users revoke in Settings and some systems auto-reset permissions for unused apps. Query the platform; a stored boolean goes stale.
- Treat background-only permissions (background location, always-on sensors) as separate, stricter requests that need store-review justification.

### 7. Platform integration

**Push notifications**
- Manage the token lifecycle: fetch on every launch, upload when it changes, bind to the user on sign-in, unbind on sign-out, and delete server-side when the push service reports it invalid.
- Distinguish display messages (the OS renders them while backgrounded; app code may not run) from data or silent messages (app code runs, but delivery is throttled, delayed, or dropped under low power, quotas, or after a force-quit). Use silent push as a hint to sync, not as the delivery guarantee.
- Send identifiers in the payload and fetch content on open; keep sensitive text off the lock screen.
- Route a notification tap through the deep-link path, including the auth gate.

**Background execution**
- Treat background time as a budget the OS grants: jobs are deferred by idle and standby policies, capped in runtime, and may not run at all for rarely used apps. Design for "eventually, maybe" and catch up on foreground.
- Reserve user-visible long-running work for tasks the user started; show progress and allow cancellation.
- Quotas and rules change with OS versions — see the platform references.

**Sharing and inter-app**
- Use the system share sheet; send scoped, temporary file access instead of raw paths; validate size and type of incoming shared content.

**App updates**
- Run a server-driven minimum-version check on launch and resume: a soft prompt for "recommended", a blocking screen with a store link for "required". Keep that endpoint independent of the API versions it gates.
- Keep APIs backward compatible for old app versions; installed builds linger for months (see `api-design`).

### 8. Device constraints

- **Battery:** batch network calls, coalesce background work, avoid continuous location and wake locks; reduce refresh in low-power mode.
- **Memory:** drop caches on memory-pressure / trim callbacks (image caches first); bound in-memory caches; decode images at display size.
- **Network:** put a timeout on every request; defer large transfers on metered or low-data connections; use chunked, resumable transfers for large files.
- **Storage:** handle write failures on a full disk; put caches where the OS may purge them; keep user data out of cache directories.
- **Screens and input:** lay out by window size class, not device model; handle insets, cutouts, foldables, split screen, keyboard and pointer input.
- **Text and accessibility:** support the largest font scales and screen readers; compliance detail lives in `accessibility`.
- **Startup:** set a cold-start budget and measure it; defer non-critical SDK and analytics init; render from local cache before the first network response.
- **Low-end devices:** test on the slowest device in the support matrix, not the team's flagship.

### 9. Security on device

- Store secrets (refresh tokens, encryption keys) in hardware-backed secure storage (Keychain / Keystore); preferences, property lists, and key-value stores are plaintext and often backed up.
- Ship no secrets in the bundle: anything in the binary is extractable. An API key in the app is an identifier; enforce limits and authorization on the server.
- Weigh certificate pinning: it blocks interception through a mis-issued certificate but can brick the app on rotation and breaks enterprise TLS inspection. If pinning, pin public keys with a backup key and a remote kill switch.
- Bind biometric gating to a key that requires user authentication to use, not to a boolean "biometric succeeded" flag a hooked process can fake.
- Hide sensitive screens from app-switcher snapshots and, where policy requires, block screenshots.
- Keep tokens and personal data out of logs and crash reports.
- Treat the device as untrusted: root/jailbreak detection and obfuscation raise attacker cost; authorization still lives on the server.

Depth: `security`, `auth`; platform storage specifics in the platform references.

### 10. Releases

- Plan for no rollback: an installed build lives until the user updates. "Rollback" means roll forward plus a remote kill switch or feature flag.
- Roll out in stages with halt criteria tied to crash-free sessions and hang/ANR rate.
- Gate risky features behind remote flags whose defaults are safe when config cannot load (first launch offline).
- Set a minimum supported OS from install-base data and API needs; review it on a fixed cadence and publish it.
- Force updates only for security fixes or unavoidable API breaks.
- Upload symbols (debug symbol files, obfuscation mappings) for every build from CI; without them crash stacks are unreadable.
- Budget store review time into hotfix plans; over-the-air code updates in cross-platform apps are bounded by store rules.

Mechanics: `release-engineering`, `observability`, `ci-cd`; store specifics in the platform references.

### 11. Testing

- Unit-test state holders against fake repositories with a controllable dispatcher and clock; assert the emitted state sequence.
- Test process death explicitly: background the app, kill the process, relaunch from recents; assert screen state, navigation, and drafts. Rotation and "recreate" tests exercise a different path.
- Cover configuration changes: rotation, largest font scale, dark mode, right-to-left locale, split screen and resize.
- Run UI tests for critical flows on a device matrix: oldest supported OS, a low-end device, a tablet or foldable.
- Test offline and flaky networks: airplane mode mid-write, a timeout after the server committed (idempotency), throttled bandwidth, server errors; assert the outbox drains exactly once.
- Test upgrades: install the previous store build, create data, upgrade, verify migrations and saved tokens.
- Test permissions (deny, permanent deny, revoke while backgrounded) and deep links (signed in/out, cold start, invalid ID).

## Worked scenario: an upload across process death

The user picks a large video, taps Upload, switches to another app; the OS kills the process; the user returns an hour later.

| Moment | What happens | Why |
|---|---|---|
| Tap Upload | Copy the file into app storage (picker grants are temporary); insert an upload record (ID, local path, idempotency key, `queued`) and an outbox entry in one transaction; enqueue unique background work keyed by the upload ID | Persist intent before starting work |
| Screen visible | The screen observes the upload record and renders queued / progress | UI observes the source of truth |
| App backgrounded | Screen-scoped work (thumbnail preview, progress animation) is cancelled; the transfer runs as user-visible background work or a system transfer session with a progress notification | Narrow scope for screen work; platform facility for must-finish work |
| Process killed | In-memory progress is lost; the record, file, and scheduled work survive | Only persisted state survives |
| Work resumes | The job reads the record, asks the server for the resumable session's offset, continues from it with the same idempotency key | Retries never duplicate the media |
| Completion | The job writes `done` and the server ID to the record, posts a notification | Results go to the source of truth |
| User returns | Cold start restores the route and upload ID from saved state, loads the record: "Uploaded", live progress, or a failure with a retry action | Restoration reloads by ID |

Not persisted: progress counters, animation state, the picker's temporary URI grant. Platform implementations: [android.md](references/android.md#upload-scenario-on-android), [ios.md](references/ios.md#upload-scenario-on-ios); edge cases (sign-out mid-upload, file deleted, app update) in [lifecycle-and-restoration.md](references/lifecycle-and-restoration.md#worked-scenario-implementation).

## Context Adaptation

**Native, single platform:** use platform primitives directly and follow platform conventions (back behavior, navigation idioms, system UI). The platform reference is the depth source.

**Cross-platform:** share domain, data, and sync logic; take lifecycle signals from the platform; keep a thin native layer for background work, push, secure storage, and pickers. Test lifecycle on each platform separately — "works on one, loses data on the other" is the common failure. See [cross-platform.md](references/cross-platform.md).

**Consumer app:** broad device and OS matrix, store review and privacy disclosures, permission-denial rates as a product metric, consent before tracking.

**Enterprise / MDM-managed:** managed app configuration pushed by the MDM instead of a settings screen, remote wipe and data-loss-prevention policies (copy/paste, open-in restrictions), per-app VPN, private distribution, and TLS-inspecting proxies that conflict with pinning. Confirm which policies the customer's MDM enforces before designing storage and networking.

**Online-only:** cache last-known reads, explicit offline states, idempotent submits; skip the outbox only when every write needs a live server answer anyway.

**Offline-first:** outbox, conflict policy, local migrations, storage quotas, and sync-status UI are core features with their own tests, not polish.

**Tablets and foldables:** window-size-driven layouts (list-detail), multiple windows or instances, posture changes as configuration changes, keyboard, pointer, and drag-and-drop input.

**Wearables, TV, car:** separate lifecycles, tighter resource and interaction limits, and their own review rules; treat each as its own platform and check its guidelines.

## Anti-Patterns

| Anti-pattern | Symptom | Fix |
|---|---|---|
| Must-finish work scoped to a screen | Upload silently lost when the user navigates back or backgrounds | Persist intent; run it in platform background work keyed by ID |
| State kept only in memory | Form empty or wrong screen after returning from the camera or an hour later | Saved state for IDs, database for drafts; process-death tests |
| Permission requested at launch without context | High denial rate; permanent denial before the feature is ever used | Request at the moment of use with rationale; offer Settings after permanent denial |
| UI updated from a callback after the screen is gone | Crashes on detached views, leaked screens, stale UI | Owner-scoped work; write to the repository and observe |
| Unbounded retries | Battery-drain complaints, server overload after outages, OS deprioritizing the app | Backoff with jitter and a cap; classify permanent errors; constraint-based jobs |
| Rotation tests treated as process-death tests | CI green, field reports of lost data | Kill the backgrounded process in tests and relaunch |
| Secrets in shared preferences or plist files | Tokens extracted from backups or rooted devices | Keychain / Keystore; exclude secrets from backups |
| Blocking the main thread with I/O | Jank, ANRs, launch-watchdog kills | Move I/O off main; enable main-thread violation detection in debug builds |
| Deep link bypasses the auth gate | Signed-out user reaches data, or the destination is lost after sign-in | Route links through the same gate; store and resume the pending destination |
| Silent push as a delivery guarantee | Data missing on some devices, especially after force-quit or in low-power mode | Sync on foreground and on schedule; push is a hint |
| Retry without an idempotency key | Duplicate orders or posts after a timeout | Client-generated key per operation, deduplicated on the server |
| Orientation locked or config changes swallowed to dodge state loss | Same bug returns on font change, dark mode, resize, fold | Fix restoration; let configuration changes flow |

## Related Knowledge

- `architecture` — ownership, boundaries, and state authority; mobile applies these to lifecycle scopes
- `kotlin` — coroutines, Flow, KMP mechanics behind Android and shared code
- `javascript` — async model and TypeScript behind React Native
- `react` — component and hook patterns shared with React Native
- `accessibility` — screen readers, font scaling, touch targets
- `design` — flows, onboarding, permission priming, empty and offline states
- `security` — threat modeling, secrets, supply chain of mobile SDKs
- `auth` — native OAuth/OIDC with PKCE, token storage and refresh, passkeys
- `testing` — strategy, fakes, flake diagnosis
- `performance` — startup, jank, memory profiling
- `release-engineering` — feature flags, staged rollout, versioning
- `observability` — crash, hang, and client telemetry pipelines
- `realtime` — sockets, presence, CRDTs for collaborative data
- `file-storage` — resumable uploads, signed URLs
- `api-design` — backward-compatible APIs for long-lived app versions, idempotency contracts

## References

- [lifecycle-and-restoration.md](references/lifecycle-and-restoration.md) — lifecycle guarantees, scope hierarchy, restoration design, async ownership, worked-scenario implementation, process-death testing
- [offline-sync.md](references/offline-sync.md) — outbox, idempotency, ordering, backoff, delta sync, conflict policies, local migrations, sync UX
- [android.md](references/android.md) — Android lifecycle, saved state, background work, push, permissions, app links, Keystore, Play releases, test commands
- [ios.md](references/ios.md) — iOS scenes, restoration, background tasks and transfer sessions, APNs, permissions, universal links, Keychain, App Store releases, test commands
- [cross-platform.md](references/cross-platform.md) — how the patterns map onto React Native, Flutter, Kotlin Multiplatform, and Compose Multiplatform
