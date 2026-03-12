# Flow 2: Verify Agent

## Step 1: Identify Target Agent

Determine which agent to verify:

- **User specified a name** → use it
- **Ambiguous** → List available agents, use `AskUserQuestion`:
  ```bash
  ls agents/
  ```

## Step 2: Load Verification Checklist

Read `references/verification-checklist.md` from skill base directory.

## Step 3: Read and Parse Agent

Collect all data needed for checks:

1. **Read agent file** — `agents/<name>.md` (full content)
2. **Parse frontmatter** — extract all fields
3. **Count lines** — body line count (excluding frontmatter)
4. **Check skills references** — if `skills:` field exists, verify referenced skills exist

## Step 4: Run All Checks

Execute all checks from the checklist:

**Category A: Frontmatter (9 checks)**
- Parse frontmatter YAML
- Validate name format, description quality, field validity
- Check model, tools, permissionMode values

**Category B: Structure (7 checks)**
- Verify body has clear sections
- Check system prompt quality
- Verify agent type consistency (standalone vs skill)

**Category C: Content Quality (6 checks)**
- Scan for filler phrases
- Check specificity of instructions
- Verify rules are actionable

**Category D: Anti-Patterns (5 checks)**
- Duplicate content with other agents
- Overly broad description
- Missing done criteria

## Step 5: Generate Report

**Format:**

```markdown
## Agent Verification Report: <agent-name>

**Type:** <standalone | skill agent>
**Model:** <model>
**Body lines:** <N>
**Skills:** <list or none>

### Results

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| A1 | CRITICAL | PASS   | name field exists |
| ... |

### Summary

- CRITICAL: X pass, Y fail
- WARNING: X pass, Y fail
- SUGGESTION: X pass, Y fail

### Recommended Fixes

1. [ID] Fix description...
```

## Step 6: Apply Fixes

**MUST use `AskUserQuestion` before applying ANY fixes.**

If all checks pass → skip to Step 7.

If there are failures, call `AskUserQuestion` with options:

| Option | Label |
|--------|-------|
| 1 | Apply all fixes |
| 2 | Critical & Warning only |
| 3 | Let me choose |
| 4 | Skip fixes |

For each fix applied:
1. Show current content and proposed change
2. Apply the edit
3. Confirm the fix

## Step 7: Re-verify

After applying fixes:
1. Re-run failed checks
2. Output updated summary
3. If all CRITICAL pass: "Agent is healthy."
4. If CRITICAL failures remain: list them for manual resolution
