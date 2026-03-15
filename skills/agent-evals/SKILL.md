---
name: agent-evals
description: Design AI evaluation systems — graders, eval-driven development, regression harnesses, LLM-as-judge, trace-based agent eval, synthetic datasets. Use when evaluating LLM outputs, building eval pipelines, or monitoring AI quality. Do NOT use for RAG pipelines (use rag) or agent orchestration (use agent-engineering).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# AI Evaluation & Testing

Build evaluation systems that measure AI quality — graders, datasets, regression harnesses, and production monitoring. Eval-driven development: define what good looks like before shipping.

---

## Eval-Driven Development

Evals are end-to-end tests for probabilistic systems. Build evals first, then iterate until the system passes.

```
1. Define target capability (what the system should do)
2. Write eval cases (20-50 real failure cases is enough to start)
3. Choose graders (code, LLM-as-judge, human — see Grader Taxonomy)
4. Set pass/fail thresholds per metric
5. Iterate on prompts/retrieval/model until evals pass
6. Add eval suite to CI — block merges on regression
7. Expand eval set from production failures over time
```

Start with 20-50 cases drawn from real failures. Early changes have large effect sizes — small sample sizes suffice. Do NOT wait for a perfect suite.

---

## Evaluation Type Decision Tree

```
What stage is the system in?
├── Pre-launch (development)?
│   ├── Deterministic outputs (format, schema, exact match)?
│   │   └── Code-based graders (assert, regex, JSON schema)
│   ├── Subjective quality (tone, accuracy, completeness)?
│   │   └── LLM-as-judge with scoring rubric
│   └── RAG pipeline quality?
│       └── Retrieval metrics (faithfulness, relevance, precision, recall)
├── Pre-deploy (CI/CD)?
│   └── Regression harness — compare against baseline, block on drop
├── Post-launch (production)?
│   ├── Have sufficient traffic?
│   │   └── A/B testing with engagement metrics
│   ├── Need continuous quality signal?
│   │   └── Online eval — sample and score production traffic
│   └── Need user signal?
│       └── Feedback collection (thumbs up/down, corrections)
└── Evaluating agent behavior (multi-step, tool use)?
    └── Trace-based eval — score trajectory, not just final output
```

---

## Grader Taxonomy

Three grader types. Use the cheapest one that captures the quality signal.

| Grader Type | When to Use | Speed | Cost | Determinism |
|-------------|-------------|-------|------|-------------|
| **Code-based** | Format checks, schema validation, exact match, regex, contains | Instant | Free | Full |
| **LLM-as-judge** | Subjective quality, accuracy, tone, completeness, relevance | Seconds | Medium | Low |
| **Human** | Calibration, edge cases, safety review, final sign-off | Minutes-hours | High | Low |

**Combine graders in layers:**
1. Code graders filter obvious failures (format, length, PII)
2. LLM-as-judge scores quality on passing cases
3. Human review calibrates LLM-as-judge on a held-out set

---

## LLM-as-Judge

The dominant automated grading method for subjective quality. Three scoring formats:

| Format | How It Works | Best For |
|--------|-------------|----------|
| **Pointwise** | Score single output 1-5 against rubric | Absolute quality measurement |
| **Pairwise** | Compare two outputs, pick winner | A/B comparison, model selection |
| **Classification** | Label output (pass/fail, category) | Binary quality gates |

