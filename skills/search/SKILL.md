---
name: search
description: "Build search behavior. Use for full-text or hybrid indexing, autocomplete, ranking, relevance tuning, facets, index sync and reindexing, permission-filtered results, and search-engine selection."
---

# Search

Full-text and hybrid search: engine selection, index design, query patterns, relevance tuning, index correctness, and search analytics. Determine the engine and its version from the project (client library, container image, managed service) before writing engine-specific queries.

## Scope and boundaries

| Question | Owner |
|---|---|
| Analyzers, mappings, query construction, hybrid fusion, relevance evaluation, autocomplete, index sync and reindexing | this skill |
| Storing embeddings next to relational data, ANN index mechanics inside a database | `database` |
| Change capture and event transport feeding the indexer | `message-queues` |
| Who may see which document (the permission model) | `auth` |
| Caching query results | `caching` |
| Search latency profiling | `performance` |

## Choosing a search engine

Decide by workload, not by product:

- **Full-text on an existing relational database, modest needs** → the database's built-in full-text search or a BM25 extension (no new infrastructure).
- **Hybrid (full-text + vector) on the same database** → vector extension plus full-text, or a hybrid-search extension.
- **Large-scale full-text with aggregations, heavy write rate, or log analytics** → distributed Lucene-class engine.
- **Instant search with typo tolerance and little ops capacity** → lightweight search server or a hosted search service.
- **Static site or client-side** → prebuilt or WASM-delivered local index.
- **Embeddings-first semantic retrieval at large scale** → dedicated vector database.

Also weigh: aggregation needs, write rate, ops capacity, relevance features (ranking control, typo tolerance, hybrid), data residency, and license terms. Product short-list: [engine-catalog.md](references/engine-catalog.md).

## Full-text fundamentals

**Analysis pipeline:** raw text → character filters → tokenizer → token filters → inverted index.

| Component | Purpose | Examples |
|-----------|---------|----------|
| Character filter | Clean raw text | Strip HTML, normalize Unicode |
| Tokenizer | Split into tokens | Word boundaries, n-grams, edge n-grams |
| Token filter | Transform tokens | Lowercase, stemming, synonyms, stop words |

**Index design:**
1. Separate index-time and search-time analysis where needed — prefix n-grams at index time for autocomplete, standard analysis at search time.
2. Map one source field several ways — analyzed text for matching, exact keyword for filters, sorting, and facets.
3. Denormalize for search — flatten what queries need; avoid query-time joins.
4. Declare mappings explicitly; never rely on dynamic type detection in production.

## Query patterns

| Need | Pattern | When to use |
|------|---------|-------------|
| Search bar | Lexical query over several weighted fields | Default |
| Exact phrase | Phrase query | Quoted terms |
| Typos | Fuzzy matching with bounded edit distance | User input |
| Facets with text | Text query for scoring + filters that do not affect score | Faceted search |
| Search-as-you-type | Prefix or n-gram index, or a dedicated suggestion index | Autocomplete |
| Conceptual queries | k-nearest-neighbor vector query | Synonyms, paraphrases |
| Best overall relevance | Lexical + vector with rank fusion | Hybrid |

Engine syntax for each: [search-patterns.md](references/search-patterns.md).

## Hybrid search

Combine lexical (BM25) and semantic (vector) retrieval; hybrid usually beats either alone.

| Fusion method | How | When |
|---------------|-----|------|
| Reciprocal Rank Fusion (RRF) | Combine ranks, ignore raw scores | Default — needs no score normalization |
| Weighted combination | Weighted sum of normalized scores | Tuning lexical vs semantic weight; normalize first, raw BM25 and vector scores are not comparable |
| Reranking | A cross-encoder rescores the top N | Highest relevance at extra latency |

1. Start with RRF.
2. Tune weights only with normalized scores and a judged query set — exact identifiers favor lexical, conceptual queries favor vector.
3. Measure NDCG or MRR before and after.

**Embedding model discipline:** record the model and version with every vector; never mix vectors from different models or versions in one index; keep the query encoder (and any query/document prefix) matched to the document encoder; changing the model means re-embedding the whole corpus into a shadow index and evaluating on the same judged queries before switching.

**Vector index choice:** HNSW for high recall at a memory cost; IVF/PQ-style indexes when memory is the constraint. Apply scalar or binary quantization when memory pressure demands it and the engine does not already default to it — measure the recall loss.

## Index correctness

