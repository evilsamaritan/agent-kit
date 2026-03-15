# RAG Patterns

Chunking, retrieval strategies, reranking, hybrid search, evaluation, and advanced patterns.

## Contents

- [Ingestion Pipeline](#ingestion-pipeline)
- [Chunking Implementation](#chunking-implementation)
- [Retrieval Strategies](#retrieval-strategies)
- [Hybrid Search](#hybrid-search)
- [Reranking](#reranking)
- [Context Assembly](#context-assembly)
- [Evaluation with RAGAS](#evaluation-with-ragas)
- [Advanced RAG Patterns](#advanced-rag-patterns)
- [Contextual Retrieval](#contextual-retrieval)
- [Multi-Vector Retrieval](#multi-vector-retrieval)
- [Production Monitoring](#production-monitoring)

---

## Ingestion Pipeline

### Full Pipeline (Python)

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from openai import OpenAI

client = OpenAI()

def ingest_document(doc_path, collection):
    # 1. Load document
    text = load_document(doc_path)  # PDF, Markdown, HTML, etc.

    # 2. Chunk
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,           # ~250 tokens
        chunk_overlap=200,         # 20% overlap
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)

    # 3. Embed
    embeddings = client.embeddings.create(
        model="text-embedding-3-small",
        input=chunks,
    )

    # 4. Store with metadata
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings.data)):
        collection.upsert(
            id=f"{doc_path}:chunk:{i}",
            embedding=embedding.embedding,
            metadata={
                "source": doc_path,
                "chunk_index": i,
                "text": chunk,
                "ingested_at": datetime.utcnow().isoformat(),
            },
            document=chunk,
        )
```

### Document Preprocessing

| Source | Preprocessing | Tool |
|--------|-------------|------|
| PDF | Extract text, preserve layout | pypdf, pdfplumber, unstructured |
| HTML | Strip tags, keep structure | BeautifulSoup, trafilatura |
| Markdown | Preserve headers as metadata | Custom parser |
| Code | Split by functions/classes | tree-sitter |
| Tables | Convert to natural language | LLM-based conversion |

---

## Chunking Implementation

### Recursive Character Splitting

```python
# Best general-purpose chunker
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=[
        "\n\n",    # Paragraph breaks first
        "\n",      # Then line breaks
        ". ",      # Then sentences
        " ",       # Then words
        "",        # Then characters (last resort)
    ],
    length_function=len,   # or tiktoken.encoding_for_model("gpt-4").encode
)
```

### Semantic Chunking

Split based on embedding similarity between adjacent sentences:

```python
from langchain_experimental.text_splitter import SemanticChunker

chunker = SemanticChunker(
    embeddings=OpenAIEmbeddings(),
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95,    # Split at top 5% dissimilarity
)
chunks = chunker.split_text(document)
```

### Document-Aware Chunking

```python
def chunk_markdown(text, max_chunk_size=1000):
    """Chunk Markdown respecting headers and code blocks."""
    sections = split_by_headers(text)

    chunks = []
    for section in sections:
        header = section["header"]        # e.g., "## Installation"
        content = section["content"]

        if len(content) <= max_chunk_size:
            chunks.append({
                "text": f"{header}\n\n{content}",
                "metadata": {"section": header},
            })
        else:
            # Sub-chunk large sections
            sub_chunks = recursive_split(content, max_chunk_size)
            for i, sub in enumerate(sub_chunks):
                chunks.append({
                    "text": f"{header}\n\n{sub}",
                    "metadata": {"section": header, "part": i},
                })

    return chunks
```

### Chunk Size Guidelines

| Content Type | Chunk Size (tokens) | Overlap | Reasoning |
|-------------|-------------------|---------|-----------|
| Technical docs | 500-1000 | 100-200 | Dense info, need context |
| Conversational | 200-500 | 50-100 | Shorter, self-contained |
| Legal / regulatory | 1000-2000 | 200-400 | Long clauses, full context |
| Code | Function/class level | None | Natural boundaries |
| FAQs | 1 Q&A per chunk | None | Self-contained units |

---

## Retrieval Strategies

### Basic Vector Search

```python
def retrieve(query, collection, top_k=5):
    query_embedding = embed(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    return results
```

### Multi-Query Retrieval

Generate multiple query variations to improve recall:

```python
def multi_query_retrieve(original_query, collection, top_k=5):
    # Generate query variations using LLM
    prompt = f"""Generate 3 different search queries that would help answer
    this question from different angles: "{original_query}"
    Return as JSON array of strings."""

    variations = llm.generate(prompt)   # ["query1", "query2", "query3"]
    all_queries = [original_query] + variations

    # Retrieve for each query and deduplicate
    all_results = set()
    for query in all_queries:
        results = retrieve(query, collection, top_k=3)
        all_results.update(results)

    return list(all_results)[:top_k]
```

### Parent Document Retrieval

Index small chunks for precision, but return the parent document for context:

```python
# Index: small chunks (200 tokens) with parent_id metadata
# Retrieve: search small chunks, then fetch full parent documents

def parent_document_retrieve(query, collection, doc_store, top_k=3):
    # Search fine-grained chunks
    chunk_results = collection.query(query, n_results=top_k * 3)

    # Get unique parent documents
    parent_ids = set(r.metadata["parent_id"] for r in chunk_results)

    # Return full parent documents (larger context)
    return [doc_store.get(pid) for pid in list(parent_ids)[:top_k]]
```

---

## Hybrid Search

Combine vector similarity with keyword (BM25) search:

```python
def hybrid_search(query, collection, alpha=0.7, top_k=5):
    """
    alpha: weight for vector search (0=keyword only, 1=vector only)
    """
    # Vector search
    vector_results = vector_search(query, collection, top_k=top_k * 2)

    # Keyword search (BM25)
    keyword_results = bm25_search(query, collection, top_k=top_k * 2)

    # Reciprocal Rank Fusion (RRF)
    scores = {}
    k = 60  # RRF constant

    for rank, doc in enumerate(vector_results):
        scores[doc.id] = scores.get(doc.id, 0) + alpha / (k + rank + 1)

    for rank, doc in enumerate(keyword_results):
        scores[doc.id] = scores.get(doc.id, 0) + (1 - alpha) / (k + rank + 1)

    # Sort by combined score
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [get_doc(doc_id) for doc_id, score in ranked[:top_k]]
```

### When to Use Hybrid

| Scenario | Best Approach |
|----------|--------------|
| Exact term lookup ("error code E-1234") | Keyword-heavy (alpha=0.3) |
| Conceptual query ("how to handle errors") | Vector-heavy (alpha=0.8) |
| Mixed queries | Balanced hybrid (alpha=0.5-0.7) |
| Proper nouns, acronyms | Keyword + vector fallback |

---

## Reranking

### Cohere Rerank

```python
import cohere

co = cohere.Client(api_key="...")

def rerank(query, documents, top_k=3):
    results = co.rerank(
        model="rerank-v3.5",
        query=query,
        documents=documents,
        top_n=top_k,
    )
    return [
        {"text": documents[r.index], "score": r.relevance_score}
        for r in results.results
    ]
```

### Cross-Encoder Reranking

```python
from sentence_transformers import CrossEncoder

model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank_cross_encoder(query, documents, top_k=3):
    pairs = [[query, doc] for doc in documents]
    scores = model.predict(pairs)
    ranked = sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
    return [doc for doc, score in ranked[:top_k]]
```

### Retrieval + Reranking Pipeline

```
Query -> Retrieve top 20 (fast, approximate) -> Rerank to top 5 (slow, precise) -> LLM
```

This two-stage approach balances recall (retrieve broadly) with precision (rerank accurately).

---

## Context Assembly

### Prompt Construction

```python
def build_rag_prompt(query, retrieved_docs):
    context = "\n\n---\n\n".join([
        f"Source: {doc.metadata['source']}\n{doc.text}"
        for doc in retrieved_docs
    ])

    return f"""Answer the question based ONLY on the following context.
If the context doesn't contain enough information, say "I don't have enough information."
Always cite the source document.

Context:
{context}

Question: {query}

Answer:"""
```

### Context Window Budget

```
Total context window (e.g., 128K tokens)
  - System prompt:       ~500 tokens
  - Retrieved context:   ~4000-8000 tokens (3-5 chunks)
  - Conversation history: ~2000 tokens
  - Output budget:       ~2000 tokens
  - Safety margin:       ~1000 tokens
```

**Rule:** Don't fill the entire context window. More context != better answers. 3-5 highly relevant chunks outperform 20 loosely relevant ones.

---

## Evaluation with RAGAS

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall

# Prepare evaluation dataset
eval_data = {
    "question": ["What is RBAC?", ...],
    "answer": [rag_pipeline("What is RBAC?"), ...],
    "contexts": [retrieved_contexts, ...],
    "ground_truth": ["RBAC is Role-Based Access Control...", ...],
}

results = evaluate(
    dataset=eval_data,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
)
print(results)
# { faithfulness: 0.92, answer_relevancy: 0.88, context_precision: 0.85, context_recall: 0.79 }
```

### Evaluation Checklist

Build 50-100 representative questions with ground truth. Run RAGAS to baseline, iterate on chunking/retrieval/prompt until metrics improve. Add regression tests for edge cases (no answer, ambiguous, multi-hop). Monitor production: user feedback, citation accuracy, latency.

---

## Advanced RAG Patterns

### Agentic RAG
The agent decides when and what to retrieve, rather than always retrieving:
- Query routing: simple questions -> direct answer, complex -> RAG
- Iterative retrieval: retrieve, generate partial answer, retrieve more if needed
- Self-reflection: check if retrieved context is sufficient before answering

### GraphRAG
Combine knowledge graphs with vector search:
- Build knowledge graph from documents (entities + relationships)
- Query graph for structured facts + vector search for context
- Best for: multi-hop questions, entity-centric queries

### Corrective RAG (CRAG)
Evaluate retrieval quality before generation: retrieve documents, score relevance of each, then branch -- if confident: use retrieved context; if uncertain: refine query and re-retrieve; if irrelevant: fall back to web search or "I don't know".

### Contextual Retrieval
Enrich chunks with surrounding context before embedding:
- Prepend a short LLM-generated summary of where each chunk fits in the source document
- Improves retrieval precision without increasing chunk size at query time
- Trade-off: higher ingestion cost, but significantly better retrieval relevance

### Late Chunking / Contextual Embeddings
Embed full documents first, then chunk the embeddings:
- Preserves cross-chunk context that is lost with chunk-then-embed
- Requires embedding models that support long input (8K+ tokens)
- Best for: dense technical documents where context spans multiple sections

### Adaptive RAG
Route queries by complexity to different retrieval strategies:
- Simple factual queries: direct embedding search, skip reranking
- Medium complexity: hybrid search + reranking (standard pipeline)
- Complex multi-hop: agentic RAG with iterative retrieval
- Reduces cost and latency for simple queries while maintaining quality for complex ones

### Speculative RAG
Pre-fetch anticipated follow-up queries in parallel:
- Analyze current query and conversation to predict likely follow-ups
- Use a smaller specialist model to draft multiple answers from distinct document subsets
- Larger model verifies drafts -- reduces latency by up to 50% while improving accuracy
- Best for: conversational RAG with predictable query patterns

### Multimodal RAG
Retrieve across text, images, tables, and diagrams:
- Use vision-language models (ColPali, ColQwen) to embed document pages directly
- Skip OCR/text extraction pipeline -- retrieve from document images
- Combine text retrieval with image retrieval using separate indexes and late fusion
- Best for: technical manuals, research papers, documents with complex layouts

---

## Contextual Retrieval

Enrich chunks with document-level context before embedding:

```python
def add_contextual_prefix(chunk, full_document):
    """Prepend LLM-generated context to each chunk before embedding."""
    prompt = f"""Given this document:
{full_document[:2000]}

And this specific chunk:
{chunk}

Write a 1-2 sentence summary of where this chunk fits in the document.
Start with 'This chunk...'"""

    context = llm.generate(prompt)
    return f"{context}\n\n{chunk}"
```

Trade-off: ~2x ingestion cost (one LLM call per chunk), but significantly better retrieval precision. The contextual prefix is embedded but can be stripped before sending to the generation LLM.

---

## Multi-Vector Retrieval

### ColBERT-Style Late Interaction

Instead of single-vector per document, store token-level embeddings:

```python
# Conceptual ColBERT retrieval
# Each document stores N token embeddings (one per token)
# Query also produces M token embeddings
# Score = sum of max similarities between each query token and all document tokens

def colbert_score(query_embeddings, doc_embeddings):
    """MaxSim scoring: for each query token, find best matching doc token."""
    scores = []
    for q_emb in query_embeddings:
        max_sim = max(cosine_similarity(q_emb, d_emb) for d_emb in doc_embeddings)
        scores.append(max_sim)
    return sum(scores)
```

**Index size management:** Use pooling (group N adjacent token embeddings into 1) to reduce storage. A pool factor of 3 reduces vectors by 67% while retaining ~98% quality.

### ColPali for Document Images

Bypass text extraction entirely -- embed document page images:
- Input: rendered PDF page image
- Output: patch-level embeddings (grid of visual tokens)
- Retrieval: late interaction between query tokens and visual patch tokens
- Advantage: preserves tables, figures, layout that OCR pipelines lose

---

## Production Monitoring

### Metrics to Track

| Metric | What to Track | Alert Threshold |
|--------|--------------|-----------------|
| Retrieval hit rate | % of queries where relevant doc appears in top-k | < 80% |
| Faithfulness score | Generated answer grounded in retrieved context | < 0.85 |
| Citation accuracy | % of citations that match source text | < 90% |
| Latency per stage | Embedding, retrieval, reranking, generation (ms) | p95 > 500ms |
| Context utilization | How much of retrieved context is actually used | < 30% (over-retrieving) |
| User feedback rate | Thumbs up/down on generated answers | Negative > 20% |

### Feedback Loop

1. Collect user feedback (thumbs up/down, corrections)
2. Build evaluation dataset from production queries
3. Run offline evaluation (RAGAS + domain-specific metrics)
4. Identify failure modes (retrieval miss, wrong chunk, hallucination)
5. Tune pipeline component responsible
6. A/B test change against baseline
7. Repeat

### Permission-Based Filtering

Tag documents with access levels during ingestion. Apply metadata filters before vector search to enforce access control. Never rely on post-retrieval filtering -- sensitive content should never enter the context window.

---

## Production RAG Checklist

Chunking quality matters more than embedding model choice. Use hybrid search (vector + BM25) by default. Always rerank (retrieve 20, rerank to 5). Do not fill the context window (3-5 relevant chunks beat 20 loosely relevant). Filter by metadata before vector search. Monitor faithfulness, citation accuracy, and latency per stage. Tag documents with access levels for permission-based filtering. Add domain-specific evaluation metrics beyond generic RAGAS scores. Consider multi-vector retrieval (ColBERT) when single-vector precision is insufficient.
