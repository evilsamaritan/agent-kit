# Flow Catalog

All 10 team flow types with stage specs, agent roles, and team.json examples.

---

## Development Flows

### 1. pipeline

Sequential stages with optional parallel steps. Default for most development work.

**When to use:** Any task where each stage depends on the previous stage's output. Start here unless you have a reason not to.

```
explorer → implementer → tester → reviewer
```

**Agent roles:**

| Role | Tools | Access |
|------|-------|--------|
| explorer/planner | Read, Grep, Glob | readonly |
| implementer | Read, Write, Edit, Bash | write |
| tester | Read, Write, Edit, Bash | write |
| reviewer | Read, Grep, Glob | readonly |

**team.json:**
```json
{
  "flow": "pipeline",
  "stages": [
    { "agent": "architect", "mode": "plan", "tools": "readonly" },
    { "agent": "backend", "mode": "implement" },
    { "agent": "qa", "mode": "test" },
    { "agent": "security", "mode": "review", "tools": "readonly" }
  ]
}
```

**Cost:** 1x (baseline)
**Key rules:**
- Compress context between stages — pass findings + file paths, not full output
- Reviewer stages MUST be readonly (no Write/Edit)
- First stage should always be planning/exploration

---

### 2. pipeline-parallel

Independent implementation tracks run in parallel, then merge.

**When to use:** Multi-domain features where frontend and backend (or other domains) can proceed independently after a shared plan.

```
planner → [frontend ∥ backend] → tester → reviewer
```

**Agent roles:**

| Role | Tools | Access |
|------|-------|--------|
| planner | Read, Grep, Glob | readonly |
| frontend | Read, Write, Edit, Bash | write (scoped) |
| backend | Read, Write, Edit, Bash | write (scoped) |
| tester | Read, Write, Edit, Bash | write |
| reviewer | Read, Grep, Glob | readonly |

**team.json:**
```json
{
  "flow": "pipeline-parallel",
  "stages": [
    { "agent": "architect", "mode": "plan", "tools": "readonly" },
    {
      "parallel": [
        { "agent": "frontend", "scope": "src/components/, src/pages/" },
        { "agent": "backend", "scope": "src/api/, src/services/" }
      ]
    },
    { "agent": "qa", "mode": "test" },
    { "agent": "architect", "mode": "review", "tools": "readonly" }
  ]
}
```

**Cost:** 2x (parallel stages run simultaneously but each costs tokens)
**Key rules:**
- Parallel agents MUST work on non-overlapping file scopes — or use worktree isolation
- Planner defines API contracts that parallel agents both follow
- Merge stage validates integration between parallel outputs

---

### 3. builder-validator

Iterative implement-review loop until approval or max iterations.

**When to use:** Quality-critical code where a single pass is insufficient. The validator's readonly constraint forces thorough issue descriptions.

```
implementer ↔ reviewer  (loop until approve or max_iterations)
```

**Agent roles:**

| Role | Tools | Access |
|------|-------|--------|
| implementer (builder) | Read, Write, Edit, Bash | write |
| reviewer (validator) | Read, Grep, Glob | readonly |

**team.json:**
```json
{
  "flow": "builder-validator",
  "stages": [
    { "agent": "backend", "mode": "implement" },
    { "agent": "qa", "mode": "review", "tools": "readonly" }
  ],
  "max_iterations": 3,
  "exit_on": "approve"
}
```

**Cost:** 2-3x (depends on iteration count)
**Key rules:**
- Validator MUST be readonly — it reports issues, never fixes them
- Set max_iterations (default 3) to prevent infinite loops
- Compress between iterations: changed files + key decisions + outstanding issues

---

## Review Flows

### 4. twin-review

Two independent reviewers analyze the same code, findings merged.

**When to use:** When you want high-confidence review. Intersection of findings = high confidence issues. Difference = flagged for human. Disagreement = escalate.

```
[reviewer-1 ∥ reviewer-2] → merge
```

**Variants:**
- **Same-model twins:** Two instances of same agent (different prompts)
- **Cross-model twins:** opus reviewer + sonnet reviewer (different cost/perspective)
- **Cross-role twins:** security reviewer + qa reviewer (different dimensions)

**Agent roles:**

| Role | Tools | Access |
|------|-------|--------|
| reviewer-1 | Read, Grep, Glob | readonly |
| reviewer-2 | Read, Grep, Glob | readonly |
| merger (orchestrator) | Read | readonly |

**team.json:**
```json
{
  "flow": "twin-review",
  "stages": [
    {
      "parallel": [
        { "agent": "qa", "mode": "review", "tools": "readonly", "id": "twin-a" },
        { "agent": "qa", "mode": "review", "tools": "readonly", "id": "twin-b", "model": "sonnet" }
      ]
    }
  ],
  "merge_strategy": "intersection"
}
```

