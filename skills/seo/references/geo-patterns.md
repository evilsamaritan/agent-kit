# AI Search & Generative Engine Optimization (GEO)

Patterns for optimizing content visibility in AI-powered search (Google AI Overviews, ChatGPT, Perplexity, and other generative engines).

## Contents

- [How AI Search Differs from Traditional Search](#how-ai-search-differs-from-traditional-search)
- [Content Structure for AI Citation](#content-structure-for-ai-citation)
- [Structured Data for AI Crawlers](#structured-data-for-ai-crawlers)
- [AI Crawler Management](#ai-crawler-management)
- [llms.txt Implementation](#llmstxt-implementation)
- [Measuring AI Search Visibility](#measuring-ai-search-visibility)
- [Anti-Patterns](#anti-patterns)

---

## How AI Search Differs from Traditional Search

| Aspect | Traditional SEO | Generative Engine Optimization |
|--------|----------------|-------------------------------|
| Goal | Rank in top 10 blue links | Get cited in AI-generated answers |
| Signal | Backlinks, domain authority, keywords | Semantic completeness, fact density, source authority |
| Format | Pages optimized for click-through | Content structured for extraction and citation |
| Metrics | Rankings, CTR, impressions | AI citations, referral traffic from AI sources |
| Content | Keyword-optimized for ranking | Answer-first, entity-rich, verifiable facts |

**Key insight:** Traditional domain authority correlation with AI citations has dropped significantly. AI systems develop their own source preferences based on content quality, structure, and verifiability.

---

## Content Structure for AI Citation

### Answer-first pattern

Lead every section with a direct, complete answer. AI systems extract the first 40-60 words as a potential citation.

```markdown
## What is [topic]?

[Topic] is [direct definition in one sentence]. It works by [mechanism].
The key benefits are [benefit 1], [benefit 2], and [benefit 3].

[Elaboration, context, and nuance follow...]
```

### Fact density

Include verifiable data points throughout content:

- Statistics with sources: "According to [source], [metric] increased by X% in [year]"
- Specific numbers over vague claims: "reduces load time by 40%" not "significantly faster"
- Dates and version numbers: "introduced in HTTP/3 (RFC 9114, 2022)"
- Comparison tables with concrete values

### Entity-rich content

Use proper nouns, standard terminology, and schema.org types. AI systems match content to knowledge graph entities:

- Name technologies precisely: "Interaction to Next Paint (INP)" not "responsiveness metric"
- Reference standards: "WCAG 2.2 Level AA" not "accessibility standards"
- Include relationship context: "INP replaced First Input Delay (FID) as a Core Web Vital in March 2024"

### Heading hierarchy for extraction

```html
<h1>Primary topic (one per page)</h1>
  <h2>Subtopic that could be a search query</h2>
    <h3>Specific aspect or comparison</h3>
```

AI systems use heading hierarchy to scope answers. Each H2 should be self-contained enough to serve as a standalone answer.

---

## Structured Data for AI Crawlers

### Schema.org alignment

AI systems cross-reference JSON-LD with visible content. Keep them synchronized:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Must match visible <h1>",
  "dateModified": "Must reflect actual last edit",
  "author": {
    "@type": "Person",
    "name": "Must match visible byline",
    "url": "Link to author profile with expertise signals"
  }
}
</script>
```

### FAQ schema for question-based queries

Question-based queries trigger AI Overviews 99%+ of the time. FAQ schema signals question-answer pairs:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Exact question users would search",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Direct answer in first sentence. Supporting detail follows."
      }
    }
  ]
}
</script>
```

### Speakable schema (voice search / AI assistants)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".article-summary", ".key-takeaway"]
  }
}
</script>
```

---

## AI Crawler Management

### robots.txt for AI crawlers

```
# Allow search engine AI crawlers (recommended for visibility)
User-agent: Googlebot
Allow: /

# Block specific AI training crawlers (optional — does not affect AI search)
User-agent: GPTBot
Disallow: /proprietary/

User-agent: Google-Extended
Disallow: /proprietary/

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /proprietary/
```

**Important distinction:**
- Blocking `GPTBot` prevents OpenAI from training on your content but does NOT remove you from ChatGPT search results
- Blocking `Google-Extended` prevents Google AI training but does NOT affect AI Overviews (which use `Googlebot`)
- To appear in AI search results, allow the main search engine bots

### AI-specific meta tags

```html
<!-- Control AI training (not search visibility) -->
<meta name="robots" content="noai, noimageai" />

<!-- These affect ALL search including AI -->
<meta name="robots" content="nosnippet" />           <!-- Prevents AI from quoting content -->
<meta name="robots" content="max-snippet:200" />      <!-- Limits snippet length -->
```

---

## llms.txt Implementation

### Standard llms.txt

Place at website root (`/llms.txt`). Curate the most important pages in Markdown format:

```markdown
# Company Name

> Brief description of what this site offers.

## Docs
- [Getting Started](https://example.com/docs/start): Setup and onboarding guide
- [API Reference](https://example.com/docs/api): Full API documentation
- [Architecture](https://example.com/docs/architecture): System design overview

## Blog
- [Key Topic Analysis](https://example.com/blog/analysis): Original research on topic
- [Best Practices Guide](https://example.com/blog/best-practices): Comprehensive how-to

## Optional
- [Changelog](https://example.com/changelog): Release history
```

**Best practices:**
- Curate 10-30 high-signal pages, not every URL
- Write descriptive link text — AI uses it to decide relevance
- Group by content type with clear section headings
- Update when significant content changes

### llms-full.txt (full context variant)

A single concatenated Markdown file containing full page content. Models visit it 2x more often than the standard index because it allows full context ingestion in one request.

```markdown
# Company Name — Full Documentation

## Getting Started

[Full content of the getting started page...]

---

## API Reference

[Full content of the API reference...]
```

**When to use:** Documentation sites, developer tools, reference-heavy sites. Skip for content-heavy blogs (too large). Automate generation from source content.

### Relationship to robots.txt

| File | Purpose | Controls |
|------|---------|----------|
| `robots.txt` | Block/allow crawlers | Crawler access (enforceable) |
| `llms.txt` | Guide AI content selection | Content prioritization (advisory) |
| `sitemap.xml` | Map all indexable URLs | Search engine discovery |

All three serve different purposes — use together for maximum coverage.

---

## Measuring AI Search Visibility

### Traffic attribution

Monitor referral traffic from AI sources in analytics:

| Source | Referrer pattern |
|--------|-----------------|
| Google AI Overviews | Standard Google organic (track via Search Console) |
| ChatGPT | `chatgpt.com` referrer |
| Perplexity | `perplexity.ai` referrer |
| Bing Copilot | `bing.com` with AI-specific parameters |

### Google Search Console signals

- **Search appearance filter:** Check for "AI Overview" appearances
- **Click-through changes:** Pages cited in AI Overviews show different CTR patterns
- **Query analysis:** Question-format queries increasingly trigger AI results

### Content audit for AI readiness

| Check | Pass criteria |
|-------|--------------|
| Answer in first 60 words | Each major section leads with a direct answer |
| Fact density | At least one verifiable data point per 200 words |
| Schema alignment | JSON-LD matches all visible content |
| Heading structure | H2s could serve as standalone answers |
| Entity precision | Technical terms use standard names |
| Freshness signals | `dateModified` is current and accurate |

---

## Anti-Patterns

1. **Schema drift** — JSON-LD contradicts visible content. AI systems cross-reference and penalize mismatches. Keep structured data dynamically synchronized with rendered content.

2. **Keyword stuffing for AI** — overloading content with entities and statistics makes it unreadable. AI systems evaluate content quality holistically, not just fact density.

3. **Blocking search bots while wanting AI visibility** — blocking `Googlebot` removes you from both traditional and AI search. Understand the distinction between training crawlers and search crawlers.

4. **Thin wrapper content** — AI-generated content that adds no original insight. AI systems prefer content with unique data, original research, or expert analysis.

5. **Ignoring multi-modal signals** — text-only content when images, tables, and diagrams would better serve the topic. AI systems favor comprehensive content formats.

6. **Stale structured data** — JSON-LD with outdated prices, dates, or availability while the page has been updated. Automate schema updates with content changes.
