# Composable Design: Extend by Adding, Not by Editing

Use this reference when something must be extensible, when designing a core or library API, or when flags, switches, factories, or preset bundles keep growing. Per-pattern semantics (ordering, errors, cancellation) live in [design-patterns.md](design-patterns.md); this file is about the shape that makes a design open.

Code sketches use TypeScript-flavored pseudo-code. The shapes are language-independent.

## Contents

- [The property](#the-property)
- [Anatomy of an open design](#anatomy-of-an-open-design)
- [Contrast pairs](#contrast-pairs)
- [Designing an extension point](#designing-an-extension-point)
- [Defaults built on the public contract](#defaults-built-on-the-public-contract)
- [When open is the wrong answer](#when-open-is-the-wrong-answer)
- [Review questions](#review-questions)

## The property

A design is **open** when a consumer can add or replace behavior without editing the core, and can discard the shipped conveniences and write their own against the same contract. It is **closed** when every new case means editing a central place, or when the only way to use it is the way it was shipped.

Openness is a property of shape, not of size or abstraction count. A function that takes a function is open. A plugin registry with one plugin is ceremony. A middleware chain can be ten lines; it is an approach, not a framework.

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

Each pair shows a closed shape, why it stops scaling, the open shape, and what the open shape costs.

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
// Closed: every new game edits this function
function createGame(kind: string) {
  switch (kind) {
    case "poker": return new PokerGame()
    case "okey":  return new OkeyGame()
  }
}
```

```ts
// Open: the core knows the contract; the composition root lists the members
const games: Record<string, GameModule> = { poker: pokerModule, okey: okeyModule }
startHost({ games })
```

Cost: the list lives somewhere. Keep it in one composition root, not in a self-registering global.

### 3. Flag parameters versus passed-in behavior

```ts
// Closed: each new variation adds a flag and a branch
function loadTable(id: string, opts: { withCache?: boolean; silent?: boolean; legacyFormat?: boolean }) { /* ... */ }
```

```ts
// Open: the variation is a value the caller supplies
function loadTable(id: string, deps: { fetch: FetchTable; onError: (e: Error) => void }) { /* ... */ }
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

Cost: order matters and must be stated (see [design-patterns.md](design-patterns.md#decorator-and-middleware)).

### 6. Shared structure copied into every module versus a narrow interface passed in

```ts
// Closed: every module's state has a wallet field, a wallet reducer, and a wallet formatter
type PokerState = { wallet: Wallet; /* ... */ }
type OkeyState  = { wallet: Wallet; /* ... */ }
```

```ts
// Open: one owner; modules receive what they need from it
type ModuleContext = { wallet: { balance$: Observable<Money>; format(m: Money): string } }
function startPoker(ctx: ModuleContext) { /* reads through the interface; owns no copy */ }
```

Cost: the context contract needs care — keep it a typed, narrow surface the host owns. It is still closed if modules must change whenever the host's internal structure changes.

For inheritance trees built to express combinations of behavior, see [design-principles.md](design-principles.md#composition-and-variation): compose independent behaviors instead.

## Designing an extension point

Design extension points around variation that exists or is committed. For each one, answer:

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

## When open is the wrong answer

- One implementation and no demonstrated or committed variation: write it directly.
- Variants whose semantics genuinely differ: a common contract would hide the difference. Keep them separate.
- Collaboration that must be coordinated in a fixed order: an explicit sequence is clearer than pluggable stages.
- A mechanism that needs coined vocabulary to explain: it is a private framework. Use a known pattern or none.

Buy the cheapest seam that works, in this order: a parameter → a passed-in function → a small contract → a composition mechanism. Move up only when the cheaper seam demonstrably fails.

## Review questions

- Can a new behavior be added without editing the core?
- Can a shipped default be replaced from outside, using only the public contract?
- Who owns the order of composition, and is it visible where pieces are assembled?
- Does the core know the names of specific cases?
- Is there one list of members, in one composition root?
- Can the mechanism be explained with well-known pattern names and the project's own words?
- Is it simpler than the sum of the cases it replaces?
