# Storage Patterns — Multi-Provider SDK & Architecture Reference

Code samples use the TypeScript SDKs to show request shapes; the same operations exist in every official SDK (Go, Python, Java, .NET). Check the SDK version in the project: signing helpers, checksum defaults, and option names change between versions.

## Table of Contents

- [Storage Port](#storage-port)
- [Signed URL Generation](#signed-url-generation)
- [Multipart / Resumable Upload](#multipart--resumable-upload)
- [tus Protocol (Resumable Uploads)](#tus-protocol-resumable-uploads)
- [Conditional Writes](#conditional-writes)
- [CDN Setup Patterns](#cdn-setup-patterns)
- [Image Processing Pipeline](#image-processing-pipeline)
- [Virus Scanning](#virus-scanning)
- [Lifecycle Policies](#lifecycle-policies)
- [CORS Configuration](#cors-configuration)
- [File Validation](#file-validation)
- [Provider Feature Matrix](#provider-feature-matrix)

---

## Storage Port

Keep provider calls behind a narrow port owned by the application, exposing only the operations the app uses. Add a second implementation when a second provider is committed, not in advance; a lowest-common-denominator interface over every provider hides conditional writes, POST policies, and multipart specifics.

```typescript
interface UploadStore {
  createUpload(input: { key: string; contentType: string; maxBytes: number }): Promise<SignedUpload>;
  head(key: string): Promise<{ size: number; contentType: string; etag: string } | null>;
  readRange(key: string, start: number, end: number): Promise<Uint8Array>;
  openReadStream(key: string): Promise<NodeJS.ReadableStream>;
  promote(fromKey: string, toKey: string, headers: StoredHeaders): Promise<void>;
  remove(key: string): Promise<void>;
  downloadUrl(key: string, disposition: string, ttlSeconds: number): Promise<string>;
}
```

---

## Signed URL Generation

### Pending-Upload Record

```typescript
async function createUpload(userId: string, contentType: string, size: number, category: Category) {
  const rules = ALLOWED_TYPES[category];
  if (!rules.mime.includes(contentType) || size > rules.maxSize) throw new BadRequest();

  const uploadId = randomUUID();
  const key = `quarantine/${uploadId}`;                 // server-generated; original name kept as metadata
  await db.pendingUploads.insert({ uploadId, userId, key, contentType, maxSize: rules.maxSize,
                                   expiresAt: addMinutes(new Date(), 15) });
  return { uploadId, ...(await store.createUpload({ key, contentType, maxBytes: rules.maxSize })) };
}

async function completeUpload(userId: string, uploadId: string) {
  const pending = await db.pendingUploads.find({ uploadId, userId });   // never a client-supplied key
  if (!pending || pending.expiresAt < new Date()) throw new NotFound();
  const head = await store.head(pending.key);
  if (!head || head.size > pending.maxSize) { await store.remove(pending.key); throw new BadRequest(); }
  await jobs.enqueue('validate-upload', { uploadId });    // magic bytes, scan, then promote
}
```

### S3 (AWS SDK v3) — Presigned POST with a Size Range

A presigned POST policy can enforce a size range and exact field values; a presigned PUT cannot bound the size.

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const { url, fields } = await createPresignedPost(s3, {
  Bucket: process.env.BUCKET!,
  Key: key,
  Conditions: [
    ['content-length-range', 1, maxBytes],
    ['eq', '$Content-Type', contentType],
  ],
  Fields: { 'Content-Type': contentType },
  Expires: 600,                                   // seconds
});
// Client sends multipart/form-data: all `fields`, then the file field last.
```

### S3 — Presigned PUT and Download URL

```typescript
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// PUT: Content-Type is signed; size is NOT enforced — HEAD-check after upload
const url = await getSignedUrl(s3, new PutObjectCommand({
  Bucket: process.env.BUCKET, Key: key, ContentType: contentType,
}), { expiresIn: 600 });

// Download with a safe Content-Disposition (see serving-untrusted-files.md)
const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({
  Bucket: process.env.BUCKET, Key: key,
  ResponseContentDisposition: contentDisposition(originalName),
}), { expiresIn: 3600 });
```

### GCS (Google Cloud Storage)

```typescript
import { Storage } from '@google-cloud/storage';

const gcs = new Storage();
const bucket = gcs.bucket(process.env.BUCKET);

// Upload URL with a signed size range: the client must send the same header
const [url] = await bucket.file(key).getSignedUrl({
  version: 'v4', action: 'write', expires: Date.now() + 10 * 60 * 1000,
  contentType,
  extensionHeaders: { 'x-goog-content-length-range': `1,${maxBytes}` },
});

// Download URL
const [downloadUrl] = await bucket.file(key).getSignedUrl({
  version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000,
  responseDisposition: contentDisposition(originalName),
});
```

### Azure Blob Storage — User Delegation SAS

Prefer a user delegation SAS (signed with an Entra ID identity) over an account-key SAS; it can be revoked by revoking the delegation key and needs no account key in the app. SAS tokens cannot bound the upload size or fix the uploaded Content-Type: HEAD-check after upload and set the blob's Content-Type from the validated type at promotion.

```typescript
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const account = process.env.AZURE_STORAGE_ACCOUNT!;
const blobService = new BlobServiceClient(`https://${account}.blob.core.windows.net`, new DefaultAzureCredential());

const startsOn = new Date(Date.now() - 60 * 1000);
const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
const delegationKey = await blobService.getUserDelegationKey(startsOn, expiresOn);

const sas = generateBlobSASQueryParameters({
  containerName: process.env.CONTAINER!, blobName: key,
  permissions: BlobSASPermissions.parse('cw'),       // create + write; 'r' for download
  startsOn, expiresOn,
}, delegationKey, account).toString();
const url = `${blobService.getContainerClient(process.env.CONTAINER!).getBlockBlobClient(key).url}?${sas}`;
```

### R2 (Cloudflare) — S3-Compatible

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 uses S3 SDK with custom endpoint
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY, secretAccessKey: process.env.R2_SECRET_KEY },
});

// Same API as S3
const command = new PutObjectCommand({ Bucket: process.env.BUCKET, Key: key, ContentType: contentType });
const url = await getSignedUrl(r2, command, { expiresIn: 600 });
```

**Checksum compatibility (SDK-version dependent):** AWS SDK for JavaScript v3 since 3.729.0 enables integrity checksums on uploads and validation on downloads by default. Some S3-compatible stores and some presigned-URL flows reject or mis-handle them. For non-AWS endpoints, set the client's checksum calculation and validation to "when required" (`requestChecksumCalculation: 'WHEN_REQUIRED'`, `responseChecksumValidation: 'WHEN_REQUIRED'` in the JS SDK) or test the presigned flow against the target provider. If the client does send a checksum header, it must be part of the signature. Check which features the S3-compatible store implements: R2 supports presigned PUT but not presigned POST policies, so enforce size by HEAD check after upload there.

---

## Multipart / Resumable Upload

Part limits are provider facts (for S3: parts of 5 MiB to 5 GiB except the last, at most 10,000 parts; others differ — check the provider). Pick a part size so the largest expected file fits within the part-count limit.

### Server-Side Upload: Stream with Bounded Concurrency

Never load a large file into one `Buffer` or start every part at once. The SDK's managed uploader streams the input and bounds parallel parts:

```typescript
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'node:fs';

const upload = new Upload({
  client: s3,
  params: { Bucket: bucket, Key: key, Body: createReadStream(path), ContentType: contentType },
  partSize: 16 * 1024 * 1024,      // bytes per part
  queueSize: 4,                     // parts in flight
  leavePartsOnError: false,         // abort the multipart upload on failure
});
upload.on('httpUploadProgress', (p) => report(p.loaded, p.total));
await upload.done();
```

Hand-rolled multipart follows the same shape: read the source part by part, keep at most N parts in flight, record `{ PartNumber, ETag }`, complete with parts sorted by number, and abort the upload on failure.

### GCS — Resumable Upload

```typescript
const file = bucket.file(key);
const stream = file.createWriteStream({
  resumable: true, contentType,
  metadata: { cacheControl: 'public, max-age=31536000' },
});
// Stream supports automatic retry and resume on failure
await pipeline(readableSource, stream);
```

### Azure — Block Blob Upload

```typescript
const blob = container.getBlockBlobClient(key);
await blob.uploadStream(readableSource,
  8 * 1024 * 1024,                  // block (buffer) size
  4,                                // blocks in flight
  { blobHTTPHeaders: { blobContentType: contentType } },
);
```

### Browser Chunked Upload with Signed Parts (S3-compatible)

The browser uploads each part to its signed URL and must read the `ETag` response header to complete the upload, so the bucket CORS rule has to expose `ETag`. Sign part URLs for the pending upload only, with a part count derived from the declared size and the part size.

```typescript
// Server: generate signed URLs for each part
async function createMultipartSignedUrls(key: string, parts: number) {
  const { UploadId } = await client.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: key })
  );
  const urls = await Promise.all(
    Array.from({ length: parts }, async (_, i) => ({
      partNumber: i + 1,
      url: await getSignedUrl(client,
        new UploadPartCommand({ Bucket: bucket, Key: key, UploadId, PartNumber: i + 1 }),
        { expiresIn: 3600 }),
    }))
  );
  return { uploadId: UploadId, key, urls };
}
```

---

## tus Protocol (Resumable Uploads)

tus is an open protocol for resumable file uploads; a related IETF HTTP resumable-upload draft exists and is still an Internet-Draft, so tus remains the deployed option. Use when clients have unreliable connections or upload large files from browsers/mobile.

```typescript
// Server: use tusd or tus-node-server
// Client example with tus-js-client
import * as tus from 'tus-js-client';

const upload = new tus.Upload(file, {
  endpoint: '/api/uploads/tus',
  retryDelays: [0, 1000, 3000, 5000],
  chunkSize: 5 * 1024 * 1024,
  metadata: { filename: file.name, filetype: file.type },
  onProgress: (bytesUploaded, bytesTotal) => {
    const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
    console.log(`${pct}%`);
  },
  onSuccess: () => console.log('Upload complete:', upload.url),
});
upload.start();
```

tus servers can be configured to store to S3, GCS, Azure, or local disk as the backend.

---

## Conditional Writes

Prevent overwrites in concurrent upload scenarios. Available on S3 (`PutObject`, `CopyObject`, `CompleteMultipartUpload`), R2 (`PutObject`), GCS, and Azure.

```typescript
// S3/R2: If-None-Match prevents overwriting existing objects
const command = new PutObjectCommand({
  Bucket: bucket, Key: key, Body: data,
  IfNoneMatch: '*', // Fail if object already exists
});

// S3/R2: If-Match ensures you're updating the expected version
const updateCommand = new PutObjectCommand({
  Bucket: bucket, Key: key, Body: data,
  IfMatch: '"known-etag-value"', // Fail if ETag doesn't match
});

// GCS: generationMatch condition
await bucket.file(key).save(data, {
  preconditionOpts: { ifGenerationMatch: 0 }, // 0 = only if not exists
});
```

Use conditional writes for: upload confirmation flows, optimistic concurrency on metadata files, preventing duplicate uploads from retry logic.

---

## CDN Setup Patterns

### Provider-Agnostic CDN URL Construction

```typescript
function getCdnUrl(key: string, transforms?: ImageTransform): string {
  const base = `https://${process.env.CDN_DOMAIN}/${key}`;
  if (!transforms) return base;

  const params = new URLSearchParams();
  if (transforms.width) params.set('w', String(transforms.width));
  if (transforms.height) params.set('h', String(transforms.height));
  if (transforms.format) params.set('f', transforms.format);
  if (transforms.quality) params.set('q', String(transforms.quality));
  return `${base}?${params.toString()}`;
}
```

### Cache Headers (All Providers)

```typescript
// Immutable hashed assets (1 year cache)
await storage.upload(
  `assets/${hash}-${filename}`, buffer, mimeType,
  'public, max-age=31536000, immutable'
);

// User avatars: version the key instead of overwriting, so it can also be immutable
await storage.upload(
  `avatars/${userId}/${contentHash}.webp`, buffer, 'image/webp',
  'public, max-age=31536000, immutable'
);
```

Content that must keep a stable URL follows the Cache-Control policy in `caching` ([SKILL.md](../../caching/SKILL.md#cache-control-policy)).

### CDN Configuration by Provider

Cells describe the providers' documented behavior; confirm against the provider for the plan and region in use.

| Setting | CloudFront | Cloud CDN | Azure Front Door | R2 + Cloudflare CDN |
|---------|-----------|-----------|-----------|-----|
| Private origin access | Origin Access Control (OAC; OAI is legacy) | Backend bucket | Private link / storage origin | Bucket bound to a custom domain |
| Edge code | CloudFront Functions, Lambda@Edge | Service extensions | Rules engine | Workers |
| Cache purge | CreateInvalidation (by path) | Cache invalidation (by path) | Purge endpoint | Cloudflare purge API (URL, tag, prefix) |
| Custom domain | CNAME + ACM certificate | Managed certificate | Managed certificate | Custom domain on the bucket |

---

## Image Processing Pipeline

### Sharp-Based Processing (Provider-Agnostic)

```typescript
import sharp from 'sharp';

interface ImageVariant {
  suffix: string;
  width: number;
  height?: number;
  format: 'avif' | 'webp' | 'jpeg';
  quality: number;
}

const VARIANTS: ImageVariant[] = [
  { suffix: 'thumb', width: 200, height: 200, format: 'avif', quality: 60 },
  { suffix: 'medium', width: 800, format: 'avif', quality: 65 },
  { suffix: 'large', width: 1600, format: 'webp', quality: 80 },
  { suffix: 'fallback', width: 1600, format: 'jpeg', quality: 85 },
];

async function processImage(input: Buffer, baseKey: string) {
  const results = [];
  for (const variant of VARIANTS) {                       // sequential: bounded memory per job
    const buffer = await sharp(input, { limitInputPixels: 40_000_000 })   // reject decompression bombs
      .rotate()                                            // apply EXIF orientation; metadata is not copied to the output
      .resize(variant.width, variant.height, { fit: 'inside', withoutEnlargement: true })
      .toFormat(variant.format, { quality: variant.quality })
      .toBuffer();
    const metadata = await sharp(buffer).metadata();
    const key = `${baseKey}/${variant.suffix}.${variant.format}`;
    await storage.upload(key, buffer, `image/${variant.format}`);
    results.push({ key, width: metadata.width!, height: metadata.height!, size: buffer.length });
  }
  return results;
}
```

### Blurhash Generation

```typescript
import { encode } from 'blurhash';
import sharp from 'sharp';

async function generateBlurhash(input: Buffer): Promise<string> {
  const { data, info } = await sharp(input)
    .resize(32, 32, { fit: 'inside' }).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}
```

---

## Virus Scanning

### Quarantine-First Pattern

```typescript
// Runs in the validation job after the upload landed under quarantine/
async function validateAndPromote(uploadId: string) {
  const pending = await db.pendingUploads.get(uploadId);
  const head = await store.readRange(pending.key, 0, 4095);           // first bytes only
  const detected = await fileTypeFromBuffer(head);
  if (!detected || detected.mime !== pending.contentType) return reject(pending, 'type-mismatch');

  let verdict;
  try {
    verdict = await scanObject(pending.key);                          // scanner reads from storage
  } catch (err) {
    return retryLater(uploadId, err);                                 // fail closed: stays in quarantine
  }
  if (!verdict.clean) {
    await store.remove(pending.key);
    await alertOps({ type: 'malware-detected', uploadId, threat: verdict.threat });
    return reject(pending, 'malware');
  }

  const finalKey = `files/${pending.userId}/${uploadId}`;
  await store.promote(pending.key, finalKey, safeHeaders(detected.mime, pending.originalName));
  await db.files.insert({ id: uploadId, ownerId: pending.userId, key: finalKey, contentType: detected.mime });
}
```

### ClamAV Integration (Self-Hosted, Any Provider)

```typescript
import NodeClam from 'clamscan';

const clam = await new NodeClam().init({ clamdscan: { host: 'clamav', port: 3310 } });

// Streams the object from storage to clamd; errors propagate so the caller fails closed
async function scanObject(key: string): Promise<{ clean: boolean; threat?: string }> {
  const body = await store.openReadStream(key);
  const { isInfected, viruses } = await clam.scanStream(body);
  return isInfected ? { clean: false, threat: viruses.join(', ') } : { clean: true };
}
```

---

## Lifecycle Policies

All providers support automatic tier transitions and expiration.

Tier names and available transitions differ per provider; zero-egress S3-compatible stores usually offer fewer tiers (often standard and infrequent access only). Verify against the provider.

| Action | S3 | GCS | Azure |
|--------|---------|-----|-------|
| Warm after 30d | Transition to Standard-IA | SetStorageClass NEARLINE | tierToCool |
| Cold after 90d | Transition to Glacier Instant Retrieval | SetStorageClass COLDLINE | tierToCold |
| Archive after 1y | Transition to Glacier Deep Archive | SetStorageClass ARCHIVE | tierToArchive |
| Delete temp files | Expiration, Days: 1 | Delete, age: 1 | delete, daysAfterModificationGreaterThan: 1 |
| Abort stale uploads | AbortIncompleteMultipartUpload | AbortIncompleteMultipartUpload | Uncommitted blocks are discarded by the service after a retention period |

---

## CORS Configuration

All providers need CORS for browser-direct uploads. Allow only your app origins, the PUT/POST methods you use, and the headers the client sends; expose `ETag` for multipart part uploads.

```
S3/R2:  CORSRules → AllowedOrigins, AllowedMethods, AllowedHeaders, ExposeHeaders: ["ETag"], MaxAgeSeconds
GCS:    cors JSON → origin, method, responseHeader, maxAgeSeconds
Azure:  setProperties({ cors: [{ allowedOrigins, allowedMethods, allowedHeaders, maxAgeInSeconds }] })
```

Restrict AllowedOrigins to exact domains (no wildcards in production).

---

## File Validation

For client-direct uploads, run this in the validation job on the first bytes read from storage (range GET), plus the size from HEAD; for server-proxied uploads, on the received bytes.

```typescript
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_TYPES: Record<string, { mime: string[]; maxSize: number }> = {
  image:    { mime: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'], maxSize: 10 * 1024 * 1024 },
  document: { mime: ['application/pdf'],                                                    maxSize: 50 * 1024 * 1024 },
  video:    { mime: ['video/mp4', 'video/webm'],                                            maxSize: 500 * 1024 * 1024 },
};

async function validateFile(buffer: Buffer, declaredType: string, category: string) {
  const config = ALLOWED_TYPES[category];
  if (!config) return { valid: false, error: 'Unknown file category' };

  // Magic bytes check — do not trust declared MIME type
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !config.mime.includes(detected.mime))
    return { valid: false, error: `Invalid file type: ${detected?.mime ?? 'unknown'}` };

  if (buffer.length > config.maxSize)
    return { valid: false, error: `File too large: ${buffer.length} > ${config.maxSize}` };

  return { valid: true, detectedType: detected.mime };
}
```

---

## Provider Feature Matrix

Use this as supplementary detail after the decision tree in SKILL.md.

| Feature | S3 | GCS | Azure Blob | R2 |
|---------|-----|-----|-----------|-----|
| Signed URLs | Presigned URLs and POST policies | Signed URLs (v4), POST policies | SAS tokens (user delegation preferred) | Presigned URLs for GET, HEAD, PUT, DELETE (S3 API); presigned POST forms are not supported |
| Large uploads | Multipart | Resumable | Block blobs | Multipart (S3 API) |
| Conditional writes | If-None-Match, If-Match | ifGenerationMatch | If-Match / If-None-Match | `If-Match` / `If-None-Match` on `PutObject` |
| Lifecycle policies | Yes | Yes | Yes | Yes |
| Native CDN | CloudFront | Cloud CDN | Azure Front Door | Cloudflare CDN |
| S3-compatible API | Native | Via interop | No | Yes |
| Egress pricing | Per-GB | Per-GB | Per-GB | Free |
| Performance tier | Express One Zone | Dual-region | Premium | N/A |
| Event triggers | EventBridge, Lambda | Eventarc, Functions | Event Grid, Functions | Workers |
