# Workflow: Architect / Planner

## Contents

- [Phase 1 — Understand the Problem](#phase-1--understand-the-problem)
- [Phase 2 — Define the Public API Contract](#phase-2--define-the-public-api-contract)
- [Phase 3 — Design State Machines with Typestate](#phase-3--design-state-machines-with-typestate)
- [Phase 4 — Write the Specification Document](#phase-4--write-the-specification-document)
- [Phase 5 — Task Decomposition](#phase-5--task-decomposition)
- [Phase 6 — Workspace Setup](#phase-6--workspace-setup)
- [Checklist Before Handing Off to Implementer](#checklist-before-handing-off-to-implementer)
- [References Used by This Workflow](#references-used-by-this-workflow)

**Goal:** Produce a clear, unambiguous specification that an Implementer can execute without guessing.

---

## Phase 1 — Understand the Problem

Before touching any design, answer these questions:

1. **What is the domain?** What real-world process does this code model?
2. **What are the system boundaries?** What is inside this crate/module vs. outside?
3. **What are the invariants?** What must always be true? What can never happen?
4. **What are the failure modes?** What can go wrong, and who handles each failure?
5. **What are the performance constraints?** Latency? Throughput? Memory budget?

Do not proceed until you can answer these clearly. If unclear — write down the ambiguities explicitly.

---

## Phase 2 — Define the Public API Contract

The public API is the most important design decision. It cannot be changed easily later.

### Module boundary rules
- One crate = one cohesive responsibility
- Domain logic crates MUST have zero infrastructure dependencies (no sqlx, no tokio, no HTTP)
- Infrastructure crates (db, http, cli) depend on domain — never the reverse
- Shared types live in a dedicated `types` or `common` crate

### Trait-first design
Define traits as *ports* (interfaces) before implementing *adapters* (concrete impls):

```rust
// Good: define the port first, in the domain crate
pub trait EventStore: Send + Sync + 'static {
    async fn append(&self, stream_id: &StreamId, events: &[Event]) -> Result<(), StoreError>;
    async fn load(&self, stream_id: &StreamId) -> Result<Vec<Event>, StoreError>;
}

// Infrastructure crate provides the adapter
pub struct PostgresEventStore { ... }
impl EventStore for PostgresEventStore { ... }

// Test adapter lives in #[cfg(test)] or a test-utils crate
pub struct InMemoryEventStore { ... }
impl EventStore for InMemoryEventStore { ... }
```

### API parameter rules (enforce these in specs)
| Accept | Not |
|--------|-----|
| `&str` | `String` |
| `&[T]` | `Vec<T>` |
| `impl AsRef<Path>` | `PathBuf` |
| `impl Into<String>` | `String` (when storing) |

### Error type design
For each module, define ONE typed error enum using `thiserror`:

```rust
#[derive(Debug, thiserror::Error)]
pub enum OrderError {
    #[error("order {id} not found")]
    NotFound { id: OrderId },
    #[error("insufficient inventory: requested {requested}, available {available}")]
    InsufficientInventory { requested: u32, available: u32 },
    #[error("storage failure")]
    Storage(#[from] StorageError),
}
```

Rules for error design:
- Variants must be meaningful to the *caller* (they need to match on them)
- Use `#[from]` only for cross-layer errors (infra → domain boundary)
- All error types must be `Send + Sync + 'static`
- Internal errors that callers don't need to distinguish → wrap in a single `Internal` variant

---

## Phase 3 — Design State Machines with Typestate

For any entity that transitions through states, use the typestate pattern:

```rust
// States as zero-sized marker types
pub struct Draft;
pub struct Submitted;
pub struct Approved;

// Entity with phantom state
pub struct Order<State> {
    id: OrderId,
    items: Vec<OrderItem>,
    _state: PhantomData<State>,
}

// Only valid transitions compile
impl Order<Draft> {
    pub fn submit(self) -> Order<Submitted> { ... }
}
impl Order<Submitted> {
    pub fn approve(self) -> Order<Approved> { ... }
    pub fn reject(self) -> Order<Draft> { ... }
}
// Order<Draft>.approve() → compile error ✓
```

Use the `bon` crate for builder pattern when structs have many optional fields.

---

## Phase 4 — Write the Specification Document

The specification is a Markdown file (or doc comments) containing:

```markdown
## Module: `crate-name`

### Responsibility
One paragraph. What this module does and does NOT do.

### Public API
List all public traits, structs, and functions with their signatures and doc comments.
Include error types and all variants.

### Invariants
- List every invariant that must hold at all times
- Example: "StreamId is always non-empty"
- Example: "events are append-only; existing entries never mutate"

### Failure Modes
| Failure | Error variant | Handler |
|---------|--------------|---------|
| DB connection lost | `StoreError::Connection` | retry with backoff |
| Item not found | `OrderError::NotFound` | return 404 |

### Dependencies
- Depends on: [list crates]
- Must NOT depend on: [list crates]

### Open Questions
List any unresolved design decisions with options and trade-offs.
```

---

## Phase 5 — Task Decomposition

Break implementation into tasks using this template:

```
Task: [name]
Input: [what the implementer receives]
Output: [what the implementer produces — file, interface, test]
Acceptance criteria:
  - [ ] Criterion 1 (verifiable)
  - [ ] Criterion 2 (verifiable)
Dependencies: [other tasks that must complete first]
Estimated complexity: [S / M / L]
```

Rules:
- Each task must be independently testable
- Tasks MUST NOT have circular dependencies
- Acceptance criteria must be objectively verifiable (compilable, tests pass, clippy clean)
- No task larger than L — split further

---

## Phase 6 — Workspace Setup

For new projects, define workspace structure before any code:

```
{project}/
├── Cargo.toml              # Virtual manifest — [workspace] only, no [package]
├── Cargo.lock              # COMMIT for apps, GITIGNORE for libraries
├── deny.toml
├── rustfmt.toml
├── clippy.toml             # or workspace.lints in Cargo.toml
├── crates/
│   ├── types/              # Shared domain types, zero deps
│   ├── core/               # Domain logic, depends only on types/
│   ├── db/                 # Database adapter
│   ├── api/                # HTTP/gRPC layer
│   └── app/                # Binary, wires everything together
└── xtask/                  # Build automation
```

All dependency versions MUST be defined in `[workspace.dependencies]`.  
Individual crates use `{ workspace = true }` — no version specified locally.

---

## Checklist Before Handing Off to Implementer

- [ ] All public traits defined with signatures and doc comments
- [ ] All error types defined with variants
- [ ] All invariants stated explicitly
- [ ] Workspace structure defined
- [ ] `[workspace.dependencies]` with versions for all crates
- [ ] `[workspace.lints]` configured
- [ ] Task list with acceptance criteria
- [ ] Open questions flagged (not silently assumed)

---

## References Used by This Workflow

- `references/architecture-patterns.md` — hexagonal arch, typestate, CQRS details
- `references/error-handling-patterns.md` — error type design patterns
- `references/library-reference.md` — crate selection guidance
