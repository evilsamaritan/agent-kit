# SEO Patterns & Implementation Guide

Detailed patterns for structured data, technical SEO, and rendering strategies.

## Contents

- [JSON-LD Schema Examples](#json-ld-schema-examples)
- [Meta Tag Templates](#meta-tag-templates)
- [Sitemap Generation](#sitemap-generation)
- [Technical SEO Audit Checklist](#technical-seo-audit-checklist)
- [hreflang Implementation](#hreflang-implementation)
- [SSR/SSG SEO Patterns](#ssrssg-seo-patterns)
- [Structured Data Testing](#structured-data-testing)

---

## JSON-LD Schema Examples

### Organization (homepage)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Company Name",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": [
    "https://twitter.com/company",
    "https://linkedin.com/company/company",
    "https://github.com/company"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-800-555-0000",
    "contactType": "customer service"
  }
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
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "127"
  }
}
</script>
```

### FAQ page

FAQPage schema: `@type: "FAQPage"` with `mainEntity` array of `Question` objects, each containing `name` (question text) and `acceptedAnswer` with `@type: "Answer"` and `text`.

### BreadcrumbList

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com/" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://example.com/category" },
    { "@type": "ListItem", "position": 3, "name": "Product", "item": "https://example.com/category/product" }
  ]
}
</script>
```

### WebSite with SearchAction (sitelinks search box)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://example.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://example.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
</script>
```

---

## Meta Tag Templates

### Blog post / Article page

```html
<head>
  <title>Article Title — Blog Name</title>
  <meta name="description" content="Concise summary of the article content, 150-160 characters." />
  <link rel="canonical" href="https://example.com/blog/article-slug" />
  <meta name="author" content="Author Name" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="Article Title" />
  <meta property="og:description" content="Social-optimized description" />
  <meta property="og:image" content="https://example.com/images/article-og.jpg" />
  <meta property="og:url" content="https://example.com/blog/article-slug" />
  <meta property="article:published_time" content="2026-01-15T10:00:00Z" />
  <meta property="article:author" content="https://example.com/authors/name" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
</head>
```

### E-commerce product page

```html
<head>
  <title>Product Name — Category | Brand</title>
  <meta name="description" content="Product description with key features, price, availability." />
  <link rel="canonical" href="https://example.com/products/product-slug" />

  <meta property="og:type" content="product" />
  <meta property="og:title" content="Product Name" />
  <meta property="og:image" content="https://example.com/products/image.jpg" />
  <meta property="product:price:amount" content="29.99" />
  <meta property="product:price:currency" content="USD" />
</head>
```

### Noindex patterns

```html
<!-- Pages that should NOT be indexed -->
<meta name="robots" content="noindex, follow" />  <!-- Don't index, but follow links -->
<meta name="robots" content="noindex, nofollow" /> <!-- Don't index, don't follow -->

<!-- Use for: -->
<!-- - Search result pages -->
<!-- - User account pages -->
<!-- - Paginated archives (page 2+, keep page 1 indexed) -->
<!-- - Staging/preview environments -->
<!-- - Thank you / confirmation pages -->
```

---

## Sitemap Generation

### Next.js App Router sitemap

```ts
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://example.com';

  // Static pages
  const staticPages = ['', '/about', '/pricing', '/contact'].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // Dynamic pages from DB/CMS
  const posts = await db.post.findMany({ select: { slug: true, updatedAt: true } });
  const postPages = posts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...postPages];
}
```

### Sitemap index for large sites (50k+ URLs)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-pages.xml</loc>
    <lastmod>2026-01-15</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-blog.xml</loc>
    <lastmod>2026-01-14</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-products.xml</loc>
    <lastmod>2026-01-15</lastmod>
  </sitemap>
</sitemapindex>
```

---

## Technical SEO Audit Checklist

### Crawlability

| Check | How to verify | Fix |
|-------|---------------|-----|
| robots.txt accessible | Fetch `/robots.txt` — 200 OK | Create file at root |
| No accidental noindex | Search `<meta name="robots" content="noindex"` | Remove from production pages |
| Canonical tags present | Every page has `<link rel="canonical">` | Add to `<head>` |
| No orphan pages | All pages reachable from internal links | Add to navigation or sitemap |
| XML sitemap valid | Validate at `/sitemap.xml` | Fix schema, add missing URLs |
| No redirect chains | Check for 301→301→200 | Point to final URL directly |
| No 404 on important pages | Crawl site, check status codes | Fix broken links or redirect |

### Indexability

| Check | How to verify | Fix |
|-------|---------------|-----|
| Title tags unique | No duplicate `<title>` across pages | Make each title descriptive and unique |
| Meta descriptions unique | No duplicate descriptions | Write unique descriptions per page |
| H1 tag present and unique | One `<h1>` per page | Add/fix heading hierarchy |
| Images have alt text | Audit `<img>` tags | Add descriptive alt attributes |
| Internal links use descriptive anchor text | Not "click here" | Use keyword-relevant anchor text |

### Mobile & Performance

| Check | How to verify | Fix |
|-------|---------------|-----|
| Mobile-friendly | Google Mobile-Friendly Test | Fix viewport, tap targets, font sizes |
| Core Web Vitals passing | PageSpeed Insights, CrUX | Optimize LCP, INP, CLS |
| HTTPS everywhere | No mixed content warnings | Upgrade all resources to HTTPS |
| Page speed < 3s | Lighthouse performance score | Optimize images, JS, CSS |

---

## hreflang Implementation

### Via sitemap (recommended for large sites)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/page</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/page" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/page" />
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/page" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/page" />
  </url>
  <url>
    <loc>https://example.com/de/page</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/page" />
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/page" />
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/page" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/page" />
  </url>
</urlset>
```

### Common hreflang mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Missing return links | EN→DE exists but DE→EN missing | Every page links to ALL variants |
| Wrong language codes | `hreflang="uk"` (UK is a country) | Use ISO 639-1: `en`, `de`, `uk` (Ukrainian) |
| No x-default | No fallback for unlisted languages | Add x-default pointing to main version |
| Mixing methods | hreflang in both `<head>` and sitemap | Pick one method only |
| Non-canonical URLs | hreflang pointing to redirected URLs | All hreflang URLs must be canonical |

---

## SSR/SSG SEO Patterns

### Next.js metadata API

```tsx
// app/blog/[slug]/page.tsx
import { Metadata } from 'next';

export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug);
  return {
    title: `${post.title} — Blog Name`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.image, width: 1200, height: 630 }],
      type: 'article',
      publishedTime: post.publishedAt,
    },
    alternates: {
      canonical: `https://example.com/blog/${params.slug}`,
    },
  };
}
```

### Nuxt SEO setup

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
  routeRules: {
    '/blog/**': { swr: 3600 },  // ISR: revalidate every hour
    '/docs/**': { prerender: true },  // SSG at build time
  },
});
```

