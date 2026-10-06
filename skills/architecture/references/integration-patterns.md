# Integration Patterns Across Owners

Patterns that coordinate state and messages between modules or services. Use them after the boundary and the state owners are chosen ([system-design.md](system-design.md), [module-design.md](module-design.md)). Collaboration patterns inside a module — decorator, strategy, factory, state machine, pipeline, command, events — belong to the `development` skill.

## Contents

- [Repository and unit of work](#repository-and-unit-of-work)
- [Saga and process manager](#saga-and-process-manager)
- [Transactional outbox](#transactional-outbox)
- [Combining them](#combining-them)

## Repository and unit of work

A repository presents domain-specific retrieval and persistence for aggregates or cohesive state. A unit of work coordinates changes that must commit atomically.

**Useful when:** the core has meaningful persistence semantics worth insulating from storage details.

Avoid generic `getAll/create/update/delete` repositories that merely duplicate an ORM. Prefer operations reflecting domain needs and preserve transactional boundaries. Do not pretend remote services participate in a local unit of work.

## Saga and process manager

A saga/process manager coordinates a long-running business process across independent transactional owners using steps, persisted progress, and compensations or reconciliation.

**Useful when:** one operation cannot be atomic across boundaries and the business accepts intermediate states.

Model business compensation, not technical rollback. A refund is not the inverse of a charge in every domain. Define timeouts, duplicate messages, manual intervention, and terminal stuck states.

Prefer one local transaction when the invariant belongs to one owner. Distribution is not a substitute for correct aggregation.

## Transactional outbox

An outbox stores a message record in the same transaction as the authoritative state change, then publishes it asynchronously.

**Useful when:** losing the publication would violate integration guarantees and atomic cross-system commit is unavailable.

Plan for at-least-once publication, idempotent consumers, ordering scope, retention, poison messages, monitoring, and recovery. If the message is merely opportunistic telemetry, a transactional outbox may be unnecessary overhead.

## Combining them

```text
use case
  -> domain policy (one owner, one local transaction)
  -> repository port <- storage adapter
  -> event record -> outbox -> independent consumers
  -> saga step when the process continues in another owner
```

Failure signals:

- Repository abstractions leak query or storage types.
- A saga coordinates steps that one owner could commit in one local transaction.
- Consumers of outbox messages are not idempotent, or ordering scope is unstated.
