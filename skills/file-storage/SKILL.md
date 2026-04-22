---
name: file-storage
description: File storage expertise — upload flows, signed URLs, multipart upload, CDN integration, image processing. Use when implementing file uploads, object storage, presigned URLs, multipart uploads, CDN asset delivery, or virus scanning. Do NOT use for database storage (use database) or caching (use caching).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# File Storage — Object Storage & Asset Pipeline

Provider-agnostic expertise: upload flows, access control, CDN integration, image processing, and lifecycle management for any object storage backend.

---

## Upload Pattern Decision Tree

```
File size?
├── < 5 MB → Simple PUT (single request)
├── 5–100 MB → Signed URL (client-direct to storage)
└── > 100 MB → Multipart or resumable upload
    ├── Browser? → Chunked upload via signed parts or tus protocol
    └── Server? → SDK multipart upload

Who uploads?
├── Client-direct (signed URL) → Default for most cases
│   + No server bandwidth cost
│   + Lower latency (no proxy hop)
│   - Requires signed URL endpoint
└── Server-proxy → Only when pre-storage processing is required
    + Inline validation/transformation
    - Server becomes bandwidth bottleneck

Resumable needed?
├── Unreliable network / mobile → tus protocol or provider resumable API
└── Stable connection → Standard multipart with retry per part
```

---

## Signed URL Flow (All Providers)

```
Client                    Server                    Object Store
  │                         │                             │
  ├─ POST /uploads ────────►│                             │
  │  { filename, type }     ├─ generateSignedUrl() ──────►│
  │                         │◄─── signed URL ─────────────┤
  │◄─── { url, key } ──────┤                             │
  │                         │                             │
  ├─ PUT signed URL ────────┼────────────────────────────►│
  │  (file bytes)           │                             │
  │◄─── 200 OK ────────────┼─────────────────────────────┤
  │                         │                             │
  ├─ POST /uploads/confirm ►│                             │
  │  { key }                ├─ headObject(key) ──────────►│
  │                         │◄─── metadata ───────────────┤
  │◄─── { url, metadata } ──┤                             │
```

**Signed URL security constraints** — enforce ALL in the signed URL conditions:
- Short expiry (5-15 min for upload, 1-4 hr for download)
- Content-Type restriction (prevent executable uploads)
- Content-Length range (min 1 byte, max per category)
- Content-Disposition for downloads (prevent inline rendering of untrusted files)
- Conditional writes (If-None-Match) to prevent overwrites in concurrent systems

---

## Image Processing Pipeline

```
Upload → Validate → Store Original → Queue Processing → Generate Variants
                                          │
                                ┌─────────┼──────────┐
                                ▼         ▼          ▼
                           thumbnail   medium    AVIF/WebP
                           200x200    800x600    optimized
                                          │
                                     Store variants
                                     Invalidate CDN
                                     Update DB record
```

**Format strategy (serve best format per browser):**
- AVIF — best compression (~50% smaller than WebP), 92%+ browser support
- WebP — universal fallback, good compression, fast encode
- JPEG/PNG — legacy fallback only
- Generate AVIF + WebP + original format; serve via Accept header or CDN auto-format

**Variant generation strategies:**
- **Eager:** Generate on upload (predictable sizes, fast delivery)
- **Lazy:** Generate on first request (save storage, slower first hit)
- **Hybrid:** Common sizes eagerly, rare sizes lazily

---

## Choosing object storage

Pick by constraint, not by brand:

- **Lowest-latency reads in one cloud** → native bucket (same cloud as compute).
- **Multi-cloud / avoid egress fees** → S3-compatible edge object store with zero egress (see references).
- **Self-hosted / on-prem** → S3-compatible open-source server.
- **Archival / cold** → per-cloud cold tier (infrequent access, glacier-class).
- **CDN-integrated** → CDN-native object store (fewer hops, unified cache).
- **Compliance-bound region** → provider with local region + BAA / DPA.

Short-list per path: [object-storage-providers.md](references/object-storage-providers.md).

### Storage Tiers (All Major Providers)

