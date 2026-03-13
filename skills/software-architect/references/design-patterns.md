# Design Patterns

GoF patterns, modern patterns, and anti-patterns.
**Apply patterns to solve specific problems. Never apply prophylactically.**

For each pattern: what problem it solves, when to use, when NOT to use.

## Contents

- [Pattern Selection Guide](#pattern-selection-guide)
- [Creational Patterns](#creational-patterns) — Factory Method, Abstract Factory, Builder, Prototype, Singleton
- [Structural Patterns](#structural-patterns) — Adapter, Bridge, Composite, Decorator, Facade, Proxy
- [Behavioral Patterns](#behavioral-patterns) — Strategy, Observer, Command, State, Chain of Responsibility, Template Method, Mediator
- [Modern Patterns (Beyond GoF)](#modern-patterns-beyond-gof) — Repository, Unit of Work, Specification, Saga, Outbox
- [Anti-Patterns](#anti-patterns) — God Object, Anemic Domain Model, Distributed Monolith, Big Ball of Mud, Golden Hammer

---

## Pattern Selection Guide

Before applying any pattern, name the problem:

| Problem | Pattern |
|---------|---------|
| Need interchangeable algorithms | Strategy |
| State changes must propagate to many consumers | Observer |
| Need undo/redo or request queuing | Command |
| Adding behavior without modifying classes | Decorator |
| Complex subsystem needs simple interface | Facade |
| Creating families of related objects | Abstract Factory |
| Building complex objects step by step | Builder |
| Conditional object creation | Factory Method |
| Converting incompatible interfaces | Adapter |
| Multiple dimensions of variation | Bridge |
| Managing distributed transactions | Saga |
| Reliable event publishing | Outbox Pattern |
| Complex conditional logic based on state | State |
| Multiple clients need only part of an interface | Interface Segregation |
| Decouple domain from persistence | Repository |

---

## Creational Patterns

### Factory Method
Creates objects through a method that subclasses can override.

```
Creator.createProduct() → Product
ConcreteCreatorA.createProduct() → ProductA
ConcreteCreatorB.createProduct() → ProductB
```

**Use when:** Creation logic varies by context or subtype; callers shouldn't know which concrete class to create.  
**Don't use when:** There's only one type of product — it's just indirection.

### Abstract Factory
Creates families of related objects without specifying concrete classes.

**Use when:** You need to ensure product compatibility across a family (UI toolkit: macOS buttons + macOS menus; Windows buttons + Windows menus).  
**Don't use when:** Products don't have relationships requiring consistency.

### Builder
Constructs complex objects step-by-step. Separates construction from representation.

```
new QueryBuilder()
  .select("id", "name")
  .from("users")
  .where("active = true")
  .limit(100)
  .build()
```

**Use when:** Object has many optional parameters; telescoping constructors become unreadable; construction requires validation across multiple parameters.  
**Don't use when:** Object has 2–3 simple required parameters.

### Prototype
Creates new objects by cloning existing ones.

**Use when:** Object instantiation is expensive; new objects are slight variations of existing ones.

### Singleton
Ensures one instance exists globally.

**AVOID in most cases:**
- Introduces global state (makes testing hard)
- Hides dependencies (callers don't know they depend on the singleton)
- Thread-safety pitfalls
- Violates SRP (manages its own lifecycle AND does its job)

**Fix:** Use dependency injection of a single-instance object. The DI container manages the lifetime. The object itself is ignorant of being "single."

---

## Structural Patterns

### Adapter
Converts one interface to another. Lets incompatible classes work together.

**Use when:** Integrating with a legacy system or third-party library whose interface doesn't match yours.

```
Target interface (yours)  →  Adapter  →  Adaptee (theirs)
```

### Bridge
Decouples an abstraction from its implementation so both can vary independently.

**Use when:** You have multiple dimensions of variation (shapes × rendering engines; notifications × channels). Without Bridge, you get combinatorial explosion of subclasses.

### Composite
Treats individual objects and compositions uniformly. Tree structures.

**Use when:** Clients should treat single items and groups identically (file system, UI component trees, organization hierarchies).

### Decorator
Adds behavior to objects dynamically without modifying the class.

```
LoggingRepository(
  CachingRepository(
    PostgresRepository(db)
  )
)
```

**Use when:** You need composable behavior additions; inheritance would create too many subclass combinations.  
**Don't use when:** The order of decorators is unclear or decoration logic is complex — consider a pipeline/chain pattern instead.

### Facade
Provides a simplified interface to a complex subsystem.

**Use when:** External callers shouldn't need to understand internal complexity; you want to decouple clients from subsystem evolution.

**Stripe's entire API is a Facade** — the payment processing complexity is enormous; the API surface is simple and stable.

### Proxy
Controls access to another object.

Types:
- **Virtual proxy:** lazy loading (load the expensive thing only when accessed)
- **Protection proxy:** access control
- **Remote proxy:** local representation of a remote object
- **Logging proxy:** intercepts calls for logging/monitoring

**Use when:** You need a layer of control over an object's lifecycle, access, or behavior without the caller knowing.

---

## Behavioral Patterns

### Strategy
Defines a family of algorithms and makes them interchangeable.

```
Sorter { sort(data, strategy: SortStrategy) }
QuickSortStrategy, MergeSortStrategy, TimSortStrategy
```

**Use when:** You have a switch/if-else selecting between algorithms; callers should be able to vary the algorithm independently from the logic that uses it.

**This is the primary replacement for switch statements on type.**

### Observer (Publish-Subscribe)
One-to-many dependency: when one object changes, all dependents are notified.

**Use when:** State changes in one object must trigger updates in others; you don't know how many or which objects need to respond.

**Event-driven architectures are Observer at the system level.**

**Watch out for:** Cascading events (A notifies B which notifies C which notifies A), memory leaks from unregistered observers, unclear ordering.

### Command
Encapsulates a request as an object.

**Use when:** You need undo/redo; you need to queue or log requests; you need to parameterize objects with operations.

### State
Allows an object to alter its behavior when its internal state changes. Looks like the object changed its class.

```
TrafficLight: Red → Green → Yellow → Red
    each state handles events differently
```

**Use when:** An object's behavior depends on its state; state transitions are explicit; nested conditionals checking state are getting complex.

**Replaces:** `if (state == A) { ... } else if (state == B) { ... }` with polymorphic state objects.

### Chain of Responsibility
Passes a request along a chain of handlers until one processes it.

**Use when:** More than one handler can process a request; the handler set should be configurable at runtime.

**Examples:** HTTP middleware pipelines, exception handlers, approval workflows.

### Template Method
Defines the skeleton of an algorithm in a base class; subclasses override specific steps.

**Use when:** An algorithm has invariant parts and variable parts; you want to avoid code duplication between related classes.

**Prefer composition over inheritance here** — if the variable parts can be extracted as strategies, that's often cleaner.

### Mediator
Centralizes complex communication between objects. Objects don't communicate directly.

**Use when:** Many objects interact in complex ways; you want to reduce dependencies between components.

**Event buses / message brokers are Mediator at the system level.**

**Warning:** The mediator can become a God Object if it grows too large.

---

## Modern Patterns (Beyond GoF)

### Repository
Abstracts data access. The domain sees a collection-like interface; the implementation handles persistence.

```
OrderRepository {
  findById(id: OrderId): Order | null
  findByCustomer(customerId: CustomerId): Order[]
  save(order: Order): void
  delete(id: OrderId): void
}
```

**Use always** when there's a domain layer. The domain should never know about SQL, ORMs, or storage formats.

### Unit of Work
Tracks changes to objects during a business transaction. Writes all changes atomically at the end.

**Use when:** Multiple domain objects change in a single business operation; you want to batch DB writes for atomicity/performance.

**Often combined with Repository** — the Unit of Work coordinates multiple Repositories in a transaction.

### Specification
Encapsulates a business rule as a composable, reusable object.

```
ActiveCustomer.and(PremiumTier).and(not(HasOpenDispute))
```

**Use when:** Business rules need to be composed flexibly; the same rules appear in queries, validation, and domain logic.

### Saga (Distributed Transactions)
Manages a multi-step distributed transaction through local transactions + compensating actions.

**Choreography-based Saga:** Each service publishes events and reacts to events from others.  
**Orchestration-based Saga:** A central saga orchestrator sends commands to each service.

```
PlaceOrder → ReserveInventory → ChargPayment → ShipOrder
     ↑ if any step fails, run compensating transactions in reverse
```

**Use when:** A business transaction spans multiple services/databases. ACID transactions aren't available across services.

**Complexity:** Sagas are hard to debug and test. Design compensating transactions carefully — they must undo the effect, not just reverse the call.

### Outbox Pattern
Solves the dual-write problem: writing business data AND publishing an event atomically.

```
BEGIN TRANSACTION
  INSERT INTO orders VALUES (...)
  INSERT INTO outbox (event_type, payload) VALUES (...)
COMMIT

[Separate process: read outbox, publish to message broker, mark as sent]
```

**Use always when:** Events must be published reliably; "at-least-once" delivery is acceptable; you can't use distributed transactions.

**Without Outbox:** Either you update the DB but fail to publish the event (data inconsistency), or you publish before committing (phantom events if the commit fails).

---

## Anti-Patterns

### God Object
One class/module that knows too much or does too much.

**Signals:** 1,000+ line class; dozens of unrelated methods; imported by nearly everything; merge conflicts on every PR.

**Fix:** Extract cohesive responsibilities into separate classes. Apply SRP. Start with the methods that share the fewest dependencies with the rest of the class.

### Anemic Domain Model
Domain objects are pure data bags with no behavior. All logic lives in service classes.

**Signals:** Domain objects have only getters/setters; service classes are thousands of lines long; business rules are scattered across services.

**Fix:** Move behavior into domain objects. `Order.submit()` not `OrderService.submitOrder(order)`. The domain object knows how to transition itself.

### Distributed Monolith
Services that are deployed as microservices but behave like a monolith — always deployed together, sharing a database, or coupled through synchronous call chains.

**The worst outcome:** All the operational complexity of microservices with none of the independence.

**Signals:** Service A always deploys with B; cross-service DB joins; a change to Service A breaks Service B's tests; integration tests cover the whole fleet.

**Fix:** Enforce data ownership (each service owns its tables), introduce async communication, or collapse back to a monolith and re-extract correctly.

### Big Ball of Mud
No discernible architecture. Everything depends on everything.

**Signals:** No module structure; circular dependencies everywhere; "just put it in the Utils class"; nobody understands the whole system.

**Fix:** Identify bounded contexts by mapping which parts change together. Introduce module boundaries incrementally using the Strangler Fig pattern.

### Golden Hammer
Using a favorite technology or pattern for every problem regardless of fit.

**Signals:** "We use Kafka for everything"; "Microservices always"; "GraphQL for all APIs including simple reads"; "Event sourcing is the only way to do persistence."

**Fix:** Define problem-pattern matching criteria. Make technology choices after understanding the requirements, not before.

### Premature Optimization
Complex infrastructure (caching, sharding, CDN) added without measured bottlenecks.

**Signals:** Distributed caching for an app with 10 users; database sharding at MVP stage; complex query optimization before profiling.

**Fix:** Measure first. "First make it work, then make it right, then make it fast" — with data.

### Resume-Driven Architecture
Technology chosen for novelty or personal interest rather than problem fit.

**Signals:** "We should use Kubernetes" for a single-machine app; "Let's try the new framework" for a production system; architectural decisions that benefit the engineer's resume rather than the product.

**Fix:** Evaluate technology by: Does it solve our actual problem? Can our team operate it? What's the maintenance cost in 2 years?
