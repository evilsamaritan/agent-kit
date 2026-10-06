# Android

How the SKILL.md patterns map onto Android and Jetpack. Kotlin language mechanics (coroutines, Flow) live in `kotlin`.

> **Volatile.** Background execution, foreground-service, permission, and Google Play policy rules change with each Android release and each target-SDK bump. Rules tied to a named Android version were checked against the Android developer documentation; for a newer release or a Play policy question, read the current documentation and Play Console policy before relying on them.

## Contents

- [Lifecycle and scopes](#lifecycle-and-scopes)
- [Saved state and process death](#saved-state-and-process-death)
- [Main thread and async](#main-thread-and-async)
- [Background work](#background-work)
- [Push with FCM](#push-with-fcm)
- [Permissions](#permissions)
- [Navigation and app links](#navigation-and-app-links)
- [Secure storage and biometrics](#secure-storage-and-biometrics)
- [Device constraints](#device-constraints)
- [Gradle and Kotlin plugin setup](#gradle-and-kotlin-plugin-setup)
- [Releases on Google Play](#releases-on-google-play)
- [Testing commands](#testing-commands)
- [Upload scenario on Android](#upload-scenario-on-android)

---

## Lifecycle and scopes

| Neutral state | Android |
|---|---|
| Active | Activity `RESUMED`; in multi-window every visible activity is resumed, and `onTopResumedActivityChanged` reports focus |
| Inactive | `STARTED` but not `RESUMED` (e.g., a translucent activity on top) |
| Background | Activity `STOPPED`; app-level signal from `ProcessLifecycleOwner` |
| Suspended / cached | Cached process; the system may freeze cached processes, so they run no code |
| Terminated | Low-memory killer; no callback |

| Neutral scope | Android |
|---|---|
| View | Compose `remember`, `LaunchedEffect` (cancelled when leaving composition) |
| Screen state holder | `ViewModel` + `viewModelScope` (cancelled in `onCleared`) |
| Navigation flow | `ViewModel` scoped to a navigation-graph back-stack entry |
| Signed-in session | A DI scope created on sign-in with its own `CoroutineScope`, cancelled on sign-out |
| App process | An injected application `CoroutineScope(SupervisorJob() + Dispatchers.Default)` — not `GlobalScope` |
| Background job | WorkManager |

- Collect UI streams with `repeatOnLifecycle(Lifecycle.State.STARTED)` in views or `collectAsStateWithLifecycle()` in Compose.
- Activities are recreated on configuration changes by default. Declaring `android:configChanges` skips recreation for the listed changes only; it does nothing for process death and hides bugs for changes not listed.
- Apps targeting Android 16 (API 36) or later ignore manifest orientation, resizability, and aspect-ratio restrictions on displays with a smallest width of 600dp or more (a temporary per-app opt-out exists for API 36, not for API 37) — handle resize as a normal configuration change.

## Saved state and process death

```kotlin
class OrderViewModel(
    savedState: SavedStateHandle,
    private val orders: OrderRepository,
) : ViewModel() {
    private val orderId: String = checkNotNull(savedState["orderId"])   // survives process death

    val uiState: StateFlow<OrderUiState> = orders.observe(orderId)      // Room-backed Flow
        .map(::toUiState)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), OrderUiState.Loading)

    fun refresh() = viewModelScope.launch { orders.refresh(orderId) }  // result lands in Room
}
```

- `SavedStateHandle` survives process death; the `ViewModel` instance does not. `WhileSubscribed(5_000)` keeps the upstream alive across a configuration change without collecting in the background.
- `rememberSaveable` stores UI state in the saved-instance `Bundle`; use a custom `Saver` for non-primitive types and keep values small.
- Saved state crosses a Binder transaction with a small shared buffer; oversized bundles throw `TransactionTooLargeException`. Keep it to IDs and short strings.
- Navigation Compose saves and restores the back stack and route arguments. With navigation libraries where the app owns the back-stack list, persist that list with a saveable holder.
- Register Activity Result launchers unconditionally during creation, so a result delivered to a recreated process finds its callback. For `TakePicture`, keep the output file path in `SavedStateHandle`; after process death it is the only way to find the photo.

## Main thread and async

- Inject dispatchers; use `Dispatchers.Main` for UI, `Dispatchers.IO` for blocking calls. Room and common HTTP clients expose main-safe `suspend` APIs.
- An unresponsive main thread for a few seconds produces an ANR dialog and counts against Play vitals.
- Enable `StrictMode` thread and VM policies in debug builds to catch disk and network access on the main thread.
- Rethrow `CancellationException` (see `kotlin`).

## Background work

```
Only while visible?                         → viewModelScope / lifecycleScope
Must eventually run, survive death/reboot?  → WorkManager (one-time or periodic, with constraints)
  ├─ should start now and is short          → expedited work (quota-limited)
  └─ long-running and user-visible          → long-running worker: setForeground + foreground service type
Large user-initiated transfer               → user-initiated data transfer job (Android 14+)
Ongoing user-aware activity (navigation, call, playback) → foreground service of the matching type
Exact wall-clock time                       → AlarmManager; exact alarms need `SCHEDULE_EXACT_ALARM` (user-revocable, not pre-granted to fresh installs targeting Android 13+) or `USE_EXACT_ALARM` (granted automatically; Play restricts its use)
```

- Deduplicate with `enqueueUniqueWork(name, ExistingWorkPolicy.KEEP, request)`.
- Constraints: `NetworkType.CONNECTED` or `UNMETERED`, `setRequiresBatteryNotLow`, `setRequiresStorageNotLow`, `setRequiresCharging`.
- Retry with `setBackoffCriteria(BackoffPolicy.EXPONENTIAL, ...)` and `Result.retry()`; return `Result.failure()` for permanent errors. Periodic work has a 15-minute minimum interval.
- Standard workers have an execution cap of 10 minutes; longer work calls `setForeground(ForegroundInfo(...))` with a foreground service type declared in the manifest (e.g., `dataSync`) and its permission.
- Report progress with `setProgress`; observe by unique name or ID as a `Flow`.
- WorkManager persists requests across process death, reboot, and app updates and instantiates workers by class name. Renaming a worker class breaks queued work unless a `WorkerFactory` maps the old name.
- A user Force Stop cancels the app's jobs and alarms; WorkManager reschedules on next launch.

Restrictions that defer or deny work (details change per Android version):

- Doze and App Standby defer jobs, alarms, and network access while idle; App Standby Buckets set job and high-priority message quotas by usage.
- Starting a foreground service from the background is blocked except for listed exemptions.
- Foreground services must declare a type; for apps targeting Android 15 or later, `dataSync` and `mediaProcessing` services may run 6 hours in total per 24 hours, then the system calls `onTimeout`.
- Since Android 16, job runtime quota applies to jobs that outlive the visible state and to jobs running alongside a foreground service, so long-running workers can exhaust it.
- Some device manufacturers add battery management beyond AOSP rules that kills background work; test on the OEM devices your users have.

## Push with FCM

- Fetch the token on launch; override `onNewToken` and upload changes. The token changes on reinstall, data clear, and restore to a new device.
- **Notification messages** are shown by the system tray while the app is backgrounded; `onMessageReceived` runs only in the foreground. A tap delivers any data fields as intent extras.
- **Data messages** always reach `onMessageReceived`, with a short execution window; hand longer work to WorkManager.
- High-priority messages can wake the device and permit a foreground-service start; when high-priority messages do not lead to a user-visible notification, FCM may deprioritize them to normal priority.
- Create notification channels at startup; after creation the app cannot raise a channel's importance — the user owns it.
- Notifications need the `POST_NOTIFICATIONS` runtime permission on Android 13+.
- Give every `PendingIntent` explicit mutability (`FLAG_IMMUTABLE` unless mutation is required); build the back stack with `TaskStackBuilder` or a navigation deep link.

## Permissions

```kotlin
val cameraPermission = rememberLauncherForActivityResult(
    ActivityResultContracts.RequestPermission()
) { granted -> viewModel.onCameraPermissionResult(granted) }
```

- `shouldShowRequestPermissionRationale` returns `false` both before the first request and after a permanent denial. Persist an "asked before" flag to tell them apart.
- Denying the same permission twice is a permanent denial; the system stops showing the dialog.
- One-time grants exist for location, camera, and microphone; unused apps have permissions auto-reset and may be hibernated.
- Revoking a permission in Settings kills the app process.
- Location: request coarse and fine together — the user may grant approximate only. Background location is a separate later request that the user grants in Settings, and Play policy adds a declaration for it.
- Media: the photo picker (`PickVisualMedia`) needs no permission. Broad media permissions allow partial "selected photos" grants, and Play policy limits them to apps with a core need.
- Declare `<queries>` for the other apps or intents the app must see (package visibility).

## Navigation and app links

- App Links: an `<intent-filter android:autoVerify="true">` for the https host and paths, plus `/.well-known/assetlinks.json` listing the package and SHA-256 signing-certificate fingerprints. With Play App Signing, publish the **app signing key** fingerprint from Play Console, not the upload key — a common verification failure.
- Unverified web links open in the browser by default on Android 12+.
- Custom schemes are claimable by any app; keep tokens and authorization codes off them (see `auth` for PKCE and redirect handling).
- Deliver links and notifications to a running app through `onNewIntent` with `singleTop`, or the navigation library's deep-link handling, which also synthesizes the back stack.
- Back handling: `OnBackPressedDispatcher` or Compose `BackHandler` / `PredictiveBackHandler`; `onBackPressed()` is deprecated; predictive back system animations are on by default for apps targeting Android 16 (API 36) or later unless the app opts out, and they need the dispatcher or `OnBackInvokedCallback`.
- Treat intents and URIs from other apps as untrusted: validate extras, never forward a received intent blindly (intent redirection), and export only components that must be exported.

## Secure storage and biometrics

- Generate keys in Android Keystore (`KeyGenParameterSpec`); they are non-exportable and hardware-backed where available (TEE, StrongBox).
- Encrypt tokens with a Keystore-held AES-GCM key and store the ciphertext in DataStore or a file. Jetpack Security's `EncryptedSharedPreferences` is deprecated; Tink with a Keystore-backed key is a common replacement.
- Biometric gating: `BiometricPrompt` with a `CryptoObject` wrapping a key created with `setUserAuthenticationRequired(true)`, so the key is unusable without authentication. A prompt without a `CryptoObject` is only UI.
- Auto Backup copies preferences, databases, and files by default. Exclude secrets and Keystore-encrypted data with `android:dataExtractionRules` (and `android:fullBackupContent` for older versions). Keystore keys never transfer, so restored ciphertext cannot decrypt — clear it and re-authenticate on decrypt failure.
- Network Security Config: cleartext is off by default; pin with `<pin-set expiration="...">` including a backup pin; trust user-installed CAs only under `<debug-overrides>`.
- `FLAG_SECURE` blocks screenshots and the recents thumbnail; `setRecentsScreenshotEnabled(false)` hides only the recents snapshot.
- Play Integrity provides device and app attestation; verify the verdict on the server.
- R8 shrinking and obfuscation raise reverse-engineering cost; they do not protect embedded secrets.

## Device constraints

- **Memory:** implement `onTrimMemory`; release UI caches at `TRIM_MEMORY_UI_HIDDEN`. Some finer-grained trim levels are deprecated in newer APIs; prefer `TRIM_MEMORY_UI_HIDDEN` and the callback's current guidance. `android:largeHeap` is not a fix.
- **Startup:** measure with Macrobenchmark (`StartupTimingMetric`) and Play vitals; ship Baseline Profiles; use the SplashScreen API; replace piles of `ContentProvider` initializers with lazy initialization; call `reportFullyDrawn()` when content is usable.
- **Battery:** avoid long partial wake locks; let WorkManager batch work; use balanced-priority location requests.
- **Network:** `ConnectivityManager.NetworkCallback` for changes, `NET_CAPABILITY_NOT_METERED` and Data Saver status before large transfers.
- **Large screens:** window size classes for layout, list-detail scaffolds, Jetpack WindowManager for fold posture.
- **Insets:** apps targeting Android 15 (API 35) or later are drawn edge-to-edge; handle `WindowInsets` for system bars, cutouts, and the keyboard.
- **Text:** font scaling is nonlinear up to 200%; size text in `sp` and test at the maximum.

## Gradle and Kotlin plugin setup

Follow what the project's Android Gradle plugin (AGP) version expects; do not mix the two models.

- AGP 9.0 and later include built-in Kotlin support, enabled by default: apply the Android plugin only and do not also apply `org.jetbrains.kotlin.android`, which is not compatible with the new DSL. Opt out with `android.builtInKotlin=false` (a migration guide covers selective disabling per subproject). AGP 9.0 needs Gradle 9.1.0 or later, JDK 17, and Kotlin Gradle plugin 2.2.10 or later.
- AGP versions before 9.0 need the Kotlin Android plugin applied beside the Android plugin, with the Kotlin plugin version taken from the version catalog.
- Keep AGP, Gradle, Kotlin, and the Compose compiler plugin on a combination their release notes list as compatible; upgrade them together and build after each step.
- Kotlin language and Gradle Kotlin DSL mechanics live in `kotlin`.

---

## Releases on Google Play

- `versionCode` strictly increases; generate it in CI.
- Tracks: internal, closed, open, production. Staged rollout percentages can be increased or halted; halting stops new installs, users already updated keep the build.
- Play App Signing holds the app signing key; protect the upload key.
- In-app updates: *flexible* (background download, prompt to restart) or *immediate* (blocking). Pair with the server-driven minimum-version policy, which also covers sideloaded and non-Play installs.
- Upload the R8 `mapping.txt` and native debug symbols for every release, to Play Console and to the crash reporter.
- Android vitals bad-behavior thresholds can reduce store visibility: a user-perceived crash rate of 1.09% or an ANR rate of 0.47% of daily users overall, or 8% on a single device model.
- Play requires new apps and updates to target a recent API level, raised yearly. From August 31, 2026 the floor is Android 16 (API 36), with an extension request to November 1, 2026; Wear OS and Android Automotive OS need API 35, Android TV and Android XR need API 34. Budget the migration each year.
- Policy declarations: Data safety form, sensitive permissions (background location, broad media, exact alarms), foreground service types, and 16 KB memory page-size support: apps targeting Android 15 (API 35) or later must support it on 64-bit devices, and from February 1, 2027 updates that do not cannot be released.

## Testing commands

| Goal | Command or tool |
|---|---|
| Simulate the system killing a backgrounded process | Background the app, run `adb shell am kill com.example.app`, relaunch from Recents |
| Kill every app once backgrounded | Developer options → Background process limit → No background processes |
| Destroy activities but keep the process | Developer options → Don't keep activities (saved-state round-trip only; singletons survive) |
| User Force Stop (a different scenario) | `adb shell am force-stop com.example.app` — also cancels alarms and jobs |
| Configuration change in tests | `ActivityScenario.recreate()` — the process survives |
| Compose saveable state | `StateRestorationTester(composeTestRule).emulateSavedInstanceStateRestore()` |
| Doze | `adb shell dumpsys battery unplug`, then `adb shell dumpsys deviceidle force-idle`; undo with `deviceidle unforce` and `battery reset` |
| Standby bucket | `adb shell am set-standby-bucket com.example.app rare`; read with `am get-standby-bucket` |
| Inspect scheduled work | Android Studio Background Task Inspector; `adb shell dumpsys jobscheduler` |
| Deep link | `adb shell am start -W -a android.intent.action.VIEW -d "https://example.com/orders/123" com.example.app` |
| App link verification | `adb shell pm get-app-links com.example.app`; `adb shell pm verify-app-links --re-verify com.example.app` |
| Revoke a permission | `adb shell pm revoke com.example.app android.permission.CAMERA` (kills the process) |
| Network loss | `adb shell svc wifi disable`, `adb shell svc data disable`; emulator network speed and signal controls |

## Upload scenario on Android

1. The photo picker returns a content URI with a temporary read grant. Copy the bytes into `filesDir` or `noBackupFilesDir` off the main thread before creating the record — the copy also survives the user deleting the original.
2. In one Room transaction, insert the upload record and its outbox entry.
3. Enqueue `enqueueUniqueWork("upload-" + uploadId, ExistingWorkPolicy.KEEP, request)` with a network constraint (unmetered when the user chose Wi-Fi only) and exponential backoff.
4. The worker promotes itself with `setForeground` and a `dataSync`-typed progress notification for long transfers. For very large user-initiated transfers, a user-initiated data transfer job (Android 14+, `RUN_USER_INITIATED_JOBS` permission, `JobInfo.Builder.setUserInitiated(true)`) is the purpose-built alternative.
5. The worker resumes from the server offset, writes progress to Room, and maps outcomes to results:

```kotlin
class UploadWorker(
    context: Context,
    params: WorkerParameters,
    private val uploads: UploadRepository,          // provided through a WorkerFactory
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val uploadId = inputData.getString(KEY_UPLOAD_ID) ?: return Result.failure()
        setForeground(uploads.foregroundInfo(uploadId))
        return when (uploads.resume(uploadId)) {     // resumes from the server offset, writes progress to Room
            UploadOutcome.Done -> Result.success()
            UploadOutcome.Transient -> Result.retry()
            UploadOutcome.Permanent -> Result.failure()
        }
    }
}
```

6. After process death, Navigation restores the route; the screen's `ViewModel` reads the upload ID from `SavedStateHandle` and observes the record in Room.
7. Launch reconciliation compares records in active states with `getWorkInfosForUniqueWork` and re-enqueues orphans left by a Force Stop or OEM battery management.
