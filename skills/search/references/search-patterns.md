# Search Patterns — Engine-Specific Deep Dive

Syntax examples for specific engines. Check the engine and client version in the project first; APIs below follow current documentation for each engine's recent major version.

## Contents

- [Elasticsearch](#elasticsearch) — Index mapping, bool query, RRF hybrid search, reindexing with change replay
- [Meilisearch](#meilisearch) — Quick setup, search with filters and facets
- [Typesense](#typesense) — Collection schema, vector search
- [Search Pipeline Architecture](#search-pipeline-architecture) — DB-to-search sync, autocomplete, relevance test suite

---

## Elasticsearch

### Index Mapping Template

```json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "autocomplete_tokenizer",
          "filter": ["lowercase"]
        },
        "search_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stemmer"]
        }
      },
      "tokenizer": {
        "autocomplete_tokenizer": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 15,
          "token_chars": ["letter", "digit"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "search_analyzer",
        "fields": {
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "standard"
          },
          "keyword": { "type": "keyword" }
        }
      },
      "description": { "type": "text", "analyzer": "search_analyzer" },
      "category": { "type": "keyword" },
      "price": { "type": "scaled_float", "scaling_factor": 100 },
      "created_at": { "type": "date" },
      "embedding": {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      }
    }
  }
}
```

### Bool Query (Combined Filters + Full-Text)

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "running shoes",
            "fields": ["title^3", "description^1.5", "brand"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        }
      ],
      "filter": [
        { "term": { "category": "footwear" } },
        { "range": { "price": { "gte": 50, "lte": 200 } } },
        { "term": { "in_stock": true } }
      ],
      "should": [
        { "term": { "featured": { "value": true, "boost": 2.0 } } }
      ]
    }
  },
  "highlight": {
    "fields": { "title": {}, "description": {} },
    "pre_tags": ["<mark>"],
    "post_tags": ["</mark>"]
  },
  "aggs": {
    "categories": { "terms": { "field": "category", "size": 20 } },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 50 },
          { "from": 50, "to": 100 },
          { "from": 100, "to": 200 },
          { "from": 200 }
        ]
      }
    }
  }
}
```

### Hybrid Search (Text + Vector) with RRF

Rank fusion through the `rrf` retriever of the Elasticsearch retrievers API (generally available in current Elastic Stack releases; `rank_constant` defaults to 60 and `rank_window_size` to 10, so set the window explicitly). Older clusters may not have it.

```json
{
  "retriever": {
    "rrf": {
      "retrievers": [
        {
          "standard": {
            "query": {
              "bool": {
                "must": { "multi_match": { "query": "comfortable walking shoes", "fields": ["title^2", "description"] } },
                "filter": [ { "term": { "tenant_id": "t-42" } } ]
              }
            }
          }
        },
        {
          "knn": {
            "field": "embedding",
            "query_vector": [0.12, -0.34, 0.56],
            "k": 50,
            "num_candidates": 200,
            "filter": { "term": { "tenant_id": "t-42" } }
          }
        }
      ],
      "rank_window_size": 50,
      "rank_constant": 60
    }
  }
}
```

The tenant filter is applied inside both retrievers and comes from the server-side identity, never from the request body.

**Weighted variant (tuning only):** a weighted sum of scores (for example a `linear` retriever with per-retriever weights and score normalization, or boosts in a `bool` query) is valid only after scores are normalized to a common range; raw BM25 and vector similarity are not comparable. Prefer RRF until a judged query set shows that weighting helps.

### Zero-Downtime Reindexing

```bash
# 1. Record the change-stream position (or start dual-writing to both indexes)
# 2. Create the new index with the updated mapping
PUT /products-v2 { "mappings": { ... } }

# 3. Copy existing documents
POST /_reindex
{ "source": { "index": "products-v1" }, "dest": { "index": "products-v2" } }

# 4. Replay changes made since step 1 into products-v2 (versioned writes, tombstones for deletes)

# 5. Swap the alias atomically
POST /_aliases
{
  "actions": [
    { "remove": { "index": "products-v1", "alias": "products" } },
    { "add":    { "index": "products-v2", "alias": "products" } }
  ]
}
# Keep products-v1 until the new index is verified, then delete it
```

Without step 4 (or dual writes), every write made during the copy is lost after the swap. Index with external versioning (`version_type=external` with the source's version) so a replayed older change cannot overwrite a newer one.

---

## Meilisearch

### Quick Setup

```typescript
// Server side only: the admin key never reaches a browser or app
import { Meilisearch } from 'meilisearch';

const client = new Meilisearch({ host: process.env.MEILI_HOST!, apiKey: process.env.MEILI_ADMIN_KEY! });

