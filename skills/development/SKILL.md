---
name: development
description: "Write and change code that stays cheap to change, in any stack: ownership, variant families, dependencies, state and async lifetime, errors, where code lives (folders, files, names), refactoring. Use when implementing a feature, fixing a bug at its cause, adding a new type, kind, or provider, refactoring, reorganizing files and folders, or reviewing code structure."
argument-hint: "[change|critique|trace|organize] [target]"
---

# Development

How to write and change code in any stack so that the next change stays local. Zone skills (`frontend`, `backend`, `mobile`, `gamedev`, …) own their environment; language skills own the idioms that express these rules; `architecture` owns boundaries between modules and systems. This skill owns the practice inside a module, and the core rules below apply wherever code is written.

## Flow selection

When invoked with an argument, `change`, `critique`, `trace`, or `organize` selects the workflow and the remaining text is the target. Otherwise pick the route from the intent.

| Intent | Route |
|---|---|
| `change` — build, fix (reproduce first), refactor, or migrate code | [change.md](workflows/change.md) |
| `critique` — judge one diff, merge request, or proposed fix | [critique.md](workflows/critique.md) |
| `trace` — check whether a family of variants is open by tracing one more member | [trace.md](workflows/trace.md) |
| `organize` — audit how existing code is laid out and plan its reorganization | [organize.md](workflows/organize.md) |
| Question about a principle, pattern, organization, or structural check | the matching reference below |

## Scope and boundaries

| Question | Owner |
|---|---|
| Where a piece of knowledge lives inside a module: which unit, which file, which folder; units, variation, dependencies, state, async lifetime, errors, names; fitting a change into existing code; refactoring | this skill |
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
7. **Every folder and file holds one concept, and every declaration lives with the concept it describes.** A folder passes "everything in `X/` is about …"; a file's description needs no "and", and its name names the concept; a type, constant, or error code sits with its concept, not with its first consumer; a concept has one home, never split across trees or duplicated; a concept with a role that has its own reason to change or its own dependencies (persistence, a wire format, presentation) is a folder with a root file named after the concept and a file for that role.

Definitions the rules depend on:

