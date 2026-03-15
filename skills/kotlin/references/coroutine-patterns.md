# Coroutine Patterns

## Contents

- [Structured Concurrency](#structured-concurrency)
- [Error Handling](#error-handling)
- [Cancellation](#cancellation)
- [Flow Operators](#flow-operators)
- [Testing Coroutines](#testing-coroutines)
- [Common Concurrency Patterns](#common-concurrency-patterns)

---

## Structured Concurrency

Every coroutine must belong to a `CoroutineScope`. When the scope cancels, all children cancel. When a child fails, the parent fails (unless `SupervisorJob`).

```kotlin
// Scope tied to lifecycle — e.g., ViewModel, Service
class OrderService(private val scope: CoroutineScope) {

    // launch — fire-and-forget (returns Job)
    fun processAsync(orderId: String) = scope.launch {
        val order = fetchOrder(orderId)
        val inventory = async { checkInventory(order) }   // concurrent
        val payment = async { processPayment(order) }     // concurrent
        finalize(order, inventory.await(), payment.await())
    }
}

// coroutineScope {} — creates child scope, suspends until all children complete
suspend fun fetchUserWithPosts(userId: String): UserWithPosts = coroutineScope {
    val user = async { userApi.get(userId) }
    val posts = async { postApi.getByUser(userId) }
    UserWithPosts(user.await(), posts.await())
    // If either fails, the other is cancelled automatically
}

// supervisorScope {} — child failure does NOT cancel siblings
suspend fun fetchDashboard(): Dashboard = supervisorScope {
    val profile = async { fetchProfile() }        // required
    val recommendations = async {                  // optional
        try { fetchRecommendations() }
        catch (e: Exception) { emptyList() }       // graceful degradation
    }
    Dashboard(profile.await(), recommendations.await())
}
```

**Scope hierarchy decision:**

| Scope | Failure behavior | Use for |
|-------|-----------------|---------|
| `coroutineScope` | One fails → all cancel | Related tasks that depend on each other |
| `supervisorScope` | One fails → others continue | Independent tasks, graceful degradation |
| `CoroutineScope(SupervisorJob())` | Class-level scope | Service/ViewModel lifecycle |

---

## Error Handling

```kotlin
// CoroutineExceptionHandler — last resort for uncaught exceptions
val handler = CoroutineExceptionHandler { _, exception ->
    logger.error("Uncaught coroutine exception", exception)
    metrics.increment("coroutine.uncaught_exception")
}

val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default + handler)

// Structured error handling in async
suspend fun <T> retryWithBackoff(
    times: Int = 3,
    initialDelay: Long = 100,
    factor: Double = 2.0,
    block: suspend () -> T,
): T {
    var currentDelay = initialDelay
    repeat(times - 1) {
        try {
            return block()
        } catch (e: Exception) {
            if (e is CancellationException) throw e  // NEVER swallow cancellation
            logger.warn("Attempt ${it + 1} failed, retrying in ${currentDelay}ms", e)
            delay(currentDelay)
            currentDelay = (currentDelay * factor).toLong()
        }
    }
    return block() // Last attempt — let exception propagate
}

// Result wrapper for coroutines
sealed interface Outcome<out T> {
    data class Success<T>(val value: T) : Outcome<T>
    data class Failure(val error: Throwable) : Outcome<Nothing>
}

suspend fun <T> runCatching(block: suspend () -> T): Outcome<T> =
    try {
        Outcome.Success(block())
    } catch (e: CancellationException) {
        throw e  // Always rethrow
    } catch (e: Throwable) {
        Outcome.Failure(e)
    }
```

**Critical rule:** Never catch `CancellationException` without rethrowing. It breaks structured concurrency.

---

## Cancellation

```kotlin
// Cooperative cancellation — check isActive or use suspending functions
suspend fun processItems(items: List<Item>) {
    for (item in items) {
        ensureActive()  // Throws CancellationException if cancelled
        process(item)
    }
}

// withTimeout — cancels if too slow
val result = withTimeout(5_000) {
    fetchFromSlowApi()
}

// withTimeoutOrNull — returns null instead of throwing
val result = withTimeoutOrNull(5_000) {
    fetchFromSlowApi()
} ?: fallbackValue

// Non-cancellable block — for cleanup code that must complete
suspend fun close() {
    withContext(NonCancellable) {
        saveState()     // Must complete even if scope is cancelled
        releaseResources()
    }
}

// Job lifecycle
val job = scope.launch { work() }
job.cancel()           // Request cancellation
job.cancelAndJoin()    // Cancel and wait for completion
job.isActive           // Still running
job.isCancelled        // Cancellation requested
job.isCompleted        // Finished (success, failure, or cancellation)
```

---

## Flow Operators

```kotlin
// Transformation operators
flow.map { it.uppercase() }
flow.filter { it.isNotEmpty() }
flow.mapNotNull { it.toIntOrNull() }
flow.flatMapConcat { fetchDetails(it) }    // Sequential
flow.flatMapMerge { fetchDetails(it) }     // Concurrent (default concurrency = 16)
flow.flatMapLatest { searchApi(it) }       // Cancel previous, start new

// Combining flows
combine(flowA, flowB) { a, b -> Pair(a, b) }   // Latest from each
flowA.zip(flowB) { a, b -> Pair(a, b) }        // Paired emissions
merge(flowA, flowB)                              // Interleaved

// Rate limiting
flow.debounce(300)              // Wait for pause in emissions
flow.sample(1000)               // Take latest every interval
flow.distinctUntilChanged()     // Skip consecutive duplicates

// Error handling
flow
    .retry(3) { e -> e is IOException }   // Retry upstream
    .catch { e -> emit(fallbackValue) }   // Handle + recover
    .onCompletion { e ->                  // Finally block
        if (e != null) logger.error("Flow failed", e)
    }

// Context
flow
    .flowOn(Dispatchers.IO)       // Upstream runs on IO
    .collect { value ->            // Collector runs on caller's dispatcher
        updateUi(value)
    }

// StateFlow / SharedFlow conversion
val stateFlow: StateFlow<State> = flow
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = State.Loading,
    )

val sharedFlow: SharedFlow<Event> = flow
    .shareIn(
        scope = viewModelScope,
        started = SharingStarted.Eagerly,
        replay = 0,
    )
```

---

## Testing Coroutines

```kotlin
// Use kotlinx-coroutines-test
@Test
fun `test with virtual time`() = runTest {
    val flow = MutableStateFlow(0)
    val values = mutableListOf<Int>()

    // backgroundScope — auto-cancelled when test completes
    backgroundScope.launch {
        flow.collect { values.add(it) }
    }

    flow.value = 1
    flow.value = 2
    advanceUntilIdle()
    assertEquals(listOf(0, 1, 2), values)
}

@Test
fun `test with delay`() = runTest {
    var result = ""
    launch {
        delay(1_000)
        result = "done"
    }
    advanceTimeBy(999)
    assertEquals("", result)
    advanceTimeBy(1)
    assertEquals("done", result)
}

// Test dispatcher injection
class MyService(private val dispatcher: CoroutineDispatcher = Dispatchers.Default) {
    suspend fun compute() = withContext(dispatcher) { /* ... */ }
}

@Test
fun `test with injected dispatcher`() = runTest {
    val service = MyService(UnconfinedTestDispatcher(testScheduler))
    // Tests run synchronously, deterministically
}

// Turbine — Flow testing library
@Test
fun `test flow emissions`() = runTest {
    val flow = userRepository.observeUser("123")
    flow.test {
        assertEquals(UiState.Loading, awaitItem())
        assertEquals(UiState.Success(user), awaitItem())
        cancelAndConsumeRemainingEvents()
    }
}
```

---

## Common Concurrency Patterns

```kotlin
// Mutex — coroutine-safe mutual exclusion
val mutex = Mutex()
var sharedCounter = 0

suspend fun incrementSafely() {
    mutex.withLock {
        sharedCounter++
    }
}

// Semaphore — limit concurrency
val semaphore = Semaphore(10) // Max 10 concurrent operations

suspend fun rateLimitedFetch(url: String): Response {
    semaphore.withPermit {
        return httpClient.get(url)
    }
}

// Fan-out / fan-in with channels
suspend fun processInParallel(items: List<Item>, concurrency: Int = 4) = coroutineScope {
    val channel = Channel<Item>(Channel.BUFFERED)
    val results = Channel<Result>(Channel.BUFFERED)

    // Producer
    launch { items.forEach { channel.send(it) }; channel.close() }

    // Workers (fan-out)
    repeat(concurrency) {
        launch { for (item in channel) results.send(process(item)) }
    }

    // Collect results (fan-in)
    buildList { repeat(items.size) { add(results.receive()) } }
}

// State owner pattern — single coroutine owns mutable state via Channel
// (actor {} is deprecated; use Channel + launch instead)
sealed interface CounterMsg {
    data object Increment : CounterMsg
    data class GetCount(val response: CompletableDeferred<Int>) : CounterMsg
}

fun CoroutineScope.counterActor(): Channel<CounterMsg> {
    val channel = Channel<CounterMsg>()
    launch {
        var count = 0
        for (msg in channel) {
            when (msg) {
                is CounterMsg.Increment -> count++
                is CounterMsg.GetCount -> msg.response.complete(count)
            }
        }
    }
    return channel
}
```
