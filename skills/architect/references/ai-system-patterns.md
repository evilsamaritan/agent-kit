# AI System Architecture Patterns

Patterns for systems that integrate LLMs, RAG pipelines, agents, and local AI.
Platform-agnostic. Language-agnostic.

## Contents

- [Core Mental Model: LLM as a Component](#core-mental-model-llm-as-a-component)
- [Context Engineering](#context-engineering)
- [RAG (Retrieval-Augmented Generation)](#rag-retrieval-augmented-generation)
- [Agent Architecture Patterns](#agent-architecture-patterns)
- [Local AI vs Cloud AI](#local-ai-vs-cloud-ai)
- [Guardrails and Safety Architecture](#guardrails-and-safety-architecture)
- [LLM Integration Anti-Patterns](#llm-integration-anti-patterns)

---

## Core Mental Model: LLM as a Component

Treat LLMs as **non-deterministic, stateless compute components** — not as intelligent agents with memory.

**Implications:**
- LLMs have no memory between calls — state must be managed externally
- LLM outputs are probabilistic — design for variance, not determinism
- Context window is the LLM's entire world — what you put in determines what comes out
- LLMs cannot call external systems — tools/functions bridge the gap
- Cost and latency are non-trivial — cache aggressively, batch when possible

---

## Context Engineering

Context is the primary lever for LLM behavior. "Context engineering" is the practice of managing what goes into the context window — with the same care as system architecture.

### Context is a finite resource

As context length increases, model recall accuracy decreases — even within the nominal context window. Prioritize ruthlessly.

**Context hierarchy (what to include, in order of priority):**
1. System prompt (role, constraints, format instructions)
2. Task-specific instructions
3. Relevant retrieved knowledge (RAG)
4. Recent conversation history
5. Tool results
6. Examples (few-shot)

### Just-in-time context

Don't pre-load everything. Maintain lightweight identifiers (file paths, IDs, URLs) and load data dynamically via tools when needed.

```
BAD:  Include entire codebase in context "in case it's needed"
GOOD: Include file list; load specific files via tool when the task touches them
```

### Context organization

Structure system prompts with XML tags or clear Markdown headers:
```xml
<role>...</role>
<constraints>...</constraints>
<output_format>...</output_format>
<examples>...</examples>
```

Structured context is easier for models to parse and less likely to have sections overriding each other.

### Compaction for long-running sessions

When a session approaches the context limit:
- Summarize early conversation turns into a compact summary
- Preserve key facts and decisions explicitly
- Discard reasoning that led to already-made decisions

---

## RAG (Retrieval-Augmented Generation)

RAG grounds LLM responses in retrieved documents, reducing hallucination and enabling up-to-date knowledge.

### Basic RAG pipeline

```
Query → Embed query → Vector search → Retrieve chunks → Inject into prompt → Generate
```

### RAG variants (choose by use case)

| Variant | When to use |
|---------|-------------|
| **Simple RAG** | Static knowledge base, < 100K documents, simple queries |
| **Hybrid RAG** | Combine vector search (semantic) + keyword search (BM25) — better precision |
| **Adaptive RAG** | Route simple queries to direct generation; complex queries to full RAG — 4x cost reduction |
| **Graph RAG** | Entity-heavy domains where relationships matter (knowledge graphs) |
| **Agentic RAG** | Multi-step retrieval — agent decides what to retrieve next based on partial results |

**Default recommendation:** Start with Hybrid RAG (vector + BM25). Adaptive routing adds significant value at scale.

### Chunking strategy

**Context-aware chunking over fixed-size chunking.** Fixed-size chunks split sentences and paragraphs mid-thought, degrading retrieval quality.

Strategies:
- **Semantic chunking:** split at natural boundaries (paragraphs, sections, sentences)
- **Document-based:** each document is a chunk (for short docs)
- **Hierarchical:** embed both large and small chunks; retrieve small, expand to large for context

### Retrieval quality

Honest expectation: even well-tuned RAG systems exhibit **17–33% hallucination rates** in complex domains. Mitigations:
- Add confidence scoring and decline to answer when confidence is low
- Show retrieved sources to users for verification
- Implement answer grounding checks (verify claims against retrieved documents)

### Vector database selection

| Scale | Recommendation |
|-------|---------------|
| < 50M vectors, already on PostgreSQL | pgvector (zero new infrastructure) |
| < 50M vectors, need standalone | Qdrant (best Rust-native, production-ready) |
| > 50M vectors | Milvus (open source) or Pinecone (managed) |

---

## Agent Architecture Patterns

### The spectrum of agency

```
Single LLM call       →    Chained calls    →    Agent with tools    →    Multi-agent system
(deterministic)            (pipeline)              (loops, branching)       (parallel, specialized)
```

**Start with the simplest architecture that solves the problem.** Multi-agent systems are expensive to debug and operate.

### Single agent with tools

The default starting point. One LLM instance with access to a defined set of tools.

```
User request → System prompt + tools → LLM decides action → Execute tool → LLM continues → Response
```

Tools are the extension point: file read/write, web search, DB queries, API calls, code execution.

**Design tool interfaces like API interfaces:**
- Clear input schema
- Structured output
- Explicit error types
- Idempotent where possible

### Multi-agent patterns

Use multi-agent only when:
- Tasks are parallelizable and independent
- Different tasks require different specialization (different system prompts, different tools)
- Context window would be exceeded by a single agent handling all context

**Orchestrator-Worker (most common):**
```
Orchestrator (planner) → decomposes task → Worker A, Worker B, Worker C (specialists)
                       ← collects results ←
                       → synthesizes final answer
```

**Hierarchical:**
```
Director → Team Lead A → Worker A1, Worker A2
         → Team Lead B → Worker B1, Worker B2
```

Use for very complex tasks that require cross-domain coordination.

**Pipeline (sequential):**
```
Agent 1 (research) → Agent 2 (analysis) → Agent 3 (synthesis) → Agent 4 (formatting)
```

Use when each step is well-defined and output of one step is the full input of the next.

### Agent state management

Agents have no intrinsic memory. State must be managed externally:

| State type | Storage |
|------------|---------|
| Current context / working memory | In-context (the prompt) |
| Short-term session state | In-process memory or Redis |
| Long-term memory / facts | Vector DB (retrieval on demand) |
| Episodic memory (past interactions) | Structured DB + retrieval |
| Shared state between agents | Shared external store |

**Memory architecture for Cognitive OS / local-first systems:**
- Working memory: current context window
- Episodic memory: event log (append-only, structured)
- Semantic memory: vector store of consolidated knowledge
- Procedural memory: tool definitions and usage patterns

---

## Local AI vs Cloud AI

### Decision framework

| Constraint | Local AI | Cloud AI |
|-----------|---------|---------|
| Data privacy (PII, medical, legal) | ✅ Preferred | ⚠️ Requires DPA/contract |
| Offline operation required | ✅ Only option | ❌ |
| Ultra-low latency (< 50ms) | ✅ | ⚠️ Network overhead |
| Maximum model capability | ⚠️ Limited by hardware | ✅ |
| Elastic scale | ❌ Fixed hardware | ✅ |
| Training / fine-tuning | ⚠️ GPU required | ✅ |
| Cost at scale (> 1M calls/day) | ✅ Cheaper | ⚠️ Can be expensive |

**Local AI is viable today:** Mistral, Llama, Gemma families run on consumer hardware. Quantization (FP32→INT8) reduces model size by 75% with minimal quality loss.

### Local AI architecture

```
App → Local inference server (Ollama, LlamaCpp, llamafile)
    → Model (GGUF format, quantized)
    → Hardware: CPU (slow), GPU (fast), Apple Silicon (efficient)
```

**Abstraction layer is critical:** Your application should not know if it's calling a local model or a cloud API. Define a `LLMClient` interface that both backends implement.

```
LLMClient interface {
  complete(prompt, options) → Response
  embed(text) → Embedding
}

OllamaClient implements LLMClient
AnthropicClient implements LLMClient
OpenAIClient implements LLMClient
```

This enables: local development → cloud production, A/B testing between models, fallback if local model fails.

---

## Guardrails and Safety Architecture

Three-layer guardrail architecture:

### Layer 1: Input guardrails
Applied before the LLM sees the input:
- Prompt injection detection (user input trying to override system instructions)
- PII detection and redaction (names, emails, SSNs, medical info)
- Content classification (is this request in-scope?)
- Rate limiting (prevent abuse)

### Layer 2: Runtime constraints
Applied during LLM operation:
- System prompt pinning (prevent override)
- Tool use constraints (the agent can only use approved tools)
- Domain boundary enforcement (agent stays within its scope)
- Token budget limits

### Layer 3: Output guardrails
Applied before output reaches the user:
- Schema validation (structured output conforms to expected shape)
- Hallucination detection (claims not supported by retrieved context)
- Content filtering (harmful content detection)
- PII in output (did the model leak sensitive data from context?)
- Confidence gating (decline to answer when confidence is below threshold)

### Observability for AI systems

Standard APM is insufficient for AI systems. Instrument:
- **Token usage** per request (cost tracking)
- **Latency** per stage (retrieval, generation, tool calls)
- **Retrieval quality** (are retrieved chunks relevant?)
- **Model response quality** (evaluation harness for regressions)
- **Tool call success rate** (are agent tools working?)
- **Session traces** (full trace of multi-step agent workflows)

Use OpenTelemetry for instrumentation. For LLM-specific observability, add a dedicated LLM tracing tool. Popular choices include: Langfuse, Braintrust, LangSmith, Arize Phoenix.

---

## LLM Integration Anti-Patterns

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Calling LLM for every request | Latency + cost | Cache deterministic queries; use LLM only for genuinely variable responses |
| No abstraction over LLM provider | Provider lock-in | Define `LLMClient` interface; swap providers without changing business logic |
| Unbounded context growth | Recall degrades, cost increases | Implement compaction; use just-in-time retrieval |
| Agent with no termination condition | Infinite loops, runaway cost | Define max steps, timeout, and explicit stop conditions |
| Single-point-of-failure on cloud API | Outage = system down | Fallback to local model or graceful degradation |
| Prompts embedded in code | Hard to iterate | Store prompts as versioned artifacts; test them like code |
| No evaluation harness | Can't detect regressions | Build eval suite of representative inputs with expected outputs |
