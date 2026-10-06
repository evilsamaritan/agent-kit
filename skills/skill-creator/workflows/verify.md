# Flow 2: Verify Skill

## Step 1: Identify Target Skill

Determine which skill to verify:

- **User specified a name** → use it
- **User said "this skill" in a skill directory** → detect from cwd
- **Ambiguous** → list the skills in the skill directory and ask the user which one

## Step 2: Load Verification Checklist

Read `references/verification-checklist.md` from skill base directory.

## Step 3: Read and Parse Skill

Read from the skill's own directory: `skills/<name>/` in the kit, the host's project skill directory elsewhere.

Collect all data needed for checks:

1. **Read SKILL.md** (full content)
2. **Parse frontmatter** — extract name, description, allowed-tools, etc.
3. **Count lines** — SKILL.md line count (excluding frontmatter)
4. **List workflows/** and **references/**
5. **Kit only: check packaging** — the Claude, Codex, and Kimi manifests expose `skills/`

## Step 4: Select Checks for the Scope

For a new skill or an explicitly requested full audit, use all checklist categories below. For a focused improvement, check metadata, links, changed behavior, and directly affected dependencies; do not load unrelated references solely to fill a report.

**Category A: Frontmatter (12 checks)**
- Parse frontmatter YAML
- Validate name format, description quality, field validity
- Check description starts with verb, includes trigger phrases

**Category B: Structure (14 checks)**
- Verify SKILL.md exists and stays within the ~550-line ceiling
- Check files are properly organized (workflows/ for procedures, references/ for docs)
- Verify progressive disclosure — SKILL.md is entry point, details in sub-files
- Verify instruction tone matches content type
- Verify content placement (procedures in workflows/, knowledge in references/)
- Check that broad knowledge skills have a Related Knowledge section
- Check language/framework knowledge skills follow uniform structure
- Check framework-specific content is in separate reference files

**Category C: Content Quality (14 checks)**
- Scan for filler phrases
- Check code examples use real patterns
- Verify workflow steps are numbered
- Check decision points are explicit
- Verify error handling for skills with `## Commands` section
- Check SKILL.md is technology-agnostic (no vendor lock-in)
- Check tool/vendor comparisons lead with decision trees

**Category D: Anti-Patterns (7 checks)**
- Scan for TODO/FIXME markers
- Check for time-sensitive content
- Detect duplicate content between SKILL.md and sub-files
- Flag thin wrappers

**Category E: Deployment (1 check, kit only)**
- Verify the skill is exposed by the Claude, Codex, and Kimi plugin packages

## Step 5: Generate Report

Default to a compact report: the failing checks with ID, severity, and fix, plus a one-line summary. In the kit, cite the repository validator for mechanical checks instead of re-deriving them. Use the full table below only for an explicitly requested full audit.

```markdown
## Skill Verification Report: <skill-name>

**Lines:** <N> (SKILL.md) + <M> (workflows) + <K> (references)
**User-invocable:** <true | false | default true>
**Workflows:** <N files listed>
**References:** <N files listed>

### Results

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| A1 | CRITICAL | PASS   | name field exists |
| A2 | CRITICAL | FAIL   | name doesn't match directory |
| ... all 48 checks in one table ... |

### Summary

- CRITICAL: X pass, Y fail
- WARNING: X pass, Y fail
- SUGGESTION: X pass, Y fail

### Recommended Fixes

1. [A2] Fix description...
2. [C1] Remove filler phrase on line N...
```

**Full-audit rules:**
- One row per check, in order A1-A12, B1-B13, B15, C1-C14, D1-D7, E1
- PASS checks: short description (3-8 words)
- FAIL checks: describe what's wrong
- N/A checks (e.g. C5 for skills without `## Commands`): mark as PASS with "N/A" in description

## Step 6: Apply Fixes When Authorized

Apply edits in the skill's own directory.

- **Review/verify only:** report failures; do not mutate files.
- **Fix/improve/actualize:** apply safe in-scope local fixes and re-verify.
- **Material choice:** ask before changing permissions, external dependencies, public behavior, or scope.

For each applied fix, keep the diff narrow and preserve unrelated user edits.

## Step 7: Re-verify and Chain

After applying fixes:
1. Re-run all checks that had failures
2. Output updated summary
3. If all CRITICAL checks pass: "Skill is healthy."
4. If CRITICAL failures remain: list them for manual resolution

When fixes were already authorized, complete them and report the result. For a review-only request, state actionable findings without treating approval as implied.
