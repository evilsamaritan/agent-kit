# Storage Patterns — Multi-Provider SDK & Architecture Reference

## Table of Contents

- [Storage Abstraction Interface](#storage-abstraction-interface)
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

## Storage Abstraction Interface

Define a provider-agnostic interface. Swap implementations without changing application code.

```typescript
interface StorageClient {
  generateUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<{ url: string; key: string }>;
  generateDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  headObject(key: string): Promise<{ contentType: string; size: number; lastModified: Date; etag: string }>;
  deleteObject(key: string): Promise<void>;
  upload(key: string, body: Buffer, contentType: string, cacheControl?: string): Promise<void>;
  copy(sourceKey: string, destKey: string): Promise<void>;
}
```

Use this interface throughout application code. Only the factory/constructor references a specific provider.

---

## Signed URL Generation

### Provider-Agnostic Pattern

```typescript
async function createUploadUrl(
  filename: string, contentType: string, maxSize: number
): Promise<{ url: string; key: string }> {
  const key = `uploads/${randomUUID()}/${sanitizeFilename(filename)}`;
  const { url } = await storage.generateUploadUrl(key, contentType, 900); // 15 min
  return { url, key };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
}
```

### S3 (AWS SDK v3)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Upload URL with security constraints
const command = new PutObjectCommand({
  Bucket: process.env.BUCKET, Key: key, ContentType: contentType,
  ContentDisposition: 'attachment',
  Metadata: { 'original-name': filename },
});
const url = await getSignedUrl(s3, command, { expiresIn: 900 });

// Download URL with Content-Disposition
const dlCommand = new GetObjectCommand({
  Bucket: process.env.BUCKET, Key: key,
  ResponseContentDisposition: `attachment; filename="${filename}"`,
});
const downloadUrl = await getSignedUrl(s3, dlCommand, { expiresIn: 3600 });
```

### GCS (Google Cloud Storage)

```typescript
import { Storage } from '@google-cloud/storage';

const gcs = new Storage();
const bucket = gcs.bucket(process.env.BUCKET);

// Upload URL
const [url] = await bucket.file(key).getSignedUrl({
  version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000,
  contentType,
});

// Download URL
const [downloadUrl] = await bucket.file(key).getSignedUrl({
  version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000,
  responseDisposition: `attachment; filename="${filename}"`,
});
```

### Azure Blob Storage

```typescript
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION);
const container = blobService.getContainerClient(process.env.CONTAINER);

const blob = container.getBlockBlobClient(key);
const sasToken = generateBlobSASQueryParameters({
  containerName: process.env.CONTAINER, blobName: key,
  permissions: BlobSASPermissions.parse('w'), // 'r' for download
  expiresOn: new Date(Date.now() + 15 * 60 * 1000),
  contentType,
}, blobService.credential).toString();
const url = `${blob.url}?${sasToken}`;
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
const url = await getSignedUrl(r2, command, { expiresIn: 900 });
```

---

## Multipart / Resumable Upload

### Provider-Agnostic Pattern

```typescript
async function uploadLargeFile(key: string, data: Buffer, partSize = 10 * 1024 * 1024) {
  const uploadSession = await storage.initiateMultipartUpload(key);
  try {
    const parts = await uploadPartsInParallel(uploadSession, data, partSize);
    await storage.completeMultipartUpload(uploadSession, parts);
  } catch (error) {
    await storage.abortMultipartUpload(uploadSession);
    throw error;
  }
}
```

### S3 / R2 — Multipart Upload

```typescript
import {
  CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

const { UploadId } = await client.send(
  new CreateMultipartUploadCommand({ Bucket: bucket, Key: key })
);
try {
  const parts = await Promise.all(
    chunks.map(async (chunk, i) => {
      const { ETag } = await client.send(new UploadPartCommand({
        Bucket: bucket, Key: key, UploadId, PartNumber: i + 1, Body: chunk,
      }));
      return { ETag, PartNumber: i + 1 };
    })
  );
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: bucket, Key: key, UploadId,
    MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
  }));
} catch (error) {
  await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId }));
  throw error;
}
```

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
await blob.uploadData(data, {
  blockSize: 10 * 1024 * 1024,     // 10 MB blocks
  concurrency: 4,                   // parallel block uploads
  blobHTTPHeaders: { blobContentType: contentType },
});
```

### Browser Chunked Upload with Signed Parts (S3/R2)

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

tus is an open protocol for resumable file uploads (IETF standardization in progress). Use when clients have unreliable connections or upload large files from browsers/mobile.

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

Prevent overwrites in concurrent upload scenarios. Available on S3, R2, GCS, and Azure.

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

