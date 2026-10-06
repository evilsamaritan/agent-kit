# JavaScript Intl and Temporal

Locale-aware formatting in JavaScript. Browser and runtime support differs per API (MDN's compatibility tables are the reference); feature-detect when support is partial.

## Contents

- [Formatters](#formatters)
- [Plural categories](#plural-categories)
- [Duration formatting](#duration-formatting)
- [Temporal](#temporal)
- [Time zones with Date](#time-zones-with-date)

---

## Formatters

```js
// Dates
new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(date);
// "15. Januar 2026"

// Currency: the currency decides fraction digits (JPY has none)
new Intl.NumberFormat('en-US', { style: 'currency', currency: 'JPY' }).format(1234);
// "¥1,234"

// Number options: roundingMode, roundingIncrement, roundingPriority,
// trailingZeroDisplay, signDisplay: 'negative'
new Intl.NumberFormat('en-IE', {
  style: 'currency', currency: 'EUR',
  trailingZeroDisplay: 'stripIfInteger',   // 20 -> "€20", 19.99 -> "€19.99"
}).format(20);

// Relative time
new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day');   // "yesterday"

// Lists
new Intl.ListFormat('en', { type: 'conjunction' }).format(['A', 'B', 'C']); // "A, B, and C"

// Locale-aware sorting
['ae', 'a', 'z'].sort(new Intl.Collator('de').compare);

// Text boundaries: words, sentences, graphemes
[...new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)];

// Display names for languages, regions, currencies
new Intl.DisplayNames('en', { type: 'region' }).of('DE');                    // "Germany"
```

Create formatters once and reuse them; construction is much more expensive than `format()`.

## Plural categories

```js
const pr = new Intl.PluralRules('pl');
pr.select(1);   // "one"
pr.select(3);   // "few"
pr.select(5);   // "many"
pr.resolvedOptions().pluralCategories;   // categories this locale uses
new Intl.PluralRules('en', { type: 'ordinal' }).select(3);   // "few" (3rd)
```

Use these categories to validate that a catalog supplies every form a language needs.

## Duration formatting

```js
new Intl.DurationFormat('en', { style: 'long' }).format({ hours: 1, minutes: 30, seconds: 15 });
// "1 hour, 30 minutes, 15 seconds"
new Intl.DurationFormat('en', { style: 'digital' }).format({ hours: 1, minutes: 5, seconds: 3 });
// "1:05:03"
```

Styles: `long`, `short` (the default), `narrow`, `digital`. Per-unit overrides: `{ hours: 'short' }`. MDN lists it as Baseline since March 2025 (Chrome 129, Firefox 136, Safari 16.4 per its compatibility data), so older targets need a polyfill (`@formatjs/intl-durationformat`).

## Temporal

Temporal replaces `Date` with immutable, time-zone-aware types. MDN does not list it as Baseline: Chrome (144) and Firefox (139) ship it, while Safari offers it only in Technology Preview. Feature-detect (`'Temporal' in globalThis`) or use a polyfill (`@js-temporal/polyfill`, `temporal-polyfill`) until every target ships it.

`Intl.DateTimeFormat.prototype.format()` does not accept `Temporal.ZonedDateTime` (it throws a `TypeError`). Use the object's own formatter, or format an instant with an explicit zone:

```js
const zdt = Temporal.Now.zonedDateTimeISO('Europe/Berlin');
zdt.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' });

// Store as an ISO 8601 instant, display in the user's zone
const stored = Temporal.Instant.from('2026-01-15T14:30:00Z');
new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: userTimeZone })
  .format(stored);
// or: stored.toZonedDateTimeISO(userTimeZone).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

// Calendar dates without time or zone
const diff = Temporal.PlainDate.from('2026-01-01').until(Temporal.PlainDate.from('2026-03-15'), { largestUnit: 'month' });
new Intl.DurationFormat(locale, { style: 'long' }).format(diff);   // "2 months, 14 days"
```

Migration from `Date`: replace manual time-zone math with `ZonedDateTime`, calendar-only values with `PlainDate`, and stored timestamps with `Instant`.

## Time zones with Date

Without Temporal, store UTC ISO 8601 strings and always pass an explicit zone:

```js
new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: userTimeZone })
  .format(new Date(stored));
```

Take the zone from the user profile, or `Intl.DateTimeFormat().resolvedOptions().timeZone` as a default. Never do offset arithmetic by hand.
