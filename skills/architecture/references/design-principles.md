# Design Principles

Language-agnostic. Platform-agnostic. These apply everywhere.

## Contents

- [SOLID](#solid) — SRP, OCP, LSP, ISP, DIP
- [DRY](#dry--dont-repeat-yourself)
- [KISS](#kiss--keep-it-simple)
- [YAGNI](#yagni--you-arent-gonna-need-it)
- [Separation of Concerns](#separation-of-concerns-soc)
- [Law of Demeter](#law-of-demeter-lod)
- [Cohesion and Coupling](#cohesion-and-coupling)
- [Principle of Least Surprise](#principle-of-least-surprise)
- [Principle of Least Privilege](#principle-of-least-privilege)

---

## SOLID

### S — Single Responsibility Principle
A module has one reason to change.

**Violation signals:** module name contains "And"; change to requirement X causes changes to this module even though it's not about X; God class with hundreds of methods.

**Fix:** Split by reason to change. Group by what changes together, separate what changes independently.

**Real example:** Google enforces SRP through small, focused libraries in their monorepo — each library has a clear owner and single purpose.

---

### O — Open / Closed Principle
Open for extension. Closed for modification.

**Violation signals:** Adding a new variant requires modifying a switch/if-else chain inside existing code; new business rules require editing multiple existing files.

**Fix:** Strategy pattern (inject behavior), plugin architecture (extension points), polymorphism (override, not modify).

**Real example:** Stripe's PaymentIntents API supports new payment methods without changing the core integration. The extension point is the API contract — it's open for new implementations, closed for modification.

---

### L — Liskov Substitution Principle
Subtypes must be substitutable for their base type without breaking correctness.

**Violation signals:** Subclass throws exceptions the base doesn't declare; subclass method does nothing or asserts narrower preconditions; "is-a" relationship that breaks when you try to use it that way (Square is-a Rectangle — but setting width changes height).

**Fix:** Use composition over inheritance. Model constraints explicitly. Prefer interfaces over class inheritance hierarchies.

---

### I — Interface Segregation Principle
No client should depend on methods it does not use.

**Violation signals:** Interface has 10+ methods; implementing a small part of the interface requires stubbing the rest; clients import an interface they use 2 methods of.

**Fix:** Split fat interfaces into focused ones. Clients depend only on what they use.

---

### D — Dependency Inversion Principle
High-level modules don't depend on low-level modules. Both depend on abstractions. Abstractions don't depend on details.

**Violation signals:** Business logic imports from infrastructure packages (HTTP, DB, filesystem); `new ConcreteInfrastructureClass()` inside business logic; tests require real databases or HTTP servers.

**Fix:** Define interfaces (ports) in the domain. Implement them in infrastructure. Wire via dependency injection at the composition root.

---

## DRY — Don't Repeat Yourself

Every piece of *knowledge* has one authoritative representation.

**Important distinction:** DRY is about knowledge, not code. Two functions that look similar but represent different domain concepts should NOT be merged — that creates wrong coupling. Merge only when they represent the same fact/rule.

**Violation signals:** Changing a business rule requires editing 3 places; copy-paste with slight variations; multiple validation functions that check the same constraint.

**Fix:** Extract the shared knowledge into a single place. Name it after what it represents.

---

## KISS — Keep It Simple

The simplest solution that works is best.

**Violation signals:** Distributed system where a monolith would suffice; CQRS for simple CRUD; microservices for a 5-person team; complex abstractions with one implementation.

**Amazon Prime Video case:** Distributed microservices architecture hit scaling limits at 5% of expected load. Monolithic rewrite achieved **90% cost reduction** and better scalability. The simplest architecture was also the most effective.

**Fix:** Measure complexity by asking "what would a new engineer have to learn to change this?" Minimize that.

---

## YAGNI — You Aren't Gonna Need It

Don't build for hypothetical future requirements.

**Violation signals:** "We might need to support X later" as justification for a complex abstraction that X doesn't exist yet; plugin systems with one plugin; generic frameworks with one use case.

**Fix:** Build for what's needed now. Refactor when the need is real. Refactoring a simple solution to handle a real requirement is easier than unwinding a wrong abstraction.

---

## Separation of Concerns (SoC)

Each module addresses one distinct concern.

**Levels:** Function (one thing), Class (one responsibility), Module (one domain), Service (one bounded context), System (one business capability).

**Violation signals:** Mixing HTTP handling with business logic; mixing business rules with persistence; mixing UI rendering with data fetching.

---

## Law of Demeter (LoD)

A method should call only methods on: itself, its parameters, objects it creates, its direct component objects.

**Violation signals:** `order.getCustomer().getAddress().getCity()` — reaching through multiple levels.

**Fix:** Tell, don't ask. `order.getShippingCity()` — the object knows its own structure.

**Why it matters:** LoD violations couple your code to the internal structure of collaborators. When the internal structure changes, your code breaks even though the collaboration didn't change.

---

## Cohesion and Coupling

**Cohesion** = how strongly related the elements within a module are.  
**Coupling** = how much modules depend on each other.

**Goal: High cohesion, low coupling.**

### Measuring coupling:
- **Afferent (Ca):** incoming dependencies — how many modules depend on this one?
- **Efferent (Ce):** outgoing dependencies — how many modules does this one depend on?
- **Instability:** Ce / (Ca + Ce). 0 = maximally stable. 1 = maximally unstable.

**Stable modules** (low instability) should not depend on unstable modules.  
**Instability should increase as you move toward infrastructure** — core domain should be maximally stable, DB adapters can be unstable.

### Improving cohesion:
- If a class's methods share nothing except file location → split it
- Organize by feature, not by technical layer (`order/` not `controllers/ services/ repositories/`)
- Apply SRP

### Reducing coupling:
- Depend on interfaces, not implementations (DIP)
- Use events for loose coupling between bounded contexts
- Avoid shared mutable state
- Define explicit, narrow APIs between modules

---

## Principle of Least Surprise

System behavior should match what a reasonable person would expect.

**API design:** consistent naming, consistent return types, consistent error shapes.  
**Module behavior:** a module named X should only do X.  
**Side effects:** if calling a function changes state elsewhere, it must be obvious from the name or signature.

**Stripe example:** every resource has the same structure (`id`, `object`, `created`, `livemode`, `metadata`); IDs have type prefixes (`ch_` for charges, `cus_` for customers) — you always know what you're working with.

---

## Principle of Least Privilege

Every component operates with the minimum permissions necessary.

**At the code level:** modules expose only what callers need (narrow public API).  
**At the service level:** services have only the DB tables and API endpoints they need.  
**At the infrastructure level:** service accounts have only the IAM permissions required.

Least privilege limits blast radius — a compromised component can do less damage.
