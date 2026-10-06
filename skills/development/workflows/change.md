# Make a Change

Use this workflow to build a feature, fix a bug, refactor, or migrate code. Each step names what to establish before moving on; a routine change passes through them in minutes.

## Contents

- [1. Read the request and the code](#1-read-the-request-and-the-code)
- [Fix: reproduce before changing](#fix-reproduce-before-changing)
- [2. Name owners, families, and assumptions](#2-name-owners-families-and-assumptions)
- [3. Choose the response](#3-choose-the-response)
- [4. Implement](#4-implement)
- [5. Verify](#5-verify)
- [6. Report](#6-report)

## 1. Read the request and the code

1. State the outcome and how it will be verified.
2. Follow the affected call and data paths in code: entry point, owner of the state and rules, consumers, recovery paths. Folder names and file names are hints, not evidence.
3. Note existing mechanisms that already do something similar; a second one is almost always wrong.

Pick the mode:

| Mode | Trigger | Output |
|---|---|---|
| Build | new behavior | code and tests at the owner |
| Fix | a defect report, failing check, or trace | a reproduction, the cause corrected at its owner, a regression check, a note on siblings |
| Refactor | structure changes, behavior does not | the diff plus evidence that behavior is identical |
| Migrate | a contract or dependency changes upstream | reversible steps with breaking points marked |

### Fix: reproduce before changing

A fix without a reproduction is a guess. Before editing:

1. **Reproduce reliably.** Turn the report into a command, test, or script that fails the same way every run. For an intermittent failure, find what varies — timing, order, data, environment — and pin it until the failure is deterministic or its rate is measured.
2. **Minimize.** Remove input, steps, and configuration until each remaining part is needed for the failure.
3. **Bisect when the cause is unknown.** By commit when it used to work, by input or configuration when it never did. Instrument (logs, assertions, a debugger) at the boundary where correct state first becomes wrong.
4. **State a falsifiable hypothesis** — "the cache is read before the owner writes it" — and the observation that would disprove it. Test it before changing code.
5. **Turn the reproduction into the regression check** at the owner of the corrected behavior; it fails before the fix and passes after.

If the failure cannot be reproduced, report what was tried and the evidence gathered; do not ship a speculative fix as a confirmed one.

## 2. Name owners, families, and assumptions

Before the first edit, write down — in the plan or the working notes:

- the owner of each operation and each piece of state the change touches;
- every family the change branches on or adds a member to, and whether it is open or closed (decision tree in SKILL.md), with the evidence;
- assumptions that would change the structure if wrong, such as "the set of providers grows" or "one session per user".

Ask about an assumption only when it changes scope, a public contract, or a hard-to-reverse decision and the code cannot answer it. Otherwise proceed and report it.

## 3. Choose the response

Use the proportion table in SKILL.md ("Changing existing code"):

- fits an existing owner and seam → make the change;
- the owner has no place for it, or the change would extend a core-rule violation → restructure first as a separate behavior-preserving step;
- crosses another module's contract, state ownership, or a persisted format → options with cost now, cost later, reversibility ([change-integration.md](../references/change-integration.md#presenting-options));
- the second fix of the same kind → find the shared cause first.

## 4. Implement

- Follow the core rules in everything the change adds or modifies.
- For a new member of a family, put its behavior, presentation data, and codec with the member and add one registration. For a new operation over an open family, add it to each member or to a named capability; for a closed family, add an exhaustive dispatch with no default.
- Follow local conventions; do not copy a local pattern that breaks a core rule — note it for the report.
- Keep the diff to the task. Cleanup the task does not need is proposed, not done.

## 5. Verify

- Run what can be run: tests, type checks, linters, and the changed behavior itself the way its consumer meets it. The zone skill says how in its environment.
- If a family changed, run an [extension trace](extension-trace.md).
- Recheck the core rules against the finished diff, not against the plan.

## 6. Report

1. What changed and why, in one or two sentences.
2. Files touched, each with a word on the change.
3. Verification run, and what could not be run.
4. Assumptions, local core-rule violations found but not fixed, follow-ups.
