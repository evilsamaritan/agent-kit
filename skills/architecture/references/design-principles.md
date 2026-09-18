# Design Principles as Decision Tools

Use principles to diagnose change cost and correctness, not to score code by slogans. Principles conflict; apply the one tied to the active force and state the tradeoff.

## Contents

- [Primary objective](#primary-objective)
- [Cohesion and coupling](#cohesion-and-coupling)
- [SOLID](#solid)
- [DRY and knowledge ownership](#dry-and-knowledge-ownership)
- [KISS and YAGNI](#kiss-and-yagni)
- [Encapsulation and information hiding](#encapsulation-and-information-hiding)
- [Composition and variation](#composition-and-variation)
- [State and invalid states](#state-and-invalid-states)
- [Dependency stability](#dependency-stability)
- [Principle tensions](#principle-tensions)
- [Diagnostic questions](#diagnostic-questions)

## Primary objective

Good design keeps important behavior correct while making likely changes local, comprehensible, and safe. Flexibility is not the number of interfaces; it is the ability to absorb a demonstrated change without violating invariants or modifying unrelated code.

Assess a design through:

- change propagation;
- invariant ownership;
- conceptual clarity;
- testability at meaningful boundaries;
- failure and lifecycle behavior;
- cost of removing or replacing a decision.

## Cohesion and coupling

**Cohesion** asks whether a module's elements contribute to one focused responsibility or capability. **Coupling** asks how much a change or failure in one element affects others.

Prefer:

- group what changes for the same reason;
- separate what has independent reasons to change;
- keep collaboration through small semantic contracts;
- make dependencies visible at construction or function boundaries;
- avoid shared mutable state and reach-through access.

Low coupling is not zero coupling. Related components should collaborate directly when an abstraction or event would only obscure a required relationship.

## SOLID

### Single Responsibility Principle

A component should have one coherent reason to change, expressed in domain or policy terms.

**Signals:** unrelated rules in one module, frequent unrelated edits, names such as Manager/Utils, or tests requiring many disconnected setups.

**Correction:** group behavior by capability, invariant, or policy owner. Do not mechanically make every method a class.

### Open/Closed Principle

Stable policy should accept known forms of variation without repeated modification.

**Signals:** every new transport, rule, or policy edits the same switch across several files.

**Correction:** isolate the demonstrated variation behind composition, strategy, data-driven policy, or a narrow extension contract.

OCP does not justify speculative extension points. A stable direct implementation is closed enough when no independent variation exists. For the shapes that make a design open, with contrast pairs, read [composable-design.md](composable-design.md).

### Liskov Substitution Principle

An implementation is substitutable only if it preserves the contract's accepted inputs, guarantees, errors, side effects, and temporal behavior.

**Signals:** subtype-specific type checks, unsupported inherited methods, narrower preconditions, surprising errors, or different lifecycle semantics.

**Correction:** use composition, split the contract, or model variants explicitly rather than forcing an inheritance hierarchy.

### Interface Segregation Principle

Consumers should depend on the smallest coherent capability they use.

**Signals:** implementers stub methods, consumers receive broad god interfaces, or a change to one operation recompiles/retests unrelated clients.

**Correction:** define contracts from consumer needs while keeping operations that share one invariant together.

### Dependency Inversion Principle

Stable policy should not depend on volatile mechanism. Both meet at a semantic contract owned near the policy.

**Signals:** domain code imports transport/storage/vendor types, tests require real infrastructure, or replacing an edge mechanism changes business rules.

**Correction:** introduce a port when it expresses the policy's need more clearly than the concrete dependency. Wire implementations at a composition root.

## DRY and knowledge ownership

DRY means one authoritative representation of a fact or rule, not one implementation of every similar-looking sequence.

Centralize when duplicated code must change together because it encodes the same knowledge. Keep separate when it represents different domain concepts that may diverge.

```text
Same shape + same meaning + same change owner -> candidate for one abstraction
Same shape + different meaning/change owner   -> intentional duplication may be safer
Different shape + same business rule          -> centralize the rule, not the syntax
```

| Situation | Response |
|---|---|
| same business rule copied across paths | centralize under one authoritative owner |
| same operation with orthogonal policies | expose a stable contract and compose policies |
| similar mechanics for different domain meanings | keep separate until a shared concept is proven |
| shared helper imports half the application | restore ownership; move behavior to the cohesive module |
| generic abstraction contains many flags | split by variation axis or return to explicit implementations |

Duplication is often cheaper than the wrong shared abstraction. Revisit after real divergence or repeated coordinated changes reveal the true seam. A good abstraction makes consumers simpler and future changes more local; if callers must understand its internals, configure unrelated flags, or handle impossible states, it is not hiding the right concept.

## KISS and YAGNI

**KISS:** minimize the concepts, states, runtime parts, and hidden interactions required to explain the design.

**YAGNI:** do not pay present complexity for an uncommitted hypothetical future. Preserve reversible seams instead of implementing every possible extension.

These principles do not mean "write the fastest local patch." Repeating a known cross-cutting rule in many places is already present complexity. A small coherent mechanism may be simpler than many branches.

## Encapsulation and information hiding

Encapsulate decisions likely to change, not merely data fields.

A good boundary hides:

- storage layout;
- algorithm or policy selection;
- lifecycle and resource management;
- external representation and vendor semantics;
- consistency and retry mechanisms the caller need not coordinate.

Expose domain meaning and stable guarantees. Avoid getters or exported structures that let callers reimplement the owner's rules.

## Composition and variation

Prefer composition when behaviors vary independently or combine in multiple ways. A decorator, pipeline, strategy, or higher-order function can preserve one stable operation while varying policies around it.

Prefer inheritance only when:

- the relationship is genuinely substitutable;
- the base contract is stable;
- variants share invariants, not just code;
- combinations do not create a subclass explosion.

Prefer a direct function or concrete object when one behavior exists and no variation pressure is demonstrated.

## State and invalid states

Make valid transitions explicit and keep invalid combinations hard to construct.

- model mutually exclusive states as variants rather than unrelated booleans;
- validate at the boundary that owns the invariant;
- expose operations such as `submitOrder` rather than unrestricted mutation;
- distinguish absence, pending, failure, and completed states when behavior differs;
- make concurrency and idempotency part of the contract when they affect correctness.

Types help but do not replace transactional or temporal invariants.

## Dependency stability

Stable, widely depended-on modules should expose small contracts and change conservatively. Volatile details should depend on those contracts rather than the reverse.

Watch for:

- high fan-in to unstable implementation details;
- shared packages that import application-specific modules;
- cyclic dependencies;
- business policy compiled against framework lifecycles;
- abstractions whose every implementation changes together.

Stability is contextual. A mature external library may be more stable than a homegrown interface that mirrors it poorly.

## Principle tensions

| Tension | Resolve by asking |
|---|---|
| DRY vs low coupling | Is this one piece of knowledge or only similar syntax? |
| OCP vs YAGNI | Is variation demonstrated/committed, and is the seam cheaper than later change? |
| SRP vs fragmentation | Does separation create a coherent responsibility or only more navigation? |
| abstraction vs simplicity | Does the contract hide meaningful complexity for multiple consumers? |
| events vs direct calls | Is temporal decoupling semantically valuable, or are we hiding required coordination? |
| domain purity vs delivery cost | Which volatile dependency is causing real change/test pressure? |
| consistency vs availability | Which operations may return stale data or reject work during failure? |

State which side the design favors and why. No principle wins without context.

## Diagnostic questions

- What single change would be hardest to make safely?
- Which rule is represented in more than one place?
- Which module knows details it should only request through a contract?
- Who owns each invariant and state transition?
- Which abstractions have only one accidental consumer or many unrelated flags?
- Can a representative extension be added by composition rather than core edits?
- Can a component be tested without reconstructing unrelated infrastructure?
- Does removing a module reveal hidden state or lifecycle ownership?
- Can a new engineer explain the main flow and failure behavior without reading every file?
