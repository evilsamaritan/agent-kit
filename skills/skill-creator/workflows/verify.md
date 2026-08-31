# Flow 2: Verify Skill

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

Always read from `skills/<name>/` — this is the source of truth exposed by both plugin packages.

Collect all data needed for checks:

1. **Read SKILL.md** — `skills/<name>/SKILL.md` (full content)
2. **Parse frontmatter** — extract name, description, allowed-tools, etc.
3. **Count lines** — SKILL.md line count (excluding frontmatter)
4. **List workflows/** — glob for files in `skills/<name>/workflows/`
5. **List references/** — glob for files in `skills/<name>/references/`
6. **Check packaging** — verify the canonical file exists and the plugin manifests expose `skills/`

## Step 4: Run All Checks

Execute all 48 checks from Categories A-E:

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

**Category E: Deployment (1 check)**
- Verify the canonical skill is included by the Claude and Codex plugin packages

## Step 5: Generate Report

**Format is mandatory — follow exactly. Results MUST be a single table, NEVER a list.**

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

**Rules:**
- ALL checks go into the Results table — one row per check, no grouping by category
- Order: A1-A12, B1-B13, B15, C1-C14, D1-D7, E1
- PASS checks: short description (3-8 words)
- FAIL checks: describe what's wrong
- N/A checks (e.g. C5 for skills without `## Commands`): mark as PASS with "N/A" in description

## Step 6: Apply Fixes When Authorized

Apply all edits to `skills/<skill-name>/`, the shared plugin source.

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

After reporting, offer:
> "Want me to improve this skill based on the findings?"

If yes → chain to Flow 3 (Improve) with the verification report as context.
