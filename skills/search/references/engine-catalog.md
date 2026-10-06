# Search Engine Catalog

Concrete short-lists per workload. Use this after choosing a workload in SKILL.md. Product capabilities, editions, and licenses change; verify them for the version you would deploy.

## Contents

- [Engine Comparison](#engine-comparison)
- [Workload-to-Engine Shortlist](#workload-to-engine-shortlist)
- [Selection Criteria](#selection-criteria)
- [Notes on Hosting and Licensing](#notes-on-hosting-and-licensing)

---

## Engine Comparison

| Engine | Class | Niche | Scaling model | Hosted? |
|---|---|---|---|---|
| Elasticsearch | Distributed Lucene | Large-scale full-text, aggregations, logs, hybrid retrievers | Sharded cluster | Vendor cloud, self-host |
| OpenSearch | Distributed Lucene (fork of Elasticsearch 7.10) | Elasticsearch-style API under Apache-2.0 | Sharded cluster | Managed on several clouds, self-host |
| Meilisearch | Lightweight server | Typo tolerance and instant search with little configuration, hybrid search | Single node first; sharding is an enterprise-edition feature | Vendor cloud, self-host |
| Typesense | Lightweight server | Instant search, simple ops, built-in vector search | Raft-replicated cluster, data held in memory | Vendor cloud, self-host |
| Algolia | Hosted service | Fastest integration, mature relevance tooling | Managed | Hosted only |
| PostgreSQL full-text (tsvector) | Built into the database | Full-text next to relational data | Scales with the database | With the database |
| ParadeDB / pg_search | PostgreSQL extension | BM25 ranking and hybrid search inside PostgreSQL | Scales with the database | With the database |
| Vespa | Distributed hybrid engine | Large-scale hybrid retrieval with ML ranking at serving time | Distributed | Vendor cloud, self-host |
| Qdrant, Weaviate, Milvus | Dedicated vector databases | Embeddings-first retrieval, filtering, some hybrid support | Distributed | Vendor cloud, self-host |
| Orama | Embedded / WASM | Client-side or edge full-text and vector search | In process | Embedded, optional cloud |
| Pagefind | Static index | Search for static sites, index built at deploy time, loaded in chunks | Static files | None needed |

---

## Workload-to-Engine Shortlist

| Workload (from SKILL.md) | Typical short-list |
|---|---|
| Full-text on an existing relational database | PostgreSQL full-text, pg_search; MySQL `FULLTEXT` for simple cases |
| Hybrid full-text + vector in the database | ParadeDB / pg_search with pgvector, or tsvector with pgvector |
| Large-scale full-text with aggregations | Elasticsearch, OpenSearch, Vespa |
| Instant search, little ops capacity | Meilisearch, Typesense, Algolia |
| Static site or client-side | Pagefind, Orama |
| Embeddings-first semantic retrieval | Qdrant, Weaviate, Milvus, or Elasticsearch/OpenSearch/Vespa kNN |

---

## Selection Criteria

Document counts alone do not decide the engine; capacity depends on document size, field count, ranking features, RAM, and write rate. Benchmark with your own documents and queries. Decide on:

| Criterion | Points toward |
|---|---|
| Aggregations, analytics, or log search over large data | Distributed Lucene-class engine |
| High sustained write rate or very large corpora | Sharded engine; plan index lag explicitly |
| Small team, little ops capacity | Hosted service or a lightweight server |
| Typo tolerance and instant search out of the box | Lightweight server or hosted service |
| Fine ranking control, learning to rank | Lucene-class engine or Vespa |
| Hybrid lexical + vector in one query | Engines with built-in rank fusion, or the database with both extensions |
| Data residency or air-gapped deployment | Self-hosted engine in the required region |
| Search over data already in the database, modest relevance needs | Built-in full-text first; move out when relevance or load requires it |

---

## Notes on Hosting and Licensing

License terms for search engines have changed several times; check the current license and edition terms before choosing.

- **Elasticsearch** — offered under Elastic License 2.0 and SSPL since 2021, with AGPL added as a third option (announced August 2024); some features depend on the subscription tier. **OpenSearch** — Apache-2.0.
- **Meilisearch** — community edition under MIT; some features (for example sharding) ship only in an enterprise edition under a commercial or Business Source License 1.1 that forbids production use without an agreement. **Typesense** — GPL-3.0.
- **Algolia** — proprietary service; pricing scales with search and indexing operations.
- **PostgreSQL extensions** — ParadeDB Community (pg_search) is AGPL-3.0, with a commercial enterprise edition; check each extension's license. They run inside the database; no new infrastructure, but they share resources with transactional traffic. Check whether your managed database offers the extension.
- **Vespa** — Apache-2.0; heavier to operate.
- **Vector databases** — licenses vary by product (several are Apache-2.0 or BSD); hosted tiers differ in features.
