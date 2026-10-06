# i18next

Configuration and patterns for the i18next family. Check the project's i18next major version first; key formats and options differ across majors.

## Contents

- [Configuration](#configuration)
- [Namespaces](#namespaces)
- [Plurals and context](#plurals-and-context)
- [Lazy loading](#lazy-loading)
- [ICU messages](#icu-messages)

---

## Configuration

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
    ns: ['common', 'auth', 'dashboard'],
    defaultNS: 'common',
    backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
    detection: { order: ['path', 'cookie', 'navigator'], lookupFromPathIndex: 0 },
    interpolation: {
      escapeValue: false,   // only when the renderer escapes output (React, Vue templates); keep true for raw HTML or string output
    },
  });
```

## Namespaces

```
locales/
  en/ common.json  auth.json  dashboard.json
  de/ common.json  auth.json  dashboard.json
```

Namespace by feature or page, not by component type; keep shared strings in `common`.

## Plurals and context

i18next resolves the context suffix first, then the plural suffix: `key_<context>_<plural>`.

```json
{
  "item_one": "{{count}} item",
  "item_other": "{{count}} items",
  "itemWithContext_male_one": "He has {{count}} item",
  "itemWithContext_male_other": "He has {{count}} items",
  "itemWithContext_female_one": "She has {{count}} item",
  "itemWithContext_female_other": "She has {{count}} items"
}
```

```js
t('item', { count: 5 });                                   // "5 items"
t('itemWithContext', { count: 3, context: 'female' });     // "She has 3 items" (key: itemWithContext_female_other)
```

Provide every plural category the target language needs (`_zero`, `_two`, `_few`, `_many` where applicable).

## Lazy loading

```js
const DashboardPage = lazy(async () => {
  await i18next.loadNamespaces('dashboard');
  return import('./pages/Dashboard');
});
```

## ICU messages

i18next uses its own interpolation and plural syntax by default; an ICU format plugin adds ICU MessageFormat. Choose one syntax per project so translators and tooling see a single format.
