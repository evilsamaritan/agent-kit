# Search Engine Catalog

Concrete short-lists per workload. Use this as a lookup after choosing a search workload in SKILL.md.

## Contents

- [Engine Comparison](#engine-comparison)
- [Workload-to-Engine Shortlist](#workload-to-engine-shortlist)
- [Scale Thresholds](#scale-thresholds)
- [Notes on Hosting and Licensing](#notes-on-hosting-and-licensing)

---

## Engine Comparison

| Engine | Class | Niche | Typical ceiling | Hosted? |
|---|---|---|---|---|
| Elasticsearch | Distributed Lucene | Large-scale full-text + aggregations, ELK stack | Billions of docs | Elastic Cloud, self-host |
| OpenSearch | Distributed Lucene (AWS fork) | Elasticsearch-compatible, Apache-2.0 license, AWS-native | Billions of docs | AWS OpenSearch Service, self-host |
| Meilisearch | Lightweight | Fast setup, typo tolerance out of the box, developer UX | ~10M docs per node | Meilisearch Cloud, self-host |
| Typesense | Lightweight | Instant-search UX, simple ops, built-in vector support | ~10M docs per node | Typesense Cloud, self-host |
| Algolia | Hosted SaaS | Fastest integration, battle-tested relevance | Millions–billions (SaaS) | Hosted only |
| PostgreSQL tsvector | DB-native | Small-scale full-text on existing Postgres | ~1M docs before pain | With Postgres |
| ParadeDB | DB-native (Postgres extension) | Hybrid full-text + vector inside Postgres | 10M+ docs; depends on Postgres | With Postgres |
| pg_search | DB-native (Postgres extension) | BM25 ranking in Postgres | Similar to ParadeDB | With Postgres |
| Vespa | Distributed hybrid | Large-scale hybrid + ML ranking at serving time | Billions of docs | Vespa Cloud, self-host |
| Qdrant / Weaviate / Milvus | Dedicated vector DB | Embeddings-first semantic, billion-scale vectors | Billions of vectors | SaaS + self-host |
| Orama | WASM / edge | Client-side or edge full-text, < 1M docs | ~1M docs | Embedded |

---

## Workload-to-Engine Shortlist

| Workload (from SKILL.md) | Typical short-list |
|---|---|
| Full-text on existing Postgres, small scale | tsvector (built-in), pg_search |
| Hybrid full-text + vector on Postgres | ParadeDB, pgvector + tsvector |
| Large-scale full-text with aggregations | Elasticsearch, OpenSearch, Vespa |
| Hosted SaaS, fastest integration | Algolia, Meilisearch Cloud, Typesense Cloud |
| Edge / client-side | Orama, Pagefind |
| Embeddings-first semantic | Qdrant, Weaviate, Milvus (or Elasticsearch/Vespa with kNN) |

---

## Scale Thresholds

| Document count | Engine class | Notes |
|---|---|---|
| < 100K | Lightweight engine or DB-native | Single node, sub-50ms latency |
| 100K – 10M | Any engine class works | Choose by feature needs and ops capacity |
| > 10M | Distributed (ES/OS/Vespa) | Sharding, replication, cluster management required |

---

## Notes on Hosting and Licensing

- **Elasticsearch** — SSPL/Elastic License 2.0 since 2021. OpenSearch is the Apache-2.0 fork.
- **OpenSearch** — Apache-2.0. Managed on AWS or self-hosted. Elasticsearch API compatibility is close but diverging over time.
- **Meilisearch / Typesense** — source-available (Meilisearch MIT, Typesense GPL-3.0). Lightweight ops.
- **Algolia** — proprietary SaaS. Pricing scales with operations (search + indexing).
- **Postgres extensions** (ParadeDB, pg_search) — live inside your database; no new infra but share resources with OLTP traffic.
- **Vespa** — Apache-2.0. Heavier to operate; built for large-scale hybrid ranking.
- **Vector DBs** — wide license variation (Qdrant Apache-2.0, Weaviate BSD, Milvus Apache-2.0).
