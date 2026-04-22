---
name: search
description: Implement search systems — full-text indexing, hybrid search, autocomplete, relevance tuning, facets. Use when building search, choosing engines, tuning relevance, or adding autocomplete. Do NOT use for database queries (use database).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Search

Full-text and hybrid search expertise: engine selection, index design, query patterns, relevance tuning, vector search integration, and search observability.

---

## Choosing a search engine

Decide by workload, not by product:

- **Full-text on existing Postgres, small scale** → tsvector / pg_search (no new infra).
- **Hybrid (full-text + vector) on Postgres** → pgvector + tsvector or ParadeDB-class extension.
- **Large-scale full-text with aggregations** → Lucene-based distributed engine.
- **Hosted SaaS, fastest integration** → managed search platform.
- **Edge / client-side** → WASM-delivered local index.
- **Embeddings-first semantic** → dedicated vector DB.

Product short-list per workload: [engine-catalog.md](references/engine-catalog.md).

---

## Full-Text Search Fundamentals

**Analysis pipeline:** Raw text --> Character filters --> Tokenizer --> Token filters --> Inverted index

| Component | Purpose | Examples |
|-----------|---------|----------|
| Character filter | Clean raw text | Strip HTML, normalize unicode |
| Tokenizer | Split into tokens | Standard (word boundary), ngram, edge_ngram |
| Token filter | Transform tokens | Lowercase, stemmer, synonym, stop words |

**Index design principles:**
1. Separate search-time and index-time analyzers -- index with edge_ngram for autocomplete, search with standard
2. Use multi-field mappings -- same field as text (searchable) + keyword (filterable/sortable)
3. Denormalize for search -- flatten nested objects, avoid joins at query time
4. Set explicit mappings -- never rely on auto-detection in production

---

## Query Pattern Quick Reference

| Need | Pattern | When to use |
|------|---------|-------------|
| Simple search | Multi-match across fields | Default search bar |
| Exact phrase | Match phrase query | Quoted search terms |
| Fuzzy / typo | Fuzzy query with edit distance | User typos, misspellings |
| Weighted fields | Field boosting (title^3, body^1) | Title more important than body |
| Combined filters + text | Bool query (must + filter + should) | Faceted search with text query |
| Autocomplete | Completion suggester or edge_ngram | Search-as-you-type |
| Semantic | kNN vector search | Conceptual queries, synonyms |
| Hybrid | BM25 + vector with fusion | Best overall relevance |

---

## Hybrid Search (Text + Vector)

Combine lexical (BM25) and semantic (vector) search. Hybrid consistently outperforms either method alone for most use cases.

| Fusion Method | How | When |
|---------------|-----|------|
| Reciprocal Rank Fusion (RRF) | Combine ranks, ignore scores | Default choice -- score-agnostic, robust |
| Linear combination | Weighted sum of normalized scores | When tuning text vs semantic weight |
| Reranking | Cross-encoder rescores top-N candidates | Maximum relevance, higher latency |

**Implementation checklist:**
1. Start with RRF -- simpler, works without score normalization
2. Tune alpha (text vs vector weight) based on query type -- exact terms favor BM25, conceptual queries favor vector
3. Consider adaptive retrieval -- route queries to the best method based on intent (keyword-heavy vs conceptual)
4. Measure NDCG/MRR before and after enabling hybrid

**Learned sparse retrieval** -- SPLADE, uniCOIL: sparse lexical vectors from a transformer. Bridges BM25 (lexical) and dense (semantic) -- strong on rare terms where dense fails. Consider for hybrid pipelines alongside BM25 + dense.

### Vector Index Considerations

| Index type | Trade-off | Best for |
|-----------|-----------|----------|
| HNSW | High recall, high memory | Default choice, < 10M vectors |
| IVF-PQ | Low memory (32-64x compression), lower recall | Billion-scale, cost-constrained |
| Scalar quantization | 4x memory reduction, minimal recall loss | Production HNSW with memory pressure |
| Binary quantization | 32x reduction, noticeable recall loss | Candidate pre-filtering, first-pass retrieval |

See [search-patterns.md](references/search-patterns.md) for hybrid query examples per engine.

---

## Relevance Tuning

### Tuning Progression

1. **Baseline** -- BM25 with default params (k1=1.2, b=0.75)
2. **Field boosting** -- title^3, description^1.5, body^1
3. **Synonyms and stop words** -- domain-specific synonym lists, language-aware stop words
4. **Recency decay** -- score decreases as documents age (configurable half-life)
5. **Popularity signals** -- boost by view count, purchase count, click-through rate
6. **Learned-to-Rank (LTR)** -- train ranking models on user click/conversion data
7. **Test with real queries** -- automated relevance test suite with expected top results

### Learned-to-Rank (LTR)

Train ML models on user behavior (clicks, dwell time, conversions) to rerank search results.

| Approach | Complexity | When |
|----------|-----------|------|
| Pointwise | Low | Predict relevance score per document |
| Pairwise | Medium | Predict which document is more relevant (LambdaMART) |
| Listwise | High | Optimize entire ranking list (ListNet, neural LTR) |

