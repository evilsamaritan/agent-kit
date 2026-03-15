# Evaluation Patterns

Implementation details for graders, dataset generation, CI integration, and evaluation frameworks.

## Contents

- [Code-Based Graders](#code-based-graders)
- [LLM-as-Judge Templates](#llm-as-judge-templates)
- [Pairwise Comparison](#pairwise-comparison)
- [RAG Evaluation Metrics](#rag-evaluation-metrics)
- [Synthetic Dataset Generation](#synthetic-dataset-generation)
- [CI/CD Integration](#cicd-integration)
- [Agent Trajectory Scoring](#agent-trajectory-scoring)
- [Evaluation Frameworks](#evaluation-frameworks)

---

## Code-Based Graders

Use code graders for every deterministic check. They are free, instant, and reproducible.

```python
# Format grader — check output structure
def grade_format(output: str, expected_format: str) -> bool:
    if expected_format == "json":
        try:
            json.loads(output)
            return True
        except json.JSONDecodeError:
            return False
    if expected_format == "markdown":
        return output.startswith("#") or output.startswith("-")
    return True

# Contains grader — check for required content
def grade_contains(output: str, required: list[str], forbidden: list[str] = []) -> dict:
    missing = [r for r in required if r.lower() not in output.lower()]
    found_forbidden = [f for f in forbidden if f.lower() in output.lower()]
    return {
        "pass": len(missing) == 0 and len(found_forbidden) == 0,
        "missing": missing,
        "forbidden_found": found_forbidden,
    }

# Semantic similarity grader — embedding-based closeness
def grade_similarity(output: str, reference: str, threshold: float = 0.8) -> bool:
    output_emb = get_embedding(output)
    ref_emb = get_embedding(reference)
    similarity = cosine_similarity(output_emb, ref_emb)
    return similarity >= threshold
```

---

## LLM-as-Judge Templates

### Pointwise Scoring Rubric

```
You are an expert evaluator. Score the response on a scale of 1-5.

Criteria:
5 - Excellent: Fully addresses the question, well-structured, accurate, cites sources when available
4 - Good: Addresses the question with minor gaps, mostly accurate
3 - Acceptable: Partially addresses, some inaccuracies or missing context
2 - Poor: Barely addresses, significant inaccuracies or missing key information
1 - Unacceptable: Does not address the question, factually wrong, or harmful

Question: {question}
Context provided: {context}
Reference answer (if available): {reference}
Response to evaluate: {response}

Provide your evaluation:
Reasoning: [explain step-by-step why this score]
Score: [1-5]
```

### Classification Gate

```
You are a quality gate evaluator. Classify the response as PASS or FAIL.

PASS criteria:
- Directly answers the question asked
- Contains no factual errors
- Does not include information not supported by the provided context
- Appropriate length and format

Question: {question}
Context: {context}
Response: {response}

Reasoning: [brief explanation]
Verdict: [PASS or FAIL]
```

---

## Pairwise Comparison

Use pairwise comparison for A/B testing prompts, models, or system configurations.

```
You are an expert evaluator. Compare two responses and pick the better one.

Evaluation criteria:
- Accuracy: factual correctness relative to the context
- Completeness: addresses all parts of the question
- Clarity: well-structured and easy to understand
- Conciseness: no unnecessary verbosity

Question: {question}
Context: {context}

Response A: {response_a}
Response B: {response_b}

Which response is better? Explain your reasoning step by step, then give your verdict.

Reasoning: [detailed comparison]
Verdict: [A, B, or TIE]
```

**Position bias mitigation:** Run each comparison twice with swapped order. If verdicts disagree, mark as TIE. Report the swap-disagreement rate — if > 20%, the rubric needs tightening.

---

## RAG Evaluation Metrics

Four core metrics for retrieval-augmented generation quality:

```
Faithfulness:     Does the answer use ONLY retrieved context? (no hallucination)
                  Score: fraction of claims in the answer supported by context

Answer Relevancy: Does the answer address the question?
                  Score: semantic similarity between question and answer

Context Precision: Are retrieved chunks relevant to the question?
                   Score: fraction of retrieved chunks that are relevant

Context Recall:   Are all needed facts retrieved?
                  Score: fraction of ground-truth claims covered by retrieved context
```

**Implementation pattern (framework-agnostic):**

```python
# Faithfulness check
def eval_faithfulness(answer: str, context: str, judge_model) -> float:
    claims = judge_model.extract_claims(answer)
    supported = [c for c in claims if judge_model.is_supported(c, context)]
    return len(supported) / len(claims) if claims else 1.0

# Context precision check
def eval_context_precision(question: str, contexts: list[str], judge_model) -> float:
    relevant = [c for c in contexts if judge_model.is_relevant(c, question)]
    return len(relevant) / len(contexts) if contexts else 0.0
```

**Thresholds (starting points, calibrate to your domain):**

| Metric | Minimum | Good | Excellent |
|--------|---------|------|-----------|
| Faithfulness | 0.80 | 0.90 | 0.95+ |
| Answer Relevancy | 0.70 | 0.85 | 0.90+ |
| Context Precision | 0.70 | 0.80 | 0.90+ |
| Context Recall | 0.60 | 0.75 | 0.85+ |

---

## Synthetic Dataset Generation

### From Documents

```python
def generate_eval_cases(documents: list[str], generator_model, n_per_doc: int = 5) -> list[dict]:
    cases = []
    for doc in documents:
        prompt = f"""Generate {n_per_doc} question-answer pairs from this document.

        For each pair, provide:
        - question: a realistic user question
        - answer: the correct answer based solely on the document
        - difficulty: easy | medium | hard
        - category: happy_path | edge_case | multi_hop | no_answer

        Document: {doc}

        Output as JSON array."""

        raw = generator_model.generate(prompt)
        generated = json.loads(raw)
        for case in generated:
            case["source_doc"] = doc[:100]
            case["synthetic"] = True
        cases.extend(generated)
    return cases
```

### Quality Control

1. Deduplicate by embedding similarity (threshold > 0.95 = duplicate)
2. Human-validate a random 20-30% sample
3. Check category distribution matches target (40% happy, 20% edge, etc.)
4. Remove cases where the generated answer contradicts the source document
5. Tag all synthetic cases — never mix unlabeled synthetic with organic data

---

## CI/CD Integration

### PR-level eval check pattern

```yaml
# Example: GitHub Actions eval workflow
name: AI Eval
on: [pull_request]
jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run eval suite
        run: python run_evals.py --dataset eval/holdout.json --output results.json
      - name: Check thresholds
        run: python check_thresholds.py --results results.json --baseline eval/baseline.json
      - name: Post results to PR
        if: always()
        run: python post_results.py --results results.json --pr ${{ github.event.pull_request.number }}
```

### Threshold check script pattern

```python
def check_regression(results: dict, baseline: dict, max_drop: float = 0.02) -> bool:
    regressions = []
    for metric, value in results.items():
        baseline_value = baseline.get(metric, 0)
        if baseline_value - value > max_drop:
            regressions.append(f"{metric}: {baseline_value:.3f} -> {value:.3f} (drop: {baseline_value - value:.3f})")
    if regressions:
        print("REGRESSIONS DETECTED:")
        for r in regressions:
            print(f"  - {r}")
        return False
    return True
```

---

## Agent Trajectory Scoring

Score both outcome and trajectory independently.

```python
def score_agent_trajectory(trace: list[dict], expected_tools: list[str] = None) -> dict:
    steps = len(trace)
    tool_calls = [s for s in trace if s["type"] == "tool_call"]
    errors = [s for s in trace if s.get("error")]
    loops = detect_loops(trace)  # repeated identical action sequences

    scores = {
        "step_count": steps,
        "tool_accuracy": (
            len([t for t in tool_calls if t["tool"] in expected_tools]) / len(tool_calls)
            if tool_calls and expected_tools else None
        ),
        "error_count": len(errors),
        "loop_count": len(loops),
        "recovered_from_errors": len([e for e in errors if e.get("recovered")]),
        "total_tokens": sum(s.get("tokens", 0) for s in trace),
        "total_latency_ms": sum(s.get("latency_ms", 0) for s in trace),
    }

    # Efficiency: compare against optimal path length if known
    if expected_tools:
        scores["efficiency"] = len(expected_tools) / steps if steps > 0 else 0

    return scores

def detect_loops(trace: list[dict], window: int = 3) -> list:
    """Detect repeated action sequences of length `window`."""
    sequences = []
    for i in range(len(trace) - window):
        seq = tuple(s.get("action") for s in trace[i:i+window])
        if seq in sequences:
            return [seq]  # simplified — return first loop found
        sequences.append(seq)
    return []
```

---

## Evaluation Frameworks

Framework-agnostic patterns above work with any evaluation platform. Common frameworks for reference:

| Framework | Strength | Integration |
|-----------|----------|-------------|
| RAGAS | RAG-specific metrics (faithfulness, relevance, precision, recall) | Python library |
| DeepEval | 14+ metrics, pytest plugin, CI/CD gates | pytest integration |
| Braintrust | Eval platform with scoring, tracing, CI integration | SDK + GitHub Action |
| Inspect AI | Research-grade agent evaluation, open-source | Python library |
| LangSmith | Tracing + evaluation for LangChain ecosystem | LangChain integration |
| Evidently AI | ML monitoring with LLM evaluation support | Python library |

Choose based on your stack. The patterns in this file work independently of any framework.