**Cost:** 2x
**Key rules:**
- Reviewers MUST NOT see each other's output — independence is the point
- Merge classifies findings: both found (high confidence), one found (flag), contradictory (escalate)
- Cross-model is cheapest way to get diverse perspectives

---

### 5. swarm-review

3-4 dimension-isolated reviewers run in parallel, each covering ONE dimension only.

**When to use:** Comprehensive review of complex changes. Each reviewer stays in its lane — no duplication, full coverage.

```
[security ∥ performance ∥ maintainability ∥ testing] → synthesis
```

**Agent roles:**

| Role | Dimension | Tools | Access |
|------|-----------|-------|--------|
| security reviewer | Security only | Read, Grep, Glob | readonly |
| performance reviewer | Performance only | Read, Grep, Glob | readonly |
| maintainability reviewer | Maintainability only | Read, Grep, Glob | readonly |
| testing reviewer | Test gaps only | Read, Grep, Glob | readonly |
| synthesizer (orchestrator) | Merge all | Read | readonly |

**team.json:**
```json
{
  "flow": "swarm-review",
  "stages": [
    {
      "parallel": [
        { "agent": "security", "mode": "review", "dimension": "security", "tools": "readonly" },
        { "agent": "performance", "mode": "review", "dimension": "performance", "tools": "readonly" },
        { "agent": "architect", "mode": "review", "dimension": "maintainability", "tools": "readonly" },
        { "agent": "qa", "mode": "review", "dimension": "testing", "tools": "readonly" }
      ]
    }
  ],
  "synthesis": "priority-ranked"
}
```

**Cost:** 4x (one per dimension)
**Key rules:**
- Each reviewer prompt MUST specify "review ONLY {dimension} — ignore all other concerns"
- Use finding IDs with dimension prefix: SEC-1, PERF-1, MAINT-1, TEST-1
- Synthesizer ranks all findings by severity across dimensions

---

### 6. devils-advocate

Single reviewer does 6 priority-ordered rounds of adversarial review.

**When to use:** Deep review when you want one agent to be thorough rather than broad. Priority ordering prevents front-loading easy observations and ensures critical issues surface first.

```
reviewer: round-1 (fatal) → round-2 (errors) → round-3 (perf) → round-4 (security) → round-5 (maint) → round-6 (tests)
```

**Round order (strict):**
1. Fatal flaws / correctness bugs
2. Error handling gaps
3. Performance issues
4. Security vulnerabilities
5. Maintainability concerns
6. Testing gaps

**Agent roles:**

| Role | Tools | Access |
|------|-------|--------|
| reviewer | Read, Grep, Glob | readonly |

**team.json:**
```json
{
  "flow": "devils-advocate",
  "stages": [
    { "agent": "qa", "mode": "review", "tools": "readonly" }
  ],
  "rounds": [
    "fatal-flaws",
    "error-handling",
    "performance",
    "security",
    "maintainability",
    "testing-gaps"
  ]
}
```

**Cost:** 1.5x (single agent, multiple passes over same code)
**Key rules:**
- Round order is mandatory — higher priority issues surface before lower
- Each round prompt: "You have already found: {previous_findings}. Now focus ONLY on {current_dimension}."
- Stop early if round produces zero findings (remaining rounds unlikely to find issues)

---

## Research Flows

### 7. fan-out

One planner decomposes a task, many parallel workers execute, one aggregator merges.

**When to use:** Decomposable research or exploration tasks — investigating multiple files, modules, or approaches simultaneously.

```
planner → [worker-1 ∥ worker-2 ∥ worker-3 ∥ ...] → aggregator
```

**Agent roles:**

| Role | Tools | Access |
|------|-------|--------|
| planner | Read, Grep, Glob | readonly |
| worker (× N) | Read, Grep, Glob | readonly (research) or write (implementation) |
| aggregator | Read, Write | write (produces report/code) |

**team.json:**
```json
{
  "flow": "fan-out",
  "stages": [
    { "agent": "architect", "mode": "plan", "tools": "readonly" },
    {
      "parallel": [
        { "agent": "backend", "scope": "module-a/", "task": "analyze" },
        { "agent": "backend", "scope": "module-b/", "task": "analyze" },
        { "agent": "backend", "scope": "module-c/", "task": "analyze" }
      ]
    },
    { "agent": "architect", "mode": "synthesize" }
  ]
}
```

**Cost:** 2-4x (depends on worker count)
**Key rules:**
- Planner MUST produce clear, independent sub-tasks — workers should not need to coordinate
- Workers operate on disjoint scopes (files, modules, topics)
- Aggregator resolves contradictions and produces unified output

---

### 8. diverge-converge

Explore multiple approaches in parallel, evaluate, pick the best.

**When to use:** Architectural decisions, design alternatives, or any situation where exploring options before committing reduces risk.

```
[approach-1 ∥ approach-2 ∥ approach-3] → evaluator picks winner
```

**Agent roles:**

