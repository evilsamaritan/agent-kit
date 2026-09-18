# Change Integration: Fitting a Feature or Fix Into Existing Code

Use this reference when adding behavior to existing code, fixing a bug that may be a symptom, porting code from elsewhere, or deciding whether to restructure before changing. The default failure is the bolt-on change: look at what exists, attach the new behavior at the nearest point, move on.

## Contents

- [Read the structure that exists](#read-the-structure-that-exists)
- [Name the structure the change wants](#name-the-structure-the-change-wants)
- [Fit, restructure, or redesign](#fit-restructure-or-redesign)
- [Weighing proportion](#weighing-proportion)
- [Preparatory refactoring](#preparatory-refactoring)
- [Fix or cause](#fix-or-cause)
- [Signs of a workaround](#signs-of-a-workaround)
- [Presenting options](#presenting-options)
- [Porting and copying code](#porting-and-copying-code)

## Read the structure that exists

Before the first line, find from code — not from folder names:

- the **owner** of the state and rules the change touches;
- the **seam** the change could enter through: a place where behavior can be added without editing the code around it;
- **existing mechanisms** that already do something similar (a second retry helper, formatter, or subscription manager is almost always wrong);
- the **consumers** that will see the change, including tests and recovery paths.

If no owner or seam exists, that is the finding. Do not paper over it by attaching the change to whichever file is open.

## Name the structure the change wants

Describe the change independently of the current code: the operation, the policy that varies, the state it needs, who owns that state, and what is likely to come next in the same direction. The distance between this description and the existing structure is the design decision.

## Fit, restructure, or redesign

The proportion table in SKILL.md gives the response for each situation. These cues tell you which row you are in:

| Situation | Cues |
|---|---|
| Fits an existing seam and owner | a new piece next to similar pieces; no other module notices |
| Needs local restructuring | the owner exists but has no seam; a function must be split before the new behavior has a place; a copy would otherwise be needed |
| Crosses a contract or boundary | another module's public surface, state ownership, a persisted or wire format, or a hard-to-reverse choice changes |
| Repeats a fix | the same kind of patch has been applied before, here or in a sibling; find the cause with [root-cause-analysis.md](root-cause-analysis.md) |

"Make the change easy, then make the easy change" describes the second row. The third row is where a user's decision is needed; the first two are not.

## Weighing proportion

There is no formula. Weigh these and say which ones decided the matter:

| Factor | Pushes toward direct change | Pushes toward restructuring |
|---|---|---|
| Cost added to later changes | none: the next similar change is equally easy | each later change needs another copy, branch, flag, or writer |
| Direction of travel | the area is stable; nothing similar is planned | more of the same kind is committed or already queued |
| Consumers touched | one | several, or every module of a kind |
| Reversibility of the direct change | trivially removable | becomes load-bearing: persisted, exported, depended on |
| Cost and risk of restructuring | large, poorly tested area; unclear behavior | local, behavior-preserving, verifiable |
| Evidence | the better structure is a guess | the missing seam or owner is visible in code |

Worked outcomes:

- *A new filter is added to a list that already has five filters as plain predicates.* Fits. Add the sixth predicate.
- *A seventh game needs wallet display, and six games each carry their own wallet copy.* The direct change adds a seventh copy and the next change edits seven places. The owner is obvious. Restructure: one wallet owner, modules receive a narrow interface to it — and because it changes the module contract, present it as options first.
- *One screen needs a one-off workaround for a vendor bug, removable when the vendor fixes it.* Direct change is right. Isolate it at the edge, name it as a workaround, and state the removal condition.

Direct embedding is sometimes the correct answer. What is never correct is choosing it without having looked.

## Preparatory refactoring

- Behavior-preserving, and verified as such before the feature step starts.
- A separate step (ideally a separate commit) so the feature diff stays readable.
- Bounded to the touched module. The moment it changes another module's contract, it is no longer preparatory — it is the third row of the table.
- Justified by the change at hand. Cleanup the task does not need is proposed, not done.

## Fix or cause

Before fixing a bug, check whether it is an instance of a class: look for siblings, earlier patches in the same area, and other copies of the rule (see [Finding siblings](root-cause-analysis.md#finding-siblings)). One isolated defect with an existing owner gets a local fix — say so explicitly. A second occurrence gets a cause.

## Signs of a workaround

A change is probably covering a hole rather than fixing it when it adds:

- a special case for one caller inside a shared path;
- a flag whose only user is the new change;
- a copy of a rule, type, or formatter that already exists elsewhere;
- a second writer to state that already has one;
- a retry, timeout, delay, or guard where the real problem is ordering, lifecycle, or ownership;
- a new mechanism parallel to an existing one;
- a comment explaining why this case is different.

Any one of these is a prompt to look again, not proof. An honest workaround is isolated, named as one, and has a removal condition.

## Presenting options

When the decision belongs to the user, give two or three options, not a survey:

```text
Option A — direct: <one-line sketch>
  now: <cost>   later: <what gets harder>   reversibility: <easy | costly | one-way>
Option B — restructure locally: <sketch>
  now: ...      later: ...                  reversibility: ...
Option C — wider redesign: <sketch>
  now: ...      later: ...                  reversibility: ...
Recommendation: <one option> because <the deciding factors>.
```

Use the project's words, point at the actual code, and keep each sketch short enough to compare at a glance.

## Porting and copying code

Port responsibilities, not files. Before carrying code across a boundary:

- Whose knowledge is this? If the destination already owns it, use that owner instead of importing a second one.
- Does the copy create a second authority for the same state or rule?
- Which assumptions of the old home (one instance, one session, one transport) does the code carry silently?
- What in it is policy worth keeping, and what is mechanism tied to the old surroundings?
