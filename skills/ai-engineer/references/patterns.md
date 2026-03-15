# Production AI Patterns

Patterns for building production-grade AI features.

## Contents

- [Provider Abstraction](#provider-abstraction)
- [Structured Outputs](#structured-outputs)
- [Model Routing](#model-routing)
- [Prompt Versioning](#prompt-versioning)
- [Cost Management](#cost-management)
- [Guardrails Architecture](#guardrails-architecture)
- [Fallback Strategies](#fallback-strategies)
- [Caching Patterns](#caching-patterns)

---

## Provider Abstraction

Abstract LLM calls behind a provider-agnostic interface:

```typescript
interface LLMProvider {
  complete(prompt: string, options: CompletionOptions): Promise<CompletionResult>;
  embed(text: string | string[]): Promise<number[][]>;
  structuredOutput<T>(prompt: string, schema: JSONSchema): Promise<T>;
}

// Switch providers without changing application code
const provider = createProvider(config.llm.provider, config.llm.apiKey);
```

Benefits: swap providers without rewriting application code, A/B test models, implement fallback chains.

## Structured Outputs

Use schema-validated outputs for any LLM call that feeds downstream code.

**Pattern: Schema-first**

1. Define output schema (JSON Schema, type definition, or framework equivalent)
2. Pass schema to LLM via provider-native structured output mode
3. Validate response against schema
4. Handle validation failures with retry or fallback

**Pattern: Two-step reasoning**

When tasks require complex reasoning, forcing structured output during generation degrades quality. Instead:

1. Let the LLM reason in free-form text
2. Extract structured data from the reasoning output in a second call
3. Validate the extracted structure

**Error recovery:**

```
Schema validation failed?
├── Retry with same prompt (transient failure)
├── Retry with simplified schema
├── Fall back to free-form + parsing
└── Return error to caller with context
```

## Model Routing

Route tasks to appropriate models based on complexity, cost, and latency requirements.

**Static routing:** Map task types to models at configuration time.

```
Task type → Model assignment
├── Classification, extraction, formatting → small/fast model
├── Summarization, simple Q&A → medium model
├── Code generation, complex analysis → large model
└── Safety-critical, high-stakes → largest available model
```

**Dynamic routing:** Use a classifier or heuristic to select model per request.

- Input length, detected complexity, user tier, latency budget
- Track routing decisions and outcomes for optimization
- Set fallback model when primary is unavailable

## Prompt Versioning

Store prompts as versioned files alongside evaluation datasets:

```
prompts/
├── v1/
│   ├── system.txt
│   ├── examples.json
│   └── eval_results.json
├── v2/
│   ├── system.txt
│   ├── examples.json
│   └── eval_results.json
└── active -> v2/          # symlink to current version
```

Every prompt change must run against the eval suite before promotion.

## Cost Management

- Track token usage per feature, endpoint, and user
- Set budget alerts at 80% of monthly allocation
- Use model routing: simple tasks to smaller model, complex to larger
- Cache embeddings and repeated queries
- Batch API calls where possible
- Monitor cost-per-query and cost-per-user trends

## Guardrails Architecture

Guardrails operate in two layers — input and output — each with distinct responsibilities.

**Input guardrails** (before LLM call):
- Prompt injection detection (pattern matching, classifier-based)
- Input length and format validation
- PII detection and redaction
- Content policy enforcement

**Output guardrails** (after LLM call):
- Schema validation (for structured outputs)
- Grounding verification (response uses provided context, not hallucination)
- PII detection in generated text
- Content safety filtering
- Confidence thresholds for critical decisions

**Implementation:** Guardrails are deterministic checks and classifiers, not prompt instructions. Move safety logic out of prompts and into infrastructure.

## Fallback Strategies

```
Primary model unavailable?
├── Retry with exponential backoff (3 attempts)
├── Fall back to secondary provider
├── Fall back to cached response (if available)
└── Return graceful degradation message
```

## Caching Patterns

| Cache Level | What | TTL | When |
|------------|------|-----|------|
| Embedding cache | Vector representations | Long (days) | Same text, same model |
| Query cache | Full LLM responses | Short (minutes) | Exact query match |
| Semantic cache | Similar query responses | Medium (hours) | Embedding similarity above threshold |
| Schema cache | Validated structured outputs | Medium (hours) | Same schema + similar input |