- **Variant family** — types or kinds the code treats as alternatives of one concept, each carrying its own behavior or presentation: payment methods, notification channels, document types, widgets, importers, entity kinds.
- **Closed family** — a set fixed by something checkable: a protocol or file format with a version and one owner; a standard, or a type whose meaning fixes its cases (`Result`, `Option`, a language's AST, HTTP methods); the states of a state machine, owned by the machine; a stated requirement that the set does not grow. Everything else is open. Declaring a union of domain kinds does not close the family; it only lists today's members.
- **A format closes itself, not the domain.** A save or wire format that lists kinds is closed: its codec dispatches exhaustively by tag. The family of domain objects it stores stays open.
- **Construction and decoding** — the factory, registry, or composition root that creates variants, and the codec that selects a decoder by tag. These are the only places that name every member of an open family.
- **Concept** (rule 7) — something the code base talks about under one name the team would use: an entity (order, document), a capability (pricing, retry), a named mechanism (codec, schedule). Who uses the code ("what the API needs"), what kind of syntax it is ("types", "helpers"), or when it was written ("misc", "new") is not a concept.
- **Container** — a file or folder that code is written into; the gates check containers, not only lines.
- **"Lives with the variant"** prescribes ownership, not a style: a method on the class, a per-kind module registered once, a codec per kind, a component and its system in ECS. Language skills show the idioms.

Existing violations outside the change are findings, not work items. When a change extends the same dispatch or the same state, first move the knowledge to its owner as a separate, behavior-preserving step, then add the change ([refactoring.md](references/refactoring.md)). When it adds to a file or folder that already mixes concepts, the new piece gets a home of its own; the rest of the container is a finding, not part of the change ([how far a change restructures](references/organization.md#how-far-a-change-restructures)).

## Gates

Disorder is a habit, not one bad decision: each placement answered by the easy question is reasonable, and together they decay the tree again after every cleanup. Rules alone have not stopped that; these four moments put the concept question back into every change. Each leaves evidence in the working notes, the report, or the review.

| Gate | When | What |
|---|---|---|
| **G1 — home before writing** | the change adds a declaration or a file | before the first edit, a placement table: declaration → concept → home (existing file, new file, new folder) → why. No table, no edit |
| **G2 — container check** | after each portion written | list the file's declarations by the concept each names and read the folder against its phrase. A new concept, or a role that [gets its own file](references/organization.md#when-a-role-gets-its-own-file), in what you just wrote → restructure first as a separate behavior-preserving step, then continue |
| **G3 — container evidence** | before reporting | each touched folder with its files and phrase; each touched file with its declarations by concept and its one-line description |
| **G4 — neighbors** | reviewing a change | the reviewer collects the same evidence from the code; a violation of rule 7 in what the change adds, or in a declaration it extends, is a blocker; older failures of the container are notes |

The evidence is computed from the code each time with the stack's own means: listings, outlines, searches. Organization is judged, not detected — no tool decides it. Procedures: [change.md](workflows/change.md) (G1–G3) and [critique.md](workflows/critique.md) (G4); the questions: [container check](references/organization.md#container-check).

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

### Where does a new declaration go?

```text
Does it describe a concept that already has a home (even if another concept is the one using it)?
├─ yes, a role with its own reason to change or dependencies → a role file beside that concept's root
├─ yes, otherwise → that concept's file; if that file already mixes concepts, a new file for this concept beside it
Is it a new concept with siblings in a folder (same feature, same family)?
├─ yes → a new file named after the concept in that folder
Is it a general mechanism, free of the rules of the concepts that use it?
├─ yes → a concept of its own, named for what it is, however few its users
└─ no  → a new file for the concept, beside the concept that uses it, never inside that concept's file
```

## Core practice

Each subsection is the short form of one reference, in the same order as the reference list below.

### Variation

**Placement is not abstraction.** Moving knowledge to its owner — a method on the class that already exists, a per-kind module, a codec beside the type — costs nothing and is always allowed. YAGNI applies to **mechanisms**: a registry, plugin API, DI container, configuration switch, or generic framework needs variation that exists or is committed. Buy mechanisms in this order and move up only when the cheaper one fails: a parameter → a passed-in function → a small contract → a composition mechanism.

**Count branches by family, not by switch.** The signal is the number of operations that branch on the same family — validation, rendering, persistence, pricing, permissions — not identical switches. The second such operation means the knowledge belongs to the variants. A closed family may be dispatched in several places because the compiler proves each dispatch complete; an open one may not. Depth: [variation.md](references/variation.md).

### Units

**Decide, remember, act.** Keep policy (what should happen), state (what is remembered and for how long), and mechanism (I/O, timers, frameworks) apart. A unit has one reason to change and a name without "and". Wiring code lists what exists and how it connects and contains no decisions. Every unit of one kind is built in one form.

**Dependencies.** Pass in what varies, what has a lifecycle, what performs I/O, and what tests must control. Import stable pure helpers directly. Passing a function is dependency injection; a container is a mechanism and follows the rule above.

**State and lifetime.** Make invalid states unrepresentable: one state value with explicit transitions instead of several booleans; operations such as `submitOrder` instead of open mutation. Give every resource and every piece of async work an owner whose end cancels and releases it. Partial startup releases what it acquired.

**Errors.** Validate at trust and semantic boundaries; inside, rely on the contract you checked. Translate errors where one model meets another — success and failure semantics, not only types. Do not add retries, delays, or guards where the real problem is ordering, lifecycle, or ownership. Depth: [units.md](references/units.md).

### Collaboration

Start with direct calls and plain functions. Add a pattern — decorator, strategy, adapter, pipeline, state machine, command, events — only for a named force, and name the force: what varies, who selects it, how order, errors, and cancellation compose. Patterns that coordinate owners across modules belong to `architecture`. Depth: [collaboration.md](references/collaboration.md).

### Organization

Every placement, at every scale from a function in a class to a folder in a package, answers one question: which concept is this about? Not which file is open, who uses it, what kind of syntax it is, or where the first version happened to land. The structure is provisional: any change can reveal a new concept or role, and the structure follows in that change. Group by concept first, kind second: `orders/` with its service and repository, not `services/` holding every concept's service. A concept starts as one file; a role with its own reason to change or its own dependencies makes it a folder with a root file and role files. Code that belongs to none of the concepts using it is a concept of its own, whatever the number of its users; buckets (`utils`, `helpers`, `common`, `misc`, `shared`, `types`) are not homes. Levels fixed by an adopted methodology or framework stay, and the tests apply inside them. Meaning splits a file or folder, never its size: no line, declaration, file, or consumer count decides — a short file with three concepts fails, a long parser with one passes. Depth: [organization.md](references/organization.md).

### Names

Take names from the domain and the industry; one term, one meaning. A name says the concept, its role when the concept has several representations, and its family: `Manager`, `Helper`, `Utils` name a location, not a concept; two types of one concept are named by their roles; error codes, events, and settings carry their family's marker. A value with meaning gets a name at its owner. Comments say why, not what. Depth: [names.md](references/names.md).

### Proportion

Read the owner, the seam, the existing mechanisms, and the consumers before the first line. Then respond by the proportion table:

| Situation | Response |
|---|---|
| The change fits an existing seam and owner | Make it. |
| The owner exists but has no place for the change | Restructure first as a separate step, behavior preserved; then add the change. |
| The file or folder the change adds to already mixes concepts | Give the new piece a home of its own; report the rest of the container. |
| It changes another module's contract, state ownership, or a persisted format | Present options with cost now, cost later, reversibility; recommend one. |
| It is the second fix of the same kind | Find the shared cause first. |

Follow the codebase's conventions. A local pattern that breaks a core rule is not a convention to copy: name it in the report. A grab-bag folder or a file of several concepts is such a pattern; the shape of the existing tree is not a layout convention, a choice the project recorded is. Cues, weighing, workaround signs, and the option format: [proportion.md](references/proportion.md).

### Refactoring

Refactoring is a step inside a change, not a project of its own: before the change when the owner or the container has no place for it, after a portion when the container check finds a new concept or role. It preserves behavior, moves code verbatim in its own step with checks green on both sides, and leaves behavior changes to separate steps. Moves, bridges, the Mikado method, and porting: [refactoring.md](references/refactoring.md).

### Principles

SOLID, DRY as one representation of each piece of knowledge, KISS, YAGNI for mechanisms, composition by default, inheritance only for genuinely substitutable variants: [principles.md](references/principles.md). Principles explain a decision; they never replace tracing the change it makes cheaper or more expensive.

## Verification

- Execute the changed behavior the way its consumer meets it; compiling is not verification. Zone skills say how in their environment.
- When a family gained a member or its dispatch changed, trace one more member: list the files it would touch. Expected: its own module, one registration, its assets. Anything else is a finding ([trace.md](workflows/trace.md)).
- Before reporting, gather the container evidence (G3) for every touched folder and file from the code as it is now.
- When a core rule is broken a second time in a project, propose an executable check — a lint rule, a dependency rule, a compile-time completeness check ([checks.md](references/checks.md)). The check is the project's own code. Rule 7 is judged by the tests, not by a detector; a dependency rule can still guard a folder's boundary.
- Report which evidence was executed and which was reasoned.

## Context Adaptation

**New code:** name the owner of each operation and each family, and the home of each declaration, before writing. Build one member of a family completely — behavior, presentation, persistence, test — before adding the others; it is the pattern everyone copies.

**Feature in existing code:** find the owner and the seam first. If neither exists, that is the finding; apply the proportion table. The open file is not a home until the container check says so.

**Legacy code:** characterize behavior before moving it. Fix violations only where the change extends them; report the rest. When an area keeps decaying after cleanups, audit it with [organize.md](workflows/organize.md) and record the project's choices so the next change has rules to follow.

**Library or shared mechanism:** a small public contract, replaceable defaults built on that contract, explicit lifecycle, compatibility notes for every change ([variation.md](references/variation.md)).

**Prototype or spike:** mark throwaway code as such; code that stays follows the core rules.

**Tests:** the same ownership rules apply to fixtures and helpers; a test asserts behavior through the owner's contract, not through its internals.

## Anti-Patterns

**Variation**

- **Scattered variant knowledge** — sending, the settings form, the retry rule, and the audit export each branch on `channel`. Adding a channel edits every consumer; the compiler catches none of it. Fix: each channel owns its behavior, presentation data, and codec; consumers call the operation.
- **Silent default** — `else return null`, `?? defaultValue`, `default: break` in a dispatch over a family. A new member compiles and silently misbehaves.
- **Two type tests in one dispatch** — `kind ===` for some members and `instanceof` for others: two descriptions of one family.
- **Flag parameter** — the caller already knows which behavior it wants; pass the behavior or split the function.
- **Speculative mechanism** — a registry, plugin system, or DI container with one implementation and no second in sight.

**Units and state**

- **Data-bag classes** — classes hold fields while a service, controller, or view decides what each class means. Object-oriented in form, procedural in substance.
- **Second writer** — a cache, component, or handler that updates state another unit owns.
- **Stale async effect** — a callback after an await writes into a disposed screen, request, job, or session.
- **Defensive noise** — fallbacks, retries, and validation for states the contract excludes, while the real boundary goes unchecked.

**Organization**

- **Placement by the easy question** — code goes where the file is open, where its first user is, next to code of the same syntactic kind, or where the first version landed, instead of to the concept it is about. Cleanups that fix the places without changing the question come back with the next feature.
- **Append to the open file** — the new type or function lands in whatever file is in context because the imports are already there. G1 and G2 exist for this.
- **Grab-bag folder** — the files share "used in many places" or "needed early", not a concept.
- **Declaration at its consumer** — the refund's types defined in the order service: readers look in the wrong place, and the next consumer copies them.
- **By-kind tree** — `controllers/`, `services/`, `repositories/` each holding every concept: one feature edits three trees.
- **Confetti** — a file per declaration and a folder per file: the concept is as hard to see in fragments as in a dump.

**Judgment**

- **Copying a defect** — reproducing a local pattern that breaks a core rule because "that's how the file does it".
- **False DRY** — merging code that looks alike but encodes different knowledge.
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

- [change.md](workflows/change.md) — build, fix, refactor, migrate: from request to verified change, with gates G1–G3 and the reproduction method for bugs
- [critique.md](workflows/critique.md) — structural critique of one diff, merge request, or proposed fix, with gate G4
- [trace.md](workflows/trace.md) — trace one more member of a family and compare with the expected touches
- [organize.md](workflows/organize.md) — audit a tree: inventory, concept map, findings, target tree, move table, slices

References:

- [variation.md](references/variation.md) — open and closed families, conditionals or variants, knowledge with its owner, contrast pairs, extension points, defaults
- [units.md](references/units.md) — what a unit owns, state/policy/mechanism, dependencies, one form per kind of unit, wiring
- [collaboration.md](references/collaboration.md) — patterns between units: decorator, strategy, adapter, factory, state machine, pipeline, command, events
- [organization.md](references/organization.md) — the approach, the five tests, concept-first layout, when a role gets its own file, splitting by meaning, shared code, the container check, how far a change restructures, the smell catalog
- [names.md](references/names.md) — vocabulary, concept, role among siblings, family markers, file and folder names
- [proportion.md](references/proportion.md) — reading existing structure, fit or restructure or redesign, weighing, fix or cause, workaround signs, options
- [refactoring.md](references/refactoring.md) — when to restructure, its bounds, the moves, porting
- [principles.md](references/principles.md) — SOLID, DRY, KISS/YAGNI, encapsulation, composition, invalid states, principle tensions
- [checks.md](references/checks.md) — making core rules executable: exhaustiveness, restricted dispatch, dependency rules
