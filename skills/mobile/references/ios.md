# iOS

How the SKILL.md patterns map onto iOS, UIKit, and SwiftUI.

> **Volatile.** Background execution budgets, permission prompts, App Review Guidelines, privacy-manifest rules, and SDK submission requirements change with each iOS release. Items marked *(verify)* depend on OS version or store policy — check current Apple developer documentation and App Review Guidelines before relying on them.

## Contents

- [Lifecycle and scopes](#lifecycle-and-scopes)
- [State restoration](#state-restoration)
- [Concurrency and cancellation](#concurrency-and-cancellation)
- [Background execution](#background-execution)
- [Push with APNs](#push-with-apns)
- [Permissions](#permissions)
- [Universal links and navigation](#universal-links-and-navigation)
- [Keychain, data protection, and biometrics](#keychain-data-protection-and-biometrics)
- [Device constraints](#device-constraints)
- [Releases on the App Store](#releases-on-the-app-store)
- [Testing commands](#testing-commands)
- [Upload scenario on iOS](#upload-scenario-on-ios)

---

## Lifecycle and scopes

| Neutral state | iOS |
|---|---|
| Active | Scene *foreground active*; SwiftUI `scenePhase == .active` |
| Inactive | Scene *foreground inactive* — app switcher, Control Center, incoming call, system alert |
| Background | Scene *background*; a short grace period, extendable briefly with `beginBackgroundTask` |
| Suspended | In memory, no CPU, no callbacks |
| Terminated | Suspended apps are terminated without notice; `applicationWillTerminate` is not called for them |

| Neutral scope | iOS |
|---|---|
| View | SwiftUI `@State`; `.task {}` (cancelled when the view disappears) |
| Screen state holder | An `@Observable` / `ObservableObject` model owned by the screen, holding its `Task` handles |
| Navigation flow | A model owned by the `NavigationStack` root or flow coordinator |
| Signed-in session | A session object created on sign-in and torn down on sign-out |
| App process | App delegate or app-level dependencies (database, `URLSession`) |
| Background job | `BGTaskScheduler`, background `URLSession` |

- iPad multitasking allows several scenes of one app (`UIApplicationSupportsMultipleScenes`); keep per-scene state per scene.
- Size-class and window-size changes (Split View, Stage Manager, rotation) rebuild layout; the model survives because the scene does.

## State restoration

- **SwiftUI:** `@SceneStorage` for small per-scene values (selected tab, route IDs). A `NavigationPath` of `Codable` route values can be persisted through its `codable` representation. `@AppStorage` is app-wide `UserDefaults` — plaintext, not for secrets.
- **UIKit:** return an `NSUserActivity` from `stateRestorationActivity(for:)` and rebuild from it in `scene(_:willConnectTo:options:)`; the older `restorationIdentifier` API still works for view-controller hierarchies.
- The system discards restoration data when the user force-quits from the app switcher, and when restoration previously failed. Persisted domain state (drafts, outbox) must not depend on it.
- Restore IDs, then load and validate from the local store.

## Concurrency and cancellation

```swift
struct OrderView: View {
    let orderID: Order.ID
    @State private var model = OrderModel()

    var body: some View {
        OrderContent(state: model.state)
            .task(id: orderID) { await model.observe(orderID) }   // cancelled on disappear or ID change
    }
}
```

- Prefer `.task` and `.task(id:)` — their work is cancelled with the view. An unstructured `Task {}` is not; store it and cancel it when its owner goes away.
- Cancellation is cooperative: call `try Task.checkCancellation()` between chunks; wrap callback APIs with `withTaskCancellationHandler` so cancellation unregisters the callback.
- Isolate UI models to `@MainActor`; run parsing, decoding, and I/O in non-main-actor code. Strict concurrency checking in recent Swift language modes surfaces data races at compile time.
- In long-lived closures (notification observers, Combine sinks), capture `[weak self]` and keep `AnyCancellable`s in the owner so they cancel on deinit.

## Background execution

```
Finish a short operation after backgrounding     → beginBackgroundTask / endBackgroundTask (seconds, not minutes)
Periodic refresh, system-chosen time             → BGAppRefreshTask (short)
Deferrable heavy work (DB cleanup, ML, sync)     → BGProcessingTask (requiresNetworkConnectivity, requiresExternalPower)
Upload or download that must survive suspension  → background URLSession
User-started long task with visible progress     → BGContinuedProcessingTask *(verify, newer iOS)*
Specific modes (audio, navigation, VoIP calls, Bluetooth) → the matching background mode only
```

- Register task identifiers in `BGTaskSchedulerPermittedIdentifiers` and register handlers before launch finishes (or use SwiftUI's `.backgroundTask` scene modifier). Set an expiration handler, call `setTaskCompleted`, and schedule the next request.
- The system picks the time from usage patterns, battery, and network; a rarely opened app may get no background time. Treat requests as hints.
- Always end background tasks; an expired task the app did not end can get the app terminated.
- VoIP pushes must report a call to CallKit immediately, or the system terminates the app and may stop delivering them.

## Push with APNs

- Call `registerForRemoteNotifications()` on every launch; upload the token from `didRegisterForRemoteNotificationsWithDeviceToken` when it changes (reinstall, restore to a new device).
- Request authorization with `UNUserNotificationCenter.requestAuthorization`. *Provisional* authorization delivers quietly to Notification Center without a prompt — useful for proving value before asking.
- **Alert notifications** are displayed by the system without running app code. A Notification Service Extension (`mutable-content: 1`) can modify or decrypt content before display, within a short time and memory budget.
- **Background (silent) notifications** (`content-available: 1`, push type `background`, low priority) wake the app briefly; they are throttled, may be coalesced or dropped, and are not delivered after the user force-quits the app.
- Use interruption levels (passive, active, time-sensitive) honestly; Focus modes filter by them.
- Handle taps in `userNotificationCenter(_:didReceive:withCompletionHandler:)` and route through the deep-link path.

## Permissions

- Every protected resource needs its usage-description key in `Info.plist` (e.g., `NSCameraUsageDescription`); accessing the resource without it crashes the app.
- The system shows each prompt once. After a denial, only Settings can change it — link with `UIApplication.openSettingsURLString`.
- Re-check authorization status when the scene becomes active; changing a privacy setting in Settings terminates a running app.
- Prefer permissionless pickers: `PhotosPicker` / `PHPickerViewController` need no photo permission. Photo library and contacts support *limited* access to a user-selected subset.
- Location: request when-in-use first; upgrade to always later, in context. The user may grant approximate location only; request temporary full accuracy for a specific purpose.
- Tracking across apps and websites requires App Tracking Transparency consent before any tracking identifier is used.
- Local-network access, Bluetooth, and motion have their own prompts and usage strings.

## Universal links and navigation

- Host `apple-app-site-association` at `https://example.com/.well-known/apple-app-site-association`, served over HTTPS without redirects, and add the `applinks:` Associated Domains entitlement.
- Apple fetches association files through its CDN, so changes propagate with delay; append `?mode=developer` to the entitlement domain on development devices to bypass the cache.
- Universal links do not open the app when typed into Safari's address bar or when tapped on a page of the same domain; test from Messages, Notes, or another domain.
- Receive links with SwiftUI `onOpenURL` or `scene(_:continue:)` / `scene(_:openURLContexts:)` in UIKit; route through the auth gate and push a synthesized path onto the `NavigationStack`.
- Custom URL schemes are not exclusive; another app can register the same scheme.

## Keychain, data protection, and biometrics

- Store tokens and keys in the Keychain. Pick accessibility deliberately: `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` for items background work must read; `WhenUnlocked` classes make items unreadable while the device is locked.
- Keychain items have historically survived app deletion. On first launch after install (detected with a `UserDefaults` flag, which deletion does clear), wipe stale Keychain items.
- Share items with extensions through a Keychain access group; share files through an App Group container.
- File protection: the default class (`completeUntilFirstUserAuthentication`) allows background access after the first unlock; `.complete` makes files unreadable while locked, which breaks background sync and uploads that touch them.
- Biometric gating: protect a Keychain item or Secure Enclave key with `SecAccessControl` (e.g., `.biometryCurrentSet`, which invalidates on enrollment changes). An `LAContext.evaluatePolicy` result alone is a boolean that can be bypassed on a compromised device.
- App Transport Security requires TLS by default; justify each exception. Declarative pinning is available through `NSPinnedDomains` in `Info.plist`, or pin in a `URLSessionDelegate` challenge handler.
- Hide sensitive content before the app-switcher snapshot by covering the window when the scene becomes inactive. iOS offers no public API to block screenshots; detect capture with `sceneCaptureState` / `UIScreen.isCaptured` and the screenshot notification.

## Device constraints

- **Memory:** observe `didReceiveMemoryWarningNotification` and drop caches; `NSCache` evicts automatically; `os_proc_available_memory()` reports headroom. App extensions have much lower memory limits than apps.
- **Launch and hangs:** the watchdog terminates apps that take too long to launch or block the main thread (crash code `0x8badf00d`). Measure with Instruments and MetricKit launch and hang diagnostics.
- **Battery:** check `ProcessInfo.processInfo.isLowPowerModeEnabled` and its change notification; reduce refresh and animation work in Low Power Mode.
- **Network:** `NWPathMonitor` exposes `isExpensive` and `isConstrained` (Low Data Mode); set `allowsExpensiveNetworkAccess`, `allowsConstrainedNetworkAccess`, and `waitsForConnectivity` on sessions.
- **Text and layout:** support Dynamic Type through accessibility sizes (text styles, `@ScaledMetric`); lay out by size class and safe areas.

## Releases on the App Store

- TestFlight: internal testers immediately; external testers after beta review.
- Phased release spreads an update to automatic-update users over seven days and can be paused; users can still update manually from the store *(verify schedule and pause limits)*.
- There is no first-party forced update; implement it with the server-driven minimum-version check.
- Expedited review can be requested for critical fixes; do not plan hotfixes around it.
- Archive and upload dSYMs for every build to the crash reporter; MetricKit and Xcode Organizer provide crash, hang, and energy reports.
- Downloaded code that changes app features is limited by the App Review Guidelines (around section 2.5.2) and the developer license terms; over-the-air script updates must stay within them *(verify current wording)*.
- Privacy manifests (`PrivacyInfo.xcprivacy`), required-reason API declarations, privacy nutrition labels, and signatures for listed third-party SDKs are submission requirements *(verify)*.
- Submissions must be built with a recent Xcode and SDK, raised yearly *(verify)*.

## Testing commands

| Goal | Command or tool |
|---|---|
| Simulate termination in the background | Run from Xcode, press Home (or background the app), stop the app in Xcode, relaunch from the home screen |
| Avoid in restoration tests | Swiping the app away in the app switcher — it discards restoration data |
| Memory warning | Simulator: Debug → Simulate Memory Warning |
| Trigger a scheduled background task | Pause in the debugger and run `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.example.app.refresh"]` |
| Send a push to the simulator | `xcrun simctl push booted com.example.app payload.apns` |
| Open a deep link | `xcrun simctl openurl booted "https://example.com/orders/123"` |
| Grant, revoke, or reset a permission | `xcrun simctl privacy booted revoke photos com.example.app` |
| Bad network | Network Link Conditioner (Mac, or Developer settings on device) |
| Main-thread misuse | Main Thread Checker and Thread Sanitizer in the scheme diagnostics |

## Upload scenario on iOS

1. `PhotosPicker` delivers the item; load it as a file representation and copy it into Application Support with a file protection class that allows background reads (`completeUntilFirstUserAuthentication`).
2. In one local-database transaction, insert the upload record and its outbox entry.
3. Create one background `URLSession` with a fixed identifier at launch, and start an upload task from the file. Background sessions upload from files only and report through a delegate.

```swift
final class UploadTransport: NSObject, URLSessionTaskDelegate {
    static let identifier = "com.example.app.uploads"

    lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: Self.identifier)
        config.sessionSendsLaunchEvents = true
        config.isDiscretionary = false               // user-initiated: do not wait for ideal conditions
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    func start(_ upload: UploadRecord, request: URLRequest) {
        let task = session.uploadTask(with: request, fromFile: upload.localURL)
        task.taskDescription = upload.id             // maps callbacks to the record after relaunch
        task.resume()
    }
}
```

4. The transfer runs in a system process while the app is suspended or terminated by the system. On completion the app is relaunched in the background through `application(_:handleEventsForBackgroundURLSession:completionHandler:)`; recreate the session with the same identifier, update records from delegate callbacks keyed by `taskDescription`, then call the stored completion handler from `urlSessionDidFinishEvents(forBackgroundURLSession:)`.
5. For resumability, either upload in file-backed chunks (one task per chunk, offset in the record) or use `URLSession`'s resumable-upload support where the server implements the matching protocol *(verify)*. Send the idempotency key as a request header on every attempt.
6. If the user force-quits, the system cancels the session's transfers. Launch reconciliation compares records in active states with `session.getAllTasks` and re-creates missing tasks from the server offset.
7. After relaunch, the screen restores its route and upload ID from scene storage and observes the record in the local store.
