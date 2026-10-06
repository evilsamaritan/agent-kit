---
name: file-storage
description: "Design file upload, storage, and delivery flows. Use for object storage, signed upload and download URLs, multipart or resumable uploads, upload validation and malware scanning, serving user files safely, image variants, CDN assets, and lifecycle rules."
---

# File Storage

Provider-agnostic upload flows, access control, validation, safe serving, image processing, and lifecycle management for object storage. Determine the provider and SDK version from the project before writing SDK code; signing and checksum behavior differ between SDK versions and S3-compatible stores ([storage-patterns.md](references/storage-patterns.md)).

## Rules

- Buckets are private. Clients reach objects only through short-lived signed URLs or an application route that checks access.
- The server decides the object key and binds it to the authenticated user at URL creation; it never accepts an arbitrary key from the client afterwards.
- Uploaded bytes are untrusted until a server-side step has checked them: size, type by content, and malware scan where required.
- User-uploaded files are served so a browser cannot execute them in your application's origin.

## Scope and boundaries

| Question | Owner |
|---|---|
| Upload flows, signed URLs and policies, validation, scanning, safe serving, image variants, lifecycle, provider choice | this skill |
| Cache-Control policy and CDN purge for assets | `caching` |
| CDN topology, custom domains, TLS | `networking` |
| Header grammar (`Content-Disposition`, `Content-Type`, CSP) | `web` |
| Upload threat model and access-control review | `security` |
| Running validation and processing jobs | `background-jobs` |

## Upload decision tree

```
1. Who sends the bytes?
├── Client-direct to storage with a signed URL or policy → default
│   + no server bandwidth, no proxy hop
│   - validation happens after the upload (quarantine, then promote)
└── Through the server → only when bytes must be inspected or transformed before storage,
    or the client cannot reach storage directly

2. Which mechanism?
├── Small files on stable networks → single signed request
│   (signed POST policy when the provider can enforce a size range; signed PUT otherwise)
├── Large files → multipart (signed part URLs) or the provider's resumable upload
└── Unreliable or mobile networks → resumable protocol (tus or provider resumable API)
```

