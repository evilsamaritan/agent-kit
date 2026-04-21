# Advanced Orchestration Patterns

Patterns for complex multi-agent workflows beyond basic pipeline and parallel execution.

---

## Pattern 1: Builder-Validator Loop

Split implementation and quality review into separate agents with asymmetric permissions.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   Builder                    Validator           │
│   (Write, Edit, Bash)        (Read, Grep, Glob)  │
│                                                 │
│   implements feature ──────▶ reviews code        │
│                              finds issues        │
│   fixes issues ◀────────── reports findings     │
│                                                 │
│   Loop until Validator approves                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Key design:** The Validator has READ-ONLY access. It cannot silently "fix" issues — it must describe them clearly enough for the Builder to act. This forces thorough issue descriptions and prevents confirmation bias.

### When to Use

- Feature implementation where quality matters
- Codebase areas with high complexity or risk
- When a single agent tends to overlook its own mistakes

### Team Composition

```json
{
  "teams": {
    "build-validate": {
      "agents": ["backend", "tester"],
      "flow": "pipeline",
      "description": "Builder implements, Validator reviews (read-only), loop until approved"
    }
  }
}
```

### Context Compression Between Iterations

Between Builder and Validator passes, compress to:
```
Files changed: [list with line ranges]
Key decisions: [2-3 design choices made]
Known constraints: [from original task]
```

Do NOT pass full agent output — context bloat kills review quality.

---

## Pattern 2: Dimension-Isolated Review Pipeline

Assign each review agent a single quality dimension. Findings accumulate across stages.

```
Code change
    │
    ▼
┌──────────────┐   findings.md
│ Security     │──────────────▶ [SEC-1, SEC-2]
│ (security)   │                    │
└──────────────┘                    │
    │                               ▼
    ▼                          ┌─────────┐
┌──────────────┐               │ Accumul-│
│ Correctness  │──────────────▶│ ated    │──▶ [SEC-1, SEC-2, COR-1]
│ (tester)          │               │ findings│
└──────────────┘               └─────────┘
    │                               │
    ▼                               ▼
┌──────────────┐               ┌─────────┐
│ Architecture │──────────────▶│ Final   │
│ (architect)  │               │ report  │
└──────────────┘               └─────────┘
```

**Key design:** Each agent receives accumulated findings from previous stages with the instruction "do NOT repeat these — find NEW issues in your dimension only." This makes non-determinism productive.

### When to Use

- Comprehensive code review or PR review
- When a single-pass review misses issues
- For review teams (`/team-creator review`)

### Prompt Template per Stage

```
Review ONLY the {dimension} dimension of these changes.

Files to review: {file_list}

Issues already found by previous reviewers (do NOT repeat):
{accumulated_findings}

Find NEW {dimension} issues only. For each finding:
- ID: {DIM}-{N}
- File:line
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- Description
- Suggested fix
```

→ Methodology details: `testing/references/multi-pass-review.md`

---

## Pattern 3: RFC-to-Work-Units Decomposition

For large features, decompose a high-level RFC into independent work units with dependency DAG.

```
RFC Document
    │
    ▼
┌──────────────┐
│ Architect    │──▶ Work Unit DAG
│ (decompose)  │
└──────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ Work Unit DAG:                      │
│                                     │
│   [DB schema] ──▶ [API endpoints]   │
│                        │            │
│   [UI components] ─────┤            │
│                        ▼            │
│                   [Integration]     │
│                        │            │
│                        ▼            │
│                   [Tests + Review]  │
└─────────────────────────────────────┘
```

### Steps

1. **Architect decomposes** RFC into work units:
   - Each unit has clear inputs, outputs, and file scope
   - Dependencies between units form a DAG (no cycles)
   - Units are small enough for a single agent (1-3 files)

2. **Independent units run in parallel** (with worktree isolation):
   ```
   [DB schema] — runs in worktree-1
   [UI components] — runs in worktree-2
   ```

3. **Dependent units wait** for prerequisites:
   ```
   [API endpoints] — waits for [DB schema] to complete
   ```

