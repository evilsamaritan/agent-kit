---
name: kotlin
description: "Write or review Kotlin. Use for coroutines, Flow, sealed types, KMP, DSLs, data/value classes, and Gradle Kotlin DSL."
user-invocable: true
---

# Kotlin

Idiomatic Kotlin: null safety, sealed types, coroutines and Flow, multiplatform, Gradle Kotlin DSL.

**Determine the project's Kotlin version first** (the Kotlin plugin version in the version catalog or build files, and the Gradle and Android Gradle plugin versions beside it). Use language features only up to that version; version-dependent features are listed in [language-patterns.md](references/language-patterns.md#version-dependent-features).

## Core Mental Model

Kotlin favors **exhaustive type hierarchies** over stringly-typed logic, **structured concurrency** over fire-and-forget threads, and **delegation** over inheritance. Every pattern below follows from these principles.

## Hard rules

- No `!!` outside tests and proven invariants; use `?.`, `?:`, `requireNotNull`, or `checkNotNull` with a message.
- Values from Java are platform types: declare the nullability you expect at the boundary instead of letting `String!` flow inward.
- Never catch `CancellationException` without rethrowing it, and prefer catching specific exceptions over `Exception` or `Throwable`. The standard `runCatching` catches cancellation too, so avoid it around suspending calls.
- Every coroutine has an owner scope; no `GlobalScope`.
- Pick the type by what is produced: `suspend` for one value, `Flow` for a stream over time, `Sequence` for lazy synchronous iteration.

---

## Coroutines Fundamentals

**Structured concurrency** — every coroutine has a parent scope. Parent cancels → all children cancel. Child fails → parent fails (unless `SupervisorJob`).

```kotlin
class UserService(private val scope: CoroutineScope) {
    fun refresh() = scope.launch {
        val profile = async { fetchProfile() }
        val prefs = async { fetchPreferences() }
        update(profile.await(), prefs.await())
    }
}
```

| Dispatcher | Use for | Thread pool |
|------------|---------|-------------|
| `Dispatchers.Default` | CPU-intensive work | Shared, core count |
| `Dispatchers.IO` | Blocking I/O | Elastic; 64 threads by default, or the core count if larger |
| `Dispatchers.Main` | UI updates | Main/UI thread |
| `Dispatchers.Unconfined` | Rarely; test dispatchers use it | Resumes in the caller's thread; not for general code |

**SupervisorJob** — child failure does not cancel siblings. Use for independent parallel tasks.

---

## Flow

| Type | Hot/Cold | Replay | Use for |
|------|----------|--------|---------|
| `Flow<T>` | Cold | None | One-shot data streams, transformations |
| `StateFlow<T>` | Hot | Last value | Observable state (replaces LiveData) |
| `SharedFlow<T>` | Hot | Configurable | Events, broadcasts |
| `Channel<T>` | Hot | None | Point-to-point communication |

**Key operators:** `map`, `filter`, `flatMapLatest` (cancel previous), `combine` (merge latest), `debounce`, `distinctUntilChanged`, `catch` (upstream errors), `flowOn` (change upstream dispatcher).

**Backpressure:** `buffer()` for producer-consumer decoupling, `conflate()` to drop intermediate, `collectLatest` to cancel slow collectors.

---

## Sealed Hierarchies

```kotlin
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String, val cause: Throwable? = null) : UiState<Nothing>
}

fun <T> render(state: UiState<T>) = when (state) {
    is UiState.Loading -> showSpinner()
    is UiState.Success -> showData(state.data)
    is UiState.Error -> showError(state.message)
}
```

Use sealed hierarchies for closed sets: state machines, result types, navigation events, API responses, error categories; `when` used as an expression, without `else`, makes a new subtype a compile error. An open family — providers, channels, plugins — is an interface each member implements, registered once; consumers call it instead of `when (x) { is A -> … }` (`development`).

---

## Scope Functions

| Function | Object ref | Return | Use when |
|----------|-----------|--------|----------|
| `let` | `it` | Lambda result | Null-safe chains: `x?.let { use(it) }` |
| `run` | `this` | Lambda result | Configure + compute |
| `with` | `this` | Lambda result | Group calls on same object (non-null) |
| `apply` | `this` | Object | Object configuration: `Builder().apply { ... }` |
| `also` | `it` | Object | Side effects: logging, validation |

**Rule:** If you nest more than 2 scope functions, refactor into named functions.

