# Skill Verification Checklist

46 checks across 5 categories. Each check has an ID, severity, rule, and fix guidance.

## Contents

- [Category A: Frontmatter](#category-a-frontmatter) — 10 checks (A1-A10)
- [Category B: Structure](#category-b-structure) — 14 checks (B1-B13, B15)
- [Category C: Content Quality](#category-c-content-quality) — 14 checks (C1-C14)
- [Category D: Anti-Patterns](#category-d-anti-patterns) — 7 checks (D1-D7)
- [Category E: Deployment](#category-e-deployment) — 1 check (E1)
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
| A4 | CRITICAL | `name` is lowercase + hyphens only, max 64 chars, no consecutive hyphens, must not start/end with hyphen | Rename to kebab-case, trim if over 64 chars, fix hyphen issues |
| A5 | WARNING | `description` starts with a verb (Create, Run, Add, Write, etc.) | Rewrite to start with action verb in imperative form |
| A6 | WARNING | `description` includes "Use when" trigger phrases | Append: ". Use when [trigger phrases]." |
| A7 | WARNING | `description` is single line (no YAML multi-line `>` or `\|`) | Collapse to single line |
| A8 | WARNING | `description` length: soft target 80-500 chars, hard cap 1024 (budget for trigger phrases + negative triggers) | Expand if under 80, trim if over 1024. Over 500 is acceptable when negative triggers add value. |
| A9 | WARNING | `description` contains no XML angle brackets (`<` or `>`) | Remove XML tags — frontmatter appears in system prompt, angle brackets are a security restriction |
| A10 | SUGGESTION | `description` includes negative triggers if skill could be confused with another | Add "Do NOT use for..." to disambiguate from similar skills |

### A: Detailed Checks

**A1-A4: Parse frontmatter**
```
Read SKILL.md → extract YAML between --- markers → validate fields
A4 name rules: lowercase a-z + hyphens, max 64 chars, no consecutive hyphens (--),
must not start or end with hyphen, must match directory name.
```

**A5: Verb check**
Match first word against: Create, Run, Add, Write, Configure, Deploy, Build, Check, Generate, Update, Delete, Fix, Install, Manage, Set, Test, Verify, Analyze, Implement, Scaffold, Execute, Monitor, Debug, Migrate, Transform, Validate, Orchestrate, Review, Design, Apply, Provide

**A6: Trigger phrase check**
Description must contain at least one of: "Use when", "use when", "Use for", "use for"

**A7: Multi-line check**
Description value must not start with `>` or `|`

**A8: Length check**
`description.length` soft target 80-500 chars, hard cap 1024. Under 80 is too vague. 80-500 is the ideal range for trigger matching. 500-1024 is acceptable when the skill has multiple sibling overlaps and needs negative triggers. Over 1024 fails — collapse description, move detail into SKILL.md.

**A9: XML bracket check**
Search description for `<` or `>` characters. Angle brackets in frontmatter may be interpreted as XML tags in the system prompt.

**A10: Negative trigger check**
If a sibling skill has overlapping domain, check for "Do NOT use for" in description. Only flag when overlap is plausible.

---

## Category B: Structure

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| B1 | CRITICAL | `SKILL.md` exists in skill directory | Create SKILL.md — skill is non-functional without it |
| B2 | WARNING | `SKILL.md` size: soft target 500 lines, ceiling ~550. Over 550 indicates extraction needed. | Extract sections to workflows/ or references/ files |
| B3 | WARNING | Supporting files are in correct directories: procedures in `workflows/`, docs in `references/`, code in `scripts/`, output files in `assets/` | Move files to appropriate directories |
| B4 | WARNING | No unreferenced files (each sub-file is linked from SKILL.md) | Add links or remove unused files |
| B5 | SUGGESTION | Has `## Purpose` section only if it expands on `description`. Always optional. Omit if it would repeat frontmatter. Intro text after `# Heading` follows the same rule. | Add Purpose only when it adds scope, constraints, or context not in description. Remove if it duplicates. Same for intro text. |
| B6 | SUGGESTION | Has `## Validation` section for skills that produce artifacts (files, configs, code). Optional for router/dispatcher meta-skills that delegate. | Add validation steps only when the skill itself writes or modifies something the agent can verify. |
| B7 | WARNING | Procedures > 60 lines are extracted to `workflows/`, knowledge > 60 lines to `references/` | Extract long sections to sub-files following progressive disclosure |
| B8 | WARNING | Content placement is correct: procedures in workflows/, knowledge in references/ (not swapped) | Move procedure files from references/ to workflows/ and vice versa |
| B9 | WARNING | If references/ contains files with step-by-step procedures, they should be in workflows/ instead | Move procedure files from references/ to workflows/ |
| B10 | WARNING | Instruction tone matches content type: procedures use imperative tone, reference material uses advisory tone | Rewrite: procedures → "Do X. Then Y." Reference → "When X, consider Y." |
| B11 | SUGGESTION | Reference files over 100 lines have a table of contents at the top | Add TOC so the agent can see the full scope when previewing |
| B12 | WARNING | SKILL.md follows progressive disclosure: entry point with overview and routing, not full content. Multi-procedure skills (2+ independent procedures) keep SKILL.md concise. | Extract detailed content to sub-files, keep SKILL.md as concise entry point |
| B13 | WARNING | Broad knowledge skills list related knowledge in a "Related Knowledge" section | Add `## Related Knowledge` section with bullet list of knowledge skills that complement this role |
| B15 | WARNING | Framework-specific content lives in separate reference files with explicit framework names, not inline in SKILL.md | Extract framework content to `references/<framework-name>.md` and link from SKILL.md |

> **B14 removed** in v2.1.0. The universal B2 line budget (soft 500, ceiling ~550) applies to language/framework skills too. Use B7 / B15 to enforce extraction when needed.

### B: Detailed Checks

**B2: Line count**
```
Count lines in SKILL.md (excluding frontmatter).
Soft target: ≤ 500. Ceiling: ≤ 550. Flag if > 550.
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

**B7: Progressive disclosure -- extraction check**
Count lines in each `##` section of SKILL.md. Flag procedures > 60 lines ("Extract to workflows/"), knowledge > 60 lines ("Extract to references/"). For skills with 2+ independent procedures, each should be in a separate `workflows/` file with SKILL.md as router.

**B8-B9: Content placement validation**
Workflows/ must contain procedural content (numbered steps, imperative). References/ must contain knowledge (tables, decision trees, advisory). Flag misplacements. Procedure signals: numbered steps, "Step N:", checklists. Knowledge signals: tables, "when X, prefer Y", pattern catalogs.

**B10: Tone check**
Procedures must use imperative tone ("Do X. Then Y. Verify Z."). Reference material must use advisory tone ("When X, consider Y."). Flag mismatches: advisory language in procedures, rigid step-by-step in references, missing step numbering.

**B11: Reference file TOC check**
Reference files over 100 lines must have a table of contents (list of `##` section anchors) in the first 10 lines.

**B12: Progressive disclosure check**
SKILL.md must be an entry point, not full content. Flag inline procedures/references > 60 lines. Multi-procedure skills (2+ procedures): keep SKILL.md concise with routing table. Flag > 50% content overlap between SKILL.md and sub-files.

**B13: Related Knowledge section check**
Broad / cross-cutting knowledge skills should have a "## Related Knowledge" section listing siblings users may also want.

**B15: Framework refs as extensions check**
Framework-specific content > 10 lines in SKILL.md must be extracted to `references/<framework-name>.md`. SKILL.md covers core technology only.

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
| C13 | WARNING | SKILL.md teaches patterns, not products. One or two de-facto standards named as examples is allowed; vendor enumeration (3+ competitors listed in decision trees, comparison tables, or "popular X" lists) belongs in references/. Decision trees must be structured primarily by **pattern or constraint**, not by product. | Move vendor enumeration and product-first decision trees to `references/<topic>-providers.md`. Keep SKILL.md structured by pattern/use-case. |
| C14 | WARNING | Skills comparing tools or vendors lead with a decision tree, not a feature comparison table | Replace feature comparison tables with a decision tree (If X → use Y. If Z → use W.) at the top of the comparison section |

### C: Detailed Checks

**C1: Filler phrase scan**
Search (case-insensitive) for: "it's important to", "please note that", "make sure to", "keep in mind", "remember to", "you should always", "it is recommended", "it's worth noting", "as mentioned", "note that", "be sure to".

**C3: Procedure format**
Sections titled "Workflow", "Steps", or "Procedure" must use numbered steps (`1.`, `2.`), not bullets.

**C5: Error handling check**
If SKILL.md has `## Commands` or `## Run` section, it must have an error handling table (`| Error | Cause | Solution |`). N/A if no Commands section.

**C10: Decision point interaction check**
Scan procedures for decision points ("If A/B", "Choose between", "Depends on"). Non-trivial decisions must have AskUserQuestion guidance.

**C11: Code naming pattern notation**
Search for `<Placeholder>` or `{Placeholder}` in naming conventions. Flag: use rule + examples format instead. Deduplicate naming conventions into `## Naming` section.

**C12: Critical instruction placement**
Search for "NEVER", "MUST", "CRITICAL", "ALWAYS", "DO NOT". Each must appear in the first 1/3 of SKILL.md. Buried instructions get ignored (U-shaped attention).

**C13: Technology agnosticity check (A+B criteria)**

**Criterion A (count):** In SKILL.md, naming a single de-facto standard as an example is allowed (Redis for in-memory cache, Kafka for streaming, S3 for object storage). Enumerating 3+ competing vendors inline (e.g., "Elasticsearch, OpenSearch, Meilisearch, Typesense, Algolia") is vendor lock-in — move to `references/`.

**Criterion B (structure):** Decision trees in SKILL.md must branch primarily on **patterns / use-cases / constraints**, not on products. "If you need full-text search on a relational DB → pgvector / tsvector path" is fine. "Provider Selection: choose between AWS S3, GCS, Azure Blob, Cloudflare R2, Backblaze B2..." as the first axis is not — invert to pattern-first, list providers in `references/`.

Flag when either criterion is violated. Allowed patterns:
- Redirect ("For Redis data structures, see `references/redis-patterns.md`") — OK.
- Single standard as example ("e.g., Kafka") — OK.
- Comparison table of 3+ products in SKILL.md — move to references/.
- Decision tree with product names as the first branching axis — restructure by pattern.

**C14: Decision tree presence check**
If SKILL.md compares tools/vendors, a decision tree must precede or replace feature comparison tables. Format: "If X, use Y. If Z, use W." Tables can follow as supplementary detail.

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

**D1: Marker scan** -- search for: TODO, FIXME, HACK, XXX, TEMP, WIP

**D2: Stale content scan**
```
Search for: year patterns (202\d), "latest version", "currently", "as of", specific calendar dates.
Evaluate whether the content will go stale. Volatile data (dates, fines, enforcement trends) belongs in references/, not core SKILL.md.
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

**Report format**: see Step 5 in [verify.md](../workflows/verify.md). Single source of truth — do not duplicate here.