// Mutable content (24h, revalidate)
await storage.upload(
  `avatars/${userId}`, buffer, mimeType,
  'public, max-age=86400, must-revalidate'
);
```

### CDN Configuration by Provider

| Setting | CloudFront | Cloud CDN | Azure CDN | R2 |
|---------|-----------|-----------|-----------|-----|
| Origin setup | OAI/OAC to S3 | Backend bucket | Storage origin | Built-in |
| Edge transforms | CloudFront Functions | Cloud Functions | Azure Functions | Workers |
| Cache invalidation | CreateInvalidation | urlMap invalidate | Purge endpoint | Automatic |
| Custom domain | CNAME + ACM cert | SSL cert | CNAME + managed cert | Custom Domains |
| Auto image format | CloudFront Functions | N/A | N/A | Polish / Workers |

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
  return Promise.all(VARIANTS.map(async (variant) => {
    const buffer = await sharp(input)
      .resize(variant.width, variant.height, { fit: 'inside', withoutEnlargement: true })
      .toFormat(variant.format, { quality: variant.quality })
      .toBuffer();
    const metadata = await sharp(buffer).metadata();
    const key = `${baseKey}/${variant.suffix}.${variant.format}`;
    await storage.upload(key, buffer, `image/${variant.format}`);
    return { key, width: metadata.width!, height: metadata.height!, size: buffer.length };
  }));
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
// 1. Upload goes to quarantine bucket/prefix
const quarantineKey = `quarantine/${randomUUID()}/${filename}`;
await storage.upload(quarantineKey, buffer, contentType);

// 2. Scan the file
const result = await scanFile(quarantineKey);

// 3. Move to production or delete
if (result.safe) {
  const prodKey = `uploads/${randomUUID()}/${filename}`;
  await storage.copy(quarantineKey, prodKey);
  await storage.deleteObject(quarantineKey);
  return { key: prodKey };
} else {
  await storage.deleteObject(quarantineKey);
  await alertOps({ type: 'virus-detected', file: quarantineKey, threat: result.threat });
  throw new Error('File failed virus scan');
}
```

### ClamAV Integration (Self-Hosted, Any Provider)

```typescript
import NodeClam from 'clamscan';

const clam = await new NodeClam().init({ clamdscan: { host: 'clamav', port: 3310 } });

async function scanFile(filePath: string): Promise<{ safe: boolean; threat?: string }> {
  const { isInfected, viruses } = await clam.isInfected(filePath);
  return isInfected
    ? { safe: false, threat: viruses.join(', ') }
    : { safe: true };
}
```

---

## Lifecycle Policies

All providers support automatic tier transitions and expiration.

| Action | S3 / R2 | GCS | Azure |
|--------|---------|-----|-------|
| Warm after 30d | Transition to IA | SetStorageClass NEARLINE | tierToCool |
| Cold after 90d | Transition to Glacier IR | SetStorageClass COLDLINE | tierToCold |
| Archive after 1y | Transition to Deep Archive | SetStorageClass ARCHIVE | tierToArchive |
| Delete temp files | Expiration: Days: 1 | Delete, age: 1 | delete, daysAfter: 1 |
| Abort stale uploads | AbortIncompleteMultipartUpload | AbortIncompleteMultipartUpload | Auto |

---

## CORS Configuration

All providers need CORS for browser-direct uploads. Allow only your app origin, PUT/POST methods, and necessary headers.

```
S3/R2:  CORSRules → AllowedOrigins, AllowedMethods, AllowedHeaders, MaxAgeSeconds
GCS:    cors JSON → origin, method, responseHeader, maxAgeSeconds
Azure:  setProperties({ cors: [{ allowedOrigins, allowedMethods, allowedHeaders, maxAgeInSeconds }] })
```

Restrict AllowedOrigins to exact domains (no wildcards in production).

---

## File Validation

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
| Signed URLs | Presigned URLs | Signed URLs (v4) | SAS tokens | Presigned (S3 API) |
| Large uploads | Multipart | Resumable | Block blobs | Multipart (S3 API) |
| Conditional writes | If-None-Match, If-Match | generationMatch | If-Match ETag | If-None-Match |
| Lifecycle policies | Yes | Yes | Yes | Yes |
| Native CDN | CloudFront | Cloud CDN | Azure CDN | Built-in |
| S3-compatible API | Native | Via interop | No | Yes |
| Egress pricing | Per-GB | Per-GB | Per-GB | Free |
| Performance tier | Express One Zone | Dual-region | Premium | N/A |
| Event triggers | EventBridge, Lambda | Eventarc, Functions | Event Grid, Functions | Workers |
