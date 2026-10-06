---
name: i18n
description: "Implement internationalization and localization (i18n, l10n): message catalogs, ICU plurals and select, locale negotiation and routing, RTL and bidi text, date/number/currency formatting, translation workflows. JavaScript Intl details are in a reference; hreflang is in seo, layout properties in css."
user-invocable: true
---

# Internationalization

Separate what users read (messages) and how values look (formatting) from code, and decide the locale in one place. The rules below are stack-independent; library and runtime specifics are in references. Determine the project's stack and library versions first (manifest or lockfile).

**Hard rules:** Never concatenate translatable strings. Never assume plural forms are only `one` and `other`. Never hardcode date, number, or currency formats. Set `lang` and `dir` on the document. Isolate user-generated text in mixed-direction contexts.

## Decision tree

```
Where do messages come from?
├── Semantic keys (auth.login.title)      → stable across copy edits; needs a source-language catalog and translator context
├── Source text as the key (gettext)      → fast to write; any edit to the source text invalidates its translations
└── Generated IDs (hash of text + context) → extraction tooling assigns IDs; stable per text, opaque in review
    Pick one per project and keep it.

When are catalogs loaded?
├── Runtime (fetched per locale/namespace) → translators ship without a rebuild; watch payload and loading states
└── Compile-time (bundled, tree-shaken)    → smaller and type-checkable; a new locale or fix needs a build

Who decides the locale?
├── Public, indexable pages → URL (path or subdomain), so pages are shareable and crawlable (seo owns hreflang)
├── Signed-in users         → stored profile preference, overriding the request header
└── First visit             → locale negotiation (below), then persist the choice

Who formats numbers, dates, currency, lists, relative time?
└── The platform's CLDR/ICU-backed locale APIs, never hand-written patterns.
```

Non-web stacks use the same rules with their platform's ICU or CLDR-backed APIs and catalog formats (for example ICU4J and Android string resources on the JVM, String Catalogs on Apple platforms, ARB in Flutter, Babel or gettext in Python, `x/text` in Go). Library names and JavaScript specifics: [javascript-intl.md](references/javascript-intl.md), [i18next.md](references/i18next.md), [formatjs.md](references/formatjs.md), [frameworks.md](references/frameworks.md).

## Locale negotiation

1. Treat locales as BCP 47 tags (`en`, `pt-BR`, `zh-Hant`).
2. Order of authority: explicit user choice, then URL, then stored profile, then `Accept-Language` (honor q-values), then default. Do not infer language from IP location.
3. Match the best supported locale and fall back along a chain (`pt-BR` to `pt` to the default); never show raw keys when a translation is missing.
4. Persist the resolved choice (profile and URL), not only `localStorage`, so it survives a new device.
5. Locale controls language and formatting separately when needed: a user may want English text with a European date format.

## Messages

ICU MessageFormat 1.0 is the established standard in most libraries.

| Type | Syntax |
|------|--------|
| Argument | `Hello, {name}!` |
| Plural | `{count, plural, one {# item} other {# items}}` |
| Select | `{gender, select, female {She} male {He} other {They}}` |
| Ordinal | `{rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}` |
| Date | `{date, date, medium}` |
| Number or currency | `{amount, number, ::currency/EUR}` (skeleton form: the currency code travels in the message) |

`#` inside plural resolves to the formatted number; use it instead of repeating the variable. A select needs `other`. A single apostrophe before `{` or `}` starts quoted text in ICU: write `''` for a literal apostrophe next to arguments (`l''{name}`). Rich text uses tags or placeholders mapped to components, never string splicing.

MessageFormat 2.0 is the Unicode successor with explicit declarations and better error handling. Decision: keep MF1 for existing catalogs; adopt MF2 for new work only when the library, translation tooling, and runtime support it. Syntax and implementation status: [i18n-patterns.md](references/i18n-patterns.md).

## Plurals

Plural categories (`zero`, `one`, `two`, `few`, `many`, `other`) come from CLDR locale data; `other` is required everywhere and which others exist depends on the language (English two, Polish four, Arabic six). Do not infer them from numbers: `one` is not "exactly 1" (French and Portuguese include 0 in `one`). Get categories from the platform (`Intl.PluralRules` in JavaScript) instead of hand-written tables, give translators every category their language needs, and never write `item(s)`.

## Direction (RTL and bidi)

Set `<html lang dir>` (both). Use CSS logical properties so layouts mirror automatically (the `css` skill owns them). Mirror directional icons (arrows, progress), not universal ones (check marks). Wrap user-generated or mixed-direction text in an isolating element (`<bdi>`, `dir="auto"`, or `unicode-bidi: isolate`) so a name or number cannot reorder surrounding text. Numerals and calendars vary by locale (numbering system and calendar come from the locale tag or `-u-` extensions); let the platform format them. RTL patterns: [i18n-patterns.md](references/i18n-patterns.md).

## Translation workflow

Extract, send to a translation system, translate and review, pull, validate (missing keys, placeholder and ICU syntax consistency), build. Give translators context (descriptions, screenshots, character limits); use machine or LLM drafts with human review for user-facing text and human translation for legal or regulated text. Detail: [i18n-patterns.md](references/i18n-patterns.md).

## Anti-patterns

1. **String concatenation**: breaks word order. Use message arguments.
2. **Hardcoded formats**: `MM/DD/YYYY` is not universal; use locale formatters.
3. **`count + " item(s)"`**: wrong for most languages; use plural messages.
4. **Physical CSS properties with RTL**: use logical properties.
5. **Locale only in `localStorage`**: lost on a new device; persist in profile and URL.
6. **Manual durations and relative times** (`${h}h ${m}m`): formats vary by locale.
7. **Missing `lang`**: breaks screen reader pronunciation, spell checking, and hyphenation.
8. **Ad-hoc timezone arithmetic**: store UTC instants and format with an explicit time zone.
9. **Splitting a sentence across messages** so translators cannot reorder it.

## Context adaptation

- **Frontend:** translate at the component boundary, lazy-load catalogs by route or namespace, keep `lang` and `dir` in sync with the locale.
- **Backend:** negotiate the locale per request, return translated user-facing text but stable codes for enums, localize emails per locale, send dates as ISO 8601 and let clients format.

## Related knowledge

- `css`: logical properties for RTL
- `html`: `lang`, `dir`, `<bdi>`
- `seo`: hreflang and localized sitemaps
- `accessibility`: language of parts, translated ARIA labels
- `javascript`: Temporal and Intl runtime notes
- `frontend`: component-level integration and locale-aware routing

## References

- [i18n-patterns.md](references/i18n-patterns.md): advanced ICU messages, MF2 syntax and status, RTL patterns, translation pipeline, pseudo-localization, tests
- [javascript-intl.md](references/javascript-intl.md): Intl APIs, Temporal, DurationFormat with support notes
- [i18next.md](references/i18next.md): i18next configuration, namespaces, plurals and context
- [formatjs.md](references/formatjs.md): FormatJS and react-intl setup and extraction
- [frameworks.md](references/frameworks.md): Next.js and Vue integration
