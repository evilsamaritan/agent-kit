# Object Storage Providers

Short-list of object storage providers mapped to the use-case decisions taught in SKILL.md. Use this when you need concrete names; pick the pattern first.

## Contents

- [Provider Comparison](#provider-comparison)
- [Use-Case Shortlist](#use-case-shortlist)
- [Notes on Egress and Pricing](#notes-on-egress-and-pricing)
- [Compliance and Data Residency](#compliance-and-data-residency)

---

## Provider Comparison

| Provider | Type | S3-compatible | Egress | Strengths | Trade-offs |
|---|---|---|---|---|---|
| AWS S3 | Hyperscaler native | Native (canonical API) | Paid | Deepest IAM/Lambda integration, widest tier set (Standard, IA, Glacier, Express One Zone) | Expensive egress, vendor lock on IAM/triggers |
| Google Cloud Storage (GCS) | Hyperscaler native | Interop API (partial) | Paid | Resumable uploads, BigQuery/Firebase integration | Egress cost; interop limited vs native GCS API |
| Azure Blob Storage | Hyperscaler native | No (AzCopy/Blob API) | Paid | Entra ID integration, Functions triggers, hot/cool/archive tiers | Not S3-compatible out of the box |
| Cloudflare R2 | Edge object store | Yes | Zero | Zero egress, Workers integration, built-in CDN | Newer, smaller tooling ecosystem |
| Backblaze B2 | Independent | Yes | Low / free via CF partners | Cheapest storage, simple pricing | Fewer integrations, single region class |
| MinIO | Self-hosted | Yes | Your infra | On-prem S3 API, K8s-native, air-gap deployments | You run it — ops overhead, durability is on you |
| Tigris | Multi-region object store | Yes | Low | Globally replicated S3 API, edge-close writes | Newer; fewer native integrations |

---

## Use-Case Shortlist

| Pattern (from SKILL.md) | Typical short-list |
|---|---|
| Lowest-latency reads in one cloud | AWS S3, GCS, Azure Blob (match the cloud of compute) |
| Multi-cloud / avoid egress fees | Cloudflare R2, Backblaze B2 (often paired with Cloudflare CDN) |
| Self-hosted / on-prem | MinIO, Ceph RGW |
| Archival / cold | S3 Glacier, GCS Archive, Azure Archive |
| CDN-integrated | Cloudflare R2 (Workers + CDN), or AWS S3 + CloudFront, or GCS + Cloud CDN |
| Compliance-bound region | Hyperscaler local region (AWS, Azure, GCP) with BAA/DPA; sovereign-cloud partners |

---

## Notes on Egress and Pricing

- Egress cost often dominates total spend for read-heavy workloads. If > ~10% of stored bytes leave the cloud monthly, model zero-egress providers first.
- Lifecycle rules (hot → IA → cold → archive) can cut storage cost 70%+ on aging data, but retrieval fees on cold tiers can be painful for unexpected re-reads.
- Multipart upload abort rules are critical — orphaned parts accumulate and bill indefinitely.

---

## Compliance and Data Residency

- Hyperscalers publish BAA, HIPAA, SOC 2, ISO 27001 attestations per region.
- Independent providers (R2, B2) publish narrower scopes — check your compliance framework before choosing.
- For EU/UK data sovereignty, confirm the bucket region is in-country and that the provider offers a signed DPA.
- Self-hosted (MinIO) shifts compliance burden fully to you — you own encryption at rest, audit logs, key rotation.