| Role | Tools | Access |
|------|-------|--------|
| approach explorer (× N) | Read, Grep, Glob, Bash | readonly or write (in worktree) |
| evaluator | Read, Grep, Glob | readonly |

**team.json:**
```json
{
  "flow": "diverge-converge",
  "stages": [
    {
      "parallel": [
        { "agent": "architect", "variant": "event-driven", "isolation": "worktree" },
        { "agent": "architect", "variant": "request-response", "isolation": "worktree" },
        { "agent": "architect", "variant": "cqrs", "isolation": "worktree" }
      ]
    },
    { "agent": "cto", "mode": "evaluate", "tools": "readonly" }
  ],
  "evaluation_criteria": ["complexity", "performance", "maintainability"]
}
```

**Cost:** 3-5x (one per approach + evaluator)
**Key rules:**
- Each approach agent gets the SAME brief but explores a DIFFERENT solution
- Use worktree isolation if approaches produce code — prevents conflicts
- Evaluator must use explicit criteria (not vibes) to pick winner

---

## Security Flows

### 9. purple-team

Red team finds vulnerabilities, blue team fixes, tight verification cycle.

**When to use:** Security hardening where you want both discovery and remediation in one flow. Closed-loop: find → fix → verify.

```
red-agent (find) → blue-agent (fix) → red-agent (verify fix) → report
```

**Agent roles:**

| Role | Tools | Access |
|------|-------|--------|
| red-agent (attacker) | Read, Grep, Glob, Bash | readonly (finds vulns, writes PoC) |
| blue-agent (defender) | Read, Write, Edit, Bash | write (applies fixes) |
| red-agent (verifier) | Read, Grep, Glob, Bash | readonly (re-tests) |

**team.json:**
```json
{
  "flow": "purple-team",
  "stages": [
    { "agent": "security", "mode": "red-team", "tools": "readonly",
      "prompt": "Find vulnerabilities. For each: describe attack vector, severity, PoC steps." },
    { "agent": "security", "mode": "blue-team",
      "prompt": "Fix each vulnerability found. Apply minimal, targeted patches." },
    { "agent": "security", "mode": "verify", "tools": "readonly",
      "prompt": "Re-test each original vulnerability. Confirm fix or report bypass." }
  ],
  "max_iterations": 2
}
```

**Cost:** 3x per cycle (red + blue + verify), up to 6x with 2 iterations
**Key rules:**
- Red agent is ALWAYS readonly — it describes attacks, never modifies code
- Blue agent fixes ONLY reported issues — no speculative hardening
- Verify stage re-runs the same attack vectors to confirm fixes hold

---

## Composite

### 10. custom

User defines stages manually. Full control over agent order, parallelism, and modes.

**When to use:** When no pre-defined flow fits. Combine any agents in any order with any tool access.

```
(user-defined)
```

**team.json:**
```json
{
  "flow": "custom",
  "stages": [
    { "agent": "architect", "mode": "plan", "tools": "readonly" },
    {
      "parallel": [
        { "agent": "backend", "scope": "api/" },
        { "agent": "frontend", "scope": "web/" }
      ]
    },
    { "agent": "qa", "mode": "test" },
    {
      "parallel": [
        { "agent": "security", "mode": "review", "tools": "readonly" },
        { "agent": "performance", "mode": "review", "tools": "readonly" }
      ]
    },
    { "agent": "architect", "mode": "final-review", "tools": "readonly" }
  ]
}
```

**Cost:** varies (sum of all stages)
**Key rules:**
- Validate stage dependencies — parallel stages must have independent scopes
- Every custom flow MUST end with a readonly review stage
- Document the flow's purpose in the team description field

---

## Flow Selection Quick Reference

```
What are you doing?
├── Building a feature
│   ├── Single domain → pipeline
│   ├── Multi-domain (frontend + backend) → pipeline-parallel
│   └── Quality-critical → builder-validator
├── Reviewing code
│   ├── High-confidence needed → twin-review
│   ├── Comprehensive coverage → swarm-review
│   └── Deep single-reviewer → devils-advocate
├── Researching / exploring
│   ├── Decomposable sub-tasks → fan-out
│   └── Comparing alternatives → diverge-converge
├── Security hardening → purple-team
└── None of the above → custom
```

## Cost Summary

| Flow | Cost | Agents |
|------|------|--------|
| pipeline | 1x | 3-4 sequential |
| pipeline-parallel | 2x | 3-5 with parallel middle |
| builder-validator | 2-3x | 2 in loop |
| twin-review | 2x | 2 parallel + merge |
| swarm-review | 4x | 3-4 parallel + synthesis |
| devils-advocate | 1.5x | 1 multi-round |
| fan-out | 2-4x | 1 + N workers + 1 |
| diverge-converge | 3-5x | N approaches + 1 evaluator |
| purple-team | 3-6x | red + blue + verify, up to 2 cycles |
| custom | varies | user-defined |
