---
name: seo
description: SEO expertise — meta tags, Open Graph, JSON-LD, robots.txt, sitemap, SSR/SSG, Core Web Vitals, GEO, IndexNow, llms.txt. Use when implementing structured data, sitemaps, hreflang, AI search optimization, or crawlability. Do NOT use for performance profiling (use performance) or accessibility (use accessibility).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# SEO

Expert-level search engine optimization. Meta tags, structured data, crawlability, rendering strategy, AI search visibility.

---

## SEO Strategy Decision Tree

```
What is the primary goal?
├── Appear in traditional search (Google, Bing)
│   ├── Content pages → Meta tags + JSON-LD + SSR/SSG + XML sitemap
│   ├── E-commerce → Product schema + canonical + hreflang (if multi-locale)
│   └── Local business → LocalBusiness schema + Google Business Profile
├── Appear in AI-generated answers (AI Overviews, ChatGPT, Perplexity)
│   ├── Informational content → GEO patterns (answer-first, fact density)
│   ├── Technical docs → llms.txt + structured headings
│   └── Brand visibility → JSON-LD + E-E-A-T signals + original research
├── Fast indexing of new/updated content
│   ├── Bing, Yandex, Naver → IndexNow API
│   └── Google → XML sitemap + Search Console API (IndexNow not supported)
└── Multi-language site → hreflang + locale-specific sitemaps
```

---

## Meta Tags Essentials

```html
<head>
  <title>Primary Keyword — Brand Name</title>              <!-- 50-60 chars -->
  <meta name="description" content="Compelling description  <!-- 150-160 chars -->
    with keywords naturally included." />
  <link rel="canonical" href="https://example.com/page" />  <!-- Canonical URL -->
  <meta name="robots" content="index, follow" />            <!-- Default -->
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
```

| Tag | Purpose | Length limit |
|-----|---------|-------------|
| `<title>` | Primary ranking signal, shown in SERP | 50-60 chars |
| `meta description` | SERP snippet, click-through rate | 150-160 chars |
| `canonical` | Consolidates duplicate URLs to one | Full absolute URL |
| `robots` | Controls indexing and link following | `index,follow` / `noindex,nofollow` |
| `meta viewport` | Mobile rendering | Always include |

---

## Open Graph & Twitter Cards

```html
<!-- Open Graph -->
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Page description for social sharing" />
<meta property="og:image" content="https://example.com/image.jpg" />  <!-- 1200x630px -->
<meta property="og:url" content="https://example.com/page" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Brand Name" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Page Title" />
<meta name="twitter:description" content="Description" />
<meta name="twitter:image" content="https://example.com/image.jpg" />
```

**Image requirements:** OG image minimum 1200x630px, < 8MB. Twitter summary_large_image: 2:1 ratio. Always use absolute URLs.

---

## JSON-LD Structured Data

| Schema Type | Rich Result | When to use |
|-------------|-------------|-------------|
| `Organization` | Knowledge panel | Homepage |
| `Article` | Article carousel, date | Blog posts, news |
| `Product` | Price, availability, reviews | E-commerce |
| `FAQ` | Expandable Q&A in SERP | FAQ pages |
| `BreadcrumbList` | Breadcrumb trail in SERP | All pages with navigation hierarchy |
| `HowTo` | Step-by-step in SERP | Tutorial pages |
| `LocalBusiness` | Map pack, hours, reviews | Local businesses |
| `WebSite` | Sitelinks search box | Homepage |

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": { "@type": "Person", "name": "Author Name" },
  "datePublished": "2026-01-15",
  "dateModified": "2026-01-20",
  "image": "https://example.com/image.jpg",
  "publisher": {
    "@type": "Organization",
    "name": "Brand",
    "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png" }
  }
}
</script>
```

**Deprecated schema types (Jan 2026):** Google no longer generates rich results for `PracticeProblem`, `Dataset`, `SpecialAnnouncement`, and `Q&A` (not FAQPage). Existing markup causes no penalties but produces no rich results. Remove to reduce page weight.

See `references/seo-patterns.md` for full JSON-LD examples per schema type.

---

## robots.txt, XML Sitemap & IndexNow

```
# robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /search?*           # Prevent crawl of search result pages
Sitemap: https://example.com/sitemap.xml
```

**Sitemap rules:** Max 50,000 URLs per sitemap, max 50MB uncompressed. Use sitemap index for large sites. `lastmod` = actual last modification date. `priority` is relative (homepage=1.0, main=0.8, blog=0.6). See `references/seo-patterns.md` for XML examples.

### IndexNow (instant indexing for Bing, Yandex, Naver, Seznam)

Push URL changes to search engines instantly instead of waiting for crawl. Google does not support IndexNow.

```
POST https://api.indexnow.org/IndexNow
Content-Type: application/json

{
  "host": "example.com",
  "key": "<your-api-key>",
  "urlList": [
    "https://example.com/updated-page",
    "https://example.com/new-page"
  ]
}
```

Place your API key file at `https://example.com/<key>.txt`. Use both IndexNow and XML sitemaps together for broadest coverage.

---

## SSR vs SSG vs ISR Decision Tree

```
Is content the same for all users?
├── Yes → Is content updated frequently?
│   ├── Rarely (docs, marketing) → SSG (Static Site Generation)
│   ├── Periodically (blog, catalog) → ISR (Incremental Static Regeneration)
│   └── Real-time (feed, dashboard) → SSR (Server-Side Rendering)
└── No (personalized) → SSR with cache headers + edge caching
```