| Tier | Access Pattern | Use Case |
|------|---------------|----------|
| Hot / Standard | Frequent | Active assets, user uploads |
| Warm / Infrequent Access | Monthly | Older assets, less-accessed media |
| Cold | Quarterly | Compliance snapshots, audit logs |
| Archive | Yearly | Long-term retention, legal holds |

Configure lifecycle rules to auto-transition objects between tiers based on age.

---

## Access Control Checklist

- [ ] Buckets/containers private by default (no public access)
- [ ] CORS configured for direct-upload domains only
- [ ] Signed URLs have short expiry (5-15 min upload)
- [ ] Content-Type restricted in signed URL conditions
- [ ] Content-Length limited in signed URL conditions
- [ ] IAM/RBAC follows least privilege (separate read/write roles)
- [ ] Versioning enabled for critical data
- [ ] Conditional writes enabled to prevent race conditions
- [ ] Abort lifecycle rule for incomplete multipart uploads

---

## File Validation

Validate on BOTH client and server. Server validation is the security boundary.

| Check | Client | Server | Why |
|-------|--------|--------|-----|
| MIME type | `file.type` | Magic bytes (file signature) | MIME from extension is spoofable |
| File size | `file.size` | Content-Length + signed URL limit | Prevent storage abuse |
| Filename | Sanitize special chars | Re-sanitize + UUID prefix | Path traversal prevention |
| Dimensions (images) | Optional | Decode header only | Prevent pixel-bomb DoS |
| Virus scan | N/A | ClamAV or cloud-native scanner | Malware distribution prevention |

---

## Virus Scanning

**Pattern:** Scan in a quarantine zone before moving to final storage.

```
Upload → Quarantine bucket → Scan → Clean? → Move to production bucket
                                  → Infected? → Delete + alert + log
```

**Cloud-native options** (prefer over self-hosted when available):
- AWS: GuardDuty Malware Protection for S3
- Azure: Defender for Storage (agentless, on-upload scanning)
- GCP: Cloud DLP + custom scanning pipeline via Cloud Functions
- Self-hosted: ClamAV daemon (any provider, any storage)

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| No file type validation | Upload of executables, scripts | Validate MIME type AND magic bytes |
| Storing files in database | DB bloat, slow queries, backup pain | Object storage + DB metadata only |
| No upload size limits | Storage exhaustion, abuse | Enforce limits in signed URL + server |
| Public buckets/containers | Data leaks, compliance violations | Private storage + signed URLs |
| No virus scanning | Malware distribution to other users | Quarantine + scan before production |
| Serving without CDN | High latency, high egress cost | CDN with proper cache headers |
| Provider lock-in in app code | Painful migration | Abstract behind storage interface |
| No lifecycle rules | Unbounded storage cost growth | Auto-tier + auto-expire temp files |
| Trusting client-side MIME type | MIME spoofing bypasses validation | Always verify magic bytes server-side |
| No abort rule for multipart | Orphaned parts accumulate cost | Lifecycle rule to abort stale uploads |

---

## Context Adaptation

**Backend developer** — Focus on: signed URL endpoint, file validation, storage abstraction interface, virus scanning integration, multipart upload orchestration.

**Frontend developer** — Focus on: chunked upload with progress, drag-and-drop UX, image preview before upload, retry on failure, format negotiation via Accept header.

**DevOps / Infrastructure** — Focus on: bucket policies, lifecycle rules, CDN origin setup, CORS configuration, monitoring storage costs, replication for DR.

**Security engineer** — Focus on: signed URL constraints, Content-Disposition headers, virus scanning pipeline, access logging, encryption at rest/in transit.

---

## Related Knowledge

- **security** — signed URL hardening, access control, virus scanning
- **caching** — CDN integration, cache headers for static assets
- **backend** — upload endpoint implementation, background image processing
- **performance** — image optimization, CDN tuning, transfer acceleration
- **compliance** — data residency, retention policies, GDPR right to erasure for stored files

---

## References

- [object-storage-providers.md](references/object-storage-providers.md) — Provider comparison, use-case shortlist, egress/pricing notes, compliance considerations
- [storage-patterns.md](references/storage-patterns.md) — Signed URL generation, multipart upload, CDN setup, image processing, lifecycle policies (multi-provider examples)

Load references when implementing SDK code, CDN configuration, image processing pipelines, or picking a provider short-list.
