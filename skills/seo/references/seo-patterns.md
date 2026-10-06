# SEO Patterns and Implementation Guide

Detailed patterns for structured data, technical SEO, sitemaps, and hreflang. Feature availability changes; the retired-features note below is dated.

## Contents

- [JSON-LD Examples](#json-ld-examples)
- [Retired and Limited Features](#retired-and-limited-features)
- [Meta Tag Templates](#meta-tag-templates)
- [Indexing Controls](#indexing-controls)
- [Sitemaps and IndexNow](#sitemaps-and-indexnow)
- [Technical SEO Audit Checklist](#technical-seo-audit-checklist)
- [hreflang Implementation](#hreflang-implementation)
- [Framework Metadata Hooks](#framework-metadata-hooks)
- [Structured Data Testing](#structured-data-testing)

---

## JSON-LD Examples

Every value must match what the visitor sees. Use absolute URLs and ISO 8601 dates.

### Article

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": { "@type": "Person", "name": "Author Name", "url": "https://example.com/authors/name" },
  "datePublished": "2026-01-15",
  "dateModified": "2026-01-20",
  "image": ["https://example.com/image.jpg"],
  "publisher": { "@type": "Organization", "name": "Brand" }
}
</script>
```

### Organization (homepage)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Company Name",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": ["https://www.linkedin.com/company/company", "https://github.com/company"]
}
</script>
```

### Product (e-commerce)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "image": ["https://example.com/product-1.jpg"],
  "description": "Product description",
  "sku": "SKU-12345",
  "brand": { "@type": "Brand", "name": "Brand Name" },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/product",
    "priceCurrency": "USD",
    "price": "29.99",
    "availability": "https://schema.org/InStock"
  }
}
</script>
```

Add `aggregateRating` or `review` only when real, visible reviews exist on that page. Generate `price` and `availability` from the same source as the page, so they cannot drift.

### BreadcrumbList

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com/" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://example.com/category" },
    { "@type": "ListItem", "position": 3, "name": "Product" }
  ]
}
</script>
```

The last item may omit `item` when it is the current page.

---

## Retired and Limited Features

State as of October 2026, from Google's Search Central documentation and changelog. Its structured-data gallery is the current list of visual features.

| Feature | Status |
|---------|--------|
| FAQ rich result | No longer shown in Google Search (deprecation notice May 2026; the documentation was later removed). `FAQPage` remains valid schema.org vocabulary; it needs no removal and may still help other consumers |
| HowTo rich result | No longer shown on any device (discontinued September 2023) |
| WebSite sitelinks search box (`SearchAction`) | Retired in November 2024; the markup does nothing in Google |
| `Speakable` | Documented as beta: English-language news publishers, U.S. users with Google Home devices set to English; do not present it as a general voice or AI feature |
| `Dataset` | Still used by Dataset Search; do not remove |

Markup for a retired feature causes no penalty and no rich result. Do not add new markup for it unless another consumer needs the vocabulary.

---

## Meta Tag Templates

### Article page

```html
<head>
  <title>Article Title - Blog Name</title>
  <meta name="description" content="Concise, accurate summary of the article." />
  <link rel="canonical" href="https://example.com/blog/article-slug" />

  <meta property="og:type" content="article" />
  <meta property="og:title" content="Article Title" />
  <meta property="og:description" content="Social-preview description" />
  <meta property="og:image" content="https://example.com/images/article-og.jpg" />
  <meta property="og:url" content="https://example.com/blog/article-slug" />
  <meta property="article:published_time" content="2026-01-15T10:00:00Z" />

  <meta name="twitter:card" content="summary_large_image" />
</head>
```

### Product page

```html
<head>
  <title>Product Name - Category | Brand</title>
  <meta name="description" content="Key features and availability of the product." />
  <link rel="canonical" href="https://example.com/products/product-slug" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="Product Name" />
  <meta property="og:image" content="https://example.com/products/image.jpg" />
</head>
```

---

## Indexing Controls

| Goal | Mechanism |
|------|-----------|
| Keep a page out of results | `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex`; the page must stay crawlable so the directive is seen |
| Keep content private | Authentication. Robots directives are not access control |
| Stop crawling (save budget) | robots.txt `Disallow`; does not remove an indexed URL |
| Merge duplicate URLs | `rel="canonical"` on duplicates pointing at the preferred URL, plus redirects when the duplicate has no purpose |
| Limit snippets | `nosnippet`, `max-snippet`, `data-nosnippet`; affects search and AI features that quote the page |

Pages that fit `noindex`: internal search results, account and checkout pages, thank-you pages, staging and preview environments (also protect them with authentication).

Paginated lists stay indexable with a self-referencing canonical on each page; do not canonicalize page 2 to page 1. A long-lived `noindex` page eventually stops passing link signals, so `noindex, follow` is not a lasting way to keep links flowing. Duplicate content is not penalized: the engine clusters duplicates and picks a canonical, so the job is to make your preferred URL win with consistent canonicals, redirects, and internal links.

---

## Sitemaps and IndexNow

Sitemap entries carry truthful `lastmod` values taken from real content changes (a CMS update timestamp), never the build or request time. Omit `priority` and `changefreq`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/blog/article-slug</loc>
    <lastmod>2026-01-20</lastmod>
  </url>
</urlset>
```

Over 50,000 URLs or 50 MB uncompressed: split files and reference them from a sitemap index.

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc><lastmod>2026-01-15</lastmod></sitemap>
  <sitemap><loc>https://example.com/sitemap-blog.xml</loc><lastmod>2026-01-20</lastmod></sitemap>
</sitemapindex>
```

For Google, discovery relies on the sitemap, internal links, and the URL Inspection tool for single URLs. The Search Console API does not submit pages for indexing, and Google's Indexing API is limited to job-posting and livestream content.

### IndexNow (Bing, Yandex, Naver, Seznam, and other participants)

```
POST https://api.indexnow.org/IndexNow
Content-Type: application/json

{ "host": "example.com", "key": "<api-key>", "urlList": ["https://example.com/updated-page"] }
```

Host the key file at `https://example.com/<key>.txt`. Google does not support IndexNow.

---

## Technical SEO Audit Checklist

### Crawlability

| Check | How to verify | Fix |
|-------|---------------|-----|
| robots.txt reachable | Fetch `/robots.txt`, expect 200 | Create the file at the root |
| No accidental noindex | Search rendered HTML and `X-Robots-Tag` headers | Remove from production pages |
| Render-critical resources allowed | URL Inspection rendered view | Unblock CSS and JS |
| No orphan pages | Every page reachable through internal links | Link from navigation or related pages |
| Sitemap valid and current | Fetch and validate `/sitemap.xml` | Fix format, remove non-canonical URLs |
| No redirect chains | Crawl for 301 to 301 to 200 | Point to the final URL |
| No broken important pages | Crawl status codes | Fix links or add redirects |

### Indexability

| Check | How to verify | Fix |
|-------|---------------|-----|
| Canonical on every indexable page | Inspect `<head>` | Add self-referencing canonical |
| Unique titles and descriptions | Crawl and compare | Write per-page values |
| Clear main heading and hierarchy | Inspect headings | Fix structure |
| Images have alt text | Audit `<img>` | Describe informative images |
| Descriptive internal anchor text | Review links | Replace "click here" |
| Content in initial HTML | View source or fetch without JS | Server-render or pre-render |

### Experience and performance

| Check | How to verify | Fix |
|-------|---------------|-----|
| Mobile usability | Lighthouse and real-device check | Fix viewport, tap targets, text size |
| Core Web Vitals (field) | CrUX, Search Console report | See `performance` |
| HTTPS everywhere | No mixed content | Upgrade resources |

---

## hreflang Implementation

Via sitemap (best for large sites):

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/page</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/page" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/page" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/page" />
  </url>
  <url>
    <loc>https://example.com/de/page</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/page" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/page" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/page" />
  </url>
</urlset>
```

`i18n` owns locale routing and language negotiation; this skill owns the hreflang annotations that describe the result.

### Common mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Missing return links | EN lists DE but DE does not list EN | Every page lists all variants, itself included |
| Wrong code | `hreflang="en-UK"`: region subtags are ISO 3166-1 alpha-2 codes and the United Kingdom is `GB` | `en-GB`. Format is language first, optional region second; a region alone is invalid. `uk` is valid and means Ukrainian |
| No `x-default` | No fallback for unlisted languages | Point `x-default` at the language selector or main version |
| Mixing methods | hreflang in head and sitemap disagree | Pick one method |
| Non-canonical targets | hreflang points at redirected or non-canonical URLs | Every target is a canonical, 200 URL |

---

## Framework Metadata Hooks

Use the framework's per-page metadata API so title, description, canonical, Open Graph, and JSON-LD come from the same content record as the page body. Examples: Next.js `generateMetadata` (route `params` has been a Promise since Next.js 15, and synchronous access was removed in 16: `const { slug } = await params`), Nuxt `useSeoMeta` and `useHead`, framework sitemap and robots route conventions. Take the project's framework version from its manifest before copying any snippet, and keep sitemap `lastmod` bound to real content timestamps.

---

## Structured Data Testing

| Tool | Purpose |
|------|---------|
| Google Rich Results Test | Eligibility for features Google still shows |
| Schema.org Validator | Validity against the schema.org vocabulary |
| Search Console | Indexing status, enhancement reports, field Core Web Vitals |
| Lighthouse SEO audit | Basic automated checks |

| Error | Cause | Fix |
|-------|-------|-----|
| Missing required field | Type requires a property (for example `image`) | Add the property |
| Invalid URL | Relative URL in JSON-LD | Use absolute URLs |
| Wrong date format | Free-text date | ISO 8601 |
| Mismatch with page | JSON-LD differs from visible content | Generate both from one source |
