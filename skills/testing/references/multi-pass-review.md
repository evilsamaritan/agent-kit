# Multi-Pass Review Methodology

Strategies for using multiple review passes to improve code quality. Addresses LLM non-determinism as a feature, not a bug.

---

## Why Multi-Pass Works

LLM outputs are inherently non-deterministic. Research (arxiv 2502.20747) shows that even at temperature 0, Claude's consistency across identical review runs is 0.85-0.93 (Pearson correlation). Each pass genuinely surfaces different findings.

**Implication:** A single review pass catches ~70-85% of issues. A second focused pass with different instructions catches issues the first pass missed — not because the first pass was wrong, but because the model's attention distributes differently each time.

**Key constraint:** Claude Code does not expose temperature control. There is no `--temperature` flag, no environment variable, no settings key. The Anthropic API supports temperature, but Claude Code sets it internally. Even if temperature were 0, outputs would not be fully deterministic (GPU floating-point variance, batching differences).

**Design response:** Instead of fighting non-determinism, structure it. Give each pass a single focus dimension so the variance works within a constrained domain.

---

## Strategy A: Dimension-Isolated Passes (recommended)

Assign each pass a single review dimension. This constrains the model's attention and makes non-determinism productive within each dimension.

### Standard Dimensions

| Pass | Dimension | Weight | Focus |
|------|-----------|--------|-------|
| 1 | **Security** | 25% | OWASP Top 10, injection, auth, secrets, input validation |
| 2 | **Correctness** | 25% | Logic errors, edge cases, error handling, null safety |
| 3 | **Maintainability** | 20% | DRY, naming, cohesion, coupling, readability |
| 4 | **Performance** | 20% | Complexity, allocations, N+1, caching opportunities |
| 5 | **Style** | 10% | Conventions, formatting, consistency with codebase |

### How to Apply

**Single-agent approach (sequential):**
1. Run first pass with security-focused prompt
2. Collect findings into a file (`review-findings.md`)
3. Run second pass with correctness-focused prompt + "already found: {findings}"
4. Append new findings
5. Continue for each dimension

**Multi-agent approach (team orchestration):**
```
security agent → correctness agent → maintainability agent → synthesis
```
Each agent receives previous findings and must find NEW issues only. Final synthesis agent deduplicates and prioritizes.

### Finding Accumulation

Between passes, maintain a persistent findings file:

```markdown
## Found Issues (do not repeat — find NEW issues only)
- [SEC-1] SQL injection in user_controller.ts:45
- [SEC-2] Missing rate limiting on /api/auth/login
- [COR-1] Off-by-one in pagination logic at paginator.ts:23
```

Include this in each subsequent pass prompt. This converts non-determinism from a liability (inconsistent results) into an asset (broader coverage).

---

## Strategy B: Builder-Validator Separation (De-Sloppify Pattern)

Separate implementation and review into distinct phases with different agents or prompts.

### The Problem

Asking an LLM to "write clean code" during implementation is ineffective. The model optimizes for functionality first. Negative instructions ("don't write verbose code", "avoid over-engineering") are poorly followed because:
1. The model's primary objective (make it work) dominates
2. Negative instructions are harder for models to follow than positive ones
3. Implementation context crowds out quality concerns

### The Solution: Two-Phase Approach

**Phase 1 — Implementation (Builder):**
- Focus: make it work correctly
- Prompt: describe the feature, constraints, and expected behavior
- No quality instructions — let the builder focus on functionality

**Phase 2 — Cleanup (Validator):**
- Focus: quality, clarity, simplicity
- Prompt: review the implementation for specific quality dimensions
- Different agent or fresh context — avoids confirmation bias (the builder cannot objectively review its own work)

### Why It Works

1. **Eliminates author bias:** A separate reviewer doesn't have the mental model that led to the implementation choices, so it can see issues the author is blind to
2. **Different attention distribution:** Fresh context means the model's attention is on the code, not on the task requirements
3. **Positive framing:** Instead of "don't be verbose", the validator is told "find verbosity and simplify" — a positive action is easier to follow

### Implementation in Claude Code

**Single session (manual):**
1. Implement the feature
2. Run `/compact` to clear implementation context
3. New prompt: "Review these files for [dimension]. Fix issues you find."

**Team orchestration:**
```
Builder (frontend/backend agent) → Validator (testing agent, read-only) → Builder (fixes)
```
The Validator has Read/Grep/Glob only — it cannot fix issues, only report them. This forces thorough issue description rather than silent fixes.

**Autonomous loop:**
```
implement → test → review (dimension 1) → fix → review (dimension 2) → fix → done
```

---

## Strategy C: Structured Checklists

Generate an explicit checklist before reviewing. Score each item with an isolated prompt.

### When to Use

- When consistency across reviews matters more than breadth
- For compliance or audit contexts where findings must be reproducible
- When multiple team members need comparable review results

### Checklist Generation

Before reviewing, generate a checklist specific to the change:

```
Given the diff, generate a review checklist with 10-15 items covering:
- Security risks specific to this change type
- Logic correctness risks based on the domain
- Performance implications of the specific patterns used
- Maintainability concerns for the specific abstractions introduced
```

### Isolated Scoring

Grade each checklist item with a separate, focused prompt:

```
Review ONLY this aspect of the code:
Checklist item: "Input validation on the new /api/transfer endpoint"
Files to check: [specific files]
Grade: PASS / CONCERN (with explanation) / FAIL (with fix)
```

This prevents the lost-in-middle effect where the model forgets criteria during a large review.

---

## Strategy D: Multi-Model Consensus

Use different models for different passes. Flag issues only when 2+ models agree.

### When to Use

- High-stakes reviews (security, financial, compliance)
- When false positive cost is high
- When budget allows 2-3x review cost

### Implementation

```
Model A (Opus) → security review → findings A
Model B (Sonnet) → security review → findings B
Synthesis → intersection(A, B) = confirmed findings
            A - B = investigate further
            B - A = investigate further
```

**Cost consideration:** This 2-3x the review cost. Use only for CRITICAL code paths.

---

## Choosing a Strategy

```
What's the review goal?
├── Broad coverage of a large change → Strategy A (dimension-isolated)
├── Quality cleanup after implementation → Strategy B (builder-validator)
├── Reproducible/auditable review → Strategy C (structured checklists)
├── High-stakes, must minimize false negatives → Strategy D (multi-model)
└── Quick one-off review → Single pass is fine
```

### Combining Strategies

Strategies compose well:

- **A + B:** Build feature → cleanup pass → then dimension-isolated review
- **A + C:** Generate checklist per dimension → isolated scoring per item
- **B + D:** Builder → Validator (Model A) + Validator (Model B) → consensus fixes

---

## Practical Tips

1. **Don't repeat the same prompt twice** — non-determinism means you'll get somewhat different results, but the overlap is high (85-93%). Change the focus to maximize unique findings.

2. **Accumulate findings across passes** — always tell the next pass what was already found. Otherwise it wastes tokens re-discovering known issues.

3. **2-3 passes is the sweet spot** — diminishing returns after 3 passes. Each subsequent pass finds fewer new issues.

4. **Use different agents for different passes** — this naturally gives different system prompts, different preloaded knowledge, and different attention patterns.

5. **Compact between passes** — run `/compact` between passes in a single session to reduce context pollution from previous findings.

6. **Measure by mutation score, not line coverage** — if you're unsure whether multi-pass review helped, run mutation testing before and after. Coverage numbers won't change, but mutation kill rate will.
