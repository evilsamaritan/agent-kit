# Design and Collaboration Patterns

Select a pattern from the pressure it resolves. Start with a direct implementation, then add structure only when variation, lifecycle, ownership, or failure behavior requires it.

## Contents

- [Selection method](#selection-method)
- [Quick selection map](#quick-selection-map)
- [Direct composition](#direct-composition)
- [Decorator and middleware](#decorator-and-middleware)
- [Strategy and policy](#strategy-and-policy)
- [Adapter and anticorruption layer](#adapter-and-anticorruption-layer)
- [Facade](#facade)
- [Factory and builder](#factory-and-builder)
- [State machine](#state-machine)
- [Pipeline and chain of responsibility](#pipeline-and-chain-of-responsibility)
- [Command and handler](#command-and-handler)
- [Observer and domain events](#observer-and-domain-events)
- [Repository and unit of work](#repository-and-unit-of-work)
- [Specification](#specification)
- [Saga and process manager](#saga-and-process-manager)
- [Transactional outbox](#transactional-outbox)
- [Pattern combinations](#pattern-combinations)
- [Pattern failure signals](#pattern-failure-signals)

## Selection method

Before naming a pattern, write:

1. **Stable center** — operation, invariant, or contract that should remain stable.
2. **Variation** — behavior, representation, policy, lifecycle, or dependency that changes independently.
3. **Selection owner** — who chooses the variation and when.
4. **Composition semantics** — order, error propagation, cancellation, state, and side effects.
5. **Cost ceiling** — how much indirection or runtime machinery the problem warrants.

Reject a pattern when its contract is less clear than the repeated code, when only one hypothetical variant exists, or when it hides materially different semantics behind a false common interface.

## Quick selection map

| Problem signal | Candidate | Avoid when |
|---|---|---|
| orthogonal behavior wraps one operation | Decorator/middleware | order and shared context dominate; use explicit pipeline |
| algorithm or policy varies | Strategy/function | there is one stable behavior |
| incompatible external model | Adapter | mapping adds no semantic isolation |
| many callers need one stable entry point | Facade | facade becomes an ownerless god API |
| construction depends on runtime composition | Factory/composition root | callers can construct one concrete value directly |
| valid behavior depends on explicit lifecycle state | State machine | states are merely display labels |
| ordered independent stages transform work | Pipeline | stages secretly share mutable internals |
| one of several handlers may accept work | Chain of responsibility | all handlers must run or order is fixed business policy |
| operation must be represented, queued, retried, or audited | Command | a direct call expresses the behavior fully |
| independent consumers react to completed facts | Domain event/observer | the producer requires their synchronous result |
| domain needs collection-like persistence boundary | Repository | it only mirrors generic CRUD or leaks storage queries |
| rules need semantic composition | Specification | simple conditions are clearer inline |
| long-running process crosses owners | Saga/process manager | one local transaction can preserve the invariant |
| state update and message publication must agree | Transactional outbox | best-effort notification is sufficient |

## Direct composition

Direct calls, plain functions, and explicit object construction are the baseline. They minimize hidden control flow and are appropriate when behavior is stable and local.

Use a composition root to assemble dependencies and policies once:

```text
transport handler
  -> application operation
       -> domain policy
       -> storage port
       -> external-service port
```

Avoid service locators and implicit globals. They hide dependency and lifecycle ownership from both readers and tests.

## Decorator and middleware

A decorator preserves a contract while adding behavior around another implementation.

```text
MeasuredClient(
  RetryingClient(
    AuthenticatedClient(
      TransportClient
    )
  )
)
```

**Useful when:** logging, metrics, authorization, retries, caching, tracing, or other policies are independently selectable and apply to the same semantic operation.

Define:

- exact ordering and whether it is user-visible;
- which layer owns retries and idempotency;
- how errors are translated or preserved;
- whether wrappers may short-circuit;
- how context and cancellation propagate;
- how duplicate instrumentation or retry nesting is prevented.

Use middleware when a runtime already has a pipeline contract and the behavior is request-oriented. Use an explicit decorator when the semantic interface should stay independent of the runtime framework.

Avoid decorators when combinations create ambiguous semantics. Model an explicit pipeline or coordinator instead.

## Strategy and policy

A strategy encapsulates one variation selected by context while preserving a stable operation.

**Useful when:** pricing, routing, ranking, retry, validation, or allocation policy varies independently.

The strategy contract should expose domain inputs and results, not the selection mechanism. Select strategies at a composition root or through explicit policy configuration.

Use a function for stateless behavior. Use an object when the strategy has identity, configuration lifecycle, resources, or related operations.

Avoid a strategy registry when a small conditional at the composition boundary is clearer and changes in one place.

## Adapter and anticorruption layer

An adapter translates one contract or model into another. An anticorruption layer protects a domain model from a large or semantically different external model.

**Useful when:** integrating a vendor, legacy subsystem, protocol, storage API, or neighboring bounded context whose concepts do not match the core.

Keep translation at the boundary. Translate both success and failure semantics, identity, time, units, optionality, and lifecycle—not only field names.

Avoid a one-to-one wrapper that exports the same vendor types and behavior. It adds navigation without insulation.

## Facade

A facade offers a focused entry point to a complex subsystem.

**Useful when:** callers need a stable use-case-oriented contract while internal coordination changes.

Keep the facade thin in policy ownership: it may orchestrate cohesive operations but should not accumulate every unrelated capability. Split by consumer capability when the surface grows into a god interface.

## Factory and builder

A factory owns conditional creation and hides concrete composition. A builder accumulates validated construction choices for a complex value.

**Factory is useful when:** implementation choice, lifecycle, or dependency graph varies while consumers need one contract.

**Builder is useful when:** construction has several meaningful optional choices, ordering, or cross-field validation.

Keep factories near the composition root. Avoid factories for one direct constructor and builders for a handful of clear required arguments.

## State machine

A state machine makes valid states, events, transitions, guards, and effects explicit.

**Useful when:** behavior changes by lifecycle state, invalid transitions matter, concurrent events occur, or recovery depends on transition history.

Define:

- finite states and their meaning;
- accepted/rejected events per state;
- guards and invariant checks;
- transition effects and atomicity;
- duplicate and out-of-order event behavior;
- terminal and recovery states.

Avoid spreading the same state transition across handlers, flags, and UI conditions. Avoid a state machine when one boolean with one owner expresses the whole lifecycle.

## Pipeline and chain of responsibility

A pipeline runs explicit ordered stages; each stage receives and returns a defined context/result. A chain allows a handler to process, reject, or pass work onward.

**Pipeline:** parsing → validation → enrichment → execution → presentation.

**Chain:** try local handler → delegated handler → fallback.

Define order, mutation, short-circuit, error, cancellation, and retry semantics. Prefer immutable or owned context between stages. If stages need unrestricted access to one shared mutable bag, module boundaries are being bypassed.

## Command and handler

A command represents an intention to ask one owner to change state. Its handler coordinates the use case and returns acceptance or rejection.

**Useful when:** work is queued, retried, authorized, audited, or dispatched independently from transport.

Commands are not facts. Name them imperatively (`SubmitOrder`); name events in past tense (`OrderSubmitted`). Avoid a generic command bus when direct typed calls provide the same decoupling with clearer navigation.

## Observer and domain events

Observers react to published changes. Domain events describe meaningful completed facts owned by the producer.

**Useful when:** independent consumers need the fact, the producer does not require their immediate result, and temporal decoupling is acceptable.

Specify delivery, ordering, duplication, compatibility, replay, privacy, and observability. In-process events still create hidden control flow; use direct calls when ordered collaboration is part of one use case.

## Repository and unit of work

A repository presents domain-specific retrieval and persistence for aggregates or cohesive state. A unit of work coordinates changes that must commit atomically.

**Useful when:** the core has meaningful persistence semantics worth insulating from storage details.

Avoid generic `getAll/create/update/delete` repositories that merely duplicate an ORM. Prefer operations reflecting domain needs and preserve transactional boundaries. Do not pretend remote services participate in a local unit of work.

## Specification

A specification names and composes a business predicate.

**Useful when:** the same rules are reused, combined, explained, or translated into multiple evaluation contexts.

Avoid turning every `if` into an object. Ensure in-memory and query-backed interpretations preserve the same semantics, especially around time, nullability, and locale.

## Saga and process manager

A saga/process manager coordinates a long-running business process across independent transactional owners using steps, persisted progress, and compensations or reconciliation.

**Useful when:** one operation cannot be atomic across boundaries and the business accepts intermediate states.

Model business compensation, not technical rollback. A refund is not the inverse of a charge in every domain. Define timeouts, duplicate messages, manual intervention, and terminal stuck states.

Prefer one local transaction when the invariant belongs to one owner. Distribution is not a substitute for correct aggregation.

## Transactional outbox

An outbox stores a message record in the same transaction as the authoritative state change, then publishes it asynchronously.

**Useful when:** losing the publication would violate integration guarantees and atomic cross-system commit is unavailable.

Plan for at-least-once publication, idempotent consumers, ordering scope, retention, poison messages, monitoring, and recovery. If the message is merely opportunistic telemetry, a transactional outbox may be unnecessary overhead.

## Pattern combinations

Patterns commonly compose around one stable center:

```text
handler
  -> facade/use case
       -> state machine or domain policy
       -> repository port <- storage adapter
       -> event record -> outbox -> independent consumers

client contract
  <- tracing decorator
  <- retry decorator
  <- authorization decorator
  <- transport adapter
```

Explain the role of each pattern independently. If removing one pattern cannot be described without collapsing the whole design, the composition may be too entangled.

## Pattern failure signals

- Adding a case requires modifying every implementation and central dispatcher.
- A generic context object accumulates unrelated optional fields.
- Decorator/pipeline order changes correctness but is implicit.
- Events are used to make synchronous dependencies look decoupled.
- Factories, registries, or plugins exist for one implementation.
- Repository abstractions leak query/storage types.
- A facade owns unrelated rules and state.
- A strategy interface has methods unused by most variants.
- The pattern name is offered as the rationale instead of a concrete force.

When these appear, revisit the invariant, variation axis, and owner before adding another layer.
