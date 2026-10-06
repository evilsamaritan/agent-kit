# Integration Patterns Across Owners

Patterns that coordinate state and messages between modules or services. This file owns them; `database`, `message-queues`, and `background-jobs` cover only their side of each. Use them after the boundary and the state owners are chosen ([system-design.md](system-design.md), [module-design.md](module-design.md)). Collaboration patterns inside a module — decorator, strategy, factory, state machine, pipeline, command, events — belong to the `development` skill.

## Contents

- [Repository and unit of work](#repository-and-unit-of-work)
- [Saga and process manager](#saga-and-process-manager)
- [Transactional outbox](#transactional-outbox)
- [CQRS: separate query model](#cqrs-separate-query-model)
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

Consumer idempotency (claim the message key first, then process; keys derived from intent, never from time): `message-queues` [idempotency-patterns.md](../../message-queues/references/idempotency-patterns.md). Relay mechanics such as polling or change-data capture: `message-queues` and `database`. Retry policy for publishers and consumers: `reliability`.

## CQRS: separate query model

CQRS separates the models used to change state from those used to answer queries. It ranges from separate code paths over one store to independently maintained read models.

**Useful when:** command rules are rich, query shapes differ materially, read projections need independent optimization, or multiple views derive from the same facts.

**Costs:** model duplication, projection lag, reconciliation, more test paths, and user-visible consistency decisions.

Do not adopt separate infrastructure merely because commands and queries are different functions. Escalate the separation only as measured forces require it.

A projection is a consumer: it inherits the outbox and idempotency rules above, and it is rebuilt from the owner's facts, never written by a second path.

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
