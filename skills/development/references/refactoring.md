# Refactoring: Moving Code Without Changing Behavior

Use this reference when restructuring code before or during a change, when a container check says a file or folder must split, when executing an audit's move table, or when carrying code across a boundary. Refactoring here is a step inside ordinary work, not a separate project: the structure follows the concepts as they appear. Whether a change needs restructuring at all is decided in [proportion.md](proportion.md).

## Contents

- [When](#when)
- [Bounds](#bounds)
- [The moves](#the-moves)
- [Porting and copying code](#porting-and-copying-code)

## When

| Moment | Trigger |
|---|---|
| before a change (preparatory) | the owner has no place for the change; the change would extend a core-rule violation; a declaration the change extends sits at the wrong concept |
| after a portion (G2) | the [container check](organization.md#container-check) finds a violation in what was just written |
| a planned reorganization | a slice of an audit's move table ([organize.md](../workflows/organize.md)) |

"Make the change easy, then make the easy change": the restructuring comes first, as its own step, and the feature or fix continues on top of it.

## Bounds

- Behavior-preserving, and verified as such before the feature step starts.
- A separate step (ideally a separate commit) so the feature diff stays readable.
- Bounded by what the change writes ([how far a change restructures](organization.md#how-far-a-change-restructures)). The moment it changes another module's contract, it is no longer preparatory — it is a decision with options ([proportion.md](proportion.md#presenting-options)).
- Justified by the change at hand. Cleanup the task does not need is proposed, not done.

## The moves

1. **Green baseline.** Run the checks that cover the code to be moved. A failing baseline is fixed or recorded first; otherwise nobody can tell what the move broke.
2. **Name the destination.** The concept and its home, from the placement table (G1) or an audit's move table.
3. **Move verbatim.** Move code without editing it in the same commit, so the diff reads as a move (`git diff --color-moved` shows it). Renames and edits follow in the next commit.
4. **Bridge many consumers.** When many files import the old location, leave a temporary re-export there and move consumers in later steps; remove the bridge in the last one. With few consumers, update them in the same commit.
5. **Large moves: work back from the goal.** Try the target change, note what breaks, revert, and fix the leaves first (the Mikado method). Repeat until the target change is small.
6. **One group per commit**, checks green after each.
7. **Behavior separately.** A defect found during the move is its own change, never folded into the move.
8. **Recheck the containers.** Run the container check on the old and the new homes, and remove a home the move left empty.

## Porting and copying code

Port responsibilities, not files. Before carrying code across a boundary:

- Whose knowledge is this? If the destination already owns it, use that owner instead of importing a second one.
- Does the copy create a second authority for the same state or rule?
- Which assumptions of the old home (one instance, one session, one transport) does the code carry silently?
- What in it is policy worth keeping, and what is mechanism tied to the old surroundings?
