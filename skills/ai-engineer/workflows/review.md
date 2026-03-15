# AI System Review Protocol

Step-by-step review procedure for production AI systems.

## Phase 1: Architecture Assessment

1. Identify all LLM calls in the codebase (grep for API clients, SDK imports)
2. Map the data flow: input -> processing -> LLM -> output -> user
3. Check for provider abstraction (can you switch providers without rewriting?)
4. Verify error handling on LLM calls (timeouts, rate limits, malformed responses)
5. Check model routing strategy (are simple tasks using appropriately sized models?)

## Phase 2: Structured Outputs

1. Identify LLM calls whose output feeds downstream code
2. Verify schema definition exists for each (JSON Schema, type definitions)
3. Check validation is applied to every structured response
4. Verify error recovery: retry, fallback, or graceful failure on schema violation
5. Check for reasoning tasks — are they using two-step (free-form then structured)?

## Phase 3: Retrieval Quality (if RAG)

1. Check chunking strategy — is it document-aware or arbitrary?
2. Verify embedding model consistency (same model for indexing and querying)
3. Check retrieval strategy — hybrid search preferred over vector-only
4. Verify reranking is in place (retrieve many, rerank to top-k)
5. Check context assembly — grounding instructions present?

## Phase 4: Evaluation

1. Does an evaluation suite exist?
2. Are there regression tests for prompt changes?
3. Is there production monitoring (faithfulness, latency, cost)?
4. Are prompts and eval datasets versioned?
5. Is there a human eval process for edge cases?

## Phase 5: Safety and Guardrails

1. Input guardrails — prompt injection defense present?
2. Output guardrails — PII detection, content policy, grounding verification?
3. Are guardrails implemented as infrastructure (not just prompt instructions)?
4. Rate limiting — per-user quotas, cost tracking?
5. Content safety — harmful content detection?

## Phase 6: Performance and Cost

1. Token usage tracking per feature/endpoint
2. Latency budgets defined and monitored
3. Caching strategy for repeated queries
4. Model selection appropriate for task complexity (model routing)
5. Batch processing where applicable
6. Cost-per-query and cost-per-user metrics

## Phase 7: Report

Produce a structured report:

| Category | Status | Severity | Finding | Recommendation |
|----------|--------|----------|---------|---------------|
| Architecture | ... | ... | ... | ... |
| Structured Outputs | ... | ... | ... | ... |
| Retrieval | ... | ... | ... | ... |
| Evaluation | ... | ... | ... | ... |
| Safety | ... | ... | ... | ... |
| Performance | ... | ... | ... | ... |
