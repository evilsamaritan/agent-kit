---
name: i18n
description: Implement internationalization — ICU MessageFormat, pluralization, RTL, Intl APIs, Temporal, translation workflows. Use when implementing i18n, localization, pluralization, RTL layout, Intl APIs, or translation pipelines. Do NOT use for accessibility (use accessibility) or CSS layout (use html/css).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Internationalization

Expert-level i18n/l10n knowledge. ICU MessageFormat (1.0 + 2.0), CLDR pluralization, RTL, Intl APIs, Temporal, translation workflows.

**Critical rules:** Never concatenate translatable strings. Never assume only `one`/`other` plural forms. Never use physical CSS properties for bidi layouts. Always set `lang` and `dir` attributes on `<html>`.

---

## I18n Library Decision Tree

- Need ICU MessageFormat syntax natively? --> FormatJS-family libraries
- Need plugin ecosystem + namespace lazy-loading? --> i18next-family libraries
- Need compile-time extraction + type safety? --> Libraries with CLI extraction (e.g., FormatJS CLI, typesafe-i18n)
- Server-side only, simple key-value? --> Lightweight solutions (gettext, raw Intl APIs)
- Want MF2 syntax today? --> Check if your library has MF2 plugin/support; polyfill if needed

---

## ICU MessageFormat Syntax

### MessageFormat 1.0 (stable standard)

| Type | Syntax | Example |
|------|--------|---------|
| Simple | `{name}` | `Hello, {name}!` |
| Plural | `{count, plural, one {# item} other {# items}}` | `You have 3 items` |
| Select | `{gender, select, male {He} female {She} other {They}}` | `She liked your post` |
| Ordinal | `{rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}` | `3rd place` |
| Nested | `{gender, select, male {{count, plural, ...}} ...}` | Combine select + plural |
| Date | `{date, date, medium}` | `Jan 15, 2026` |
| Number | `{amount, number, currency}` | `$1,234.56` |

`#` inside plural/selectordinal resolves to the matched number. Always use `#` instead of re-referencing the variable.

### MessageFormat 2.0 (MF2) -- approved Unicode standard

MF2 is the Unicode Consortium successor to MF1. The spec is approved and stable. ICU includes draft Java implementation; JS/C++ are in tech preview. `Intl.MessageFormat` TC39 proposal exists but is not advancing yet.

```
# MF2 syntax uses .local/.input declarations and {{...}} patterns
.input {$count :number}
.match $count
one   {{You have {$count} item}}
*     {{You have {$count} items}}

# Custom functions -- extensible formatting
.local $exp = {$date :datetime dateStyle=long}
{{Expires on {$exp}}}
```

**MF2 vs MF1:** explicit declarations, custom function registry, better error model (fallback values instead of exceptions), `{#tag}...{/tag}` markup for rich text. Use MF1 for existing projects. Consider MF2 for new projects if your i18n library and TMS support it.

---

## CLDR Pluralization Rules

| Category | Languages that use it | Example numbers |
|----------|-----------------------|-----------------|
| `zero` | Arabic, Latvian, Welsh | 0 |
| `one` | English, French, Portuguese, German | 1 |
| `two` | Arabic, Hebrew, Slovenian | 2 |
| `few` | Czech, Polish, Russian, Arabic | 2-4 (Czech), 3-10 (Arabic) |
| `many` | Polish, Russian, Arabic, Welsh | 5-20 (Polish), 11-99 (Arabic) |
| `other` | **All languages** (required) | Everything else |

English: `one` + `other`. Polish: `one` + `few` + `many` + `other`. Arabic: all six. Never assume only `one`/`other`.

---

## Intl APIs Quick Reference

```js
// Date formatting -- locale-aware
new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(date)
// --> "15. Januar 2026"

// Number formatting -- currency
new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(1234)
// --> "Y=1,234"

// Relative time
new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day')
// --> "yesterday"

// List formatting
new Intl.ListFormat('en', { type: 'conjunction' }).format(['A', 'B', 'C'])
// --> "A, B, and C"

// Duration formatting (Baseline Newly Available)
new Intl.DurationFormat('en', { style: 'long' })
  .format({ hours: 1, minutes: 30, seconds: 15 })
// --> "1 hour, 30 minutes, 15 seconds"

// Collation -- locale-aware sorting
['ae', 'a', 'z'].sort(new Intl.Collator('de').compare)

// Segmenter -- word/sentence/grapheme boundaries (Baseline)
[...new Intl.Segmenter('ja', { granularity: 'word' }).segment('text')]
```

### Temporal API + Intl formatting

Temporal (shipping in major browsers) replaces `Date` with immutable, timezone-aware types. Format Temporal objects with `Intl.DateTimeFormat`:

