# Kotlin Language Patterns

## Contents

- [DSL Builders](#dsl-builders)
- [Delegation](#delegation)
- [Contracts](#contracts)
- [Scope Functions in Depth](#scope-functions-in-depth)
- [Sealed Hierarchies](#sealed-hierarchies)
- [Extension Functions](#extension-functions)
- [Idiomatic Kotlin](#idiomatic-kotlin)

---

## DSL Builders

```kotlin
// Type-safe builder with @DslMarker to prevent scope leaking
@DslMarker
annotation class HtmlDsl

@HtmlDsl
class HTML {
    private val children = mutableListOf<Element>()

    fun head(init: Head.() -> Unit) { children.add(Head().apply(init)) }
    fun body(init: Body.() -> Unit) { children.add(Body().apply(init)) }

    override fun toString() = "<html>${children.joinToString("")}</html>"
}

@HtmlDsl
class Body {
    private val children = mutableListOf<Element>()
    fun div(init: Div.() -> Unit) { children.add(Div().apply(init)) }
    fun p(text: String) { children.add(Text(text)) }
}

fun html(init: HTML.() -> Unit): HTML = HTML().apply(init)

// Usage — reads like markup
val page = html {
    head { title("My Page") }
    body {
        div {
            p("Hello, World!")
        }
        // head { } // Compile error — @DslMarker prevents scope leak
    }
}

// Configuration DSL — common in Ktor, Exposed, Gradle
class ServerConfig {
    var port: Int = 8080
    var host: String = "0.0.0.0"
    private val routes = mutableListOf<Route>()

    fun routing(init: RoutingBuilder.() -> Unit) {
        routes.addAll(RoutingBuilder().apply(init).build())
    }
}

fun server(init: ServerConfig.() -> Unit): Server {
    val config = ServerConfig().apply(init)
    return Server(config)
}

// Usage
val app = server {
    port = 3000
    routing {
        get("/health") { respond("OK") }
        post("/users") { createUser(request) }
    }
}
```

**Builder pattern key ingredients:**
1. `@DslMarker` annotation — prevents implicit access to outer scopes
2. Receiver lambda (`T.() -> Unit`) — `this` refers to builder
3. `apply` — configure and return the builder
4. Infix functions — `"name" to "value"` for map-like DSLs

---

## Delegation

```kotlin
// Property delegation — lazy, observable, map-backed
class Config(properties: Map<String, Any>) {
    val name: String by properties           // Map delegation
    val port: Int by properties
    val debug: Boolean by lazy { checkDebugMode() }   // Lazy — computed once

    var count: Int by Delegates.observable(0) { _, old, new ->
        println("count changed from $old to $new")
    }

    var validated: String by Delegates.vetoable("") { _, _, new ->
        new.length <= 100  // Reject if too long
    }
}

// Custom delegate
class Trimmed : ReadWriteProperty<Any?, String> {
    private var value = ""
    override fun getValue(thisRef: Any?, property: KProperty<*>) = value
    override fun setValue(thisRef: Any?, property: KProperty<*>, value: String) {
        this.value = value.trim()
    }
}

class Form {
    var name: String by Trimmed()   // Auto-trims on set
}

// Interface delegation — compose behavior from implementations
interface Logger { fun log(msg: String) }
interface Metrics { fun record(name: String, value: Double) }

class ConsoleLogger : Logger {
    override fun log(msg: String) = println("[LOG] $msg")
}

class InMemoryMetrics : Metrics {
    override fun record(name: String, value: Double) { /* store */ }
}

// Compose via delegation — no boilerplate
class MonitoredService(
    logger: Logger = ConsoleLogger(),
    metrics: Metrics = InMemoryMetrics(),
) : Logger by logger, Metrics by metrics {
    fun process() {
        log("Processing started")
        record("process.count", 1.0)
    }
}
```

---

## Contracts

```kotlin
import kotlin.contracts.*

// Tell compiler about control flow guarantees
@OptIn(ExperimentalContracts::class)
fun requireNotEmpty(value: String?): String {
    contract {
        returns() implies (value != null)  // After return, value is known non-null
    }
    require(!value.isNullOrEmpty()) { "Value must not be empty" }
    return value
}

// callsInPlace — lambda executes exactly once
@OptIn(ExperimentalContracts::class)
inline fun <T> measureTime(block: () -> T): Pair<T, Long> {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    val start = System.nanoTime()
    val result = block()
    return result to (System.nanoTime() - start)
}

// Enables val initialization in lambda
val value: String
measureTime {
    value = computeExpensiveString()  // OK — compiler knows block runs exactly once
}
```

---

## Scope Functions in Depth

```kotlin
// let — null-safe chains, transform values
val length = name?.let { it.trim() }?.let { it.length } ?: 0

// Naming convention in let chains
val result = fetchUser()?.let { user ->
    fetchOrders(user.id)?.let { orders ->
        buildReport(user, orders)
    }
}
// Better: decompose into functions instead of nesting let

// run — object configuration + compute result
val connection = database.run {
    setAutoCommit(false)
    setTransactionIsolation(SERIALIZABLE)
    createConnection()  // returns Connection
}

// with — group calls on non-null object (no null safety)
val details = with(user) {
    """
    Name: $name
    Email: $email
    Role: ${role.displayName}
    """.trimIndent()
}

// apply — configure object, return object itself
val request = Request().apply {
    url = "https://api.example.com"
    method = "POST"
    headers["Content-Type"] = "application/json"
    body = payload
}

// also — side effects, debugging, validation
val user = createUser(params)
    .also { logger.info("Created user: ${it.id}") }
    .also { metrics.increment("users.created") }
    .also { require(it.isValid()) { "Invalid user state" } }
```

---

## Sealed Hierarchies

```kotlin
// State machine with sealed interfaces
sealed interface ConnectionState {
    data object Disconnected : ConnectionState
    data object Connecting : ConnectionState
    data class Connected(val session: Session) : ConnectionState
    data class Error(val cause: Throwable, val retryCount: Int) : ConnectionState
}

// State transitions — exhaustive when ensures all states handled
fun ConnectionState.transition(event: Event): ConnectionState = when (this) {
    is ConnectionState.Disconnected -> when (event) {
        is Event.Connect -> ConnectionState.Connecting
        else -> this
    }
    is ConnectionState.Connecting -> when (event) {
        is Event.Connected -> ConnectionState.Connected(event.session)
        is Event.Failed -> ConnectionState.Error(event.cause, retryCount = 0)
        else -> this
    }
    is ConnectionState.Connected -> when (event) {
        is Event.Disconnect -> ConnectionState.Disconnected
        is Event.Failed -> ConnectionState.Error(event.cause, retryCount = 0)
        else -> this
    }
    is ConnectionState.Error -> when (event) {
        is Event.Retry -> if (retryCount < 3) ConnectionState.Connecting else this
        is Event.Disconnect -> ConnectionState.Disconnected
        else -> this
    }
}

// Nested sealed hierarchies for error categorization
sealed interface AppError {
    val message: String

    sealed interface Network : AppError {
        data class Timeout(override val message: String) : Network
        data class NoConnection(override val message: String) : Network
    }

    sealed interface Validation : AppError {
        data class MissingField(val field: String) : Validation {
            override val message = "Missing required field: $field"
        }
        data class InvalidFormat(val field: String, val expected: String) : Validation {
            override val message = "Invalid format for $field, expected $expected"
        }
    }

    data class Unknown(override val message: String, val cause: Throwable) : AppError
}
```

---

## Extension Functions

```kotlin
// Add functionality without inheritance
fun String.toSlug(): String =
    lowercase()
        .replace(Regex("[^a-z0-9\\s-]"), "")
        .replace(Regex("\\s+"), "-")
        .trim('-')

// Extension on nullable type
fun String?.orEmpty(): String = this ?: ""
fun <T> List<T>?.orEmpty(): List<T> = this ?: emptyList()

// Extension properties
val String.wordCount: Int
    get() = split(Regex("\\s+")).filter { it.isNotEmpty() }.size

// Scoped extensions — only available in specific context
class Database {
    fun String.asColumn(): Column = Column(this)

    fun createTable(name: String, init: TableBuilder.() -> Unit) {
        // "id".asColumn() works here but not outside Database
    }
}
```

---

## Idiomatic Kotlin

```kotlin
// Destructuring
val (name, age) = user                           // data class
val (key, value) = mapEntry                      // Map.Entry
for ((index, item) in list.withIndex()) { }      // indexed iteration

// Collection operations — prefer functional over imperative
val activeAdmins = users
    .filter { it.isActive }
    .filter { Role.ADMIN in it.roles }
    .sortedByDescending { it.lastLogin }
    .take(10)

// groupBy + mapValues for aggregation
val byDepartment: Map<Dept, List<String>> = employees
    .groupBy({ it.department }, { it.name })

// buildList / buildMap / buildString
val items = buildList {
    add("always")
    if (condition) add("conditional")
    addAll(dynamicItems)
}

// require / check / error — stdlib preconditions
fun transfer(amount: Int, from: Account, to: Account) {
    require(amount > 0) { "Amount must be positive: $amount" }
    check(from.balance >= amount) { "Insufficient funds" }
    // ...
}

// use — auto-close resources (like try-with-resources)
File("data.txt").bufferedReader().use { reader ->
    reader.lineSequence().forEach { process(it) }
}

// Sealed + when for exhaustive pattern matching
// Always prefer when expression over if-else chains for 3+ branches
```