---

## Data & Value Classes

```kotlin
data class User(val id: UserId, val name: String, val email: Email)

@JvmInline
value class UserId(val value: String)
```

Data classes: structural equality, `copy`, destructuring. Value classes: zero-overhead type-safe wrappers. **Delegation** (`by`) — delegates interface implementation without boilerplate.

---

## Context Parameters

```kotlin
context(logger: Logger, metrics: Metrics)
fun handle(request: Request) {
    logger.info("Handling request")
    metrics.record("requests", 1.0)
}
```

Context parameters are stable from Kotlin 2.4 (explicit context arguments and callable references are not part of that stabilization); earlier versions need the `-Xcontext-parameters` compiler option. They replace context receivers, an older experimental feature. A context parameter is named and referenced explicitly. Use them for ambient dependencies that pass through many call layers (a logger, a transaction, a clock), not as a substitute for constructor injection (`development`).

---

## KMP (Kotlin Multiplatform)

`commonMain/` (pure Kotlin) plus platform source sets (`androidMain/`, `iosMain/`, `jvmMain/`).

```
Platform-specific behavior needed in common code?
├── A capability with several possible implementations → an interface in commonMain, implementations per platform, wired by dependency injection
└── A tiny platform primitive with exactly one implementation per target (a clock, UUID, file path) → expect/actual
```

Platform and UI-sharing status (Compose Multiplatform, Swift export) changes between releases: check the release notes of the project's Kotlin version. Android and iOS app concerns are in `mobile`.

---

## Gradle Kotlin DSL

```
Which Kotlin plugin does the module apply?
├── JVM library or service → org.jetbrains.kotlin.jvm
├── Multiplatform → org.jetbrains.kotlin.multiplatform
└── Android → Android Gradle plugin 9.0 and later have built-in Kotlin support and do not need the `org.jetbrains.kotlin.android` plugin; older AGP versions apply it; see `mobile`
```

Use the version catalog as the single source of versions, and use the versions the project's catalog already declares.

```toml
# gradle/libs.versions.toml
[versions]
kotlin = "<project's Kotlin version>"
coroutines = "<project's coroutines version>"

[libraries]
kotlinx-coroutines-core = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
```

```kotlin
// build.gradle.kts
plugins { alias(libs.plugins.kotlin.jvm) }

dependencies { implementation(libs.kotlinx.coroutines.core) }

kotlin { jvmToolchain(21) } // the JDK the project targets
```

Share build logic as convention plugins in an included build (`build-logic`), not in `buildSrc`: Gradle documents that any change in `buildSrc` makes the entire build out-of-date, while a change in an included build only invalidates the projects that use its products. Configure compiler flags with `compilerOptions {}`.

---

## Anti-Patterns

1. **`GlobalScope.launch`** — leaks coroutines; always use a structured `CoroutineScope`
2. **Catching `CancellationException`** — breaks structured concurrency; rethrow if caught
3. **Mutable shared state in coroutines** — use `Mutex`, `StateFlow`, or `Channel` instead
4. **Over-nesting scope functions** — `x.let { it.also { it.run { } } }` is unreadable; extract functions
5. **Stringly-typed states** — model states as sealed types; compiler enforces exhaustive handling
6. **`actor {}` coroutine builder** — annotated `@ObsoleteCoroutinesApi`; a `Channel` plus `launch` owns state without it
7. **Context receivers** — replaced by context parameters; migrate with the IDE assisted support
8. **`kotlinOptions {}` in Gradle** — replaced by `compilerOptions {}`
9. **`runCatching` around suspending calls** — it catches `CancellationException`; catch specific exceptions or rethrow
10. **`!!` for convenience** — hides a null that a contract should have excluded

---

## Related Knowledge

- **development** — code practice these idioms express: variant families, ownership, explicit dependencies
- **backend** — service wiring, middleware, lifecycle when building Kotlin backend services
- **database** — Exposed/Ktorm ORM patterns, connection pooling
- **testing** — test strategy; coroutine and Flow testing examples are in the coroutine reference
- **mobile** — Android and iOS app lifecycle, Android Gradle plugin details

## References

- [coroutine-patterns.md](references/coroutine-patterns.md) — structured concurrency, error handling, cancellation, Flow operators, testing
- [language-patterns.md](references/language-patterns.md) — DSL builders, delegation, contracts, scope functions, sealed state machines, version-dependent features
