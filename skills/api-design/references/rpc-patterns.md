# RPC Patterns

Depth for the RPC branches of the protocol decision tree: product examples, deadlines, status codes, and schema evolution. Product status changes; check the project's lockfile and the tool's current docs before relying on a feature.

## Contents

- [Protocol Examples](#protocol-examples)
- [Deadlines and Cancellation](#deadlines-and-cancellation)
- [Status Codes and Errors](#status-codes-and-errors)
- [Protobuf Evolution](#protobuf-evolution)
- [Streaming](#streaming)

---

## Protocol Examples

Examples, not endorsements.

| Branch in SKILL.md | Examples | Notes |
|--------------------|----------|-------|
| Typed RPC, one language, you own both ends | tRPC (TypeScript); server functions in full-stack frameworks | Types flow through the build; no IDL. Locks both ends to one language; add an OpenAPI layer if outside consumers appear |
| Schema-first binary RPC between services | gRPC with Protocol Buffers | HTTP/2, code generation in many languages, four streaming modes |
| Browser clients on an RPC contract | Connect protocol (speaks gRPC, gRPC-Web, and its own HTTP+JSON/Protobuf protocol); gRPC-Web through a proxy | Connect avoids the translating proxy; gRPC-Web needs one |
| Simple RPC over HTTP+JSON | JSON-RPC 2.0, Twirp-style POST endpoints | Little tooling; fine for small internal surfaces |

Payload size versus JSON depends on the data; measure on real messages before choosing a binary format for size alone.

Do not choose binary RPC for third-party developers: debugging, caching, and client availability are worse than REST.

---

## Deadlines and Cancellation

- Every call carries a deadline (absolute time), not only a local timeout. Servers read it and stop work when it passes.
- Propagate the remaining deadline to downstream calls; subtract a small margin for the response path.
- Cancellation of the caller cancels the server-side work; handlers check for cancellation in long loops and before side effects.
- A call without a deadline is a bug: it holds resources until the connection dies.

---

## Status Codes and Errors

gRPC-style status codes and how clients should treat them:

| Code | Meaning | Client retry? |
|------|---------|---------------|
| `OK` | Success | — |
| `INVALID_ARGUMENT` | Bad input regardless of state | No |
| `FAILED_PRECONDITION` | Valid input, wrong system state | No (fix state first) |
| `NOT_FOUND` / `ALREADY_EXISTS` | Resource state | No |
| `PERMISSION_DENIED` / `UNAUTHENTICATED` | Authorization / credentials | No (refresh credentials for `UNAUTHENTICATED`) |
| `RESOURCE_EXHAUSTED` | Quota or rate limit | Yes, with backoff |
| `ABORTED` | Concurrency conflict | Yes, at a higher level (re-read, re-apply) |
| `UNAVAILABLE` | Transient | Yes, with backoff, if the method is idempotent |
| `DEADLINE_EXCEEDED` | Deadline passed | Only if idempotent and budget remains |
| `INTERNAL` / `UNKNOWN` | Server bug or unmapped error | No by default |

Attach structured error details (a machine-readable reason, field violations) rather than encoding them in the message string. Map domain errors to codes at one place on the server, as in `backend`.

---

## Protobuf Evolution

| Safe | Breaking |
|------|----------|
| Add a field with a new number | Change a field's number or type |
| Add an enum value (receivers must handle unknown values) | Reuse a deleted field's number or name |
| Add a method or service | Rename a package, service, or method (wire names change) |
| Mark a field deprecated | Change `optional`/`repeated` cardinality |

- Reserve the numbers and names of deleted fields: `reserved 4, 7; reserved "legacyId";`.
- Every enum starts with a zero `*_UNSPECIFIED` value, so an unset or unknown value is distinguishable.
- Proto3 scalars have no presence by default; use `optional` when "unset" and "zero" must differ.
- Run a schema breaking-change check in CI against the last released contract.

---

## Streaming

- Server streaming suits progress and feeds; client streaming suits uploads; bidirectional suits interactive sessions.
- Long-lived streams need heartbeats, a resume token, and a reconnection strategy, exactly like WebSocket (`realtime`).
- Load balancers that balance per connection pin a stream to one backend; balance per request (L7) for unary calls.
