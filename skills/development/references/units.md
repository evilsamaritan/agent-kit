# Units: Structure in the Small

Use this reference when writing or refactoring a function, class, or module: tangled functions, mixed responsibilities, hidden dependencies, units of one kind built differently, decisions in setup code. It shows the moves behind the core rules at the scale of a unit. Principles are in [principles.md](principles.md), variant families and conditionals in [variation.md](variation.md), collaboration patterns in [collaboration.md](collaboration.md), files and folders in [organization.md](organization.md), names in [names.md](names.md).

Code sketches use TypeScript-flavored pseudo-code. The structures are language-independent.

## Contents

- [Find the section](#find-the-section)
- [What a unit owns](#what-a-unit-owns)
- [Separate state, policy, and mechanism](#separate-state-policy-and-mechanism)
- [Pass dependencies in](#pass-dependencies-in)
- [One form per kind of unit](#one-form-per-kind-of-unit)
- [Wiring code](#wiring-code)
- [When to leave it alone](#when-to-leave-it-alone)

## Find the section

| You see | Read |
|---|---|
| a function or class that does "everything"; every feature edits it | [What a unit owns](#what-a-unit-owns), [Separate state, policy, and mechanism](#separate-state-policy-and-mechanism) |
| tests that need half the application set up; globals, singletons, imports of concrete services deep in logic | [Pass dependencies in](#pass-dependencies-in) |
| flag parameters, several operations branching on the same kind or type, booleans that encode a lifecycle | [variation.md](variation.md#conditionals-or-variants) |
| classes with no state, closures hiding a lifecycle, owners of one kind built in different forms | [One form per kind of unit](#one-form-per-kind-of-unit) |
| business decisions inside setup or bootstrap code | [Wiring code](#wiring-code) |
| `Manager`, `Helper`, `Utils`, a word used with two meanings, near-identical type names, error codes that read like settings | [names.md](names.md) |
| a file or folder that holds several things | [organization.md](organization.md) |

## What a unit owns

A function, class, or file should have one reason to change, stated in domain or policy terms. Test: describe what it does without the word "and". "Creates the session and the store and loads modules and formats errors" is four units.

Size is a symptom, not the criterion. A long function with one job (a parser, a wiring function) can be fine. A short one that reads state, decides, and performs I/O is already three things.

A function that grew into the whole application shows the same failure at full size, and the same cure: stages with one job each, and the function that remains is wiring.

```ts
// Before: one function owns parsing, validation, state, I/O, and presentation
function createCore(config) { /* every feature edits it */ }
```

```ts
// After: stages with one job each; the function that remains is wiring
function createCore(config) {
  const session = createSession(config.auth)
  const store = createStore(reducers)
  const modules = loadModules(manifests, { session, store })
  return { session, store, modules }
}
```

Cost: more names to read. Each must describe a real responsibility; if a stage cannot be named without "and", it is not a stage yet.

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

A feature-flag client is such a dependency: inject it, evaluate the flag once at a single seam where the implementation is chosen, and pass the chosen behavior downstream so inner code never asks the flag. An unknown flag name is an error, not a silent "off". Rollout mechanics: `release-engineering`.

Do not overdo it: stable, pure, local helpers are imported directly. Pass in what varies, what has a lifecycle, what performs I/O, and what tests must control.

## One form per kind of unit

Choose a form by state and variation, not ideology — then build every unit of the same kind in that form across the code base.

| Kind of unit | Default form |
|---|---|
| data: records, messages, values | types or records; behavior limited to the value's own invariants |
| pure transformation | functions |
| owner of state, a lifetime, a registry, a session | a class or an object with methods that keeps its state private; extended by composition, adapters, and decorators rather than by editing |
| member of a family | a module or class per variant ([variation.md](variation.md)) |
| assembly | the composition root, wiring only ([Wiring code](#wiring-code)) |

- **Objects** fit identity, encapsulated mutable state, a lifecycle, substitutable implementations, or protocol-like collaboration.
- **Functions** fit stateless transformation, dataflow composition, explicit dependencies as arguments, and states expressed as data variants.
- **Hybrids are normal:** immutable values and pure policy functions inside a stateful service; object adapters composed from functional middleware.

A functional code base may choose closures, processes, or modules as its owner form; the rule is one form per kind, not classes. The project records its choice ([organization.md](organization.md#recording-the-projects-choices)). Two forms for one kind — one registry a class, another a closure, a third a bag of functions over a shared object — is a finding: readers cannot predict the shape, and an extension written for one does not fit the others.

Prefer composition over inheritance; see [principles.md](principles.md#composition-and-variation). When classes already model the variants, their behavior belongs on them: a class that only holds fields while other code decides what it means is a data bag, not an object.

## Wiring code

Code that assembles the application — constructs owners, passes dependencies, lists members, orders middleware — may be long and boring. It must contain no policy. When a business decision appears in wiring, move it to the unit that owns it and keep wiring as a readable list of what exists and how it is connected.

## When to leave it alone

- Stable code with no change pressure.
- Similar lines that may yet diverge.
- A single implementation with no other variant in sight: write it directly, without a mechanism.
- Anything outside the task's scope: propose the cleanup with its reason; do not fold it into an unrelated change.
