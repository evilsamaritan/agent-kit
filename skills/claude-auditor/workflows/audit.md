# Claude Code Configuration Audit Workflow

Step-by-step procedure for auditing all aspects of a Claude Code setup.

---

## Phase 1: CLAUDE.md Quality & Structure

**Goal:** Assess project instructions for clarity, structure, and effectiveness.

### Steps

1. **Find all instruction files:**
   ```
   glob: CLAUDE.md, .claude/CLAUDE.md, **/CLAUDE.md
   ```

2. **Quality checks:**
   - [ ] Clear section structure (not a wall of text)
   - [ ] Size under 500 lines (context budget)
   - [ ] Critical rules at START and END (lost-in-middle mitigation)
   - [ ] No contradictory instructions
   - [ ] No redundancy with skill/agent definitions
   - [ ] Explicit scope boundaries ("What this does NOT do")
   - [ ] Actionable rules (not vague "be careful" statements)

3. **Context engineering checks:**
   - [ ] Acts as router to skills, not a monolith
   - [ ] No inline domain knowledge that belongs in a skill
   - [ ] Progressive disclosure respected (overview here, depth in skills)

4. **Record findings** with dimension (Quality), severity, line number, and remediation.

---

## Phase 2: Agent & Skill Correctness

**Goal:** Validate that agent and skill configurations are correct and follow conventions.

### Steps

1. **Find all definitions:**
   ```
   glob: agents/*.md, skills/*/SKILL.md
   ```

2. **For each agent, check:**
   - [ ] Required frontmatter: name, description, tools
   - [ ] `name` follows lowercase-hyphen convention
   - [ ] `description` answers WHAT + WHEN (< 1024 chars)
   - [ ] `description` includes negative triggers ("Do NOT use for...")
   - [ ] `model` appropriate for task complexity
   - [ ] `maxTurns` set (recommend 10-30)
   - [ ] `skills` preload — are all listed skills necessary?
   - [ ] `tools` — minimal set needed for the role?
   - [ ] Body has: persona, job statement, rules, done criteria

3. **For each skill, check:**
   - [ ] Required frontmatter: name, description
   - [ ] `name` matches directory name exactly
   - [ ] `description` answers WHAT + WHEN + trigger phrases
   - [ ] `description` includes "Do NOT use for..." to prevent over-triggering
   - [ ] `allowed-tools` matches what the skill actually uses
   - [ ] SKILL.md follows correct template for its type (role/knowledge/meta)
   - [ ] All referenced workflows/ and references/ files exist
   - [ ] Size under 500 lines
   - [ ] Related Knowledge section links to complementary skills
   - [ ] Anti-Patterns section present

4. **Taxonomy checks:**
   - [ ] Broad/role skills are vendor-agnostic in SKILL.md
   - [ ] Framework-specific content in separate reference files
   - [ ] Decision trees before vendor comparison tables
   - [ ] Skills comparing tools lead with decision trees

5. **Record findings** with dimension (Correctness), file, severity, and remediation.

---

## Phase 3: Cross-Reference Integrity

**Goal:** Verify that all internal links and references are valid.

### Steps

1. **Check all markdown links** in SKILL.md files:
   - [ ] `workflows/*.md` links point to existing files
   - [ ] `references/*.md` links point to existing files
   - [ ] `/skill-name` references in Related Knowledge point to existing skills
   - [ ] No orphaned files (files in workflows/ or references/ not linked from SKILL.md)

2. **Check agent-skill alignment:**
   - [ ] Skills listed in agent `skills:` field exist
   - [ ] Agent descriptions don't conflict with preloaded skill descriptions

3. **Record findings** with dimension (Correctness), severity, and remediation.

---

## Phase 4: Efficiency Review

**Goal:** Assess context budget usage and identify waste.

### Steps

1. **Measure context costs:**
   - [ ] Count total SKILL.md lines across all skills
   - [ ] Count enabled MCP servers (< 10 recommended)
   - [ ] Check CLAUDE.md size
   - [ ] Identify agents preloading unnecessary skills

2. **Find redundancy:**
   - [ ] Same information in CLAUDE.md AND a skill?
   - [ ] Same rules in multiple skills?
   - [ ] Agent descriptions repeating skill descriptions?

3. **Check reference sizing:**
   - [ ] Individual reference files > 500 lines → should split
   - [ ] Large workflow files → consider splitting into phases

4. **Record findings** with dimension (Efficiency), severity, and remediation.

---

## Phase 5: Security Scan

**Goal:** Identify injection vectors, excessive permissions, and data leaks.

### Steps

1. **Permission audit:**
   - [ ] Agents with `bypassPermissions` — justified?
   - [ ] Agents with `dontAsk` + Bash/Write — justified?
   - [ ] Review-only agents should have Read/Grep/Glob only

2. **Secrets scan:**
   - [ ] API keys, tokens, passwords in any config file
   - [ ] Credentials in MCP server configs
   - [ ] `.env` excluded in `.gitignore`?

3. **Injection vectors:**
   - [ ] Dynamic content injection (`` `!command` ``) in CLAUDE.md
   - [ ] Instructions to "ignore", "bypass", "skip verification"
   - [ ] Untrusted data interpolation in hook commands

4. **MCP security:**
   - [ ] Remote servers without authentication → CRITICAL
   - [ ] Servers with filesystem write access → HIGH
   - [ ] Unused servers still configured → remove

5. **Hook safety:**
   - [ ] Command injection via tool parameters
   - [ ] Network requests (data exfiltration path)
   - [ ] Config file modification (persistence vector)

→ Detailed threat model: `references/threat-model.md`

6. **Record findings** with dimension (Security), severity, and remediation.

---

## Phase 6: Best Practices Check

**Goal:** Verify alignment with proven patterns and conventions.

### Steps

1. **Progressive disclosure:**
   - [ ] 3 levels implemented (frontmatter → SKILL.md → references)?
   - [ ] SKILL.md acts as router, not encyclopedia?

2. **Skill quality patterns:**
   - [ ] Decision trees present for multi-option domains?
   - [ ] Context Adaptation section for cross-domain skills?
   - [ ] Anti-patterns documented?
   - [ ] Related Knowledge links to complementary skills?
   - [ ] Done criteria for role skills?

3. **Agent patterns:**
   - [ ] Builder-Validator separation where appropriate?
   - [ ] Read-only agents for review tasks?
   - [ ] Worktree isolation for file-modifying agents?

4. **Record findings** with dimension (Best Practices), severity, and remediation.

---

## Phase 7: Scoring and Report

**Goal:** Calculate per-dimension scores and overall grade. Produce structured report.

### Scoring per Dimension

For each dimension, start at 100 and deduct:
- CRITICAL: -20
- HIGH: -10
- MEDIUM: -5
- LOW: -2

Floor at 0.

### Overall Grade

Weighted average:
- Security: 30%
- Correctness: 25%
- Quality: 20%
- Efficiency: 15%
- Best Practices: 10%

### Grade Mapping

| Score | Grade |
|-------|-------|
| 90-100 | A |
| 75-89 | B |
| 60-74 | C |
| 40-59 | D |
| 0-39 | F |

### Report

Produce using the template from SKILL.md:
1. Dimension scores table
2. Critical findings (fix immediately)
3. High-priority findings (fix before production)
4. Recommendations (ordered by impact)

### Quality Check

Before finalizing:
- [ ] Every finding has: dimension, severity, location (file:line), description, remediation
- [ ] No false positives (verify each finding)
- [ ] Scores calculated correctly
- [ ] Recommendations are actionable
- [ ] Report follows template
