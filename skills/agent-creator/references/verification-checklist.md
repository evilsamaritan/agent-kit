# Agent Verification Checklist

30 checks across 4 categories.

## Contents

- [Category A: Frontmatter](#category-a-frontmatter) — 12 checks
- [Category B: Structure](#category-b-structure) — 7 checks
- [Category C: Content Quality](#category-c-content-quality) — 6 checks
- [Category D: Anti-Patterns](#category-d-anti-patterns) — 5 checks

**Severity levels:**
- **CRITICAL** — Agent will malfunction or fail to trigger. Must fix.
- **WARNING** — Agent works but has quality issues. Should fix.
- **SUGGESTION** — Improvement opportunity.

---

## Category A: Frontmatter

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| A1 | CRITICAL | `name` field exists and is non-empty | Add `name: <agent-name>` |
| A2 | CRITICAL | `name` matches filename (without .md) | Rename either field or file |
| A3 | CRITICAL | `name` is lowercase + hyphens only | Rename to kebab-case |
| A4 | CRITICAL | `description` field exists and is non-empty | Add description with trigger phrases |
| A5 | WARNING | `description` includes trigger phrases ("When to use", "Use when", "Use this agent") | Add trigger context so Claude knows when to delegate |
| A6 | WARNING | `model` value is valid (`sonnet`, `opus`, `haiku`, `inherit`) or absent | Fix to valid value or remove |
| A7 | WARNING | `tools` is either a comma-separated string or a YAML array (both valid) | Verify format is consistent within the file |
| A8 | WARNING | `permissionMode` value is valid or absent | Fix to valid value |
| A9 | SUGGESTION | `color` is set for visual distinction | Add color field |
| A10 | WARNING | `memory` value is valid (`user`, `project`, `local`) or absent | Fix to valid scope or remove |
| A11 | WARNING | `background` value is boolean or absent | Fix to `true` or `false` |
| A12 | WARNING | `isolation` value is `worktree` or absent | Fix to `worktree` or remove |

### A: Detailed Checks

**A2: Name-filename match**
```
Parse filename (strip .md), compare with name field.
Example: file `kotlin-backend.md` → name must be `kotlin-backend`
```

**A5: Trigger phrase check**
```
Description should contain at least one of:
- "When to use"
- "Use when"
- "Use this agent"
- "Use for"
- "Example prompts"
If multiline (|): check all lines.
```

---

## Category B: Structure

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| B1 | CRITICAL | Body (after frontmatter) is non-empty | Add system prompt content |
| B2 | WARNING | Body starts with role/expertise statement ("You are a...") | Add opening role statement |
| B3 | WARNING | For standalone agents: body has structured sections (## headers) | Add sections: Responsibilities, Workflow, Rules |
| B4 | WARNING | For skill agents: `skills:` field references existing skills | Verify skill exists in `skills/` directory |
| B5 | WARNING | Body size: soft target 500 lines, ceiling ~550 (excessive length reduces adherence) | Extract to skill or condense |
| B6 | SUGGESTION | Has explicit "Done criteria" or "Success criteria" section | Add done criteria so agent knows when to stop |
| B7 | SUGGESTION | For standalone agents: has "Rules" or "Guidelines" section | Add rules section with specific DO/DON'T items |

### B: Detailed Checks

**B4: Skill reference check**
```
For each skill in skills: array:
  Check: ls skills/<skill-name>/SKILL.md
  If not found → FAIL
```

**B5: Line count check**
```
Count lines in body (after frontmatter closing ---).
Soft target: 500 lines. Ceiling: ~550 lines.
If > 550 → flag: "Consider extracting to a skill"
If 500–550 → suggestion: "Approaching ceiling — condense where possible"
```

---

## Category C: Content Quality

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| C1 | WARNING | No filler phrases ("It's important to", "Please note", "Make sure to") | Remove filler, use direct instructions |
| C2 | WARNING | Rules are specific and actionable ("Use Uuid.v7()" not "Use proper UUIDs") | Rewrite vague rules with concrete guidance |
| C3 | WARNING | System prompt matches agent type: standalone has full instructions, skill agent is thin | Align content with agent type |
| C4 | SUGGESTION | Code examples use real project patterns (not `foo/bar` placeholders) | Replace with actual project examples |
| C5 | SUGGESTION | Instructions use imperative tone ("Do X. Then Y.") | Rewrite advisory language to imperative |
| C6 | SUGGESTION | Critical rules are in first third of body | Move important rules to top |

### C: Detailed Checks

**C1: Filler phrase scan**
```
Search body for (case-insensitive):
"it's important to", "please note", "make sure to", "keep in mind",
"remember to", "you should always", "it is recommended"
```

**C3: Type consistency check**
```
If skills: field exists (skill agent):
  Body should be < 100 lines (thin wrapper)
  Should reference skill by name
  Should NOT duplicate skill content
If no skills: field (standalone):
  Body should have ## sections with detailed instructions
  Should NOT say "read SKILL.md" (no skill to read)
```

---

## Category D: Anti-Patterns

| ID | Severity | Check | Fix |
|----|----------|-------|-----|
| D1 | WARNING | No duplicate content with other agents in `agents/` | Remove duplication, reference shared rules via skills |
| D2 | WARNING | Description is not overly broad (doesn't match everything) | Narrow scope, add disambiguation |
| D3 | WARNING | No TODO/FIXME/HACK markers | Resolve or remove |
| D4 | SUGGESTION | Agent is not a thin wrapper around a single tool call | Add value: context, rules, workflow. Or delete. |
| D5 | SUGGESTION | No stale references (paths, tool names that don't exist) | Update or remove stale references |

### D: Detailed Checks

**D1: Duplication check**
```
For each other agent in agents/:
  Compare body sections (## headers).
  Flag if > 30% content overlap.
  Fix: Extract shared content to a skill, use skills: field.
```

**D2: Broad description check**
```
If description contains only generic terms without specific technologies/patterns:
  Flag: "Description too broad — may trigger incorrectly"
  Fix: Add specific technologies, file patterns, or task types.
```