Part size and count limits are provider facts; check them in [storage-patterns.md](references/storage-patterns.md#multipart--resumable-upload).

## Signed upload flow

```
Client                     Server                          Object Store
  ├─ POST /uploads ────────►│ create pending_upload row        │
  │  {filename, type, size} │ (owner, key, expected type/size, │
  │                         │  expires_at)                     │
  │                         ├─ sign URL or POST policy ───────►│
  │◄── {uploadId, url} ─────┤                                  │
  ├─ PUT/POST bytes ────────┼─────────────────────────────────►│  key under quarantine/
  ├─ POST /uploads/{uploadId}/complete ►│                      │
  │                         ├─ look up pending row for this user
  │                         ├─ HEAD object: size, type ───────►│
  │                         ├─ enqueue validation job          │
  │◄── {status: processing} ┤                                  │
                     Validation job: range-GET first bytes → check signature and dimensions
                     → scan → promote to final key, or delete and record the rejection
```

**Signed URL constraints:**
- Short expiry: minutes for uploads, longer only for downloads that need it.
- Content-Type fixed in the signature where the mechanism supports it (S3 POST policy or signed PUT, GCS signed URL); otherwise set it at promotion from validation.
- **Size limit where the mechanism supports it:** an S3-style presigned POST policy (`content-length-range`) or a GCS signed URL with the `x-goog-content-length-range` header. A presigned PUT or a SAS token cannot express a range: check the size with HEAD after upload and delete or quarantine oversize objects, and keep a bucket-level or lifecycle backstop.
- Conditional create (`If-None-Match: *` or the provider's equivalent) where available, so a retry cannot overwrite another upload.
- Downloads: `Content-Disposition: attachment` unless the type is on the inline allowlist (below).

**Cleanup:** a lifecycle rule deletes objects left in the quarantine prefix and aborts incomplete multipart uploads after a day or so; a job expires `pending_upload` rows never completed.

## Validation

Validate on the client for UX and on the server as the security boundary. For direct uploads the server-side checks run in the validation job against the stored object.

| Check | Client | Server | Why |
|-------|--------|--------|-----|
| Type | `file.type` | Magic bytes from the first bytes of the object; must match the declared and allowed type | Extensions and declared MIME types are spoofable |
| Size | `file.size` | Policy limit where supported; HEAD check always | Storage abuse |
| Filename | Display only | Never used as the key; key = server-generated id | Path traversal, collisions |
| Image dimensions | Optional | Read from the header before decoding; reject above a pixel limit | Decompression bombs |
| Malware | — | Scan in quarantine | Distributing malware to other users |

## Malware scanning

```
Upload → quarantine prefix or bucket → scan triggered by the upload event
  ├── clean → promote to the final key, mark the record available
  ├── infected → delete, record, alert
  └── scanner unavailable or timed out → stay in quarantine (fail closed), retry
```

Prefer the provider's native malware scanning where it exists; otherwise run an event-triggered antivirus scanner (for example ClamAV in a container). Data-classification services that find sensitive data are not malware scanners. Scanning does not replace type validation or safe serving. Per-provider options: [object-storage-providers.md](references/object-storage-providers.md#malware-scanning-options).

## Serving untrusted files

- **Separate origin:** serve user content from a different, cookieless domain (or through signed download URLs on the storage or CDN domain), never from the application's origin.
- **No sniffing:** set `X-Content-Type-Options: nosniff` and an explicit `Content-Type` from validation, not from the upload request.
- **Inline allowlist:** inline only passive types you validated (raster images, video, audio, PDF if accepted). HTML, SVG, XML, and anything unknown are served as `attachment` or converted (SVG rasterized or sanitized).
- **Filenames:** encode `Content-Disposition` per RFC 6266 (`filename*=UTF-8''...` plus an ASCII fallback); never echo raw user filenames into headers.
- **Images:** re-encode user images, strip metadata (EXIF location) unless the product needs it, and bound decode size.
- **Authorization:** private files go through a route that checks access and then issues a short-lived signed URL.

Header examples and image-processing limits: [serving-untrusted-files.md](references/serving-untrusted-files.md).

## Image processing

```
Validated original → queue processing → variants (thumbnail, medium, large) in modern formats
  → store variants → record keys and dimensions → purge or version CDN URLs
```

- **Eager** variants on upload for predictable sizes; **lazy** on first request to save storage; **hybrid** for both.
- Serve the best format per client (AVIF or WebP with a JPEG/PNG fallback) by `Accept` negotiation or the CDN's automatic format conversion.
- Version variant keys (content hash) so they can be cached as immutable; the Cache-Control policy comes from `caching`.

## Choosing object storage

Pick by constraint, not by brand:

- **Lowest-latency reads in one cloud** → that cloud's native object storage.
- **Multi-cloud, or egress cost dominates** → S3-compatible store with low or zero egress fees.
- **Self-hosted or on-premises** → self-hosted S3-compatible store; check its maintenance status and license.
- **Archival** → cold or archive tiers (retrieval fees and delays).
- **CDN-integrated** → storage built into the CDN, or storage with a private-origin CDN.
- **Compliance-bound region** → provider with an in-country region and a signed DPA.

Short-list per constraint: [object-storage-providers.md](references/object-storage-providers.md).

| Tier | Access pattern | Use case |
|------|---------------|----------|
| Hot / Standard | Frequent | Active assets, user uploads |
| Warm / Infrequent | Monthly | Older assets |
| Cold | Quarterly | Compliance snapshots |
| Archive | Yearly | Long-term retention, legal holds |

Lifecycle rules move objects between tiers by age and expire temporary files.

## Access control checklist

- [ ] Buckets private; public access blocked at the account or bucket level
- [ ] CORS allows only the app's origins, the needed methods, and exposes `ETag` for browser multipart uploads
- [ ] Signed URLs short-lived; Content-Type fixed in the signature
- [ ] Size enforced by the signed policy where supported, otherwise by a post-upload HEAD check plus a backstop
- [ ] Keys generated by the server and bound to the user in a pending-upload record
- [ ] Quarantine, validation, and scan before promotion
- [ ] User content served from a separate origin with `nosniff` and attachment for active types
- [ ] Least-privilege credentials (separate read and write roles; upload signer cannot delete)
- [ ] Versioning or backups for data that must survive deletion
- [ ] Lifecycle rules abort incomplete multipart uploads and expire quarantine leftovers

## Context Adaptation

- **User-generated content platform** — quarantine, scanning, safe serving, and abuse reporting are mandatory.
- **Internal or admin-only uploads** — validation still applies; scanning depends on who downloads the files.
- **Mobile clients** — resumable uploads and background transfer; tolerate app restarts mid-upload.
- **Regulated data** — encryption keys, residency, retention, and erasure (including variants, backups, and CDN copies) per `compliance`.
- **Single provider, no plan to switch** — call the SDK through a narrow port owned by the application; add a second implementation only when a second provider is committed.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Trusting declared MIME type or extension | Spoofed files pass | Check magic bytes on the stored object |
| Confirm step that accepts any client-supplied key | Users claim or overwrite others' objects | Pending-upload record bound to the user |
| "Size limit" on a presigned PUT | PUT signatures cannot bound size | Signed POST policy or provider header; HEAD check otherwise |
| Serving uploads from the app origin | Stored XSS through HTML or SVG uploads | Separate cookieless origin, `nosniff`, attachment for active types |
| Files stored in the database | Bloat, slow backups | Object storage + metadata rows |
| Public buckets | Data leaks | Private buckets + signed URLs |
| No malware scanning for shared files | Malware distribution | Quarantine + scan, fail closed |
| Wide storage interface wrapping every provider | Hides conditional writes, policies, multipart specifics | Narrow port with the operations the app uses |
| No lifecycle rules | Orphaned parts and temp files bill forever | Abort and expiry rules |

## Related Knowledge

- **security** — threat model for uploads, access control review
- **caching** — Cache-Control policy and CDN purge for assets and variants
- **networking** — CDN topology and custom domains
- **background-jobs** — validation, scanning, and variant-generation jobs
- **performance** — transfer and image delivery performance
- **compliance** — residency, retention, erasure of stored files

## References

- [storage-patterns.md](references/storage-patterns.md) — signed URLs and POST policies per provider, multipart with streaming and bounded concurrency, tus, conditional writes, CDN setup, image processing, quarantine flow, lifecycle, CORS, validation, provider matrix
- [serving-untrusted-files.md](references/serving-untrusted-files.md) — response headers, inline allowlist, filename encoding, metadata stripping, decompression limits
- [object-storage-providers.md](references/object-storage-providers.md) — provider comparison, use-case shortlist, egress and pricing notes, malware scanning options, compliance
