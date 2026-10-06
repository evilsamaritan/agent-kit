# AI Search and Crawler Patterns (GEO)

How content reaches AI answer features and assistants, and how to control which crawlers use it. Crawler names and vendor behavior change; each vendor's own crawler documentation is the source of truth for a policy.

## Contents

- [What is Different, What is Not](#what-is-different-what-is-not)
- [Content for AI Answers](#content-for-ai-answers)
- [Structured Data Alignment](#structured-data-alignment)
- [AI Crawler Management](#ai-crawler-management)
- [llms.txt](#llmstxt)
- [Measuring AI Visibility](#measuring-ai-visibility)
- [Anti-Patterns](#anti-patterns)

---

## What is Different, What is Not

AI answer features (search-engine AI summaries, chat assistants with browsing) read the same web. They need pages that are crawlable, rendered in initial HTML, accurate, and clearly written. No special markup guarantees citation, and no file format forces inclusion. What differs is the output: an answer with a few cited sources instead of ten links, so visibility may arrive as citations and referrals rather than rankings.

| Aspect | Web search | AI answers |
|--------|-----------|-----------|
| Unit retrieved | Page | Passage from a page |
| Outcome | Ranked link, click | Cited or paraphrased source, sometimes no click |
| Controls | robots.txt, noindex, snippet directives, canonical | robots.txt tokens per crawler purpose, snippet directives, access rules |

---

## Content for AI Answers

These are author heuristics that tend to help any reader and any extractor; none is a documented ranking rule.

- Lead each section with the direct answer, then elaborate. Make each section self-contained enough to be quoted alone.
- State verifiable specifics (numbers, dates, versions, named standards) with sources, instead of vague claims.
- Use standard terminology and precise names for entities and technologies.
- Use a clear heading hierarchy whose headings read like the questions the page answers.
- Add original information (data, analysis, first-hand experience, expert authorship). Repackaged content gives a system no reason to cite you.
- Keep dates honest: update `dateModified` only on real changes.
- Prefer text in the initial HTML; do not hide key facts in images or behind interaction.

---

## Structured Data Alignment

Structured data helps engines identify entities, authorship, and offers. Keep it consistent with the visible page:

- `headline` matches the visible heading, `author` matches the visible byline, `dateModified` matches the last real edit, prices and availability come from the same source as the page.
- Generate JSON-LD from the same record as the page body so drift cannot occur.
- `FAQPage` is valid vocabulary but has had no Google rich result since May 2026; use it only if the content really is a visible question-and-answer list.
- `Speakable` is documented as a beta feature for English-language news publishers; skip it elsewhere.

Examples of correct types: see [seo-patterns.md](seo-patterns.md).

---

## AI Crawler Management

Crawlers fall into three purposes. Control each with its own robots.txt token; blocking one does not block the others.

| Purpose | What it does | Example tokens (as each vendor documents them) |
|---------|--------------|---------------------------------|
| Training | Collects content to train models | `GPTBot` (OpenAI), `ClaudeBot` (Anthropic), `Google-Extended` (Google AI products), `CCBot` (Common Crawl), `Applebot-Extended` (Apple) |
| Search and indexing | Builds the index an AI search product cites | `OAI-SearchBot` (OpenAI), `Claude-SearchBot` (Anthropic), `PerplexityBot` (Perplexity), `Googlebot` and `Bingbot` for the engines' own AI features |
| User-triggered | Fetches a page because a user asked an assistant | `ChatGPT-User`, `Claude-User`, `Perplexity-User` |

Notes:

- `anthropic-ai` and `claude-web` appear in older robots.txt files; Anthropic's crawler documentation lists three: `ClaudeBot` (training), `Claude-SearchBot` (search indexing), and `Claude-User` (user-directed fetches).
- `Google-Extended` is a robots.txt product token with no user-agent string of its own; crawling uses Google's existing user agents. It controls use of crawled content for training Gemini models and for grounding in Gemini Apps and related products; Google states it does not affect inclusion in Google Search or act as a ranking signal. AI features in Search follow `Googlebot` and snippet controls.
- `Applebot-Extended` works the same way: Apple documents it as a token that does not crawl and only governs use of Applebot-crawled content for training Apple's foundation models.
- Vendors differ on whether user-triggered fetchers honor robots.txt: OpenAI states robots.txt rules may not apply to `ChatGPT-User`, and Perplexity states `Perplexity-User` generally ignores them. Use rate limits, authentication, or IP-based rules where a robots.txt token is not enough.
- robots.txt is advisory. Compliant crawlers follow it; others ignore it. Verify with server logs.

```
# Policy example: allow search and user-triggered access, decline training
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-SearchBot
Allow: /
```

### Page-level controls

`nosnippet`, `max-snippet:N`, and `data-nosnippet` limit how much of a page search features may quote, and they apply to search and AI summaries from engines that honor them. `X-Robots-Tag` carries the same directives as an HTTP header for non-HTML files. Meta tags such as `noai` or `noimageai` are not standards and are not honored by major engines or crawlers; do not rely on them.

---

## llms.txt

`llms.txt` is a community convention: a Markdown index of curated pages at `/llms.txt`, sometimes with `llms-full.txt` holding concatenated content. Google's generative-AI optimization guide states that Google Search does not use such files and ignores them, so they neither help nor harm visibility or rankings. Treat it as optional, for sites whose consumers are coding agents or MCP clients that read it (documentation, APIs), with no promised ranking or citation effect.

```markdown
# Site Name

> One-sentence description.

## Docs
- [Getting Started](https://example.com/docs/start): Setup guide
- [API Reference](https://example.com/docs/api): Endpoint documentation
```

If you publish it, keep it short and curated, link only pages that exist, and regenerate it from source content.

| File | Purpose | Strength |
|------|---------|----------|
| `robots.txt` | Allow or block crawlers | Honored by compliant crawlers |
| `sitemap.xml` | List canonical URLs | Discovery aid |
| `llms.txt` | Hint for agents that choose to read it | Advisory convention |

---

## Measuring AI Visibility

| Source | How to observe |
|--------|----------------|
| Google AI features | Search Console performance data; attribution of AI-feature traffic is approximate |
| Chat assistants | Referrers from the assistant's domain in analytics, plus server-log hits from the crawler tokens above |
| Citations | Sample the target questions in each assistant periodically and record whether you are cited |

Treat the numbers as trends, not exact counts: many AI visits carry no referrer.

---

## Anti-Patterns

1. **Schema drift**: structured data that contradicts the page. Generate both from one source.
2. **Blocking the search crawler while wanting visibility**: training tokens and search tokens are separate; blocking `Googlebot` removes web search and Google's AI features in it.
3. **Relying on `noai` meta tags or `llms.txt` as controls**: neither controls anything on major engines.
4. **Thin wrapper content** with no original information.
5. **Keyword and statistic stuffing**: readable, accurate prose is the goal.
6. **Stale structured data**: prices, dates, or availability that no longer match the page.
