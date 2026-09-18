# Architecture Decision Records

Use an ADR to preserve a consequential architectural choice, its forces, alternatives, and accepted costs. An ADR records one decision; it does not replace the design model or implementation plan.

## Contents

- [When to write one](#when-to-write-one)
- [Decision scope](#decision-scope)
- [Full template](#full-template)
- [Compact template](#compact-template)
- [Decision log](#decision-log)
- [Lifecycle](#lifecycle)
- [Quality checks](#quality-checks)

## When to write one

An ADR is useful when a decision:

- has meaningful long-term or cross-team consequences;
- changes ownership, boundaries, contracts, data, or runtime topology;
- has several viable options with different tradeoffs;
- is expensive or risky to reverse;
- constrains later implementation in a non-obvious way.

Skip it for routine implementation choices, formatting, or decisions that are cheap to rediscover and reverse.

## Decision scope

Keep one forceful choice per ADR. Related consequences belong in the same record; independent decisions deserve separate records.

Good scopes:

- one module owns a state and invariant;
- one integration uses an adapter boundary;
- one capability moves to an independent service;
- one flow adopts asynchronous publication;
- one public contract changes compatibility strategy.

Weak scopes:

- "Use good architecture";
- a full project plan containing many independent choices;
- a technology name without the problem and forces;
- a decision already mandated with no relevant local consequence.

## Full template

```markdown
# ADR-NNN: Use a present-tense decision title

Status: Proposed | Accepted | Deprecated | Superseded by ADR-NNN
Date: YYYY-MM-DD
Owners: people or team responsible for the decision

## Context

Describe the problem, current evidence, affected scope, and why a decision is needed.
Separate facts, assumptions, and unknowns.

## Decision drivers

- outcome or invariant to protect
- relevant constraints and quality attributes
- compatibility, ownership, delivery, and operational forces

## Options considered

### Option A: descriptive name

Describe the shape, benefits, costs, risks, and reversibility.

### Option B: descriptive name

Describe the shape, benefits, costs, risks, and reversibility.

### Keep the current design

Describe the consequence of doing nothing now.

## Decision

State the chosen option, its scope, and the force that makes it preferable.

## Consequences

### Enables

- capabilities or changes made easier

### Costs and constraints

- complexity, coupling, runtime, compatibility, or operational burden accepted

### Follow-up decisions

- genuinely independent questions not decided here

## Delivery and migration

Describe reversible slices, compatibility window, rollout, rollback, and cleanup.

## Verification

Name tests, architecture fitness functions, telemetry, or operational evidence that confirm the decision.
```

## Compact template

Use this for a small but durable choice:

```text
In [scope], facing [force and constraints],
we choose [decision] over [alternatives]
to achieve/protect [outcome or invariant],
accepting [cost and limitation].
We will verify it through [evidence or fitness check]
and revisit it when [trigger].
```

## Decision log

When one design effort produces many small coupled decisions, a log table is cheaper than one ADR each and keeps supersession visible:

```markdown
| ID | Decision | Force | Rejected | Supersedes |
|---|---|---|---|---|
| D7 | One keepalive, owned by the host | several modules may be open at once; per-module heartbeats multiply and leave gaps | per-module keepalive; command declared in each manifest | D3 |
```

One row, one decision, in plain words. Record the force and what was rejected, not only the outcome. Promote a row to a full ADR when it is costly to reverse or must be understood without the surrounding design.

## Lifecycle

| Status | Meaning |
|---|---|
| Proposed | under review; implementation should not assume finality |
| Accepted | current decision for the stated scope |
| Deprecated | no longer recommended, but may still exist during migration |
| Superseded | another ADR replaces its decision |

Preserve the historical context and rationale. Status and links may be updated as the decision evolves; do not rewrite the old record to make the past look cleaner.

Store ADRs with the system they govern and use stable identifiers. Link superseding and related records in both directions when practical.

## Quality checks

Reject or revise an ADR when:

- the context contains only the preferred solution;
- alternatives are strawmen or omit keeping the current design;
- benefits are listed without accepted costs;
- the scope and state/data owner are ambiguous;
- implementation details obscure the actual architectural decision;
- no migration or compatibility path exists for an existing system;
- no evidence can verify the decision;
- the title names a technology but not the resulting behavior;
- several independent decisions are bundled together.

A good ADR lets a future maintainer understand why the choice was rational under the original constraints and which changed constraint should trigger reconsideration.
