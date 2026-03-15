# i18n Patterns & Implementation Guide

Detailed patterns for internationalization libraries, workflows, and testing.

## Contents

- [i18next Configuration](#i18next-configuration)
- [FormatJS / react-intl Setup](#formatjs--react-intl-setup)
- [ICU MessageFormat Advanced Examples](#icu-messageformat-advanced-examples)
- [RTL CSS Patterns](#rtl-css-patterns)
- [Translation Workflow](#translation-workflow)
- [Pseudo-Localization & Testing](#pseudo-localization--testing)
- [Date & Number Formatting Patterns](#date--number-formatting-patterns)
- [Framework Integration](#framework-integration)

---

## i18next Configuration

```js
import i18next from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18next
  .use(Backend)
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'de', 'ja', 'ar'],
    ns: ['common', 'auth', 'dashboard'],       // namespaces
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json', // lazy-load per namespace
    },
    detection: {
      order: ['path', 'cookie', 'navigator'],  // URL path first
      lookupFromPathIndex: 0,                   // /en/about → 'en'
    },
    interpolation: {
      escapeValue: false,  // React already escapes
    },
    pluralSeparator: '_',  // key_one, key_other
    contextSeparator: '_', // key_male, key_female
  });
```

### Namespace organization

```
locales/
  en/
    common.json     # shared: buttons, labels, errors
    auth.json       # login, register, password reset
    dashboard.json  # metrics, charts, tables
  de/
    common.json
    auth.json
    dashboard.json
```

### Plurals in i18next

```json
// en/common.json
{
  "item_one": "{{count}} item",
  "item_other": "{{count}} items",
  "itemWithContext_one_male": "He has {{count}} item",
  "itemWithContext_other_female": "She has {{count}} items"
}
```

```js
t('item', { count: 1 });  // "1 item"
t('item', { count: 5 });  // "5 items"
t('itemWithContext', { count: 3, context: 'female' }); // "She has 3 items"
```

### Lazy loading namespaces on route change

```js
// React Router example
const DashboardPage = lazy(() =>
  i18next.loadNamespaces('dashboard').then(() =>
    import('./pages/Dashboard')
  )
);
```

---

## FormatJS / react-intl Setup

```tsx
import { IntlProvider, FormattedMessage, useIntl } from 'react-intl';

const messages = await import(`./locales/${locale}.json`);

function App() {
  return (
    <IntlProvider locale={locale} messages={messages}>
      <Content />
    </IntlProvider>
  );
}

function Content() {
  const intl = useIntl();
  return (
    <>
      {/* Declarative */}
      <FormattedMessage id="greeting" defaultMessage="Hello, {name}!" values={{ name: 'World' }} />
      {/* Imperative — for attributes, aria-labels */}
      <input placeholder={intl.formatMessage({ id: 'search.placeholder', defaultMessage: 'Search...' })} />
      {/* Rich text with tags */}
      <FormattedMessage id="tos" defaultMessage="Agree to <link>Terms of Service</link>"
        values={{ link: (chunks) => <a href="/tos">{chunks}</a> }} />
    </>
  );
}
```

### Message extraction with FormatJS CLI

```bash
npx formatjs extract 'src/**/*.tsx' --out-file lang/en.json --id-interpolation-pattern '[sha512:contenthash:base64:6]'
npx formatjs compile lang/en.json --out-file compiled/en.json
npx formatjs compile lang/de.json --out-file compiled/de.json
```

---

## ICU MessageFormat Advanced Examples

### MessageFormat 1.0

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

# Date + time formatting
Meeting on {date, date, long} at {date, time, short}
→ "Meeting on January 15, 2026 at 3:30 PM"

# Number with unit
{distance, number, ::unit/kilometer unit-width-long}
→ "150 kilometers"

# Currency
{price, number, ::currency/EUR}
→ "€1,234.56"

# Ordinal
{rank, selectordinal,
  one {#st place}
  two {#nd place}
  few {#rd place}
  other {#th place}
}
```

### MessageFormat 2.0 (MF2)

MF2 is a Unicode Consortium successor (CLDR 48 / ICU 78). Java implementation is at "draft" API status; JS/C++ are in tech preview.

```
# Simple message — same as MF1 for basic cases
{{Hello, {$name}!}}

# Plural with .match — replaces {count, plural, ...} syntax
.input {$count :number}
.match $count
one   {{You have {$count} item in your cart}}
*     {{You have {$count} items in your cart}}

# Select with .match
.input {$gender :string}
.match $gender
male   {{He liked your post}}
female {{She liked your post}}
*      {{They liked your post}}

# Local variable declarations
.local $formattedDate = {$date :datetime dateStyle=long}
.local $formattedPrice = {$price :number style=currency currency=USD}
{{Order placed on {$formattedDate} for {$formattedPrice}}}

# Custom function registry — extensible
.local $rel = {$timestamp :relativeTime}
{{Last updated {$rel}}}

# Markup support for rich text (e.g., React components)
{{Click {#link}here{/link} to continue}}
```

**MF2 vs MF1 key differences:**

| Aspect | MF1 | MF2 |
|--------|-----|-----|
| Syntax | Inline `{var, type, ...}` | Declarations + `{{pattern}}` |
| Error handling | Throws exceptions | Fallback values, never crashes |
| Extensibility | Fixed function set | Custom function registry |
| Rich text | Not supported | `{#tag}...{/tag}` markup |
| Variables | Implicit from arguments | Explicit `.input` / `.local` |
| Adoption | Mature, universal support | Early (CLDR 48+, ICU 78+) |

**Migration advice:** Use MF1 for existing projects. Consider MF2 for new projects if your TMS and i18n library support it. FormatJS has experimental MF2 support. i18next supports MF2 via the i18next-mf2 plugin.

---

## RTL CSS Patterns

### Full logical property mapping

```css
/* Physical → Logical */
margin-left    → margin-inline-start
margin-right   → margin-inline-end
padding-left   → padding-inline-start
padding-right  → padding-inline-end
border-left    → border-inline-start
border-right   → border-inline-end
left           → inset-inline-start
right          → inset-inline-end
text-align: left  → text-align: start
text-align: right → text-align: end
float: left    → float: inline-start
float: right   → float: inline-end

/* Already bidirectional — no change needed */
margin-top / margin-bottom → margin-block-start / margin-block-end
display: flex              → auto-reverses row direction
display: grid              → auto-reverses column order
```

### Common RTL patterns

```css
/* Breadcrumb separator — direction-aware */
.breadcrumb-separator::before {
  content: "\203A";  /* › */
}
[dir="rtl"] .breadcrumb-separator::before {
  content: "\2039";  /* ‹ */
}

/* Asymmetric border radius */
.tab {
  border-start-start-radius: 8px;  /* top-left in LTR, top-right in RTL */
  border-start-end-radius: 8px;    /* top-right in LTR, top-left in RTL */
}

/* Directional shadow — must flip manually */
.card { box-shadow: 4px 2px 8px rgba(0,0,0,0.1); }
[dir="rtl"] .card { box-shadow: -4px 2px 8px rgba(0,0,0,0.1); }
```

---

## Translation Workflow

### Pipeline stages

| Stage | Action | Tools / Notes |
|-------|--------|---------------|
| 1. EXTRACT | Source code -> message catalog | formatjs extract, i18next-parser, xgettext |
| 2. SEND | Upload source strings to TMS | Crowdin, Phrase, Lokalise, Transifex |
| 3. TRANSLATE | Human or MT translation, review | Gate: 100% translated + reviewed before release |
| 4. PULL | Download translated files | CI job on schedule or webhook |
| 5. VALIDATE | Check missing keys, format errors | Compare key counts, parse ICU syntax, check placeholders |
| 6. BUILD | Compile messages, split by route | Deploy |

### AI-assisted translation

LLMs produce high-quality translations for common languages and standard application text. Recommended hybrid workflow:

1. **Extract** source strings via CLI tooling
2. **First pass** -- MT or LLM translation with terminology glossary and translation memory context
3. **Human review** -- linguists review quality-critical strings (legal, marketing, error messages)
4. **Automated validation** -- check placeholder consistency, ICU syntax, character limits
5. **Deploy** -- compiled messages per locale

**When to use AI translation:**
- Internal tools, developer-facing content -- AI-only is often sufficient
- User-facing product text -- AI first pass + human review
- Legal, medical, regulated content -- human translation required, AI as assist only

TMS platforms increasingly integrate AI translation with terminology enforcement. Use context fields and screenshots to improve translation quality.

### Key management rules

- Never delete a key until confirmed unused across all platforms
- Mark deprecated keys with prefix: `_deprecated.old.key`
- Use context/description fields in TMS for translator guidance
- Set character limits where UI space is constrained (buttons, badges)
- Add screenshots to TMS for visual context

---

## Pseudo-Localization & Testing

### Pseudo-locale generation

```js
// Accent pseudo-locale: detects untranslated strings
// "Submit" → "[!!!Šũƀɱĩţ!!!]"
function pseudoLocalize(str) {
  const accents = { a: 'ā', e: 'ē', i: 'ĩ', o: 'ō', u: 'ũ', s: 'š' };
  const accented = str.replace(/[aeious]/gi, c => accents[c.toLowerCase()] || c);
  return `[!!!${accented}!!!]`;
}

// Expansion pseudo-locale: detects truncation
// "Submit" → "Šũƀɱĩţ ~~~~" (30% longer)
function pseudoExpand(str) {
  const extra = Math.ceil(str.length * 0.3);
  return pseudoLocalize(str) + ' ' + '~'.repeat(extra);
}
```

### Testing checklist

| Test | What to check |
|------|---------------|
| Pseudo-locale render | All visible text has `[!!!...]` markers |
| Expansion test | No truncation at 30-50% text expansion |
| RTL layout | Set `dir="rtl"`, check layout mirroring |
| Plurals | Test count=0, 1, 2, 5, 21 for all supported locales |
| Date/number formats | Verify locale-appropriate formatting |
| Missing keys | Fallback behavior when key not found |
| Locale switching | UI updates without page reload |
| Long words | German compound words don't break layout |

### Automated testing

```js
// Jest/Vitest — verify all keys exist in all locales
import en from './locales/en.json';
import de from './locales/de.json';

test('all English keys exist in German', () => {
  const missing = Object.keys(en).filter(k => !(k in de));
  expect(missing).toEqual([]);
});

// Verify no ICU syntax errors
import { parse } from '@formatjs/icu-messageformat-parser';

test('all messages parse as valid ICU', () => {
  Object.entries(en).forEach(([key, msg]) => {
    expect(() => parse(msg)).not.toThrow();
  });
});
```

---

## Date, Number & Duration Formatting Patterns

### Intl.DurationFormat (Baseline 2025)

```js
new Intl.DurationFormat('en', { style: 'long' })
  .format({ hours: 2, minutes: 15 })   // "2 hours, 15 minutes"

new Intl.DurationFormat('en', { style: 'digital' })
  .format({ hours: 1, minutes: 5, seconds: 3 })  // "1:05:03"
```

Styles: `long` (spelled out), `short` (abbreviated), `narrow` (minimal), `digital` (clock). Per-unit overrides via `{ hours: { style: 'short' } }`. Polyfill: `@formatjs/intl-durationformat`.

### Temporal API + Intl formatting

Temporal (shipping in Chrome, Edge, Firefox) replaces `Date` with immutable, timezone-aware types. Use `Intl.DateTimeFormat` to format Temporal objects:

```js
// Create timezone-aware datetime
const now = Temporal.Now.zonedDateTimeISO('America/New_York');

// Format with Intl
new Intl.DateTimeFormat('en-US', {
  dateStyle: 'full', timeStyle: 'short'
}).format(now);
// --> "Saturday, January 15, 2026 at 9:30 AM"

// Store as ISO 8601 instant, display in user timezone
const stored = Temporal.Instant.from('2026-01-15T14:30:00Z');
const local = stored.toZonedDateTimeISO(userTimeZone);
new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  .format(local);

// Duration arithmetic + formatted output
const start = Temporal.PlainDate.from('2026-01-01');
const end = Temporal.PlainDate.from('2026-03-15');
const diff = start.until(end, { largestUnit: 'month' });
new Intl.DurationFormat(locale, { style: 'long' }).format(diff);
// --> "2 months, 14 days"
```

**Migration from Date:** Replace `new Date()` with `Temporal.Now`. Replace manual timezone math with `Temporal.ZonedDateTime`. Use `Temporal.PlainDate` for calendar dates without time. Polyfill: `@js-temporal/polyfill` or `temporal-polyfill`.

### Timezone-safe date handling (legacy Date)

Store dates as UTC ISO 8601 strings (`2026-01-15T14:30:00Z`). Display in user's timezone with `new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: userTimeZone }).format(new Date(stored))`. Get user timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone` or user profile. Prefer Temporal API for new code.

### Currency formatting

Use `Intl.NumberFormat(locale, { style: 'currency', currency })`. For zero-decimal currencies (JPY, KRW, VND), set `minimumFractionDigits: 0`.

### Relative time display

Use `Intl.RelativeTimeFormat(locale, { numeric: 'auto' })`. Calculate diff in seconds/minutes/hours/days, then call `rtf.format(diff, unit)` with the appropriate unit.

---

## Framework Integration

### Next.js App Router i18n

Structure: `app/[locale]/layout.tsx` (IntlProvider wrapper, set `lang`/`dir` on `<html>`), `app/[locale]/page.tsx`, `middleware.ts` (redirect `/` to `/en`, detect locale from `Accept-Language`).

Middleware: check if pathname starts with a supported locale; if not, detect preferred locale from `Accept-Language` header and redirect to `/${locale}${pathname}`.

### Vue i18n setup

Use `createI18n({ locale, fallbackLocale, messages, datetimeFormats, numberFormats })`. Define per-locale `datetimeFormats` and `numberFormats` (including currency) in the config object.
