# Flow 3: Improve Skill

## Entry Points

This flow can be triggered two ways:

1. **Chained from Flow 2 (Verify)** — verification report identified issues, user said "fix these"
2. **Independent** — user says "this skill doesn't work well" or "improve this skill"

## Step 1: Identify Target Skill

If chained from verify: skill is already identified, skip to Step 2.

Otherwise:
- **User specified a name** → use it
- **Ambiguous** → List available skills, use `AskUserQuestion`:
  ```bash
  ls skills/
  ```

Read the full skill: SKILL.md + all files in workflows/, references/, scripts/.

## Step 2: Gather Feedback

Understand what needs improvement. Ask the user (or extract from context):

- **What works poorly?** — specific behaviors, missed triggers, wrong output
- **Concrete examples** — "When I ask X, it does Y instead of Z"
- **Desired outcome** — what should the skill do differently?

If chained from verify, the verification report serves as feedback. Summarize the key issues.

## Step 3: Analyze Current Skill

Compare the skill against:

1. **User feedback** — does the structure support the desired behavior?
2. **Best practices** — read `references/best-practices.md` and check compliance
3. **Verification checklist** — run a quick check of critical items (A1-A8, B1-B3, B12)

Identify root causes:

| Symptom | Possible Root Cause |
|---------|-------------------|
| Skill doesn't trigger | Description missing trigger keywords |
| Agent doesn't follow steps | Steps are ambiguous, missing decision points |
| Output is wrong/incomplete | Missing context, wrong examples, stale content |
| Too verbose / wastes tokens | Content not properly split into sub-files (progressive disclosure) |
| Agent improvises too much | Tone too advisory for procedural content, steps not specific enough |
| Agent is too rigid | Tone too imperative for reference material, missing adaptation guidance |

## Step 4: Propose Changes

Present a structured change proposal to the user:

```markdown
## Proposed Changes for <skill-name>

### Structure Changes
- [ ] Move X to workflows/
- [ ] Add references/patterns.md

### Content Changes
- [ ] Rewrite description: "old" → "new"
- [ ] Add missing trigger keywords: X, Y, Z
- [ ] Remove filler phrases on lines N, M
- [ ] Update code examples to use real patterns

### Instruction Tone
- [ ] Change from advisory → imperative (add more specific steps)

### New Files
- [ ] workflows/migrate.md — migration procedure
```

Use `AskUserQuestion` to confirm:
- **"Apply all changes"**
- **"Let me choose which changes to apply"**
- **"Modify the proposal first"**

## Step 5: Apply Changes

For each approved change:

1. Read the target file
2. Apply the edit using `Edit` tool (or `Write` for new files)
3. Confirm the change was applied

After all changes, verify the skill is accessible via symlink:
```bash
ls .claude/skills/<skill-name>/SKILL.md
```

## Step 6: Verify (Optional)

Offer to chain to Flow 2:
> "Changes applied. Want me to run verification to confirm everything is clean?"

If yes → chain to Flow 2 (Verify) with the improved skill.