// Create index and configure
const index = client.index('products');
await index.updateSettings({
  searchableAttributes: ['title', 'description', 'brand'],
  filterableAttributes: ['category', 'price', 'in_stock'],
  sortableAttributes: ['price', 'created_at'],
  rankingRules: [
    'words', 'typo', 'proximity', 'attributeRank', 'sort', 'wordPosition', 'exactness'   // the defaults, in order
  ],
  typoTolerance: {
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 }
  }
});

// Add documents (asynchronous task; wait for it before relying on the result)
await index.addDocuments(products);

// Search with filters and facets
const results = await index.search('running shoes', {
  filter: ['category = "footwear"', 'price >= 50', 'price <= 200'],
  facets: ['category', 'brand'],
  limit: 20,
  offset: 0,
  attributesToHighlight: ['title', 'description'],
});
```

Clients that query directly get a search-only API key or a short-lived tenant token whose search rules embed the tenant filter; the server generates the token from the caller's identity.

### Meilisearch vs Elasticsearch Decision

| Scenario | Choose Meilisearch | Choose Elasticsearch |
|----------|-------------------|---------------------|
| Simple product search | Yes | Overkill |
| Typo-tolerant by default | Yes (zero config) | Requires fuzzy config |
| Complex aggregations | No (basic facets only) | Yes |
| Log analytics | No | Yes (ELK stack) |
| Very large corpora, heavy write rate, sharding | Check limits for your data and hardware | Yes |
| Vector / hybrid search | Built-in (hybrid) | Built-in (kNN, retrievers) |

---

## Typesense

### Setup and Search

```typescript
import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST!, port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_ADMIN_KEY!,   // server side only; clients get scoped search keys
});

// Create collection (schema required)
await client.collections().create({
  name: 'products',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'price', type: 'float', facet: true },
    { name: 'category', type: 'string', facet: true },
    { name: 'popularity_score', type: 'int32' },
    { name: 'embedding', type: 'float[]', num_dim: 384 },
  ],
  default_sorting_field: 'popularity_score',   // must be a numeric field declared above
});

// Search with vector
const results = await client.collections('products').documents().search({
  q: 'comfortable shoes',
  query_by: 'title,description',
  filter_by: 'price:>=50 && price:<=200',
  facet_by: 'category',
  vector_query: 'embedding:([], k:10)', // auto-embed if configured
});
```

---

## Search Pipeline Architecture

### DB-to-Search Sync Patterns

```
Pattern 1: Change Data Capture
  DB log → CDC connector → stream (topic) → indexer → search index
  + Near real time, captures every write path, carries log positions for versioning
  - Requires streaming infrastructure

Pattern 2: Application-Level Events (through an outbox)
  App writes row + outbox record in one transaction → relay → indexer → search index
  + No CDC infrastructure
  - Every write path must record the event

Pattern 3: Periodic Full Sync
  Scheduler → bulk read → bulk index into a new index → alias swap
  + Simple, self-healing
  - Stale between runs, expensive for large datasets

Indexer rules for all patterns:
  - write with the source version; skip if the indexed version is newer
  - apply deletes as tombstones (versioned deletes), not by absence
  - retry failed batches; dead-letter documents that fail mapping
```

### Autocomplete Architecture

```
User types "run" →
  1. Client: debounce ~200 ms, cancel the previous in-flight request
  2. Request: GET /search/suggest?q=run
  3. Backend: query edge_ngram or completion suggester
  4. Response: [
       { text: "running shoes", category: "footwear", count: 1234 },
       { text: "running shorts", category: "apparel", count: 567 }
     ]
  5. Frontend: render dropdown grouped by category
  6. User selects → full search with selected term
```

### Relevance Test Suite

```typescript
// test/relevance.test.ts
describe('search relevance', () => {
  const relevanceTests = [
    {
      query: 'red running shoes',
      expectedTopIds: ['sku-red-runner-01', 'sku-red-trail-02'],
      mustNotAppear: ['sku-blue-dress-shoe'],
    },
    {
      query: 'reset password',              // docs search
      expectedTopIds: ['doc-account-recovery'],
      mustNotAppear: ['doc-password-policy-admin'],
    },
  ];

  for (const test of relevanceTests) {
    it(`"${test.query}" returns expected results`, async () => {
      const results = await searchIndex.search(test.query, { limit: 10 });
      const topIds = results.hits.map(h => h.id);

      for (const expected of test.expectedTopIds) {
        expect(topIds).toContain(expected);
      }
      for (const forbidden of test.mustNotAppear) {
        expect(topIds).not.toContain(forbidden);
      }
    });
  }
});
```
