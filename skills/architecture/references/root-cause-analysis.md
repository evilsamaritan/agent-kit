# Root-Cause Analysis: From Many Symptoms to Few Causes

Use this reference when facing an issue inventory, recurring bugs, a long list of review findings, a second fix of the same kind, or a scenario list that keeps growing. The goal is a small set of structural causes, each with evidence, the symptoms it explains, and the symptoms it does not.

## Contents

- [What counts as a cause](#what-counts-as-a-cause)
- [Method](#method)
- [Testing a cluster](#testing-a-cluster)
- [Worked example](#worked-example)
- [Acting on a list of findings](#acting-on-a-list-of-findings)
- [Finding siblings](#finding-siblings)
- [Result form](#result-form)
- [When a local fix is the right answer](#when-a-local-fix-is-the-right-answer)
- [Failure modes](#failure-modes)

## What counts as a cause

A structural cause is something you can point at in code: an owner, an invariant, a boundary, a lifecycle, or a contract. "The architecture is weak" explains everything and therefore nothing.

| Cause kind | Typical symptoms | Where to look |
|---|---|---|
| Missing or confused owner | the same rule behaves differently in different places; fixes land in callers | every implementation of the rule; who decides when two disagree |
| Several writers of one state | stale or contradictory values, order-dependent bugs, "fixed" by a guard or delay | every write path to the state, including tests and recovery code |
| Unenforced invariant | impossible states appear in production; validation is repeated at call sites | where the transition happens versus where it is checked |
| Leaky boundary | a change in one module breaks another; consumers depend on internals | imports across the boundary; exported internal types |
| Duplicated knowledge | one business change needs edits in many files; copies drift | all representations of the fact: types, mappers, formatters, constants |
| Edit-to-extend variation point | every new case edits the same switch, factory, or flag list; merge conflicts cluster there | the central dispatcher and its change history |
| Lifecycle gap | leaks, double subscriptions, work continuing after close, lost in-flight work | who starts, stops, disposes, and recovers each resource |
| Wrong unit of identity or lifetime | the contract needs exceptions as soon as a second instance, tenant, or session exists | what the contract assumes there is exactly one of |
| Wrong dependency direction | the core changes when a transport, storage, or vendor changes | imports from stable policy into volatile mechanism |

## Method

1. **Verify and deduplicate.** A reported problem is a hypothesis until code, a test, a trace, or an incident confirms it. Two descriptions of the same observed behavior are one symptom. Drop what cannot be confirmed and say so.
2. **Describe symptoms as facts, not remedies.** "Wallet balance differs between the lobby and the table" is a symptom. "Need a wallet sync service" is a remedy in disguise. Record what happened, where, and which state, rule, or contract was involved.
3. **Ask the two cause questions** for each symptom: *Which owner should have made this impossible? What would have to be true for this never to happen?* Symptoms that give the same answer are candidates for one cluster.
4. **Test each cluster** with the checks in the next section. Split it when a check fails.
5. **Record residual cases.** A symptom that no cause explains stays on the list as itself. Do not force it into the nearest cluster.
6. **Find the leverage point:** the smallest structural change, at the cause's owner, that makes the whole cluster impossible rather than fixed.
7. **Merge competing remedies.** When findings propose different fixes for one cause, the cause gets one correction at its owner. Several competing remedies for one problem are a sign the cause was never named.
8. **Rank causes** by consequence — correctness, blast radius, how much each future change is amplified — not by how many symptoms they collect.

## Testing a cluster

| Check | Question | Fails when |
|---|---|---|
| Counterfactual | If this cause were fixed, which symptoms disappear and which remain? | some "members" would survive the fix |
| Competing explanation | What else could produce these symptoms? What evidence separates the two? | the alternative explains them equally well and was not examined |
| Counterexample | Is there a place with the same structure where the symptom does not occur? Why? | the cause is present but harmless there, so something else is at work |
| Pointability | Can the owner, invariant, boundary, or lifecycle be shown in code? | the cause is a quality word: "messy", "coupled", "legacy" |
| Remedy independence | Would the cluster still hold if the favored pattern did not exist? | the symptoms were grouped because one solution could cover them |

## Worked example

Reported problems in a client that calls a remote service:

1. A payment is charged twice after a timeout.
2. Some calls retry three times, some never.
3. During an outage the client floods the service.
4. Retry counts in metrics do not match the logs.
5. An expired token causes an endless refresh loop.
6. Amounts are rounded differently on two screens.

Cause questions: for 1–4, the owner that should have made them impossible is "whoever decides how this client retries" — and there is none; each call site wrote its own loop. Counterfactual: with one retry policy around the client contract, owning attempts, backoff, the idempotency key, and the metric, symptoms 1–4 disappear together.

Symptom 5 looks related because the word "retry" appears, but the counterfactual fails: a single retry policy would still loop on refresh. Its own cause is that token refresh has no single owner serializing concurrent refreshes. Symptom 6 is unrelated duplicated knowledge (two formatters for one rule).

| Cause | Evidence | Explains | Does not explain | Leverage point |
|---|---|---|---|---|
| No owner of retry policy | 11 hand-written retry loops; 4 without backoff; no idempotency key | 1, 2, 3, 4 | 5 | one decorator around the client contract owns retry, backoff, idempotency, and its metric |
| Token refresh has no single owner | refresh triggered from 3 interceptors concurrently | 5 | — | one refresh operation that concurrent callers await |
| Amount formatting duplicated | two formatters with different rounding | 6 | — | one formatter owned by the money module |

Six problems, three causes, and the first cause was the only one that needed a design decision.

## Acting on a list of findings

A list of findings — from a review, an audit, another agent, a bug tracker — is input to analysis, never a to-do list. Working through it item by item produces one local patch per item, hides the pattern, and most of those patches are thrown away once the cause is addressed.

1. **Sort before clustering.** A raw list mixes confirmed defects, plausible risks, and preferences. Verify each against the code. Preferences and unconfirmed items do not enter the clusters.
2. **Do not fix anything yet.** An early individual fix removes evidence and commits to a remedy before the cause is known.
3. **Cluster and test** with the method above.
4. **Correct each cause once,** at its owner.
5. **Close the list.** Walk the original items and mark each one: resolved by the correction for cause X, residual with its own local fix, or rejected with the reason. Every item gets an answer; few get their own change.

The measure of success is not "all hundred items fixed" but "few corrections, every item accounted for".

## Finding siblings

Before fixing one instance, look for the rest of its class:

- other call sites of the same contract;
- other writers of the same state;
- other copies of the same rule, type, or constant (search for the shape, not only the name);
- other implementations created by copying the one at hand;
- earlier fixes in version history that patched the same area.

One instance with no siblings is a defect. Two or more are a cause.

## Result form

Report causes in a compact table like the one above: cause, evidence, symptoms explained, symptoms not explained, leverage point. Keep the raw symptom list out of the main narrative unless the user asked for traceability.

## When a local fix is the right answer

Fix locally, and say why, when the defect is isolated, has no siblings, the rule already lives in one place, and its owner exists. Most single bugs are this. The discipline is to check for siblings first, not to turn every bug into a redesign.

## Failure modes

- **Solution-shaped clustering** — grouping symptoms because one favored pattern could address them.
- **The universal cause** — one cluster that absorbs everything and cannot be tested.
- **Counting instead of weighing** — ranking causes by symptom count rather than consequence.
- **Remedies as symptoms** — starting from proposed fixes, which hides what actually happened.
- **Lost residuals** — dropping what did not fit, then being surprised when it returns.
- **Unverified inventory** — clustering reports that were never confirmed against the code.
