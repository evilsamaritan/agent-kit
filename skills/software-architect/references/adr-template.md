# Architecture Decision Records (ADRs)

ADRs document the *why* behind architectural decisions — not just what was chosen, but what was considered, what was rejected, and what consequences were accepted.

## Contents

- [When to Write an ADR](#when-to-write-an-adr)
- [The MADR Template (Standard)](#the-madr-template-standard)
- [Filled Example: ADR-001 — Architecture Style](#filled-example-adr-001--architecture-style)
- [Filled Example: ADR-002 — Database Choice](#filled-example-adr-002--database-choice)
- [Y-Statement Format (one-liner ADR)](#y-statement-format-one-liner-adr)
- [ADR Lifecycle](#adr-lifecycle)
- [ADR File Organization](#adr-file-organization)
- [Common ADR Anti-Patterns](#common-adr-anti-patterns)

---

## When to Write an ADR

Write an ADR when:
- A decision has significant long-term consequences
- Multiple reasonable options existed
- The decision is difficult to reverse
- Future engineers will wonder "why did they do it this way?"

Skip an ADR for:
- Obvious choices with no real alternatives
- Implementation details (how, not what)
- Decisions easily reversed

**Rule of thumb:** If you're debating a decision for more than 15 minutes, it deserves an ADR.

---

## The MADR Template (Standard)

MADR (Markdown Architectural Decision Records) is the most widely adopted format.

```markdown
# ADR-NNN: [Short, present-tense, imperative title]

Date: YYYY-MM-DD  
Status: [Proposed | Accepted | Deprecated | Superseded by ADR-NNN]  
Deciders: [who made this decision]

---

## Context and Problem Statement

[Describe the context. What problem needs solving? What forces are in tension?
2-4 sentences. Be specific — what makes this decision necessary NOW?]

## Decision Drivers

* [Constraint or goal driving this decision]
* [e.g., team size, timeline, existing tech stack, NFR]
* [e.g., operational burden, security requirement]

## Considered Options

* [Option A]
* [Option B]
* [Option C — "do nothing" is always an option]

## Decision Outcome

**Chosen option:** [Option X], because [one-sentence justification tied to decision drivers].

### Consequences

**Positive:**
* [Benefit 1]
* [Benefit 2]

**Negative:**
* [Trade-off accepted]
* [Risk created]

**Neutral:**
* [Side effect that's neither good nor bad]

### Confirmation

[How will we verify this decision was implemented correctly and is working?
e.g., "Architecture fitness function: ArchUnit rule preventing direct DB access from presentation layer."]

---

## Options Considered (detailed)

### Option A: [Name]

[Description]

Good, because:
* [reason]

Bad, because:
* [reason]

### Option B: [Name]

[Description]

Good, because:
* [reason]

Bad, because:
* [reason]
```

---

## Filled Example: ADR-001 — Architecture Style

```markdown
# ADR-001: Use Modular Monolith as Initial Architecture

Date: 2025-03-15  
Status: Accepted  
Deciders: Tech Lead, Engineering Manager, 2 senior engineers

---

## Context and Problem Statement

We are building Cerebro v1 — a local-first AI "cognitive OS" that will 
span mind (orchestration) and brain (memory/consolidation) modules. 
The team has 4 engineers. We need to move fast, but we also need clear 
module boundaries because the mind/brain separation is a core design principle.

## Decision Drivers

* Team of 4 engineers — microservices coordination overhead is unjustified
* We need to iterate quickly in the first 6 months
* Module boundaries between mind/brain must be enforced from day one
* We expect to extract services later if specific scaling needs arise
* We cannot afford the operational complexity of a distributed system at this stage

## Considered Options

* Microservices from day one
* Modular monolith with enforced boundaries
* Single-layer monolith (no internal structure)

## Decision Outcome

**Chosen option:** Modular monolith, because it enforces our mind/brain boundary 
without the operational overhead of microservices at our current team size.

### Consequences

Positive:
* Single deployment unit — simple CI/CD
* In-process calls between modules — no network overhead or distributed failure modes
* Clear module boundaries prevent accidental coupling
* Easy to extract a module as a service later (Strangler Fig)

Negative:
* All modules deploy together — a bug in one can take down all
* Shared process — memory leak in one module affects all
* Cannot scale modules independently

Neutral:
* Requires discipline to enforce module boundaries (mitigated by automated checks)

### Confirmation

ArchUnit (or equivalent) rule: mind module must not import from brain module's 
internal packages; only the published interface is accessible.
```

---

## Filled Example: ADR-002 — Database Choice

```markdown
# ADR-002: Use PostgreSQL as Primary Storage with redb for Local State

Date: 2025-03-15  
Status: Accepted

---

## Context and Problem Statement

Cerebro needs to persist memory (brain module), events (mind module), and 
vector embeddings for semantic search. We need to choose storage backends 
that work locally-first (no mandatory cloud dependency).

## Decision Drivers

* Local-first: must work entirely offline
* Rust ecosystem: storage must have high-quality Rust bindings
* Vector search required: memory retrieval uses semantic similarity
* Append-only semantics preferred for memory consolidation
* Operational simplicity: no separate database server process

## Considered Options

* PostgreSQL + pgvector (server-based)
* SQLite + sqlite-vec (embedded, no server)
* redb (pure Rust embedded KV) + external vector index
* sled (embedded, pure Rust) — ruled out (perpetual alpha)

## Decision Outcome

**Chosen option:** SQLite + sqlite-vec for local-first deployments; 
PostgreSQL + pgvector for server deployments. A storage abstraction layer 
(Repository pattern) allows swapping backends.

### Consequences

Positive:
* SQLite: zero-configuration, single file, embeds in the binary
* sqlite-vec: vector search without external process
* Repository abstraction: tests use in-memory backend; production uses real storage
* Path to PostgreSQL when server deployment is needed

Negative:
* Two storage backends to maintain
* sqlite-vec is less mature than pgvector
* SQLite write concurrency is limited (WAL mode mitigates)

### Confirmation

Integration test suite runs against both SQLite and PostgreSQL backends 
using the same test scenarios against the Repository interface.
```

---

## Y-Statement Format (one-liner ADR)

For lightweight decisions that don't need a full document:

```
In the context of [situation],
facing [concern],
we decided for [option]
and neglected [other options],
to achieve [quality/outcome],
accepting [downside],
because [rationale].
```

Example:
```
In the context of inter-module communication within Cerebro's modular monolith,
facing the need to decouple mind from brain without introducing network hops,
we decided for an in-process event bus (typed domain events)
and neglected direct method calls and a real message broker,
to achieve loose coupling with zero network overhead,
accepting that event ordering is not globally guaranteed,
because the modules run in the same process and latency must be sub-millisecond.
```

---

## ADR Lifecycle

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion, not yet decided |
| **Accepted** | Decision made and in effect |
| **Deprecated** | No longer relevant (e.g., the feature was removed) |
| **Superseded by ADR-NNN** | A newer ADR replaced this decision |

**Never delete or modify an accepted ADR.** The history is the value.  
When a decision changes, create a new ADR with status "Superseded by ADR-NNN" on the old one.

---

## ADR File Organization

```
docs/
└── decisions/
    ├── ADR-001-modular-monolith.md
    ├── ADR-002-storage-backends.md
    ├── ADR-003-rust-as-implementation-language.md
    └── ADR-004-event-bus-for-mind-brain-decoupling.md
```

Number sequentially. Never reuse numbers.  
Keep in version control alongside the code.

---

## Common ADR Anti-Patterns

- **Post-hoc documentation:** ADR written after the decision to justify it. Useful only as a record; loses the "alternatives considered" value.
- **Missing trade-offs:** Only stating benefits, no acknowledged downsides. A good ADR always names what you're giving up.
- **Too granular:** ADR for every small implementation choice. Reserve for significant, consequential decisions.
- **Too abstract:** ADR that doesn't name specific technologies or approaches. "We will use a database" is not an ADR.
- **No confirmation mechanism:** Accepted ADR with no way to verify compliance. Add a fitness function or review step.
