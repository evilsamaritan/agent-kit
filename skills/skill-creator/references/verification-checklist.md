# Skill Verification Checklist

50 checks across 6 categories. Categories A-E are automated (43 checks). Category F requires manual testing with Claude (7 checks).

Each check has an ID, severity, rule, and fix guidance.

## Contents

- [Category A: Frontmatter](#category-a-frontmatter) — 11 checks (A1-A11)
- [Category B: Structure](#category-b-structure) — 12 checks (B1-B12)
- [Category C: Content Quality](#category-c-content-quality) — 12 checks (C1-C12)
- [Category D: Anti-Patterns](#category-d-anti-patterns) — 7 checks (D1-D7)
- [Category E: Deployment](#category-e-deployment) — 1 check (E1)
- [Category F: Triggering & Context](#category-f-triggering--context) — 7 checks (F1-F7), manual
- [Verification Report Format](#verification-report-format)

**Severity levels:**
- **CRITICAL** — Skill will malfunction or fail to trigger. Must fix.
- **WARNING** — Skill works but has quality issues. Should fix.
- **SUGGESTION** — Improvement opportunity. Nice to fix.

---

## Category A: Frontmatter

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| A1 | CRITICAL | `name` field exists and is non-empty | Add `name: <skill-name>` to frontmatter |
| A2 | CRITICAL | `name` matches directory name exactly | Rename either `name` field or directory to match |
| A3 | CRITICAL | `description` field exists and is non-empty | Add `description:` with trigger phrases |
| A4 | CRITICAL | `name` is lowercase + hyphens only, max 64 chars | Rename to kebab-case, trim if over 64 chars |
| A5 | WARNING | `description` starts with a verb (Create, Run, Add, Write, etc.) | Rewrite to start with action verb in imperative form |
| A6 | WARNING | `description` includes "Use when" trigger phrases | Append: ". Use when [trigger phrases]." |
| A7 | WARNING | `description` is single line (no YAML multi-line `>` or `\|`) | Collapse to single line |
| A8 | WARNING | `description` is 80-300 chars (sweet spot for trigger matching) | Expand if too short, trim if too long |
| A9 | WARNING | `description` contains no XML angle brackets (`<` or `>`) | Remove XML tags — frontmatter appears in system prompt, angle brackets are a security restriction |
| A10 | SUGGESTION | `description` includes negative triggers if skill could be confused with another | Add "Do NOT use for..." to disambiguate from similar skills |
| A11 | SUGGESTION | If `internal: true` is absent, verify/improve flows skip this skill unless explicitly forced | No fix needed — informational flag for non-internal skills |

### A: Detailed Checks

**A1-A4: Parse frontmatter**
```
Read SKILL.md → extract YAML between --- markers → validate fields
```

**A5: Verb check**
Match first word against: Create, Run, Add, Write, Configure, Deploy, Build, Check, Generate, Update, Delete, Fix, Install, Manage, Set, Test, Verify, Analyze, Implement, Scaffold, Execute, Monitor, Debug, Migrate, Transform, Validate, Orchestrate, Review

**A6: Trigger phrase check**
Description must contain at least one of: "Use when", "use when", "Use for", "use for"

**A7: Multi-line check**
Description value must not start with `>` or `|`

**A8: Length check**
`description.length` should be 80-300 chars. Under 80 is likely too vague. Over 300 is wasting space.

**A9: XML bracket check**
```
Search description value for < or > characters.
Frontmatter is injected into Claude's system prompt — angle brackets could be
interpreted as XML tags, which is a security restriction per Anthropic guidelines.
```

**A10: Negative trigger check**
```
If skills/ contains another skill with overlapping domain (similar name or description):
  Check if description includes "Do NOT use for" or "Not for" to disambiguate.
  Example: "Advanced data analysis for CSV files. Do NOT use for simple data exploration
  (use data-viz skill instead)."
Only flag if there is a plausible sibling skill with overlap.
```

**A11: Internal flag check**
```
Parse frontmatter for `internal: true`.
If present:
  - PASS (skill is internal, included in verify/improve by default)
If absent:
  - Verify/improve flows should skip this skill unless user explicitly forces.
  - Mark as PASS with note: "Non-internal skill — skipped by default"
```

---

## Category B: Structure

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| B1 | CRITICAL | `SKILL.md` exists in skill directory | Create SKILL.md — skill is non-functional without it |
| B2 | WARNING | `SKILL.md` is under 500 lines | Extract sections to workflows/ or references/ files |
| B3 | WARNING | Supporting files are in correct directories: procedures in `workflows/`, docs in `references/`, code in `scripts/`, output files in `assets/` | Move files to appropriate directories |
| B4 | WARNING | No unreferenced files (each sub-file is linked from SKILL.md) | Add links or remove unused files |
| B5 | SUGGESTION | Has `## Purpose` section only if it expands on `description`. Omit if it would repeat frontmatter. Intro text after `# Heading` follows the same rule. | Add Purpose only when it adds scope, constraints, or context not in description. Remove if it duplicates. Same for intro text. |
| B6 | SUGGESTION | Has `## Validation` section for skills with procedures | Add validation steps |
| B7 | WARNING | Procedures > 60 lines are extracted to `workflows/`, knowledge > 60 lines to `references/` | Extract long sections to sub-files following progressive disclosure |
| B8 | WARNING | Content placement is correct: procedures in workflows/, knowledge in references/ (not swapped) | Move procedure files from references/ to workflows/ and vice versa |
| B9 | WARNING | If references/ contains files with step-by-step procedures, they should be in workflows/ instead | Move procedure files from references/ to workflows/ |
| B10 | WARNING | Instruction tone matches content type: procedures use imperative tone, reference material uses advisory tone | Rewrite: procedures → "Do X. Then Y." Reference → "When X, consider Y." |
| B11 | SUGGESTION | Reference files over 100 lines have a table of contents at the top | Add TOC so the agent can see the full scope when previewing |
| B12 | WARNING | SKILL.md follows progressive disclosure: entry point with overview and routing, not full content. Router skills (2+ independent procedures) keep SKILL.md under 200 lines. | Extract detailed content to sub-files, keep SKILL.md as concise entry point |

### B: Detailed Checks

**B2: Line count**
```
Count lines in SKILL.md (excluding frontmatter). If > 500, flag.
Identify longest sections as extraction candidates.
```

**B3: File placement**
```
Glob for all files in skill directory (excluding SKILL.md).
Check each file is in the correct subdirectory:
  - *.md with step-by-step procedures → workflows/
  - *.md with docs/knowledge → references/
  - *.sh, *.py, *.js → scripts/
  - Templates, images → assets/
Any file NOT in a subdirectory is misplaced.
```

**B4: Orphan check**
```
For each file in workflows/, references/, scripts/:
  Search SKILL.md for filename reference (link or Read instruction).
  If not found → orphaned file.
```

**B7: Progressive disclosure — extraction check**
```
Scan SKILL.md for long sections:
  - Count lines in each ## section
  - If a procedure section > 60 lines → flag: "Extract to workflows/"
  - If a knowledge/reference section > 60 lines → flag: "Extract to references/"

For skills with 2+ independent procedures (different user intents):
  - Check that each procedure is in a separate workflows/ file
  - Check that SKILL.md has a routing table linking to them
  - If procedures are inline in SKILL.md → flag: "Extract to workflows/, use SKILL.md as router"
```

**B8: Content placement validation**
```
For each file in workflows/:
  Check content is procedural (numbered steps, imperative instructions).
  If content is mostly reference material → flag: "Should be in references/"

For each file in references/:
  Check content is knowledge (tables, decision trees, advisory).
  If content has numbered step-by-step procedures → flag: "Should be in workflows/"

Signals for procedures: numbered steps, "Step N:", checklists, imperative verbs
Signals for knowledge: tables, decision trees, "when X, prefer Y", pattern catalogs
```

**B9: Procedure in references check**
```
If references/ contains files named workflow-*.md or files with step-by-step procedures:
  Flag: "Procedure files should be in workflows/, not references/"
  Fix: Move to workflows/ and update links in SKILL.md
```

**B10: Tone check**
```
Scan each section of SKILL.md and sub-files for tone:

Imperative tone markers (expected for procedures):
  numbered steps, "must", "always", "run this command", "do X", "verify Y"

Advisory tone markers (expected for reference material):
  "consider", "options", "depending on", decision trees, "prefer X", "when Y"

Flag mismatches:
  - Procedure section with advisory language ("you might want to consider...")
    → Fix: rewrite to imperative ("Run X. If error, run Y.")
  - Reference section with rigid step-by-step commands
    → Fix: rewrite as reference material with decision guidance
  - Procedure missing explicit step ordering
    → Fix: add numbered steps with clear sequencing
```

**B11: Reference file TOC check**
```
For each file in references/:
  Count lines. If > 100 lines:
    Check if first 10 lines contain a table of contents (## Contents, ## TOC,
    or a list of ## section links).
    If no TOC → flag: "Long reference file without table of contents"
    Fix: Add TOC at top listing all ## sections with anchors.
    This helps the agent see the full scope without reading the entire file.
```

**B12: Progressive disclosure check**
```
Evaluate SKILL.md as an entry point:

1. Does SKILL.md contain detailed procedures that should be in workflows/?
   - If inline procedure > 60 lines → flag
2. Does SKILL.md contain detailed reference material that should be in references/?
   - If inline reference > 60 lines → flag
3. For router skills (2+ independent procedures):
   - Is SKILL.md under 200 lines?
   - Does it have a routing table (Quick Reference) linking to workflows?
   - If not → flag: "Router skill should have concise SKILL.md with routing table"
4. Is content duplicated between SKILL.md and sub-files?
   - Compare section headers and content overlap
   - If > 50% overlap → flag: "Duplicated content between SKILL.md and sub-file"
```

---

## Category C: Content Quality

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| C1 | WARNING | No filler phrases present | Remove: "It's important to", "Please note that", "Make sure to", "Keep in mind that", "Remember to", "You should", "It is recommended" |
| C2 | WARNING | Code examples use real patterns (not placeholder `foo/bar`) | Replace with actual project paths/commands |
| C3 | WARNING | Procedure steps are numbered, not bulleted | Convert bullet procedures to numbered steps |
| C4 | WARNING | Decision points use explicit if/then or options | Add "If X → do Y. If Z → do W." structure |
| C5 | WARNING | Skills with `## Commands` section have error handling table | Add error table: Error \| Cause \| Solution |
| C11 | WARNING | Code naming patterns use rule + examples, not `<Placeholder>` or `{Placeholder}` templates | Extract naming convention to `## Naming` section with rule + `e.g.,` examples. Use concrete names in code blocks. See best-practices.md "Code Pattern Notation". |
| C12 | WARNING | Critical instructions (rules, constraints, "NEVER" items) are in the first third of SKILL.md | Move critical rules to the top — buried instructions get ignored |
| C6 | SUGGESTION | Tables used for structured data instead of paragraphs | Convert repeated key-value content to tables |
| C7 | SUGGESTION | Examples show real use cases, not abstract ones | Replace abstract examples with concrete codebase examples |
| C8 | SUGGESTION | `allowed-tools` is appropriately scoped (not just "all") | Restrict to tools actually needed |
| C9 | SUGGESTION | Sections follow logical order (Purpose → How → Validate) | Reorder sections |
| C10 | SUGGESTION | Decision points in procedures have AskUserQuestion guidance | Add AskUserQuestion guidance at decision points where user input is needed |

### C: Detailed Checks

**C1: Filler phrase scan**
Search for these patterns (case-insensitive):
```
"it's important to"
"please note that"
"make sure to"
"keep in mind"
"remember to"
"you should always"
"it is recommended"
"it's worth noting"
"as mentioned"
"note that"
"be sure to"
```

**C3: Procedure format**
If a section titled "Workflow", "Steps", or "Procedure" exists:
- Steps should be `1.`, `2.`, `3.` (numbered)
- Not `- `, `* ` (bulleted)

**C5: Error handling check**
```
If SKILL.md has a `## Commands` or `## Run` section:
  Must have `## Error Handling` or error table
  Table format: `| Error | Cause | Solution |`
If no Commands section → N/A (mark as PASS)
```

**C10: Decision point interaction check**
```
Scan procedures (in SKILL.md and workflows/) for decision points:
  - "If A → ... If B → ..."
  - "Choose between..."
  - "Depends on..."

For each decision point:
  Check if there's guidance on user interaction (AskUserQuestion, "ask the user", etc.)
  If decision is non-trivial and has no interaction guidance → flag
```

**C12: Critical instruction placement**
```
Scan SKILL.md for critical markers: "NEVER", "MUST", "CRITICAL", "IMPORTANT",
"ALWAYS", "DO NOT", "Rule:", "Constraint:"
For each found:
  Check if it appears in the first 1/3 of SKILL.md lines.
  If not → flag: "Critical instruction buried at line N"
  Fix: Move to a ## Critical Rules section near the top,
  right after Purpose or as the second section.
Rationale: Anthropic guide identifies "instructions buried" as a top cause
of agents ignoring skill rules.
```

**C11: Code naming pattern notation**
```
Search code blocks and naming sections for:
  - Angle-bracket placeholders: <[A-Z][a-zA-Z]+> (e.g., <Trigger>, <Entity>)
  - Curly-brace placeholders: {[A-Z][a-zA-Z]+} (e.g., {Trigger}, {Effect})
If found in naming convention context (function/variable/class/epic naming):
  Flag: "Use rule + examples format instead of placeholder templates"
  Fix: Extract to ## Naming section with: `fixed` + variable + `fixed` + (e.g., concrete1, concrete2)
  In code examples, replace placeholders with concrete names.
If skill has 2+ code examples sharing same naming convention:
  Flag if convention is repeated or explained inline in each example.
  Fix: Deduplicate — define once in ## Naming, use concrete names in code blocks.
```

---

## Category D: Anti-Patterns

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| D1 | WARNING | No TODO/FIXME/HACK markers in content | Resolve or remove markers |
| D2 | WARNING | No time-sensitive information (dates, versions that will go stale) | Remove or make evergreen |
| D3 | WARNING | No duplicate content between SKILL.md and sub-files | Remove duplication — keep in one place only |
| D4 | WARNING | Not just a wrapper around a single command | Add value: error handling, validation, context. Or delete the skill. |
| D7 | WARNING | No auxiliary files: README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md | Delete — all documentation goes in SKILL.md or references/. Skills are for agents, not humans. |
| D5 | SUGGESTION | No excessive markdown formatting (triple-nested lists, etc.) | Simplify to max 2 levels of nesting |
| D6 | SUGGESTION | No commented-out sections or dead content | Remove dead content |

### D: Detailed Checks

**D1: Marker scan**
```
Search for: TODO, FIXME, HACK, XXX, TEMP, WIP
```

**D2: Stale content scan**
```
Search for: year patterns (202\d), "latest version", "currently", "as of"
Evaluate whether the content will go stale.
```

**D3: Duplication check**
```
For each sub-file (workflows/, references/):
  Compare section headers with SKILL.md sections.
  Flag sections with same header or > 50% content overlap.
```

**D7: Auxiliary file check**
```
Glob skill directory for:
  README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md,
  CONTRIBUTING.md, SETUP.md, any *.txt files
If found → flag: "Auxiliary file not allowed in skill directory"
Fix: Delete the file. Move any useful content to SKILL.md or references/.
Skills are consumed by agents, not humans — no need for human-oriented docs.
```

**D4: Thin wrapper check**
```
If SKILL.md has < 30 lines of actual content (excluding frontmatter, headers, blank lines):
  AND the content is essentially "run this command":
  Flag as thin wrapper — either add value or reconsider.
```

---

## Category E: Deployment

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| E1 | CRITICAL | Skill accessible via `.claude/skills/<name>/SKILL.md` (symlink or direct) | Verify `skills/<name>/SKILL.md` exists — `.claude/skills` is a symlink to `../skills/`. If file missing, create it. |

### E: Detailed Checks

**E1: Symlink access check**
```
Check that .claude/skills/<skill-name>/SKILL.md is readable.
The repo uses symlinks: .claude/skills → ../skills/
So the actual file must exist at skills/<skill-name>/SKILL.md.
If not found → skill is not accessible. The agent cannot load it.
```

---

## Category F: Triggering & Context

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| F1 | WARNING | Skill triggers on 3+ natural phrasings of the task | Expand description with more trigger phrases |
| F2 | WARNING | Skill does NOT trigger on 3+ unrelated queries | Add negative triggers ("Do NOT use for...") or narrow description |
| F3 | WARNING | `description` under 200 chars (or justified if longer) | Trim description — long descriptions waste context budget |
| F4 | WARNING | `SKILL.md` under 5000 words | Extract content to sub-files following progressive disclosure |
| F5 | SUGGESTION | New frontmatter fields used correctly (`argument-hint`, `disable-model-invocation`, `hooks`) | See best-practices.md Frontmatter Reference for valid values |
| F6 | SUGGESTION | Dynamic context (`` `!command` ``) syntax is correct and command exists | Test command independently, verify output is useful at load time |
| F7 | SUGGESTION | `$ARGUMENTS` substitution tested with actual input | Invoke skill with arguments and verify substitution works |

### F: Detailed Checks

**F1: Triggering test**
```
Formulate 3+ natural phrasings of the task the skill handles.
Ask Claude: "When would you use [skill-name] skill?"
Claude should quote the description back and give relevant examples.
If it can't explain when to use the skill, the description needs work.
Success: 90%+ trigger rate on relevant queries.
```

**F2: False positive test**
```
Formulate 3+ unrelated queries that should NOT trigger the skill.
If the skill loads for unrelated queries → description is too broad.
Fix: add negative triggers or narrow the description scope.
```

Note: Critical instruction placement is already covered by C12 in Category C.

---

**Report format**: see Step 5 in [verify.md](../workflows/verify.md). Single source of truth — do not duplicate here.
