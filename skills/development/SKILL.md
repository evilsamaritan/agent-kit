---
name: development
description: "Write and change code that stays cheap to change, in any stack: ownership, variant families, dependencies, state and async lifetime, errors, refactoring. Use when implementing a feature, fixing a bug at its cause, adding a new type, kind, or provider, refactoring, or reviewing code structure."
argument-hint: "[change|critique|extension-trace] [target]"
---

# Development

How to write and change code in any stack so that the next change stays local. Zone skills (`frontend`, `backend`, `mobile`, `gamedev`, …) own their environment; language skills own the idioms that express these rules; `architecture` owns boundaries between modules and systems. This skill owns the practice inside a module, and the core rules below apply wherever code is written.

## Flow selection

When invoked with an argument, `change`, `critique`, or `extension-trace` selects the workflow and the remaining text is the target. Otherwise pick the route from the intent.

| Intent | Route |
|---|---|
| `change` — build, fix (reproduce first), refactor, or migrate code | [change.md](workflows/change.md) |
| `critique` — judge one diff, merge request, or proposed fix | [critique.md](workflows/critique.md) |
| `extension-trace` — check whether a family of variants is open | [extension-trace.md](workflows/extension-trace.md) |
| Question about a principle, pattern, or structural check | the matching reference below |

## Scope and boundaries

| Question | Owner |
|---|---|
| Where a piece of knowledge lives inside a module; units, variation, dependencies, state, async lifetime, errors, names; fitting a change into existing code; refactoring | this skill |
| Boundaries between modules or services, data ownership across them, application styles, ADRs, architecture views | `architecture` |
| Environment and constraints of a zone: browser rendering, request lifecycle, game loop, OS lifecycle | the zone skill |
| How a rule is written in a language: unions, sealed types, traits, interfaces, error types | the language skill |
| Test strategy, fixtures, flaky tests | `testing` |
| Measured latency, throughput, memory | `performance` |
| Threats and controls | `security` |

## Core rules

These hold in code that a change adds or modifies. A violation there is a defect, whatever the local convention.

1. **Knowledge about a variant of an open family lives with that variant.** Outside construction and decoding, code does not branch on a variant's type to decide what the variant means, does, shows, or saves.
2. **Dispatch over a family is exhaustive or polymorphic.** No silent default: no `else return null`, no fallback value, no `default:` that hides a member the code forgot.
3. **Every piece of mutable state and every invariant has one writer.** Other code asks the owner — a query, an operation, a published fact — and keeps no copy to maintain.
4. **Dependencies arrive explicitly.** Domain code does not reach for globals, singletons, or a service locator; time, randomness, and identity generation are dependencies too.
5. **Async work belongs to an owner.** After an await, code checks that its owner is still current before it acts; ending the owner cancels its work and releases what it acquired, on every path.
6. **Errors are not swallowed.** They are handled where a decision can be made and translated at boundaries; there are no fallbacks for states the contract excludes.

Definitions the rules depend on:

