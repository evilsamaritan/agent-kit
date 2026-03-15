---
name: rag
description: Build RAG pipelines — chunking, retrieval, reranking, hybrid search, context assembly, evaluation. Use when building RAG, choosing chunking, implementing hybrid search, or selecting vector databases. Do NOT use for agent orchestration (use agent-engineering) or eval frameworks (use agent-evals).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# RAG Pipeline Engineering

**Rule:** Always use hybrid search (vector + BM25) as the production default.
**Rule:** Always rerank -- retrieve 20, rerank to 5.
**Rule:** Never fill the entire context window -- 3-5 highly relevant chunks outperform 20 loosely relevant ones.
**Rule:** Always use the same embedding model for indexing and querying. Switching requires full re-indexing.

---

## Pipeline Architecture

```
Documents -> Chunking -> Embedding -> Vector DB (ingestion)
Query -> Embedding -> Vector Search -> Reranking -> Context Assembly -> LLM -> Response
```

---

## Decision Tree -- RAG Approach

```
What type of queries?
├── Simple factual lookups, single-hop?
│   └── Standard RAG (hybrid search + rerank)
├── Multi-hop, entity relationships, "themes across documents"?
│   └── GraphRAG (knowledge graph + vector search)
├── Complex multi-step, need tool use?
│   └── Agentic RAG (agent decides when/what to retrieve)
├── High-precision, must verify retrieval quality?
│   └── Corrective RAG (evaluate before generation)
├── Mixed query complexity, variable difficulty?
│   └── Adaptive RAG (route by query complexity)
└── Latency-critical with predictable follow-ups?
    └── Speculative RAG (pre-fetch anticipated queries)
```

## Decision Tree -- Vector DB Selection

```
Prototyping / small scale?
  YES -> Chroma (embedded, zero setup)
  NO  -> Already using PostgreSQL?
           YES -> pgvector (no new infra)
           NO  -> Need multi-vector / late interaction support?
                    YES -> Qdrant or Vespa (ColBERT-native)
                    NO  -> Want managed service?
                             YES -> Pinecone (zero-ops)
                             NO  -> Qdrant (best OSS performance)
```

---

## Chunking Quick Reference

| Strategy | Best For | Size (tokens) | Overlap |
|----------|----------|---------------|---------|
| Recursive character | General-purpose default | 500-1000 | 10-20% |
| Semantic | Long-form prose, topic boundaries | Variable | N/A |
| Document-aware | Markdown/HTML/code | Follows structure | Header preserved |
| Fixed-size | Uniform processing | 200-500 | 50-100 |
| Vision-guided | PDFs with tables/figures/mixed layout | Page-level | N/A |

**Rule:** Chunk size matters more than embedding model choice.

**When to skip chunking:** Small, focused documents that already match user queries. Chunking can hurt retrieval when documents are self-contained.

---

## Embedding & Retrieval Models

### Single-Vector Embeddings

Choose based on requirements:
- **Cost-effective proprietary:** OpenAI text-embedding-3-small (1536d)
- **High-quality proprietary:** OpenAI text-embedding-3-large (3072d), Cohere embed-v4 (1024d)
- **Top benchmark:** Gemini Embedding 001 (3072d, top MTEB)
- **Best open-weight:** Qwen3-Embedding (1024-4096d, Apache 2.0)
- **Long context open:** nomic-embed-text (768d, 8192 tokens)

### Multi-Vector / Late Interaction

Token-level embeddings that preserve fine-grained matching. Higher accuracy, larger index.

- **ColBERT / ColBERTv2** -- text retrieval with token-level interaction. Best for legal, financial, technical docs where precision matters.
- **ColPali / ColQwen** -- vision-language late interaction. Retrieves directly from document images -- no OCR, no chunking pipeline. Best for PDFs with complex layouts, tables, figures.

**Trade-off:** Multi-vector indexes are 3-10x larger. Use pool factors to compress (e.g., 3x pooling retains ~98% quality at 67% less storage).

---

## Retrieval Strategies

| Strategy | When | Trade-off |
|----------|------|-----------|
| Basic vector search | Simple queries, prototyping | Fast but misses keyword matches |
| Hybrid search (vector + BM25) | Production default | Better recall, more complex |
| Multi-query retrieval | Complex questions | Higher recall, more LLM calls |
| Parent document retrieval | Dense technical docs | Better context, more storage |
| Late interaction (ColBERT) | High-precision requirements | Best accuracy, larger index |

**Default:** Hybrid search (vector + BM25) with Reciprocal Rank Fusion (RRF).