**Feedback loop:** Search analytics --> judgment lists --> train LTR model --> deploy --> measure NDCG --> iterate.

Avoid tuning for "pet queries" -- optimizing for a handful of queries degrades the long tail. Use a broad evaluation set (100+ queries with relevance judgments).

---

## Autocomplete Architecture

```
User types "run" -->
  1. Frontend: debounce 200-300ms
  2. Request: GET /search/suggest?q=run
  3. Backend: edge_ngram index or completion suggester
  4. Response: suggestions grouped by category with result counts
  5. Frontend: render dropdown, group by category
  6. User selects --> full search with selected term
```

**Implementation options:**
- **Completion suggester** -- pre-indexed suggestions, fastest, limited flexibility
- **Edge n-gram** -- index-time ngrams, supports fuzzy matching, more flexible
- **Prefix query** -- simple, no special index config, slower on large datasets

---

## Multi-Language Search

| Approach | When | Complexity |
|----------|------|------------|
| Per-language index | Different analyzers per language | Medium -- route queries by detected language |
| Multi-language analyzer | Single index, ICU tokenizer | Low -- works for 80% of use cases |
| Multilingual embeddings | Semantic search across languages | Low -- multilingual model handles everything |

Configure language-specific stemmers and stop words. Use ICU analysis for CJK, Arabic, and other non-Latin scripts.

---

## Search Observability

| Metric | What to Track | Target |
|--------|--------------|--------|
| Zero-result rate | Queries with no hits | < 5% |
| Click-through rate (CTR) | Users clicking results | > 30% for top-3 results |
| Query latency p95 | Search response time | < 200ms |
| Top queries without clicks | Popular but unsatisfying searches | Review weekly |
| Query abandonment rate | Users leaving after search | < 20% |

Feed search analytics into relevance tuning. Zero-result queries reveal indexing gaps -- add synonyms, fix analyzers, or expand indexed fields.

---

## DB-to-Search Sync Patterns

| Pattern | How | Trade-off |
|---------|-----|-----------|
| Change Data Capture (CDC) | DB --> CDC tool --> message queue --> indexer | Real-time, reliable, requires message queue infrastructure |
| Application-level events | App --> event bus --> indexer | Simple, must instrument every write path |
| Periodic full sync | Cron job --> bulk index | Self-healing, stale data between syncs |

**Zero-downtime reindexing:** Create new index with updated mapping --> reindex from old --> swap alias atomically. Application always queries the alias, never the versioned index name.

---

## Context Adaptation

### Frontend
- Debounced search input (200-300ms)
- Autocomplete dropdown with category grouping
- Faceted search UI (checkboxes, range sliders, color swatches)
- Infinite scroll or paginated results with result count
- Highlight rendering (mark matched terms in results)
- Empty state and zero-results handling with suggestions
- Search history and recent searches

### Backend
- Index design and mapping configuration
- Query DSL construction and optimization
- Reindexing strategies (zero-downtime alias swap)
- Sync pipeline (DB change --> search index)
- Relevance tuning, A/B testing, and LTR
- Rate limiting and query complexity limits

### Data / ML
- Embedding generation pipeline for hybrid search
- LTR model training on click/conversion data
- Synonym and taxonomy management
- Relevance evaluation (NDCG, MAP, MRR benchmarks)

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| SQL LIKE for full-text search | No relevance scoring, full table scan | Use a search engine or DB-native full-text (tsvector) |
| No analyzers for user input | Exact match only, misses variations | Configure analyzers per language |
| Reindex entire dataset on every update | Downtime, wasted resources | Incremental updates; alias swap for schema changes |
| No relevance testing | Rankings silently degrade | Automated relevance test suite (100+ queries) |
| Unbounded result sets | Memory exhaustion, slow responses | Always limit results, use cursor-based pagination |
| Vector-only search | Misses exact terms, acronyms, product IDs | Hybrid search (vector + BM25) |
| No search analytics | Cannot identify relevance gaps | Track zero-result rate, CTR, top queries |
| Tuning for "pet queries" | Optimizing few queries degrades the long tail | Use broad evaluation set with NDCG measurement |
| HNSW without quantization at scale | Memory bloat with millions of high-dim vectors | Apply scalar or product quantization |
| Embedding model never retrained | Drift from current domain language | Retrain or fine-tune embeddings periodically |

---

## Related Knowledge

- **database** -- pgvector, database-level full-text search (PostgreSQL tsvector), sync pipelines
- **performance** -- Search latency optimization, caching strategies for search results
- **caching** -- Query result caching, search suggestion caching

## References

- [engine-catalog.md](references/engine-catalog.md) -- Engine comparison (Elasticsearch, OpenSearch, Meilisearch, Typesense, Algolia, Postgres extensions, Vespa, vector DBs, Orama), workload shortlist, scale thresholds, licensing notes
- [search-patterns.md](references/search-patterns.md) -- Engine-specific query DSL (Elasticsearch, Meilisearch, Typesense), index mapping templates, hybrid query examples, sync pipeline architecture, relevance test suite template

Load references when you need an engine short-list, engine-specific query DSL examples, index mapping templates, or sync pipeline architecture.
