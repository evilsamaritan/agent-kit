# FormatJS and react-intl

ICU MessageFormat-native libraries with CLI extraction. Check the installed major version first.

## Contents

- [Provider and messages](#provider-and-messages)
- [Extraction and compilation](#extraction-and-compilation)

---

## Provider and messages

```tsx
import { IntlProvider, FormattedMessage, useIntl } from 'react-intl';

// locale must come from a validated, supported list, never raw user input
const messages = (await import(`./locales/${locale}.json`)).default;

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
      <FormattedMessage id="greeting" defaultMessage="Hello, {name}!" values={{ name: 'World' }} />
      <input placeholder={intl.formatMessage({ id: 'search.placeholder', defaultMessage: 'Search...' })} />
      <FormattedMessage id="tos" defaultMessage="Agree to <link>Terms of Service</link>"
        values={{ link: (chunks) => <a href="/tos">{chunks}</a> }} />
    </>
  );
}
```

Use the imperative `formatMessage` for attributes and ARIA labels; use tags in the message for rich text rather than splicing JSX between strings.

## Extraction and compilation

```bash
npx formatjs extract 'src/**/*.tsx' --out-file lang/en.json --id-interpolation-pattern '[sha512:contenthash:base64:6]'
npx formatjs compile lang/de.json --out-file compiled/de.json
```

Content-hash IDs derive from the default message and its description, so a changed default message gets a new ID and the old translation is not reused. Add a `description` to messages that need translator context. If the team prefers semantic keys, set explicit IDs instead of the hash pattern; do not mix both styles.
