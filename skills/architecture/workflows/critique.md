# Critique a Change

Act as an architecture critic for a merge request, diff, commit range, or proposed fix. The question is not "is this code correct" but "is this the right structure of change": does it treat the cause or patch a symptom, is it integrated or bolted on, and what would be better. Correctness, security, test, and style review belong to other reviewers.

## Contents

- [1. Establish intent and scope](#1-establish-intent-and-scope)
- [2. Reconstruct the local model](#2-reconstruct-the-local-model)
- [3. Classify the change](#3-classify-the-change)
- [4. Test the structure](#4-test-the-structure)
- [5. Develop alternatives](#5-develop-alternatives)
- [6. Report](#6-report)

## 1. Establish intent and scope

1. Read what the change is trying to achieve: description, ticket, commit messages, linked plan.
2. List the areas it touches: modules, contracts, state, configuration.
3. Critique against that intent, not against personal preference. If the intent itself is the problem, say so separately.

## 2. Reconstruct the local model

From the code around the diff — the touched area plus one hop:

1. Who owns the state and rules the change touches?
2. Which contracts does it cross, and who else consumes them?
3. Which existing mechanisms nearby already do something similar?
4. What did the structure look like before, and what was it evidently designed to allow?

Use project documentation when it exists, as a hypothesis to check against code. Never require it, and do not treat its absence as a finding.

## 3. Classify the change

Place the change in the proportion table of the core judgment and compare with what the author did:

| The change... | Expected | Finding when... |
|---|---|---|
| fits an existing seam and owner | direct change | the author added ceremony the change did not need |
| needed local restructuring | restructure, then add | it was attached to the nearest point instead; or restructuring and feature are mixed in one unreadable diff |
| crosses a contract, boundary, or state ownership | an explicit decision with options | the contract changed implicitly as a side effect |
| repeats an earlier fix | the shared cause addressed | another patch of the same kind was added |

Say so when direct embedding was the right call. A critique that always demands restructuring is as useless as one that never does.

## 4. Test the structure

Check the change against the core judgment. Each check names what to look for in the diff:

- **Cause or symptom.** Search for siblings of the fixed bug and earlier patches in the same area ([root-cause-analysis.md](../references/root-cause-analysis.md#finding-siblings)). A second occurrence means the cause is still there.
- **Workaround signs.** A special case in a shared path, a single-use flag, a guard or delay where the problem is ordering or ownership, a comment explaining why this case differs ([change-integration.md](../references/change-integration.md#signs-of-a-workaround)).
- **Ownership.** A new copy of a rule, type, formatter, or piece of state; a second writer to state that already has an owner.
- **Openness.** A new arm in a switch, case in a factory, or flag in an options bag where a composed piece would do; a consumer forced to edit the core ([composable-design.md](../references/composable-design.md)).
- **Parallel mechanism.** A new helper, manager, or subscription scheme beside an existing one that does the same job.
- **Contract drift.** A public surface, persisted shape, or lifecycle changed without being treated as a decision.
- **Unit structure.** State, policy, and mechanism newly mixed in one function; dependencies reached for instead of passed in ([code-design.md](../references/code-design.md)).
- **Vocabulary.** Coined names for mechanisms; a word now carrying two meanings.
- **Next change.** After this merge, is the next similar change cheaper, the same, or more expensive?

## 5. Develop alternatives

For each significant finding, propose one to three concrete alternatives: a short sketch, cost now, cost later, reversibility — including "accept as is, because" when that is honest. Use the option form in [change-integration.md](../references/change-integration.md#presenting-options). The critic proposes; it does not rewrite the change, and its alternatives are options for the author and the user to weigh.

## 6. Report

A five-minute read:

1. **Verdict** — sound; sound with a follow-up; or restructure before merge. One sentence of why.
2. **Findings** — the few that matter, ranked by architectural impact, each with `file:line` evidence, the judgment it violates, and the consequence. When several findings share a cause, report the cause once.
3. **Alternatives** — per significant finding, with a recommendation.
4. **Not checked** — what was out of scope or could not be verified.

No low-value tail, no style notes, no restating the diff.
