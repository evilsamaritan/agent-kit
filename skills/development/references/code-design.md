# Code Design: Structure in the Small

Use this reference when writing or refactoring code inside a module: tangled functions, mixed responsibilities, hidden dependencies, growing conditionals. It shows the moves behind the core rules at the scale of a function, class, or file. Principles are defined in [principles.md](principles.md), variation in [variation.md](variation.md), and patterns in [patterns.md](patterns.md).

Code sketches use TypeScript-flavored pseudo-code. The structures are language-independent.

## Contents

- [Find the section](#find-the-section)
- [What a unit owns](#what-a-unit-owns)
- [Separate state, policy, and mechanism](#separate-state-policy-and-mechanism)
- [Pass dependencies in](#pass-dependencies-in)
- [Conditionals and variation](#conditionals-and-variation)
- [Objects or functions](#objects-or-functions)
- [Wiring code](#wiring-code)
- [Names](#names)
- [When to leave it alone](#when-to-leave-it-alone)

## Find the section

| You see | Read |
|---|---|
| a function or file that does "everything"; every feature edits it | [What a unit owns](#what-a-unit-owns), [Separate state, policy, and mechanism](#separate-state-policy-and-mechanism) |
| tests that need half the application set up; globals, singletons, imports of concrete services deep in logic | [Pass dependencies in](#pass-dependencies-in) |
| flag parameters, several operations branching on the same kind or type, booleans that encode a lifecycle | [Conditionals and variation](#conditionals-and-variation) |
| classes with no state, or closures hiding a lifecycle | [Objects or functions](#objects-or-functions) |
| business decisions inside setup or bootstrap code | [Wiring code](#wiring-code) |
| `Manager`, `Helper`, `Utils`, or a word used with two meanings | [Names](#names) |

## What a unit owns

A function, class, or file should have one reason to change, stated in domain or policy terms. Test: describe what it does without the word "and". "Creates the session and the store and loads modules and formats errors" is four units.

Size is a symptom, not the criterion. A long function with one job (a parser, a wiring function) can be fine. A short one that reads state, decides, and performs I/O is already three things.

## Separate state, policy, and mechanism

Most tangled units mix three kinds of code:

- **policy** — decisions: given these facts, what should happen;
- **state** — what is remembered between calls, and its lifecycle;
- **mechanism** — I/O, transport, storage, timers, framework calls.

```ts
// Before: one function decides, remembers, and talks to the network
async function subscribe(channelId) {
  if (current && current.id !== channelId && !settings.multiChannel) await socket.send({ unsubscribe: current.id })
  current = { id: channelId, since: Date.now() }
  await socket.send({ subscribe: channelId })
}
```

```ts
// After: policy is a pure function; state has one owner; mechanism is passed in
function planSubscribe(current: Channel | null, channelId: string, multiChannel: boolean): Step[] {
  const steps: Step[] = []
  if (current && current.id !== channelId && !multiChannel) steps.push({ unsubscribe: current.id })
  return [...steps, { subscribe: channelId }]
}
// The stateful shell runs the plan through `send` and records the result.
```

The policy is now testable without a socket, the state has one writer, and the mechanism can change without touching the decision.

## Pass dependencies in

A unit's dependencies should be visible where it is constructed or called: parameters, constructor arguments, or a narrow context object. Globals, singletons, service locators, and imports of concrete services from deep inside logic hide who depends on what and who owns each lifecycle.

This needs no framework. Passing a function is dependency injection. Include time, randomness, and identity generation: a unit that calls the clock directly cannot be tested or replayed.

Do not overdo it: stable, pure, local helpers are imported directly. Pass in what varies, what has a lifecycle, what performs I/O, and what tests must control.

## Conditionals and variation

| Shape | Reading | Move |
|---|---|---|
| an `if` over values in one place | fine | none |
| a flag parameter selecting behavior | the caller already knows which behavior it wants | pass the behavior, or split into two functions |
| a branch on a variant's kind or type outside construction and decoding | the consumer is deciding what the variant means | move that decision to the variant; the consumer calls the operation |
| several operations branching on the same family, even through different switches | the family has several competing descriptions | each variant owns its behavior, presentation data, and codec |
| an exhaustive switch over a closed family (versioned protocol, `Result`, state-machine states) | the compiler proves it complete | keep it; make sure no `default` hides a member |
| several booleans encoding a lifecycle | impossible combinations are representable | one state value with explicit transitions |
| a lookup would do | the variants differ only in data | a table, not a class hierarchy |

Conditionals over values stay conditionals; a strategy for a single `if` is ceremony. A branch on a variant's type is not a value conditional: the core rules decide it, not its size.

## Objects or functions

Choose by state and variation, not ideology.

- **Objects** fit identity, encapsulated mutable state, a lifecycle, substitutable implementations, or protocol-like collaboration.
- **Functions** fit stateless transformation, dataflow composition, explicit dependencies as arguments, and states expressed as data variants.
- **Hybrids are normal:** immutable values and pure policy functions inside a stateful service; object adapters composed from functional middleware.

Prefer composition over inheritance; see [principles.md](principles.md#composition-and-variation). When classes already model the variants, their behavior belongs on them: a class that only holds fields while other code decides what it means is a data bag, not an object.

## Wiring code

Code that assembles the application — constructs owners, passes dependencies, lists members, orders middleware — may be long and boring. It must contain no policy. When a business decision appears in wiring, move it to the unit that owns it and keep wiring as a readable list of what exists and how it is connected.

## Names

- Take names from the domain and from the industry. Do not coin names for mechanisms when a known term exists.
- One term, one meaning. When a word carries two meanings (`session` for both login and game round), rename one; do not document the ambiguity.
- `Manager`, `Helper`, `Utils`, `Common` name a location, not a responsibility. Find the owner of each piece inside and move it there.
- A name that needs the word "and", or a comment to explain it, is describing two things.

## When to leave it alone

- Stable code with no change pressure.
- Three similar lines that may yet diverge.
- A single implementation with no other variant in sight: write it directly, without a mechanism.
- Anything outside the task's scope: propose the cleanup with its reason; do not fold it into an unrelated change.
