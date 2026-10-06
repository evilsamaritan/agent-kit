# Serving Untrusted Files

How to deliver user-uploaded files without letting them run code in your application's origin or leak private data. Header grammar is owned by `web`; cache policy by `caching`.

## Contents

- [Origin Isolation](#origin-isolation)
- [Response Headers](#response-headers)
- [Inline Allowlist](#inline-allowlist)
- [Filename Encoding](#filename-encoding)
- [Image Re-encoding and Limits](#image-re-encoding-and-limits)

---

## Origin Isolation

- Serve user content from a separate registrable domain (for example `usercontent-example.net`, not a subdomain of the app that shares cookies) or directly from signed storage or CDN URLs.
- The content domain sets no cookies and is not trusted by the app's CORS or CSP configuration.
- Private files: the app checks authorization, then redirects to a short-lived signed URL; the signed URL is the only credential.

---

## Response Headers

```http
Content-Type: image/png                        # from server-side validation, never from the upload request
X-Content-Type-Options: nosniff
Content-Disposition: attachment; filename="report.pdf"; filename*=UTF-8''report%20%E2%80%93%20Q3.pdf
Content-Security-Policy: default-src 'none'; sandbox   # defense in depth if a file is rendered anyway
Cache-Control: private, max-age=0              # for private files; public variants follow caching's policy
```

Set these as object metadata at promotion time (or override them when signing a download URL, e.g. `response-content-disposition`), so the storage or CDN serves them on every response.

---

## Inline Allowlist

| Type | Inline? | Notes |
|---|---|---|
| Raster images (JPEG, PNG, WebP, AVIF, GIF) | Yes, after validation and re-encoding | |
| Video, audio | Yes, after validation | |
| PDF | Only if the product needs inline viewing; otherwise attachment | Viewers have had script and form features |
| SVG | No — attachment, or rasterize / sanitize with a dedicated sanitizer | SVG can contain script |
| HTML, XML, XHTML | No — attachment | Executes in the serving origin |
| Office documents, archives, unknown | Attachment | |

---

## Filename Encoding

- Store the original filename as metadata only; the object key is a server-generated id.
- In `Content-Disposition`, send an ASCII fallback in `filename="..."` (quotes and backslashes removed, non-ASCII replaced) and the full name in `filename*=UTF-8''<percent-encoded>` (RFC 6266 with RFC 8187 encoding).
- Strip control characters and path separators; cap the length.

```typescript
function contentDisposition(name: string, type: 'attachment' | 'inline' = 'attachment'): string {
  const clean = name.replace(/[\u0000-\u001f\u007f"\\/]/g, '').slice(0, 200) || 'download';
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_');
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
```

---

## Image Re-encoding and Limits

- Decode with a pixel limit before allocating (most image libraries expose one; for example sharp's `limitInputPixels`, Pillow's `MAX_IMAGE_PIXELS`); reject images whose header declares more.
- Re-encode to the stored format rather than serving the original bytes; this drops embedded payloads and polyglot tricks.
- Strip metadata (EXIF, including GPS location, XMP, comments) unless the product explicitly keeps it; preserve orientation by applying it before stripping.
- Bound processing time and memory per job; run image processing in workers, not in the request path.
- Animated formats: cap frame count and total pixels across frames.
