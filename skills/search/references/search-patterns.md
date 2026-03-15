# Search Patterns — Engine-Specific Deep Dive

## Contents

- [Elasticsearch](#elasticsearch) — Index mapping, bool query, hybrid search, zero-downtime reindexing
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
      "price": { "type": "float" },
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

### Hybrid Search (Text + Vector)

```json
{
  "query": {
    "bool": {
      "should": [
        {
          "multi_match": {
            "query": "comfortable walking shoes",
            "fields": ["title^2", "description"],
            "boost": 0.7
          }
        },
        {
          "knn": {
            "field": "embedding",
            "query_vector": [0.12, -0.34, 0.56],
            "num_candidates": 100,
            "boost": 0.3
          }
        }
      ]
    }
  }
}
```

### Zero-Downtime Reindexing

```bash
# 1. Create new index with updated mapping
PUT /products-v2 { "mappings": { ... } }

# 2. Reindex from old to new
POST /_reindex
{ "source": { "index": "products-v1" }, "dest": { "index": "products-v2" } }

# 3. Swap alias atomically
POST /_aliases
{
  "actions": [
    { "remove": { "index": "products-v1", "alias": "products" } },
    { "add":    { "index": "products-v2", "alias": "products" } }
  ]
}
# Application always queries "products" alias — no downtime
```

---

## Meilisearch

### Quick Setup

```typescript
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({ host: 'http://localhost:7700', apiKey: 'masterKey' });

// Create index and configure
const index = client.index('products');
await index.updateSettings({
  searchableAttributes: ['title', 'description', 'brand'],
  filterableAttributes: ['category', 'price', 'in_stock'],
  sortableAttributes: ['price', 'created_at'],
  rankingRules: [
    'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'
  ],
  typoTolerance: {
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 }
  }
});

// Add documents
await index.addDocuments(products); // auto-batched

// Search with filters and facets
const results = await index.search('running shoes', {
  filter: ['category = "footwear"', 'price >= 50', 'price <= 200'],
  facets: ['category', 'brand'],
  limit: 20,
  offset: 0,
  attributesToHighlight: ['title', 'description'],
});
```

### Meilisearch vs Elasticsearch Decision

| Scenario | Choose Meilisearch | Choose Elasticsearch |
|----------|-------------------|---------------------|
| Simple product search | Yes | Overkill |
| Typo-tolerant by default | Yes (zero config) | Requires fuzzy config |
| Complex aggregations | No (basic facets only) | Yes |
| Log analytics | No | Yes (ELK stack) |
| > 10M documents | No | Yes |
| Vector search | Built-in (hybrid) | Production-ready |

---

## Typesense

### Setup and Search

```typescript
import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{ host: 'localhost', port: 8108, protocol: 'http' }],
  apiKey: 'xyz',
});

// Create collection (schema required)
await client.collections().create({
  name: 'products',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'price', type: 'float', facet: true },
    { name: 'category', type: 'string', facet: true },
    { name: 'embedding', type: 'float[]', num_dim: 384 },
  ],
  default_sorting_field: 'popularity_score',
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
Pattern 1: Change Data Capture (recommended)
  DB → CDC (Debezium) → Kafka → Search Indexer → Elasticsearch
  + Real-time, reliable, no application changes
  - Requires Kafka infrastructure

Pattern 2: Application-Level Events
  Application → Event Bus → Search Indexer → Elasticsearch
  + Simple, no infrastructure overhead
  - Must instrument every write path, risk of missed updates

Pattern 3: Periodic Full Sync
  DB → Cron Job → Bulk Index → Elasticsearch
  + Simple, self-healing
  - Stale data between syncs, expensive for large datasets
```

### Autocomplete Architecture

```
User types "run" →
  1. Frontend: debounce 200ms
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
      expectedTopIds: ['nike-red-runner', 'adidas-red-boost'],
      mustNotAppear: ['blue-dress-shoes'],
    },
    {
      query: 'iphone case',
      expectedTopIds: ['iphone-15-case', 'iphone-14-case'],
      mustNotAppear: ['android-case'],
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
