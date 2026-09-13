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
| Skill doesn't trigger | Portable description misses the key use case; Claude-only `when_to_use`/`paths` may be needed for extra routing |
| Agent doesn't follow steps | Steps are ambiguous, missing decision points |
| Output is wrong/incomplete | Missing context, wrong examples, stale content |
| Too verbose / wastes tokens | Repeated rules, routine steps, or conditional detail are loaded into every invocation |
| Agent improvises too much | Tone too advisory for procedural content, steps not specific enough |
| Agent is too rigid | Tone too imperative for reference material, missing adaptation guidance |

## Step 4: Bound Changes

Build a structured change set. Present it before editing only when a material choice remains unresolved; otherwise use it as the implementation checklist:

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

If the user asked to improve, fix, refactor, audit-and-actualize, or otherwise change the skill, the request authorizes safe in-scope local edits. Ask only when a proposed change materially expands scope, changes permissions, introduces external dependencies, or chooses among meaningfully different contracts.

## Step 5: Apply Changes

For each in-scope change:

1. Read the target file
2. Apply the edit using `Edit` tool (or `Write` for new files)
3. Confirm the change was applied

After all changes, verify the canonical skill source exists:
```bash
test -f skills/<skill-name>/SKILL.md
```

## Step 6: Verify

Always chain to Flow 2 after editing. Re-run failed checks and the repository validator before reporting completion.

---

## Sub-flow: Description Triggers

If feedback is specifically about missed or false triggers, compare the portable description against the observed requests and the descriptions of likely sibling skills. Rewrite the smallest ambiguous part, then replay the same requests when the target runtime is available. Do not add persistent routing fixtures unless an executable regression harness consumes them.