**Hard rules for LLM-as-judge:**
- Use a stronger model as judge than the model being evaluated
- Provide explicit rubric with criteria per score level
- For pairwise: randomize order to counter position bias (flips 10-30% of verdicts)
- Run 3+ judgments per case and take majority vote to reduce variance
- Calibrate against human scores — measure inter-rater agreement (Cohen's Kappa > 0.6)
- Include chain-of-thought reasoning before the score
- Never use the same model to judge its own outputs (self-enhancement bias)

---

## Trace-Based Agent Evaluation

Agents require trajectory evaluation, not just outcome scoring. A correct final answer produced via wrong tool calls or loops is a false positive.

**Two evaluation dimensions:**

| Dimension | What It Measures | Metrics |
|-----------|-----------------|---------|
| **Outcome** | Did the agent achieve the goal? | Task completion, answer correctness, user satisfaction |
| **Trajectory** | How did the agent get there? | Tool-call accuracy, step efficiency, no loops/hallucinated tools, recovery from errors |

**Score both dimensions independently.** High outcome + bad trajectory = fragile system that will fail on harder tasks.

**Trajectory signals to track:**
- Tool-call accuracy (correct tool + correct arguments)
- Step count vs optimal path length
- Loop detection (repeated identical actions)
- Error recovery (graceful handling of tool failures)
- Latency per step and total completion time
- Token usage per step (cost efficiency)

---

## Evaluation Dataset Design

| Category | % of Dataset | Purpose |
|----------|-------------|---------|
| Happy path | 40% | Standard queries with clear answers |
| Edge cases | 20% | Empty input, very long queries, ambiguous |
| No-answer | 15% | Questions outside knowledge scope |
| Multi-hop | 15% | Questions requiring multiple retrievals or steps |
| Adversarial | 10% | Injection attempts, misleading queries |

**Dataset rules:**
- Start with 20-50 cases from real failures, grow to 100-200
- Split into dev set (iterate) and holdout set (final measurement — never peek)
- Version datasets in git alongside prompts and model configs
- Update quarterly with production failure cases
- Include ground truth AND grading criteria per case

---

## Synthetic Dataset Generation

Bootstrap eval datasets when real data is scarce or for coverage expansion.

```
1. Seed with 10-20 real examples (from production logs, support tickets, docs)
2. Use LLM to generate variations (paraphrase, increase difficulty, add edge cases)
3. Filter: remove duplicates, check diversity (embedding clustering)
4. Human-validate a sample (20-30%) — measure generation quality
5. Label with ground truth (LLM-draft + human-verify)
6. Add to eval suite with provenance tag (synthetic vs organic)
```

**Risks:** LLM-generated data inherits model biases and may lack real-world distribution. Always validate synthetic cases against production patterns. Never use 100% synthetic evals — mix with organic data.

---

## Regression Harness

```
1. Define pass/fail thresholds per metric (e.g., faithfulness > 0.85)
2. Run on every prompt, config, or model change
3. Compare against baseline scores — flag any drop > 2%
4. Block deployment if regression detected on holdout set
5. Store historical scores for trend analysis
6. Track: metric value, confidence interval, sample size, timestamp
```

**CI integration pattern:**
- Run eval suite as PR check — post results as PR comment
- Set quality thresholds that block merges
- Track score trends across commits
- Alert on gradual degradation (not just sudden drops)

---

## Offline vs Online Evaluation

| Aspect | Offline (pre-deploy) | Online (production) |
|--------|---------------------|---------------------|
| **Data** | Curated eval dataset | Sampled production traffic |
| **Timing** | Before deploy, in CI | Continuous post-deploy |
| **Graders** | Code + LLM-as-judge | Code + lightweight LLM + user feedback |
| **Purpose** | Catch regressions, validate changes | Detect drift, measure real-world quality |
| **Latency** | Can be slow (minutes) | Must be fast (async scoring) |

**Online eval signals:**
- Sample 1-10% of production traffic for automated scoring
- Track user feedback (thumbs up/down, corrections, abandonment)
- Monitor score distributions over time — alert on drift
- A/B test significant changes with engagement metrics
- Log traces: full pipeline (query, retrieval, generation, evaluation)

---

## Statistical Rigor

- Report confidence intervals, not point estimates
- Minimum 30 cases per metric for meaningful signal; 100+ for reliable comparison
- Use paired tests when comparing two systems on the same eval set
- For LLM-as-judge: measure inter-rater reliability (Cohen's Kappa, Krippendorff's Alpha)
- For A/B tests: calculate required sample size before running the test
- Track variance across runs — high variance means the grader is unreliable, not the system

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| No evaluation at all | No idea if system works | Start with 20 cases + code graders |
| Evaluating only happy path | Misses failure modes | Cover all 5 dataset categories above |
| Same model as judge and subject | Self-enhancement bias | Use a different, stronger model |
| No versioning of eval sets | Can't reproduce results | Version prompts + eval sets in git |
| Manual-only evaluation | Doesn't scale, inconsistent | Automate + human calibration |
| Outcome-only agent eval | Misses fragile trajectories | Score trajectory + outcome independently |
| 100% synthetic eval data | Doesn't match real distribution | Mix synthetic with organic production data |
| Point estimates without CI | Can't tell if difference is real | Report confidence intervals, use paired tests |
| Eval set too small (< 20) | Noise dominates signal | Minimum 20-50 cases to start |
| Waiting for perfect eval suite | Delays all quality feedback | Start with 20 cases, iterate |

---

## Related Knowledge

- **rag** skill — RAG pipeline architecture that evaluation measures
- **agent-engineering** skill — agent orchestration patterns being evaluated
- **observability** skill — tracing and monitoring infrastructure
- **ai-engineer** skill — production AI features that need evaluation
- **qa** skill — general testing strategy principles

## References

- [eval-patterns.md](references/eval-patterns.md) — LLM-as-judge templates, dataset design patterns, CI integration examples, grader implementation
