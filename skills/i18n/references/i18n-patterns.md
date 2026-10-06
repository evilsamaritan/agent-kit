# i18n Patterns

Framework-neutral patterns: advanced ICU messages, MF2, RTL specifics, the translation pipeline, and testing. Library-specific setup: [i18next.md](i18next.md), [formatjs.md](formatjs.md), [frameworks.md](frameworks.md). JavaScript formatting: [javascript-intl.md](javascript-intl.md).

## Contents

- [ICU MessageFormat 1.0 Examples](#icu-messageformat-10-examples)
- [MessageFormat 2.0](#messageformat-20)
- [RTL and Bidi Patterns](#rtl-and-bidi-patterns)
- [Translation Pipeline](#translation-pipeline)
- [Pseudo-Localization and Testing](#pseudo-localization-and-testing)

---

## ICU MessageFormat 1.0 Examples

```
# Nested select + plural
{gender, select,
  male {{count, plural,
    one {He has # item in his cart}
    other {He has # items in his cart}
  }}
  female {{count, plural,
    one {She has # item in her cart}
    other {She has # items in her cart}
  }}
  other {{count, plural,
    one {They have # item in their cart}
    other {They have # items in their cart}
  }}
}

# Date and time
Meeting on {date, date, long} at {date, time, short}

# Number with unit, and currency (skeleton syntax)
{distance, number, ::unit/kilometer unit-width-long}
{price, number, ::currency/EUR}

# Apostrophe quoting: a single ' before { or } starts quoted text
l''{name}          (literal apostrophe, then the argument)
```

Grammar differs per language (gender agreement, case): give translators full-sentence messages with `select` on the grammatical variable instead of fragments. Quoting rules differ slightly between libraries; test a message containing an apostrophe in every target language.

---

## MessageFormat 2.0

MF2 is the Unicode successor to MF1: explicit declarations, a function registry, fallback values instead of exceptions, and markup placeholders.

Status as of October 2026: the specification became stable with CLDR 47 (March 2025, shipped in ICU 77), and its stability policy is normative. Implementations lag the spec: ICU 78 (CLDR 48) upgraded the Java core API to draft while the data-model API and the C++ implementation stayed technology previews, and ICU 79 release candidates still mark part of the API as preview. Several JavaScript libraries implement it, and no `Intl.MessageFormat` ships in browsers. Translation tools' MF2 support is the usual blocker, so the library and the TMS decide the catalog format.

```
# Plural via .match
.input {$count :number}
.match $count
one {{You have {$count} item in your cart}}
*   {{You have {$count} items in your cart}}

# Select
.input {$gender :string}
.match $gender
male   {{He liked your post}}
female {{She liked your post}}
*      {{They liked your post}}

# Local declarations; the stable spec has separate :date, :time, :datetime, :currency, :percent, :unit functions
.local $date = {$when :datetime dateStyle=long}
.local $cost = {$price :currency currency=USD}
{{Order placed on {$date} for {$cost}}}

# Markup for rich text
{{Click {#link}here{/link} to continue}}
```

| Aspect | MF1 | MF2 |
|--------|-----|-----|
| Syntax | Inline `{var, type, ...}` | Declarations plus `{{pattern}}` |
| Errors | Often throws | Fallback values |
| Extensibility | Fixed types | Custom function registry |
| Rich text | Not supported | `{#tag}...{/tag}` markup |
| Tooling | Mature, universal | Growing |

Function and option names changed during standardization (for example currency moved to its own `:currency` function); a library that implemented an older draft may still use the old names.

---

## RTL and Bidi Patterns

Logical properties, the physical-to-logical mapping, and mirrored layout are owned by `css`. Patterns specific to i18n:

```css
/* Directional glyph or icon that must mirror */
[dir="rtl"] .icon-arrow { transform: scaleX(-1); }

/* Breadcrumb separator */
.breadcrumb-separator::before { content: "\203A"; }                    /* › */
[dir="rtl"] .breadcrumb-separator::before { content: "\2039"; }        /* ‹ */

/* Offset shadows do not mirror automatically */
.card { box-shadow: 4px 2px 8px rgb(0 0 0 / 0.1); }
[dir="rtl"] .card { box-shadow: -4px 2px 8px rgb(0 0 0 / 0.1); }
```

Bidi isolation for user-generated or interpolated text:

```html
<p>Message from <bdi>{userName}</bdi>: <bdi>{preview}</bdi></p>
<input type="text" dir="auto" />
```

Without isolation, a right-to-left name next to a number or punctuation can reorder the surrounding sentence. Use `unicode-bidi: isolate` in CSS where markup cannot change. Phone numbers, code, and URLs stay left-to-right inside RTL text (`dir="ltr"` on the element). Check text direction per string, not only per page, for mixed-language content.

---

## Translation Pipeline

| Stage | Action | Notes |
|-------|--------|-------|
| 1. Extract | Source code to message catalog | formatjs extract, i18next-parser, xgettext, platform extractors |
| 2. Send | Upload source strings to a translation management system | Include context, screenshots, limits |
| 3. Translate | Human or machine translation, then review | Gate release on reviewed strings |
| 4. Pull | Download translated files | CI job on schedule or webhook |
| 5. Validate | Missing keys, placeholder consistency, ICU syntax, length | Fail the build, do not ship broken messages |
| 6. Build | Compile and split by route or namespace | Deploy |

AI-assisted translation: produce a first pass with a glossary and translation memory, review quality-critical strings (legal, marketing, errors) with linguists, then run automated validation. Internal and developer-facing text may ship with machine translation alone; legal, medical, and regulated text needs human translation.

Key management: do not delete a key until it is unused on every platform; mark deprecated keys; give translators a description per message; set character limits for constrained UI.

---

## Pseudo-Localization and Testing

```js
// Accent pseudo-locale: unaccented text on screen is a hardcoded string
// "Submit" -> "[!!!šũbmĩt!!!]"
function pseudoLocalize(str) {
  const accents = { a: 'ā', e: 'ē', i: 'ĩ', o: 'ō', u: 'ũ', s: 'š' };
  const accented = str.replace(/[aeious]/gi, (c) => accents[c.toLowerCase()] || c);
  return `[!!!${accented}!!!]`;
}

// Expansion pseudo-locale: pads about 30% to expose truncation
function pseudoExpand(str) {
  return pseudoLocalize(str) + ' ' + '~'.repeat(Math.ceil(str.length * 0.3));
}
```

| Test | What to check |
|------|---------------|
| Pseudo-locale render | All visible text carries markers; anything without is hardcoded |
| Expansion | No truncation at 30-50% longer text |
| RTL | `dir="rtl"` mirrors layout, icons, and alignment |
| Plurals | One sample per plural category of each supported locale (from the platform's plural rules) |
| Formats | Dates, numbers, currency in the locale's format |
| Missing keys | Fallback chain works, no raw keys shown |
| Switching | UI updates without reload; `lang` and `dir` update |
| Long words | Compound words do not break layouts |
| Bidi | Mixed-direction user content stays readable |

Automated checks:

```js
// every source key exists in every locale
const missing = Object.keys(en).filter((k) => !(k in de));
expect(missing).toEqual([]);

// every message parses as valid ICU
import { parse } from '@formatjs/icu-messageformat-parser';
Object.values(en).forEach((msg) => expect(() => parse(msg)).not.toThrow());
```