- **Variant family** — types or kinds the code treats as alternatives of one concept, each carrying its own behavior or presentation: payment methods, notification channels, document types, widgets, importers, entity kinds.
- **Closed family** — a set fixed by something checkable: a protocol or file format with a version and one owner; a standard, or a type whose meaning fixes its cases (`Result`, `Option`, a language's AST, HTTP methods); the states of a state machine, owned by the machine; a stated requirement that the set does not grow. Everything else is open. Declaring a union of domain kinds does not close the family; it only lists today's members.
- **A format closes itself, not the domain.** A save or wire format that lists kinds is closed: its codec dispatches exhaustively by tag. The family of domain objects it stores stays open.
- **Construction and decoding** — the factory, registry, or composition root that creates variants, and the codec that selects a decoder by tag. These are the only places that name every member of an open family.
- **"Lives with the variant"** prescribes ownership, not a style: a method on the class, a per-kind module registered once, a codec per kind, a component and its system in ECS. Language skills show the idioms.

Existing violations outside the change are findings, not work items. When a change extends the same dispatch or the same state, first move the knowledge to its owner as a separate, behavior-preserving step, then add the change ([change-integration.md](references/change-integration.md)).

## Decision tree

### Where does this knowledge belong?

```text
Is it a decision about one variant (what it does, shows, saves, validates)?
├─ yes → the variant
Is it a rule or invariant over some state?
├─ yes → the single writer of that state
Is it a policy that varies independently of the operation (retry, pricing, ranking)?
├─ yes → a function or strategy passed in, selected at assembly
Is it I/O, transport, storage, time, randomness?
├─ yes → a mechanism passed in at the edge
Is it which members exist and how they connect?
└─ yes → the composition root; no policy there
```

### Is the family open or closed?

```text
Do the variants differ only in values?
├─ yes → data definitions run by one algorithm; no types, no branches
Is the set fixed by a versioned protocol or format with one owner?
├─ yes → closed: exhaustive dispatch at that owner
Is it fixed by a standard or a type whose meaning fixes its cases (Result, Option, AST)?
├─ yes → closed: exhaustive dispatch wherever it is consumed
Is it the state set of a state machine?
├─ yes → closed: the machine owns the transitions
Does a requirement say the set will not grow?
├─ yes → closed: exhaustive dispatch; cite the requirement where the dispatch is
└─ no  → open: each variant owns its knowledge; only construction and decoding name the members
```

## Core practice

### Placement is not abstraction

Moving knowledge to its owner — a method on the class that already exists, a per-kind module, a codec beside the type — costs nothing and is always allowed. YAGNI applies to **mechanisms**: a registry, plugin API, DI container, configuration switch, or generic framework needs variation that exists or is committed. Buy mechanisms in this order and move up only when the cheaper one fails: a parameter → a passed-in function → a small contract → a composition mechanism.

### Count branches by family, not by switch

The signal is the number of operations that branch on the same family — validation, rendering, persistence, pricing, permissions — not identical switches. The second such operation means the knowledge belongs to the variants. A closed family may be dispatched in several places because the compiler proves each dispatch complete; an open one may not.

### Units: decide, remember, act

Keep policy (what should happen), state (what is remembered and for how long), and mechanism (I/O, timers, frameworks) apart. A unit has one reason to change and a name without "and". Wiring code lists what exists and how it connects and contains no decisions. Depth: [code-design.md](references/code-design.md).

### Dependencies

Pass in what varies, what has a lifecycle, what performs I/O, and what tests must control. Import stable pure helpers directly. Passing a function is dependency injection; a container is a mechanism and follows the rule above.

### State and lifetime

Make invalid states unrepresentable: one state value with explicit transitions instead of several booleans; operations such as `submitOrder` instead of open mutation. Give every resource and every piece of async work an owner whose end cancels and releases it. Partial startup releases what it acquired.

### Errors

Validate at trust and semantic boundaries; inside, rely on the contract you checked. Translate errors where one model meets another — success and failure semantics, not only types. Do not add retries, delays, or guards where the real problem is ordering, lifecycle, or ownership.

### Principles

SOLID, DRY as one representation of each piece of knowledge, KISS, YAGNI for mechanisms, composition by default, inheritance only for genuinely substitutable variants: [principles.md](references/principles.md). Principles explain a decision; they never replace tracing the change it makes cheaper or more expensive.

### Names and comments

Take names from the domain and the industry; one term, one meaning. `Manager`, `Helper`, `Utils` name a location, not a responsibility. A value with meaning gets a name at its owner. Comments say why, not what.

### Changing existing code

Read the owner, the seam, the existing mechanisms, and the consumers before the first line. Then respond by the proportion table:

| Situation | Response |
|---|---|
| The change fits an existing seam and owner | Make it. |
| The owner exists but has no place for the change | Restructure first as a separate step, behavior preserved; then add the change. |
| It changes another module's contract, state ownership, or a persisted format | Present options with cost now, cost later, reversibility; recommend one. |
| It is the second fix of the same kind | Find the shared cause first. |

Follow the codebase's conventions. A local pattern that breaks a core rule is not a convention to copy: name it in the report. Workaround signs, porting, and option format: [change-integration.md](references/change-integration.md).

## Verification

- Execute the changed behavior the way its consumer meets it; compiling is not verification. Zone skills say how in their environment.
- When a family gained a member or its dispatch changed, trace one more member: list the files it would touch. Expected: its own module, one registration, its assets. Anything else is a finding ([extension-trace.md](workflows/extension-trace.md)).
- When a core rule is broken a second time in a project, propose an executable check — a lint rule, a dependency rule, a compile-time completeness check ([structural-checks.md](references/structural-checks.md)). The check is the project's own code.
- Report which evidence was executed and which was reasoned.

## Context Adaptation

**New code:** name the owner of each operation and each family before writing. Build one member of a family completely — behavior, presentation, persistence, test — before adding the others; it is the pattern everyone copies.

**Feature in existing code:** find the owner and the seam first. If neither exists, that is the finding; apply the proportion table.

**Legacy code:** characterize behavior before moving it. Fix violations only where the change extends them; report the rest.

**Library or shared mechanism:** a small public contract, replaceable defaults built on that contract, explicit lifecycle, compatibility notes for every change ([variation.md](references/variation.md)).

**Prototype or spike:** mark throwaway code as such; code that stays follows the core rules.

**Tests:** the same ownership rules apply to fixtures and helpers; a test asserts behavior through the owner's contract, not through its internals.

## Anti-Patterns

- **Scattered variant knowledge** — sending, the settings form, the retry rule, and the audit export each branch on `channel`. Adding a channel edits every consumer; the compiler catches none of it. Fix: each channel owns its behavior, presentation data, and codec; consumers call the operation.
- **Silent default** — `else return null`, `?? defaultValue`, `default: break` in a dispatch over a family. A new member compiles and silently misbehaves.
- **Data-bag classes** — classes hold fields while a service, controller, or view decides what each class means. Object-oriented in form, procedural in substance.
- **Two type tests in one dispatch** — `kind ===` for some members and `instanceof` for others: two descriptions of one family.
- **Speculative mechanism** — a registry, plugin system, or DI container with one implementation and no second in sight.
- **Flag parameter** — the caller already knows which behavior it wants; pass the behavior or split the function.
- **Second writer** — a cache, component, or handler that updates state another unit owns.
- **Stale async effect** — a callback after an await writes into a disposed screen, request, job, or session.
- **Defensive noise** — fallbacks, retries, and validation for states the contract excludes, while the real boundary goes unchecked.
- **False DRY** — merging code that looks alike but encodes different knowledge.
- **Copying a defect** — reproducing a local pattern that breaks a core rule because "that's how the file does it".
- **Principle as alibi** — answering a structural finding with a quoted principle instead of tracing the next change.

## Related Knowledge

- `architecture` — boundaries between modules and services, application styles, system design, ADRs, views
- `testing` — test strategy, test doubles, regression and property tests
- `performance` — profiling and measured optimization
- `security` — trust boundaries and threat-driven controls
- language skills (`javascript`, `kotlin`, `rust`, `go`, `python`, …) — idioms for closed and open families, errors, async cancellation
- zone skills (`frontend`, `backend`, `mobile`, `gamedev`, …) — the environment the code runs in and how to exercise it there

## References

Workflows:

- [change.md](workflows/change.md) — build, fix, refactor, migrate: from request to verified change, including the reproduction method for bugs
- [critique.md](workflows/critique.md) — structural critique of one diff, merge request, or proposed fix
- [extension-trace.md](workflows/extension-trace.md) — trace one more member of a family and compare with the expected touches

References:

- [principles.md](references/principles.md) — SOLID, DRY, KISS/YAGNI, encapsulation, composition, invalid states, principle tensions
- [code-design.md](references/code-design.md) — units, state/policy/mechanism, dependencies, conditionals, objects or functions, wiring, names
- [variation.md](references/variation.md) — open and closed families, knowledge with its owner, contrast pairs, extension points, defaults
- [patterns.md](references/patterns.md) — code-level collaboration patterns: decorator, strategy, adapter, factory, state machine, pipeline, command, events
- [change-integration.md](references/change-integration.md) — fitting a change into existing code, proportion, workarounds, porting
- [structural-checks.md](references/structural-checks.md) — making core rules executable: exhaustiveness, restricted dispatch, dependency rules