---

## Reranking

Always rerank: retrieve 20, rerank to 5. Two-stage approach balances recall with precision.

Options by quality/cost:
- **Cross-encoder rerankers** -- highest quality, open-source available
- **Cohere Rerank** -- best hosted quality/speed ratio
- **LLM-based** -- most flexible, most expensive, use for complex relevance judgments
- **ColBERT late interaction** -- can serve as both retriever and reranker

---

## Context Assembly

- Budget: ~4000-8000 tokens for retrieved context (3-5 chunks)
- Include source metadata for citation
- Ground the LLM: "Answer based ONLY on the following context"
- Order chunks by relevance -- most relevant first and last (U-shaped attention)

---

## Ingestion Enhancement Techniques

| Technique | How | Trade-off |
|-----------|-----|-----------|
| Contextual Retrieval | LLM-generated summary prepended to each chunk explaining its place in the document | Higher ingestion cost, significantly better retrieval precision |
| Late Chunking | Embed full documents first (long-context model), then segment the embeddings | Preserves cross-chunk context, requires 8K+ token models |
| Hypothetical Document Embedding (HyDE) | Generate hypothetical answer, embed that instead of query | Better for abstract queries, adds latency |
| Metadata enrichment | Extract entities, topics, dates, access levels per chunk | Enables pre-filtering, reduces irrelevant results |

---

## Advanced RAG Patterns

| Pattern | Description | When |
|---------|-------------|------|
| Agentic RAG | Agent decides when/what to retrieve, iterates | Complex multi-step queries, tool-augmented retrieval |
| GraphRAG | Knowledge graph + vector search | Multi-hop, entity-centric, "themes across corpus" queries |
| Corrective RAG (CRAG) | Score retrieval confidence, re-retrieve or fallback if low | High-precision requirements, unreliable sources |
| Adaptive RAG | Route queries by complexity to different retrieval strategies | Mixed workloads -- simple queries skip heavy retrieval |
| Speculative RAG | Pre-fetch for anticipated follow-up queries | Latency-critical conversational RAG |
| Multimodal RAG | Retrieve across text, images, tables, diagrams | Documents with mixed media (technical manuals, research papers) |

---

## Evaluation

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| Faithfulness | Generated answer grounded in retrieved context | > 0.9 |
| Answer relevancy | Answer addresses the question | > 0.85 |
| Context precision | Retrieved chunks are relevant | > 0.8 |
| Context recall | Relevant information was retrieved | > 0.75 |

**Evaluation workflow:** Build 50-100 representative questions with ground truth. Baseline with RAGAS/DeepEval. Iterate on chunking, retrieval, prompt. Add regression tests for edge cases (no answer, ambiguous, multi-hop). Add domain-specific custom metrics beyond generic RAGAS scores.

**Production monitoring:** Track faithfulness, citation accuracy, latency per pipeline stage, retrieval hit rate. Feed user feedback into evaluation loop.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| RAG without evaluation | No idea if retrieval works | RAGAS/DeepEval + human eval baseline |
| No chunking strategy | Arbitrary splits break meaning | Document-aware chunking with overlap |
| Stuffing full context window | Degrades reasoning quality | 3-5 highly relevant chunks |
| Ignoring embedding model choice | Poor retrieval quality | Benchmark on MTEB + your domain data |
| No metadata filtering | Irrelevant results from wrong documents | Filter by metadata before vector search |
| Provider lock-in | No fallback path | Abstract behind provider-agnostic interface |
| Vector-only search | Misses exact terms, acronyms, IDs | Hybrid search (vector + BM25) |
| Same strategy for all queries | Simple queries get expensive pipeline | Adaptive routing by query complexity |
| OCR-then-chunk for complex PDFs | Loses layout, tables, figures | Vision-based retrieval (ColPali) or vision-guided chunking |

---

## Related Knowledge

- **search** skill -- full-text indexing, BM25 tuning, query DSL for hybrid search component
- **database** skill -- pgvector setup, schema design for vector storage, index types (HNSW, IVF)
- **agent-engineering** skill -- agentic RAG orchestration, tool-augmented retrieval patterns
- **agent-evals** skill -- RAGAS/DeepEval setup, LLM-as-judge for retrieval evaluation
- **ai-engineer** skill -- LLM integration, structured outputs, model routing

## References

- [rag-patterns.md](references/rag-patterns.md) -- Chunking implementation, retrieval code, hybrid search, reranking, context assembly, RAGAS evaluation, advanced pattern examples