```ts
// pages/blog/[slug].vue — per-page SEO
const { data: post } = await useFetch(`/api/posts/${route.params.slug}`);
useHead({
  title: `${post.value.title} — Blog`,
  meta: [
    { name: 'description', content: post.value.excerpt },
    { property: 'og:title', content: post.value.title },
    { property: 'og:image', content: post.value.image },
  ],
  link: [
    { rel: 'canonical', href: `https://example.com/blog/${route.params.slug}` },
  ],
});
```

---

## Structured Data Testing

### Validation tools

| Tool | URL | Purpose |
|------|-----|---------|
| Google Rich Results Test | search.google.com/test/rich-results | Test JSON-LD for rich result eligibility |
| Schema.org Validator | validator.schema.org | Validate against full Schema.org spec |
| Google Search Console | search.google.com/search-console | Monitor indexing, coverage, enhancements |
| Lighthouse SEO audit | Chrome DevTools | Automated SEO checks |

### Common validation errors

| Error | Cause | Fix |
|-------|-------|-----|
| Missing required field | Schema type requires fields (e.g., `image` for Article) | Add all required properties |
| Invalid URL format | Relative URL in JSON-LD | Use absolute URLs everywhere |
| Date format wrong | `"January 15, 2026"` instead of ISO | Use `"2026-01-15"` or `"2026-01-15T10:00:00Z"` |
| Mismatch with page content | JSON-LD data differs from visible content | Structured data must reflect visible content |
