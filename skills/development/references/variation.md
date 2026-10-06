# Variation: Extend by Adding, Not by Editing

Use this reference when a family of variants grows, when code branches on kinds or types, when designing a core or library API, or when flags, switches, factories, or preset bundles keep growing. Per-pattern semantics (ordering, errors, cancellation) live in [patterns.md](patterns.md); this file is about where variant knowledge lives and the structure that makes a design open.

Code sketches use TypeScript-flavored pseudo-code. The structures are language-independent.

## Contents

- [Open and closed families](#open-and-closed-families)
- [The property](#the-property)
- [Anatomy of an open design](#anatomy-of-an-open-design)
- [Contrast pairs](#contrast-pairs)
- [Concrete knowledge belongs to its owner](#concrete-knowledge-belongs-to-its-owner)
- [Designing an extension point](#designing-an-extension-point)
- [Defaults built on the public contract](#defaults-built-on-the-public-contract)
- [When a new mechanism is the wrong answer](#when-a-new-mechanism-is-the-wrong-answer)
- [Review questions](#review-questions)

## Open and closed families

A family is a set of variants the code treats as alternatives of one concept. Decide what kind of set it is before writing the first branch over it; the core rules in SKILL.md follow from the answer.

| The set is fixed by | Family | Dispatch |
|---|---|---|
| a protocol or file format with a version and one owner | closed | exhaustive, at the owner (decoder, state machine) |
| a standard, or a type whose meaning fixes its cases: `Result`, `Option`, a language's AST, HTTP methods | closed | exhaustive, wherever consumed |
| the states of a state machine | closed | the machine owns transitions |
| a requirement that says the set does not grow | closed | exhaustive; cite the requirement beside the dispatch |
| nothing of the above | open | each variant owns its knowledge; only construction and decoding name members |
| — the variants differ only in values | data | definitions run by one algorithm |

A format and the domain it stores are different sets. An export file that lists today's document types is a closed format: its codec dispatches by tag. The family of document types stays open, and a new type means a new codec entry plus a format version, not edits to every consumer.

Declaring a union of domain kinds (`type Kind = "email" | "sms"`) does not close the family either: the union only lists today's members. Counting enumerated members in a specification does not close a family. "We support five notification channels" describes today; "the set of channels is fixed" is a requirement. When the specification is silent and a new member is a plausible request, treat the family as open and state the assumption.

### Expressing ownership

| Style | Open family | Closed family |
|---|---|---|
| Classes | a method on each variant, or on a named capability several variants implement | a sealed hierarchy or enum with an exhaustive switch |
| Functions and data | a per-kind module registered once; one table at the registration mapping each kind to its module, proven complete by the type checker — never a per-consumer table of per-kind values | a discriminated union with an exhaustive switch |
| ECS or data-oriented | a component and the system that owns it; kind-specific behavior is its own component | an enum dispatched by its owning system |
| Persistence | one codec per kind, selected by tag at decode | the format's version dispatch |

When several variants share a behavior — two payment methods that both support refunds — name the capability and implement it once. Consumers call the capability's operation; they do not test which variants have it.

## The property

A design is **open** when a consumer can add or replace behavior without editing the core, and can discard the shipped conveniences and write their own against the same contract. It is **closed** when every new case means editing a central place, or when the only way to use it is the way it was shipped.

Openness is a property of structure, not of size or abstraction count. A function that takes a function is open. A plugin registry with one plugin is ceremony. A middleware chain can be ten lines; it is an approach, not a framework.

## Anatomy of an open design

```text
conveniences / defaults      built only on the public contract; replaceable, disposable
        |
composition by the caller    which pieces, in what order
        |
contract for pieces          small: input, output, how a piece passes control or a result on
        |
core                         does one mechanical job; knows no specific piece
```

The core stays small because it never learns about specific cases. New behavior is a new piece. The caller, not the core, decides which pieces exist and in what order.

## Contrast pairs

Each pair shows a closed structure, why it stops scaling, the open structure, and what the open structure costs.

### 1. Preset API versus core, middleware, and replaceable utilities

```ts
// Closed: one call, a growing options bag, behavior fixed by the library
showTooltip(target, { placement: "top", flip: true, shift: true, arrow: true, offset: 8 })
// A new positioning rule means a new option and a library release.
```

```ts
// Open: a core that computes, pieces that adjust, utilities on top
const position = computePosition(reference, floating, {
  middleware: [offset(8), flip(), shift(), myCustomRule()],
})
// offset/flip/shift are ordinary middleware shipped as defaults; a consumer can write their own.
```

Cost: the consumer assembles more. Pay it back with a convenience wrapper built from the same public pieces.

### 2. Central factory or type switch versus registration at the composition root

```ts
// Closed: every new exporter edits this function
function createExporter(format: string) {
  switch (format) {
    case "csv":  return new CsvExporter()
    case "xlsx": return new XlsxExporter()
  }
}
```

```ts
// Open: the core knows the contract; the composition root lists the members
const exporters: Record<string, ExporterModule> = { csv: csvModule, xlsx: xlsxModule }
startReports({ exporters })
```

Cost: the list lives somewhere. Keep it in one composition root, not in a self-registering global.

### 3. Flag parameters versus passed-in behavior

```ts
// Closed: each new variation adds a flag and a branch
function loadReport(id: string, opts: { withCache?: boolean; silent?: boolean; legacyFormat?: boolean }) { /* ... */ }
```

```ts
// Open: the variation is a value the caller supplies
function loadReport(id: string, deps: { fetch: FetchReport; onError: (e: Error) => void }) { /* ... */ }
```

Cost: callers must choose. Give them a default value, not a default branch.

### 4. God function versus named stages

```ts
// Closed: one function owns parsing, validation, state, I/O, and presentation
function createCore(config) { /* 400 lines; every feature edits it */ }
```

```ts
// Open: stages with one job each; the function that remains is wiring
function createCore(config) {
  const session = createSession(config.auth)
  const store = createStore(reducers)
  const modules = loadModules(manifests, { session, store })
  return { session, store, modules }
}
```

Cost: more names to read. Each must describe a real responsibility; if a stage cannot be named without "and", it is not a stage yet.

### 5. Cross-cutting behavior at every call site versus one decorator

```ts
// Closed: each call site re-implements retry, logging, metrics — differently
for (let i = 0; i < 3; i++) { try { return await client.call(req) } catch { await sleep(100) } }
```

```ts
// Open: the operation's contract stays; policies wrap it once
const client = withMetrics(withRetry(withAuth(transportClient), retryPolicy))
```

Cost: order matters and must be stated (see [patterns.md](patterns.md#decorator-and-middleware)).

### 6. Shared structure copied into every module versus a narrow interface passed in

```ts
// Closed: every module keeps its own locale field, loader, and money formatter
type BillingState = { locale: Locale; /* ... */ }
type ReportsState = { locale: Locale; /* ... */ }
```

```ts
// Open: one owner; modules receive what they need from it
type ModuleContext = { locale: { current$: Observable<Locale>; formatMoney(m: Money): string } }
function startBilling(ctx: ModuleContext) { /* reads through the interface; owns no copy */ }
```

Cost: the context contract needs care — keep it a typed, narrow surface the host owns. It is still closed if modules must change whenever the host's internal structure changes.

For inheritance trees built to express combinations of behavior, see [principles.md](principles.md#composition-and-variation): compose independent behaviors instead.

## Concrete knowledge belongs to its owner

An interface, DI container, registry, or folder split does not remove coupling by itself. Follow the decisions: if saving, drawing, and updating each inspect the same concrete types to decide what those types mean, the family has several competing descriptions. Adding a member requires synchronized edits across consumers.

```ts
// A generic saver owns the details of every document type.
function snapshot(document: Document) {
  switch (document.kind) {
    case "text": return { kind: "text", content: document.content }
    case "drawing": return { kind: "drawing", strokes: document.strokes }
  }
}
```

The stable operation is collecting serializable state. The variable knowledge is which state represents each document. Put that knowledge beside its owner and let collection and storage depend on the operation:

```ts
interface SnapshotSource {
  capture(): SavedRecord
}

function collect(sources: readonly SnapshotSource[]) {
  return sources.map(source => source.capture())
}
```

This is a collaboration sketch, not a requirement that every domain object implement persistence. `capture` can be an object method, a composed capability, a closure, or an adapter. In a data-oriented or ECS design, codecs beside component stores can own schema knowledge while an orchestrator iterates registered codecs. Domain state stays independent of the storage provider; codecs own versioned mapping, validation, and restoration, including invalid or unsupported records. Shared identity and cross-record invariants have their own explicit owner.

Concrete implementations are known where they are assembled. On restore, a serialized tag may select a registered decoder at a boundary. That boundary knows the lookup protocol; the selected decoder owns the payload rules. Adding a document type changes its implementation and assembly, without teaching collection or storage its fields. Renaming a runtime type does not automatically change a persisted schema identifier.

Use this decision test:

| Situation | Appropriate structure |
|---|---|
| Finite protocol messages or lifecycle states, changed together under one owner | Discriminated union and exhaustive dispatch can be the clearest contract. |
| Independently added behaviors or providers | Select the implementation through a narrow contract at assembly or a boundary. |
| Variants differ only in configuration | Use data with one algorithm; do not manufacture classes. |
| Consumer enumerates optional capabilities and infers a concrete type | It is reconstructing the family model; give it the required operation or query instead. |

The criterion is where the decision about a member lives. For an open family, construction and decoding name the members and nothing else does. A table inside a consumer that holds every variant's rules has the same problem as a switch. An exhaustive decoder for a closed wire format is valid. A conditional over values is not variation and needs no mechanism.

Prove the structure with an extension trace: add one representative member, list the files it touches, and trace its creation, operation, failure, and cleanup. Any consumer on the list is a finding. Procedure: [extension-trace.md](../workflows/extension-trace.md).

## Designing an extension point

An extension point is a mechanism: a contract others implement, a registry, a plugin API. Build one around variation that exists or is committed. For each one, answer:

1. What may vary?
2. What must stay invariant, whatever the extension does?
3. Who selects and orders extensions?
4. What context can an extension see, and what is deliberately withheld?
5. How are errors, cancellation, and partial effects handled?
6. How is compatibility kept when the contract evolves?
7. How is an extension tested alone and in composition?

If questions 2–5 have no answer, the extension point is a hole, not a contract.

## Defaults built on the public contract

Ship conveniences that use only what consumers can also use. The test: *could a consumer have written this default?* If the default needs private access, the contract is too narrow or the default belongs in the core.

This keeps the core small, makes defaults disposable, and turns every shipped default into a living example of how to extend.

## When a new mechanism is the wrong answer

- One implementation and no other variant in sight: write it directly.
- Variants whose semantics genuinely differ: a common contract would hide the difference. Keep them separate.
- Collaboration that must be coordinated in a fixed order: an explicit sequence is clearer than pluggable stages.
- A mechanism that needs coined vocabulary to explain: it is a private framework. Use a known pattern or none.

Buy the cheapest mechanism that works, in this order: a parameter → a passed-in function → a small contract → a composition mechanism. Move up only when the cheaper one demonstrably fails. This ladder prices mechanisms; it does not apply to placing a variant's knowledge on the variant, which is free.

## Review questions

- Can a new behavior be added without editing the core?
- Can a shipped default be replaced from outside, using only the public contract?
- Who owns the order of composition, and is it visible where pieces are assembled?
- Does the core, or any consumer outside construction and decoding, know the names of specific cases?
- Is there one list of members, in one composition root?
- Can the mechanism be explained with well-known pattern names and the project's own words?
- Is it simpler than the sum of the cases it replaces?
