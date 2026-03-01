# Flow 2: Verify Skill

## Step 0: Check Internal Flag

Parse the target skill's frontmatter. If `internal: true` is NOT set:

1. Tell the user: "Skill `<name>` is not internal — skipping. Use explicit request to verify anyway."
2. **Stop** — do not proceed unless the user explicitly confirms they want to verify a non-internal skill.

## Step 1: Identify Target Skill

Determine which skill to verify:

- **User specified a name** → use it
- **User said "this skill" in a skill directory** → detect from cwd
- **Ambiguous** → List available skills, use `AskUserQuestion`:
  ```bash
  ls skills/
  ```

## Step 2: Load Verification Checklist

Read `references/verification-checklist.md` from skill base directory.

## Step 3: Read and Parse Skill

**IMPORTANT**: Always read from `skills/<name>/` — this is the source of truth. Never read from `.claude/skills/` (that's a symlink install target).

Collect all data needed for checks:

1. **Read SKILL.md** — `skills/<name>/SKILL.md` (full content)
2. **Parse frontmatter** — extract name, description, allowed-tools, internal, etc.
3. **Count lines** — SKILL.md line count (excluding frontmatter)
4. **List workflows/** — glob for files in `skills/<name>/workflows/`
5. **List references/** — glob for files in `skills/<name>/references/`
6. **Check access** — verify `.claude/skills/<name>/SKILL.md` is readable via symlink

## Step 4: Run All Checks

Execute all 43 checks from Categories A-E:

**Category A: Frontmatter (11 checks)**
- Parse frontmatter YAML
- Validate name format, description quality, field validity
- Check description starts with verb, includes trigger phrases
- Check internal field handling

**Category B: Structure (12 checks)**
- Verify SKILL.md exists and is under 500 lines
- Check files are properly organized (workflows/ for procedures, references/ for docs)
- Verify progressive disclosure — SKILL.md is entry point, details in sub-files
- Verify instruction tone matches content type
- Verify content placement (procedures in workflows/, knowledge in references/)

**Category C: Content Quality (12 checks)**
- Scan for filler phrases
- Check code examples use real patterns
- Verify workflow steps are numbered
- Check decision points are explicit
- Verify error handling for skills with `## Commands` section

**Category D: Anti-Patterns (7 checks)**
- Scan for TODO/FIXME markers
- Check for time-sensitive content
- Detect duplicate content between SKILL.md and sub-files
- Flag thin wrappers

**Category E: Deployment (1 check)**
- Verify skill is accessible via `.claude/skills/` symlink

## Step 5: Generate Report

**Format is mandatory — follow exactly. Results MUST be a single table, NEVER a list.**

```markdown
## Skill Verification Report: <skill-name>

**Lines:** <N> (SKILL.md) + <M> (workflows) + <K> (references)
**Internal:** <yes | no>
**Workflows:** <N files listed>
**References:** <N files listed>

### Results

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| A1 | CRITICAL | PASS   | name field exists |
| A2 | CRITICAL | FAIL   | name doesn't match directory |
| ... all 43 checks in one table ... |

### Summary

- CRITICAL: X pass, Y fail
- WARNING: X pass, Y fail
- SUGGESTION: X pass, Y fail

### Recommended Fixes

1. [A2] Fix description...
2. [C1] Remove filler phrase on line N...
```

**Rules:**
- ALL checks go into the Results table — one row per check, no grouping by category
- Order: A1-A11, B1-B12, C1-C12, D1-D7, E1
- PASS checks: short description (3-8 words)
- FAIL checks: describe what's wrong
- N/A checks (e.g. C5 for skills without `## Commands`): mark as PASS with "N/A" in description

## Step 6: Apply Fixes

**IMPORTANT**: All edits must be applied to `skills/<skill-name>/`, NOT `.claude/skills/` (symlink target).

**MUST use `AskUserQuestion` tool before applying ANY fixes. Do NOT ask in plain text — call the tool.**

If all 43 checks pass (zero failures) → skip this step, go to Step 7.

If there are ANY failures, call `AskUserQuestion` with these exact options:

| Option | Label | Description |
|--------|-------|-------------|
| 1 | Apply all fixes | Fix everything: CRITICAL + WARNING + SUGGESTION |
| 2 | Critical & Warning only | Fix CRITICAL and WARNING failures, skip suggestions |
| 3 | Let me choose | Review each fix individually and decide one by one |
| 4 | Skip fixes | Just the report, don't modify any files |

Then based on the user's choice:

- **"Apply all fixes"** → apply all recommended fixes
- **"Critical & Warning only"** → apply only CRITICAL and WARNING fixes, skip SUGGESTION
- **"Let me choose"** → present each fix one by one, user decides per fix
- **"Skip fixes"** → proceed to Step 7 without changes

For each fix applied:
1. Show the current content and proposed change
2. Apply the edit using `Edit` tool
3. Confirm the fix was applied

## Step 7: Re-verify and Chain

After applying fixes:
1. Re-run all checks that had failures
2. Output updated summary
3. If all CRITICAL checks pass: "Skill is healthy."
4. If CRITICAL failures remain: list them for manual resolution

After reporting, offer:
> "Want me to improve this skill based on the findings?"

If yes → chain to Flow 3 (Improve) with the verification report as context.
