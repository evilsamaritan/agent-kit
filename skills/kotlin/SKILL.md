---
name: kotlin
description: Write idiomatic Kotlin — coroutines, Flow, sealed classes, KMP, DSL builders, Gradle KTS, context parameters. Use when working with Kotlin coroutines, Flow, sealed hierarchies, data/value classes, multiplatform, DSL builders, or Gradle Kotlin DSL. Do NOT use for Android UI (use platform-specific guidance) or general JVM patterns.
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Kotlin

Idiomatic Kotlin patterns, coroutines, multiplatform, Gradle KTS. Kotlin 2.3+ / K2 compiler.

---

## Core Mental Model

Kotlin favors **exhaustive type hierarchies** over stringly-typed logic, **structured concurrency** over fire-and-forget threads, and **delegation** over inheritance. Every pattern below follows from these principles.

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
| `Dispatchers.IO` | Blocking I/O | Elastic, up to 64 |
| `Dispatchers.Main` | UI updates | Main/UI thread |
| `Dispatchers.Unconfined` | Testing only | Resumes in caller's thread |

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

Use sealed hierarchies for: state machines, result types, navigation events, API responses, error categories.

---

## Guard Conditions in `when` (Stable, Kotlin 2.2+)

```kotlin
fun handle(response: Response) = when (response) {
    is Response.Success -> process(response.data)
    is Response.Error if response.code in 400..499 -> handleClientError(response)
    is Response.Error -> handleServerError(response)
}
```

Add `if` clauses to `when` branches — avoids nested `when`/`if` blocks.

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

## Context Parameters (Beta, Kotlin 2.2+)

```kotlin
context(logger: Logger, metrics: Metrics)
fun handle(request: Request) {
    logger.info("Handling request")
    metrics.record("requests", 1.0)
}
```

Replace deprecated context receivers — require a name, explicit reference. Enable: `-Xcontext-parameters`. Context receivers removal planned ~Kotlin 2.4.

---

## KMP (Kotlin Multiplatform)

`commonMain/` (pure Kotlin) + platform source sets (`androidMain/`, `iosMain/`, `jvmMain/`). Use `expect`/`actual` for platform APIs; prefer interfaces + DI over expect/actual where possible.

**Compose Multiplatform** — iOS stable since 1.8.0. Share UI across Android, iOS, desktop, web.
**Swift Export** — direct Kotlin-to-Swift translation, bypassing Objective-C interop layer.

---

## Gradle KTS

```kotlin
// Version catalogs (libs.versions.toml) — single source of truth
[versions]
kotlin = "2.3.0"
coroutines = "1.10.1"

[libraries]
kotlinx-coroutines = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }

// Convention plugins — shared build logic
// buildSrc/src/main/kotlin/kotlin-library.gradle.kts
plugins {
    kotlin("jvm")
}
kotlin { jvmToolchain(21) }
```

---

## Anti-Patterns

1. **`GlobalScope.launch`** — leaks coroutines; always use a structured `CoroutineScope`
2. **Catching `CancellationException`** — breaks structured concurrency; rethrow if caught
3. **Mutable shared state in coroutines** — use `Mutex`, `StateFlow`, or `Channel` instead
4. **Over-nesting scope functions** — `x.let { it.also { it.run { } } }` is unreadable; extract functions
5. **Stringly-typed states** — model states as sealed types; compiler enforces exhaustive handling
6. **`actor {}` coroutine builder** — deprecated; use `Channel` + `launch` pattern instead
7. **Context receivers** — deprecated in favor of context parameters (Kotlin 2.2+); migrate with IntelliJ quick-fix
8. **`kotlinOptions {}` in Gradle** — removed in Kotlin 2.2+; use `compilerOptions {}` instead

---

## Context Adaptation

**Backend:** coroutine scopes tied to request lifecycle, Flow for reactive pipelines/SSE, sealed classes for error hierarchies. **DevOps:** Gradle KTS convention plugins, version catalogs, KMP CI targets.

---

## Related Knowledge

- **backend** — service patterns, DI, middleware when building Kotlin backend services
- **database** — Exposed/Ktorm ORM patterns, connection pooling
- **qa** — testing coroutines, Turbine for Flow testing

## References

- `references/coroutine-patterns.md` — structured concurrency, error handling, testing, Flow operators
- `references/language-patterns.md` — DSL builders, delegation, contracts, scope functions, idiomatic Kotlin