| Strategy | SEO Score | Build Time | TTFB | When content changes |
|----------|-----------|------------|------|----------------------|
| SSG | Excellent | Slow (at build) | Fastest | Rebuild required |
| ISR | Excellent | Fast (on demand) | Fast | Background revalidate |
| SSR | Excellent | None | Slower | Instant |
| CSR only | Poor | None | Fastest | Instant |

**Critical:** Client-side rendered content (CSR) is NOT reliably indexed. Use SSR/SSG for any content that must appear in search results.

---

## hreflang Tags

```html
<link rel="alternate" hreflang="en" href="https://example.com/page" />
<link rel="alternate" hreflang="de" href="https://example.com/de/page" />
<link rel="alternate" hreflang="x-default" href="https://example.com/page" />
```

**Rules:** Every page links to ALL variants (including itself). Bidirectional (EN links DE, DE links EN). Include `x-default` for fallback. Pick one method (`<head>`, HTTP header, or sitemap). See `references/seo-patterns.md` for sitemap-based hreflang and common mistakes.

---

## Core Web Vitals Impact

| Metric | Target | What it measures | SEO impact |
|--------|--------|------------------|------------|
| LCP | < 2.5s | Largest visible element render time | Ranking signal |
| INP | < 200ms | Interaction responsiveness (replaced FID, March 2024) | Ranking signal |
| CLS | < 0.1 | Visual stability (layout shifts) | Ranking signal |

**Quick wins:** Set explicit `width`/`height` on images (CLS). Preload LCP image. Inline critical CSS. Defer non-essential JS. Break long tasks for INP.

---

## AI Search & Generative Engine Optimization (GEO)

AI Overviews appear in a significant share of Google searches. ChatGPT handles 5B+ monthly visits as a search alternative. Optimizing for AI citation is now essential alongside traditional ranking. This shift ("The Great Decoupling") means more visibility but potentially fewer clicks.

**Key principles:**
- **Semantic completeness** — answer the full question in one section; AI extracts complete answers
- **Direct answer first** — lead with the answer in the first 40-60 words, then elaborate
- **Fact density** — include verifiable data (statistics, dates, citations) every 150-200 words
- **Structured data alignment** — JSON-LD must match visible page content (schema drift causes trust loss)
- **Multi-modal content** — combine text, images, and structured data for higher AI citation rates
- **E-E-A-T signals** — AI systems prefer content with original research, expert authorship, and unique data

### llms.txt (AI content discovery)

A plain-text Markdown file at `/llms.txt` curating high-signal pages for LLM consumption. Complements robots.txt (which controls access) — llms.txt guides AI content selection.

```markdown
# Site Name

## Docs
- [Getting Started](https://example.com/docs/start): Overview and setup guide
- [API Reference](https://example.com/docs/api): Full API documentation

## Blog
- [Key Article](https://example.com/blog/key-article): In-depth analysis of topic
```

Optional: `llms-full.txt` concatenates full page content into a single Markdown file for complete context ingestion. See `references/geo-patterns.md` for content structuring patterns.

---

## Anti-Patterns

1. **CSR without SSR for important pages** — search engines and AI crawlers may not execute JS reliably. Use SSR/SSG for indexable content
2. **Missing canonical URLs** — leads to duplicate content penalties. Every page needs `<link rel="canonical">`
3. **Duplicate content across locales** — same content on `/en/page` and `/de/page` without hreflang causes keyword cannibalization
4. **Blocking JS/CSS in robots.txt** — search engines need to render pages. Allow all render-critical resources
5. **No structured data** — missing rich result and AI citation opportunities. Add JSON-LD for eligible content types
6. **Schema drift** — JSON-LD data contradicts visible content (e.g., "InStock" in schema but "Sold Out" on page). Keep structured data in sync with rendered content
7. **Blocking search bots while wanting AI visibility** — blocking `Googlebot` removes you from both traditional and AI search. Understand the distinction between training crawlers (`GPTBot`, `Google-Extended`) and search crawlers (`Googlebot`)
8. **Thin wrapper content** — AI-generated content that repackages existing information without original insight. AI systems prefer unique data, original research, or expert analysis

---

## Context Adaptation

| Role | Relevant aspects |
|------|-----------------|
| Frontend developer | Meta tags, Open Graph, JSON-LD implementation, SSR/SSG setup, Core Web Vitals, semantic HTML |
| Content writer | GEO patterns (answer-first, fact density), heading hierarchy, E-E-A-T signals |
| Backend developer | robots.txt, XML sitemap generation, IndexNow API, SSR/ISR configuration, hreflang |
| Marketing / SEO specialist | Strategy decision tree, schema type selection, AI search visibility, llms.txt |
| DevOps / Platform engineer | IndexNow automation, sitemap deployment, crawl budget optimization, llms.txt generation |

---

## Related Knowledge

- `web` skill — HTTP caching, service workers, CSP (affects crawlability and Core Web Vitals)
- `performance` skill — profiling and optimizing LCP, INP, CLS
- `html/css` skill — semantic markup, heading hierarchy, image optimization
- `accessibility` skill — semantic HTML and ARIA overlap with SEO best practices

---

## References

Load on demand for detailed patterns and implementation guides:

- `references/seo-patterns.md` — JSON-LD schema examples, meta tag templates, sitemap generation, SSR/SSG comparison, technical audit checklist, hreflang implementation
- `references/geo-patterns.md` — AI search optimization, content structuring for LLM citation, AI Overview optimization, AI crawler management
