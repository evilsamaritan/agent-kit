# Framework Integration

Routing and provider wiring for common JavaScript frameworks. The APIs below follow the framework's major version, so read it from the manifest.

## Next.js App Router

Structure: `app/[locale]/layout.tsx` (provider, `lang` and `dir` on `<html>`), `app/[locale]/page.tsx`, and a request interception layer that resolves the locale. That layer is `proxy.ts` in Next.js 16 and later (`middleware.ts` in earlier versions, now deprecated).

The interception layer checks whether the path starts with a supported locale; if not, it negotiates a locale (stored preference, then `Accept-Language`) and redirects to `/${locale}${pathname}`. `params` is a Promise (since Next.js 15; synchronous access was removed in 16): `const { locale } = await params`. Validate `locale` against the supported list before loading a catalog. Generate `alternates.languages` in metadata for hreflang (owned by `seo`).

## Vue

Use `createI18n({ locale, fallbackLocale, messages, datetimeFormats, numberFormats })`. Define per-locale `datetimeFormats` and `numberFormats` (including currency) in the config, and set `legacy: false` for Composition API mode (the default is legacy mode, which vue-i18n marks deprecated and slates for removal in v12); use one mode across the app. Sync `document.documentElement.lang` and `dir` when the locale changes.
