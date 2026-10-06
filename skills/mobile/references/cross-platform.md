# Cross-Platform Frameworks

How the SKILL.md patterns map onto shared-code frameworks. These are not tutorials: each section names where a framework puts the lifecycle signal, the owner scope, saved state, background work, and secure storage — and where it leaves a gap you must fill with native code. Language depth: `javascript` (React Native), `kotlin` (KMP); component patterns: `react`.

> **Volatile.** Framework architectures, plugin ecosystems, and store rules on over-the-air updates change often. Library names are examples, not endorsements; check version-specific behavior against current framework and store documentation.

## Contents

- [Mapping the decision tree](#mapping-the-decision-tree)
- [What stays native in every framework](#what-stays-native-in-every-framework)
- [Concern-by-concern mapping](#concern-by-concern-mapping)
- [React Native](#react-native)
- [Flutter](#flutter)
- [Kotlin Multiplatform and Compose Multiplatform](#kotlin-multiplatform-and-compose-multiplatform)
- [Web-view hybrids](#web-view-hybrids)
- [Cross-cutting pitfalls](#cross-cutting-pitfalls)

---

## Mapping the decision tree

Start from the "Native or shared code?" tree in SKILL.md. Its outcomes map to:

| Outcome | Typical framework | Trade-off to accept |
|---|---|---|
| Native UI per platform | Swift/SwiftUI + Kotlin/Compose | Two codebases; best platform fidelity and day-one API access |
| Shared domain and data, native UI | Kotlin Multiplatform | Shared logic, two UI layers; Swift interop needs care |
| Shared UI on a JS runtime | React Native (often with Expo tooling) | Web-team velocity; native modules for anything below the UI |
| Shared UI with its own renderer | Flutter, or Compose Multiplatform | Pixel-identical UI; platform look, accessibility, and text input are re-implemented by the framework |
| Existing web app in a native shell | Capacitor or similar | Fastest reuse; weakest offline, background, and platform integration |

## What stays native in every framework

Regardless of framework, budget platform code (or vetted plugins) for:

- Background work: WorkManager on Android, `BGTaskScheduler` and background `URLSession` on iOS.
- Push token registration, notification channels and categories, notification extensions.
- Secure storage: Keystore and Keychain.
- App links and universal links: association files, entitlements, manifest filters.
- Permission prompts, usage strings, and manifest declarations.
- Process-death behavior: the shared runtime dies with the process, and restoration is wired per platform.

## Concern-by-concern mapping

| Concern | React Native | Flutter | KMP (+ Compose Multiplatform) |
|---|---|---|---|
| Lifecycle signal | `AppState` (`active`, `background`, `inactive` on iOS) | `AppLifecycleListener` / `AppLifecycleState` (`resumed`, `inactive`, `hidden`, `paused`, `detached`) | Platform lifecycle; multiplatform `Lifecycle` artifacts for shared code |
| Screen owner scope | Component effects with cleanup; `AbortController` for requests | `State.dispose`, state-management scopes (auto-dispose providers, bloc `close`) | Multiplatform `ViewModel` + `viewModelScope` |
| "Owner still alive" after await | Effect cleanup flag or aborted signal | `if (!context.mounted) return;` | Structured cancellation of the scope |
| Saved state across process death | Not automatic; persist route and IDs yourself | Restoration framework (`RestorationMixin`, `restorationScopeId`) | Android: `SavedStateHandle`; iOS: wire it per platform |
| Background work | Native module or a library over WorkManager / `BGTaskScheduler` | A plugin over WorkManager / `BGTaskScheduler` running a Dart entry point | Shared job logic, platform schedulers via `expect`/`actual` or interfaces |
| Local database | SQLite-based libraries | SQLite-based libraries (e.g., drift) | SQLDelight or Room (multiplatform) |
| Secure storage | Keychain/Keystore wrapper library | Keychain/Keystore wrapper plugin | `expect`/`actual` over Keychain/Keystore |
| Native interop | Turbo Native Modules (codegen) | Platform channels, Pigeon codegen, FFI | Direct: Kotlin/JVM on Android, Objective-C/Swift export on iOS |

## React Native

**Lifecycle and scope**
- `AppState` reports foreground and background; JS timers and the JS thread are suspended with the app on iOS. Do not rely on a JS callback firing before termination.
- Owner scopes are components and their effects: cancel in the effect cleanup (`AbortController.abort()`, unsubscribe). Server-state libraries (e.g., TanStack Query) handle request cancellation and online/offline status when wired to the platform's network state.
- The New Architecture (Fabric renderer, Turbo Native Modules, JSI) is the only runtime (since RN 0.82); modules written for the old bridge run through an interop layer or must be migrated.

**Process death and restoration**
- JS state dies with the process. On Android, the common `react-native-screens` setup passes `null` to `super.onCreate` in the main activity, so the app restarts from its root after process death.
- Navigation libraries can persist navigation state; store only route names and IDs, version the shape, and validate on restore.
- Persist drafts and outbox entries in a local database, not in component state or an in-memory store.

**Background work and uploads**
- JS `fetch` stops when the app is suspended or killed. Run must-finish uploads through a native background transfer (WorkManager on Android, background `URLSession` on iOS) exposed by a module, and keep the record in the local database.
- Android Headless JS can run JS in the background; iOS has no equivalent beyond what `BGTaskScheduler` and background sessions grant.
- Persisted paused mutations in server-state libraries are an outbox-lite: they still need idempotency keys and a migration plan for their stored shape.

**Storage and security**
- `AsyncStorage` and similar key-value stores are plaintext; use a Keychain/Keystore-backed module for tokens. If an encrypted key-value store is used, keep its key in secure storage.
- Strings in the JS bundle are trivially readable.

**Releases**
- Over-the-air JS updates must match the installed native binary (runtime-version or fingerprint policy) and stay within store rules on downloaded code (App Review Guideline 2.5.2 on iOS). Some hosted OTA services have been retired: Microsoft App Center, including its hosted CodePush, closed on March 31, 2025, leaving only a self-hosted CodePush server; confirm any provider's status.
- Upload native symbols and the JS source maps (including Hermes bytecode maps) for readable crash stacks.

## Flutter

**Lifecycle and scope**
- `AppLifecycleListener` exposes resume, inactive, hide, show, pause, and detach callbacks; `hidden` sits between `inactive` and `paused`.
- Dart futures cannot be cancelled. Cancel `StreamSubscription`s and dispose controllers in `dispose()`; use a cancellable-operation wrapper or a token for long work; check `context.mounted` (or `mounted`) after every `await` before touching the UI. The `use_build_context_synchronously` lint catches violations.
- Move CPU-heavy work off the UI isolate with `Isolate.run` / `compute`.

**Process death and restoration**
- Opt in with `restorationScopeId` on the app widget; use `RestorationMixin` with restorable properties (`RestorableTextEditingController`, `RestorableInt`) and `Navigator.restorablePush` or a router with restoration support.
- iOS restoration needs extra setup in Xcode (see the Flutter `RestorationManager` documentation, section on state restoration on iOS); test both platforms separately.
- Restorable data is for UI and screen state; drafts and outbox entries belong in the database.

**Background work and push**
- Background plugins and push background handlers run a separate Dart entry point (a top-level function annotated `@pragma('vm:entry-point')`) in a fresh isolate. It shares nothing with the UI isolate's memory: re-open the database and re-create dependencies there.
- Platform channels must be called from the platform's main thread on the native side; background isolates need the background binary messenger to call plugins.

**Storage, links, accessibility**
- `shared_preferences` is plaintext; use a Keychain/Keystore-backed plugin for secrets.
- Decide whether Flutter's built-in deep-link handling or a link plugin owns incoming links — not both. Opt out of the built-in handler with `flutter_deeplinking_enabled` set to false in `AndroidManifest.xml` or `FlutterDeepLinkingEnabled` set to false in `Info.plist`.
- Widgets, not platform controls, render the UI: verify screen-reader semantics (`Semantics`), text scaling (`MediaQuery.textScalerOf`), and platform text-input behavior explicitly.

**Releases**
- Building with `--obfuscate --split-debug-info` produces symbol files; upload them with native symbols for readable stacks.

## Kotlin Multiplatform and Compose Multiplatform

**What to share**
- Share the domain model, repositories, sync engine, outbox, and local database (SQLDelight or Room) in `commonMain`; this is where offline-first logic lives once instead of twice.
- Keep UI native (SwiftUI + Compose) or share it with Compose Multiplatform incrementally, screen by screen.

**Lifecycle and scope**
- Multiplatform `ViewModel` and `Lifecycle` artifacts give shared state holders a `viewModelScope`. On iOS, something must clear the `ViewModel` when its Swift owner goes away — a wrapper whose `deinit` clears it, or a `ViewModelStoreOwner` tied to the SwiftUI view or navigation entry.
- Swift sees `suspend` functions as `async` or completion-handler APIs and `Flow` as an opaque type. Use a bridging tool (SKIE or KMP-NativeCoroutines) or Swift export so Flows become `AsyncSequence`s and **Swift task cancellation cancels the Kotlin coroutine** — the most common leak in KMP apps.

**Platform seams**
- Background work: shared `SyncEngine.runOnce()`; platform schedulers (WorkManager, `BGTaskScheduler`) invoke it. Express the scheduler as an interface injected per platform; reserve `expect`/`actual` for small leaf APIs.
- Secure storage, push registration, and deep-link entry stay platform-side; parse and route links in shared code.

**Compose Multiplatform on iOS**
- It renders its own UI. Verify VoiceOver semantics, text input and IME behavior, scroll physics, and interop with UIKit/SwiftUI views on real devices.
- Do not assume Android saved-state semantics on iOS: test that saveable state and navigation actually survive a background termination in the framework version you ship.

## Web-view hybrids

- Lifecycle arrives through the shell's app-state events; the web view can be torn down and reloaded under memory pressure.
- Web storage (local storage, IndexedDB) inside a web view is neither secure nor guaranteed durable; use native storage plugins for user data and secrets.
- Background work, push, and secure storage require native plugins; universal and app links need the same association files as native apps.

## Cross-cutting pitfalls

- **Plugin lag:** a plugin wrapping a platform API may lag new OS rules (permission models, foreground-service types, privacy manifests). Audit plugins against each new OS release and target-SDK requirement.
- **Upgrade cadence:** store target-SDK deadlines force framework upgrades; budget them yearly.
- **Two lifecycles:** the framework's "paused" event may not fire before the process is killed; persist on the platform signal or earlier.
- **One platform tested:** shared code hides platform divergence in lifecycle, background limits, and permissions. Run process-death, permission, and offline tests on both platforms.
- **Symbols:** readable crashes need native symbols plus the framework's own maps (JS source maps, Dart debug info) per build.