```js
const zdt = Temporal.Now.zonedDateTimeISO('Europe/Berlin');
new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' })
  .format(zdt);  // locale-aware output

// Store as ISO 8601, display in user timezone
const stored = Temporal.Instant.from('2026-01-15T14:30:00Z');
const local = stored.toZonedDateTimeISO(userTimeZone);
```

---

## RTL Support Essentials

```css
/* Use CSS logical properties -- works for both LTR and RTL */
.card {
  margin-inline-start: 1rem;    /* NOT margin-left */
  padding-inline-end: 0.5rem;   /* NOT padding-right */
  border-inline-start: 3px solid;/* NOT border-left */
  text-align: start;            /* NOT text-align: left */
}

/* Flexbox and Grid auto-reverse with dir="rtl" -- no changes needed */

/* Directional icons need flipping */
[dir="rtl"] .icon-arrow { transform: scaleX(-1); }
```

**Key rules:**
- Set `<html lang="ar" dir="rtl">` -- both attributes required
- Logical properties: `inline-start/end` = horizontal, `block-start/end` = vertical
- Flip directional icons, keep universal icons (checkmark, X) unflipped
- Test with pseudo-localization: `[!!!Thish ish a tesht!!!]`

---

## Key Naming Conventions

```
# Hierarchical -- namespace.component.element.state
auth.login.title           = "Sign In"
auth.login.button.submit   = "Log In"
auth.login.error.invalid   = "Invalid credentials"

# Rules:
# - Use dots for hierarchy, never camelCase keys
# - Namespace by feature/page, not by component type
# - Keep keys descriptive: auth.login.title NOT t1
# - Prefix shared keys: common.save, common.cancel
```

---

## Translation Workflow

| Stage | Action |
|-------|--------|
| EXTRACT | Source code --> message catalog (CLI extraction) |
| SEND | Upload source strings to TMS |
| TRANSLATE | Human, MT, or AI-assisted translation + review |
| PULL | Download translated files (CI job or webhook) |
| VALIDATE | Check missing keys, format errors, placeholder consistency |
| BUILD | Compile messages, split by route, deploy |

**AI-assisted translation:** LLMs produce high-quality translations for common languages. Use hybrid workflow: MT/LLM first pass, human review for quality-critical content. TMS platforms increasingly integrate AI translation with terminology enforcement and translation memory.

---

## Context Adaptation

### Frontend
- Wrap text in translation function calls at component level
- RTL layout: use CSS logical properties, test with `dir="rtl"` on `<html>`
- Locale switching: store in URL (`/en/about`), sync with `<html lang>` and `dir`
- Lazy-load translations: split by route/namespace, load on navigation
- Duration display: use `Intl.DurationFormat` instead of manual formatting
- Dates: use Temporal API + `Intl.DateTimeFormat` for timezone-safe display

### Backend
- Locale detection: `Accept-Language` header, user preference in DB, URL, fallback chain
- API responses: return translated content for user-facing fields, keep keys for enums
- Email localization: template per locale, shared layout, locale from user profile
- Dates in APIs: use ISO 8601 / Temporal instants -- let clients format for display

### Accessibility
- `lang` attribute on `<html>` and on inline language switches (`<span lang="fr">`)
- Screen readers use `lang` to select pronunciation engine
- Ensure translated alt text, ARIA labels, and error messages
- RTL + screen reader: logical reading order must match visual order

---

## Anti-Patterns

1. **String concatenation** -- `"Hello, " + name + "!"` breaks in languages with different word order. Use ICU: `Hello, {name}!`
2. **Hardcoded date/number formats** -- `MM/DD/YYYY` is US-only. Use `Intl.DateTimeFormat` with locale
3. **Ignoring pluralization** -- `count + " item(s)"` is wrong for most languages. Use ICU plural rules
4. **CSS physical properties with RTL** -- `margin-left` breaks RTL. Use `margin-inline-start`
5. **localStorage-only locale** -- loses locale on new device/browser. Persist in user profile + URL
6. **Manual duration formatting** -- `${h}h ${m}m` varies by locale. Use `Intl.DurationFormat`
7. **Missing `lang` attribute** -- breaks screen reader pronunciation, harms SEO
8. **Using `Date` for cross-timezone display** -- timezone bugs. Use Temporal API with explicit zones

---

## Related Knowledge

- **html/css** -- CSS logical properties for RTL, `lang` attribute, `dir` attribute
- **accessibility** -- screen reader language switching, translated ARIA labels
- **frontend** -- component-level i18n integration, locale-aware routing
- **web** -- Temporal API, Intl APIs, browser compatibility

## References

Load on demand for detailed patterns and implementation guides:

- `references/i18n-patterns.md` -- library configuration examples (i18next, FormatJS), ICU MessageFormat advanced examples, MF2 syntax and migration, RTL CSS patterns, pseudo-localization testing, framework integration (Next.js, Vue)
