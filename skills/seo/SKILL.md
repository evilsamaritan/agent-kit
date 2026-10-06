---
name: seo
description: "Implement SEO (search engine optimization) for web pages: titles and meta descriptions, canonical URLs, Open Graph, JSON-LD structured data, robots.txt, sitemaps, hreflang, indexing and crawlability, AI crawlers. Not in-app search (search), not rendering performance (performance), not locale routing (i18n)."
user-invocable: true
---

# SEO

Make pages crawlable, indexable, correctly described, and eligible for the search features that still exist. Search engines change features often; volatile feature lists and crawler tokens live in references, and the vendor's own documentation is the source of truth.

## Decision tree

```
What is the goal?
├── Appear and rank in web search
│   ├── Content page → unique title + description, canonical, crawlable HTML, internal links, sitemap
│   ├── Product / listing → Product or merchant markup that matches the visible page, canonical per variant
│   └── Local business → LocalBusiness markup + the engine's business-profile tool
├── Be understood by AI answer features and assistants
│   └── Same foundation: crawlable, accurate, helpful content; consistent structured data; deliberate crawler policy (geo-patterns.md)
├── Get new or updated URLs discovered fast
│   ├── Google → sitemap with truthful lastmod, internal links, URL Inspection for single URLs
│   └── Bing, Yandex, Naver, Seznam and other IndexNow engines → IndexNow (Google does not support it)
├── Multi-language or multi-region site → hreflang (seo) on top of locale routing (i18n)
└── Page must stay out of search → noindex (page must remain crawlable) or authentication; never robots.txt alone
```

## Page essentials

```html
<head>
  <title>Primary topic - Brand</title>
  <meta name="description" content="One accurate sentence or two that describes this page." />
  <link rel="canonical" href="https://example.com/page" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
```

| Element | Rule |
|---------|------|
| `<title>` | Unique per page, describes the page first and brand second. About 50-60 characters is display guidance; truncation is by pixel width, not a limit |
| meta description | Unique, accurate summary used as snippet material. About 150-160 characters is display guidance; engines may rewrite it |
| `canonical` | Absolute URL; self-referencing on every indexable page; consolidates duplicates (a hint, not a penalty mechanism) |
| robots meta | Default is indexable; add `noindex` only for pages that must stay out of results |
| `<h1>` and headings | One clear main heading is the convention; a hierarchy that reflects the content matters more than a count |

## Social previews

Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) drives link previews on most platforms. Use absolute image URLs; 1200 by 630 is a safe size for large previews. Add `twitter:card` (usually `summary_large_image`); other `twitter:*` tags fall back to Open Graph and are only needed to override.

## Structured data (JSON-LD)

Mark up what is visibly on the page, using schema.org types that still produce a visible feature or clarify the entity.

| Type | Use for |
|------|---------|
| `Article` / `NewsArticle` | Blog and news pages (headline, author, dates, image) |
| `Product` + `Offer` | Product pages and merchant listings |
| `BreadcrumbList` | Pages with a navigation hierarchy |
| `Organization` | Homepage: name, logo, official profiles |
| `LocalBusiness` | Local businesses: address, hours |
| `Review`, `VideoObject`, `Event`, `JobPosting` | When the page is that thing |

Rich-result eligibility is volatile: Google has retired several features (FAQ and HowTo results, the WebSite sitelinks search box among them). The engine's structured-data gallery lists what still produces a visual feature; see the retired-features note in [seo-patterns.md](references/seo-patterns.md). `FAQPage` stays valid vocabulary but earns no Google rich result. Markup that contradicts the visible page (stale price, wrong availability) is worse than none. Validate with the Rich Results Test and the schema.org validator.

## robots.txt, sitemaps, indexing

```
User-agent: *
Disallow: /admin/
Disallow: /search

Sitemap: https://example.com/sitemap.xml
```

- robots.txt controls crawling, not indexing. A URL blocked there can still be indexed from links, and a `noindex` on a blocked page is never seen. Do not block CSS or JS the page needs to render.
- Sitemap: up to 50,000 URLs and 50 MB uncompressed per file; use a sitemap index beyond that. Include only canonical, indexable URLs. Set `lastmod` only when it reflects a real content change; omit `priority` and `changefreq` (Google ignores them).
- IndexNow pushes changed URLs to participating engines (for example Bing, Yandex, Naver, Seznam; Google does not take part). Use it alongside sitemaps, never instead of them. Mechanics: [seo-patterns.md](references/seo-patterns.md).

## Rendering strategy

Content that must appear in results or previews belongs in the initial HTML. Google renders JavaScript, but with delay and cost, and many social and AI crawlers do not run it. Client-only rendering is acceptable for pages that should not be indexed. Choosing the rendering mode per route: `frontend`.

## hreflang

Each language or region variant lists all variants including itself, plus `x-default`. Links must be reciprocal and point at canonical URLs; use one delivery method (head, HTTP header, or sitemap). Codes are language first, optional region second (`en`, `en-GB`, `pt-BR`). `i18n` owns locale routing and detection; this skill owns the hreflang annotations. Details and mistakes: [seo-patterns.md](references/seo-patterns.md).

## Core Web Vitals

Core Web Vitals are a page-experience ranking signal, one among many and never a substitute for relevant content. Definitions, thresholds, and field-data measurement belong to `performance`, UI causes and fixes to `frontend`; for SEO, read the field data in Search Console and treat lab scores as diagnostics.

## AI search and AI crawlers

AI answer features rely on the same crawlable, accurate, helpful content. Keep structured data consistent with visible content, set an explicit robots.txt policy per crawler purpose (training, search, user-triggered), and measure through referrers and Search Console. There is no markup that guarantees citation. Crawler tokens, `llms.txt` status, schema drift, thin content, and measurement: [geo-patterns.md](references/geo-patterns.md).

## Anti-patterns

1. **Important content only rendered client-side**, invisible to crawlers that do not run JavaScript.
2. **Missing or conflicting canonicals**: duplicates split signals; Google picks its own canonical instead of penalizing.
3. **Locale variants without hreflang**, or hreflang without return links.
4. **`noindex` on a page blocked in robots.txt**, so the directive is never read.
5. **Markup added for retired rich results** and for features the page does not show.

## Context adaptation

| Role | Focus |
|------|-------|
| Frontend | Per-page metadata hooks, JSON-LD, render strategy, semantic HTML |
| Backend | robots.txt, sitemap generation, redirects and status codes, IndexNow |
| Content | Unique titles and descriptions, heading structure, original information, authorship |

## Related knowledge

- `i18n`: locale routing and language negotiation behind hreflang
- `performance`: Core Web Vitals definitions and measurement; `frontend`: their UI causes and fixes
- `html`: semantic structure, headings, image attributes
- `web`: HTTP header mechanics (conditional requests, `Vary`, `X-Robots-Tag` delivery)
- `api-design`: status codes and redirects
- `frontend`: choosing the rendering mode per route
- `search`: in-app search features, not web search engine optimization

## References

- [seo-patterns.md](references/seo-patterns.md): JSON-LD examples, meta templates, sitemaps and IndexNow, audit checklist, hreflang, retired features
- [geo-patterns.md](references/geo-patterns.md): AI crawler tokens, content for AI answers, llms.txt, measurement