1. **Permission filtering on the server.** Derive tenant and ACL filters from the caller's identity on the server and apply them in every query. Never accept them from the client, and never filter results after retrieval (counts, facets, and pagination leak).
2. **Ordered, versioned sync.** Every index write carries the source's monotonic version (row version, log position); the indexer ignores older versions. Deletes travel as tombstones so a late update cannot resurrect a deleted document.
3. **Reindex without losing writes.** Build the new index, then replay changes made during the build (or dual-write to both indexes) before swapping the alias.
4. **Client keys.** Browsers and apps get search-only keys scoped to their tenant or filter (or short-lived tenant tokens); admin and indexing keys stay on the server.

## Index sync from the source of truth

| Pattern | How | Trade-off |
|---------|-----|-----------|
| Change data capture | Database log → change stream → indexer | Near real time, no app changes; needs streaming infrastructure |
| Application events | App publishes change events → indexer | Simple; every write path must publish (use an outbox for reliability) |
| Periodic full sync | Scheduled bulk reindex | Self-healing; stale between runs, costly at scale |

The application always queries an alias, never a versioned index name, so reindexing can swap atomically. Flow details: [search-patterns.md](references/search-patterns.md#search-pipeline-architecture).

## Relevance tuning

1. **Baseline** — BM25 with default parameters.
2. **Field weights** — title above description above body.
3. **Synonyms and stop words** — domain-specific, language-aware.
4. **Recency decay** — score falls with age (configurable half-life).
5. **Popularity signals** — clicks, purchases, views.
6. **Learning to rank** — models trained on judged or behavioral data (pointwise, pairwise such as LambdaMART, listwise).
7. **Regression suite** — judged queries with expected top results, run on every relevance change.

Evaluate on a broad judged query set; tuning for a handful of pet queries degrades the long tail.

## Autocomplete

- **Suggestion index** — prebuilt suggestions; fastest, least flexible.
- **Prefix n-grams** — index-time edge n-grams; supports fuzzy matching.
- **Prefix query** — no special index; slower on large data.

The client debounces input and cancels stale requests. Request flow: [search-patterns.md](references/search-patterns.md#autocomplete-architecture).

## Multi-language search

| Approach | When | Complexity |
|----------|------|------------|
| Index per language | Different analyzers per language | Medium — route by detected language |
| One index, Unicode-aware analysis | Mixed content, simple needs | Low |
| Multilingual embeddings | Cross-language semantic search | Low, plus embedding cost |

Use language-specific stemmers and stop words; CJK and other scripts without spaces need dedicated tokenization.

## Search analytics

Track zero-result rate, click-through on top results, query latency (p95), abandonment, and popular queries without clicks. Zero-result queries reveal missing synonyms, analyzer gaps, or unindexed fields. Set targets from your own baseline.

## Context Adaptation

- **Small catalog on an existing database** — stay in the database until relevance or scale demands an engine.
- **Multi-tenant** — tenant filter in every query from the server identity; per-tenant indexes when tenants need separate mappings or isolation.
- **High write rate** — batch index writes; decide the acceptable index lag explicitly.
- **Regulated content** — deletion must reach the index and its snapshots; check residency of hosted engines.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| SQL `LIKE '%term%'` for search | No relevance, full scans | Built-in full-text search or an engine |
| No analyzers for user input | Exact match only | Language-aware analysis |
| Full reindex on every update | Load and lag | Incremental updates; alias swap for mapping changes |
| Client-supplied tenant or ACL filter | Users read other tenants' documents | Filters from server-side identity |
| Admin key in client code | Anyone can modify or dump the index | Search-only scoped keys or tenant tokens |
| Unversioned sync writes | Late updates resurrect deleted or newer data | Monotonic versions and tombstones |
| No relevance regression suite | Rankings silently degrade | Judged query set run on every change |
| Unbounded result sets | Memory and latency blowups | Limit results; cursor-based deep pagination |
| Vector-only search | Misses exact identifiers and acronyms | Hybrid with lexical retrieval |
| Mixed embedding models in one index | Distances become meaningless | Record model version; re-embed into a shadow index |
| Weighted fusion of raw scores | Lexical scores dominate unpredictably | RRF, or normalize before weighting |

## Related Knowledge

- **database** — built-in full-text search, vector columns, change data capture sources
- **message-queues** — transport for change events into the indexer
- **auth** — permission model behind result filtering
- **caching** — query and suggestion caching
- **performance** — search latency profiling

## References

- [engine-catalog.md](references/engine-catalog.md) — engine comparison, workload short-list, selection criteria, licensing notes
- [search-patterns.md](references/search-patterns.md) — engine-specific mappings and queries, RRF hybrid examples, reindexing with change replay, sync pipeline, autocomplete flow, relevance test suite