4. **Integration unit** merges all work and resolves conflicts

5. **Review unit** runs dimension-isolated review on the merged result

### Work Unit Specification

Each work unit should specify:
```markdown
## Work Unit: {name}
- **Depends on:** [list of prerequisite units]
- **Files:** [scoped list of files this unit creates/modifies]
- **Agent:** [which agent handles this]
- **Acceptance criteria:** [how to verify this unit is done]
- **Estimated complexity:** simple | moderate | complex
```

### When to Use

- Features spanning 5+ files across multiple domains
- Work that naturally decomposes into independent sub-tasks
- When worktree isolation is available (`claude --worktree`)

---

## Pattern 4: Complexity-Tiered Quality Pipeline

Apply different levels of review based on change complexity.

```
Classify change complexity
    │
    ├── Simple (1-2 files, single concern)
    │   └── Single-pass review by one agent
    │
    ├── Moderate (3-5 files, 2+ concerns)
    │   └── Builder-Validator loop (Pattern 1)
    │
    └── Complex (5+ files, cross-domain)
        └── Full pipeline: architect → implement → dimension review → fix
```

### Complexity Signals

| Signal | Simple | Moderate | Complex |
|--------|--------|----------|---------|
| Files changed | 1-2 | 3-5 | 5+ |
| Domains touched | 1 | 2 | 3+ |
| New abstractions | 0 | 0-1 | 2+ |
| External API changes | No | Maybe | Yes |
| Database changes | No | Minor | Schema changes |
| Security implications | No | Low | Auth/data/secrets |

### When to Use

- When you want to balance review thoroughness with cost/time
- As a default policy for team orchestration
- To avoid over-reviewing simple changes

---

## Pattern 5: Worktree Isolation for Parallel Work

Use git worktrees to give each parallel agent its own copy of the repository.

```
main branch
    │
    ├──▶ worktree-1: agent-1 works on feature-A
    │    (independent branch, no conflicts)
    │
    ├──▶ worktree-2: agent-2 works on feature-B
    │    (independent branch, no conflicts)
    │
    └──▶ worktree-3: agent-3 works on feature-C
         (independent branch, no conflicts)

Integration: merge all branches back
```

### Prerequisites

- Git worktree support (`git worktree add`)
- Claude Code worktree flag (`claude --worktree task-name`)
- OR Agent tool `isolation: "worktree"` parameter

### When to Use

- Multiple agents modifying overlapping files
- Parallel implementation of independent features
- When git merge conflicts are likely without isolation

### Limitations

- Each worktree is a full repo copy (disk space)
- Merge conflicts still possible at integration time
- Agent in worktree cannot see changes from other worktrees

---

## Choosing a Pattern

```
Task type?
├── Implement + review → Pattern 1 (Builder-Validator)
├── Code review / PR review → Pattern 2 (Dimension-Isolated)
├── Large feature (5+ files) → Pattern 3 (RFC Decomposition)
├── Variable-size tasks → Pattern 4 (Complexity-Tiered)
├── Parallel with conflict risk → Pattern 5 (Worktree Isolation)
└── Simple task → No pattern needed — single agent
```

### Combining Patterns

Patterns compose naturally:

- **3 + 1:** Decompose RFC into units → each unit uses Builder-Validator
- **3 + 5:** Decompose RFC into units → independent units in worktrees
- **4 + 2:** Classify complexity → complex changes get dimension-isolated review
- **1 + 2:** Build with Builder-Validator → then dimension-isolated review of result

---

## Cost Considerations

| Pattern | Token Multiplier | When Justified |
|---------|-----------------|----------------|
| Single agent | 1x | Simple tasks, low risk |
| Builder-Validator (1 loop) | 2-3x | Quality-critical features |
| Dimension-Isolated (3 passes) | 3-4x | Comprehensive review |
| RFC Decomposition | 4-6x | Large features that benefit from parallelism |
| Full pipeline (decompose + build + review) | 6-10x | Complex, high-stakes features |

**Rule of thumb:** If the cost of a bug in production exceeds the review cost by 10x+, the review is worth it.
