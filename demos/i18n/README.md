# Remix i18n Demo

A server-rendered i18next integration built from Remix routes, middleware, request context, and cookies. It uses i18next directly; no framework-specific i18n adapter is required.

## Run

From the repository root:

```sh
pnpm install
pnpm -C demos/i18n dev
```

Open <http://localhost:44100>. Change the cart quantity to see i18next select plural forms without a request. Switch to Arabic and try zero, one, two, few, many, and other counts.

## Language URLs and preferences

Detection checks the URL locale, then the saved preference cookie, then the browser language preference (`Accept-Language`), defaulting to English when none match. Every language has an explicit URL: `/en`, `/es`, `/fr`, `/ja`, and `/ar`.

- **“View this page in” links** change the URL without saving a preference. They use `data-rmx-document`, so every language switch requests and loads a complete localized document.
- **“Save preference”** stores an HTTP-only locale cookie and redirects to that language's URL using POST-redirect-GET.
- **“Clear saved preference”** deletes the cookie and returns to `/`, where browser-language detection runs again. The header logo also links to `/`.

All language-changing links and forms use `data-rmx-document`. Each switch starts with fresh browser component state and works without JavaScript. Browser-only controls remain disabled until hydration.

`<html lang>` and `Content-Language` reflect the selected language. `<html dir>` comes from i18next's language direction; logical CSS properties support both LTR and RTL layouts. Arabic strings use Unicode isolates around LTR code examples so paths and header names stay readable. Locale-less HTML varies by `Cookie` and `Accept-Language`; explicit locale URLs do not depend on those headers.

## Request-scoped translation

The middleware creates an i18next instance per request, fixes its translator to the selected language, and exposes `{ locale, direction, t, detectionSource }` as `context.i18n`. There is no shared mutable active language.

The page action places that state in an `I18nProvider`. Server-rendered descendants read it through component context instead of threading translator props through the tree. The demo extends the fixed translator with `t.get(path)`, which returns raw data from the active catalog. `t.get('pluralization')` returns that section's object; dotted paths such as `t.get('pluralization.cart_demo.title')` return deeper values. Both forms are type-checked against the catalog.

Translation keys are checked by TypeScript, but plural suffixes are language-specific. Each catalog declares its categories through `Translation<...>` rather than copying English's plural keys:

| Language        | Plural categories                            |
| --------------- | -------------------------------------------- |
| English         | `one`, `other`                               |
| Spanish, French | `one`, `many`, `other`                       |
| Japanese        | `other`                                      |
| Arabic          | `zero`, `one`, `two`, `few`, `many`, `other` |

All catalogs also provide i18next's `_zero` override for zero-count messages. `Intl.PluralRules(locale).resolvedOptions().pluralCategories` lists a language's categories. The page includes counts that exercise Arabic's categories and the French/Spanish million-count case; missing those forms would otherwise fall back to English.

`Intl` formats dates, numbers, a USD business value, and relative time. Language controls presentation, not the currency or time zone: this demo explicitly uses USD and UTC.

## Server and browser translation boundaries

A `clientEntry(...)` is a serialized boundary. It cannot receive the request-bound `t` function or inherit component context from a server-only ancestor. The number preview receives only its locale and translated strings:

```tsx
<NumberPreview
  locale={locale}
  buttonLabel={t('formatting.preview_button')}
  valueLabel={t('formatting.preview_value')}
/>
```

The number preview reads its labels from `handle.props` and formats its local number with `Intl.NumberFormat(handle.props.locale)`. A language switch loads a new document and creates a new preview instance.

The cart needs to translate arbitrary counts without a server response, so its client boundary receives the locale and one serializable catalog subtree:

```tsx
<CartPreview locale={locale} translations={t.get('pluralization')} />
```

`CartPreview` creates one browser-side i18next instance from that subtree and places its mutable cart state and translator in component context. Event handlers mutate that shared state and call `handle.update()`; the heading, quantity control, and summary consume it without prop drilling. The server provider and browser provider are separate because context does not cross the serialized client-entry boundary. Full-document language switches create a fresh cart and translator, so the client does not need to synchronize translator props across navigations.

## Key files

| File                                                                                                                                   | Responsibility                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [app/routes.ts](https://github.com/remix-run/remix/blob/main/demos/i18n/app/routes.ts)                                                 | Typed routes with an optional locale segment                  |
| [app/middleware/i18n.ts](https://github.com/remix-run/remix/blob/main/demos/i18n/app/middleware/i18n.ts)                               | Detection, request isolation, direction, and response headers |
| [app/i18n/config.ts](https://github.com/remix-run/remix/blob/main/demos/i18n/app/i18n/config.ts)                                       | Supported languages, typed resources, and preference cookie   |
| [app/actions/controller.tsx](https://github.com/remix-run/remix/blob/main/demos/i18n/app/actions/controller.tsx)                       | Localized page response and preference actions                |
| [app/actions/home-page.tsx](https://github.com/remix-run/remix/blob/main/demos/i18n/app/actions/home-page.tsx)                         | Language links, pluralization, and server formatting          |
| [app/ui/i18n.tsx](https://github.com/remix-run/remix/blob/main/demos/i18n/app/ui/i18n.tsx)                                             | Request-scoped server component context                       |
| [app/actions/public/cart-preview.tsx](https://github.com/remix-run/remix/blob/main/demos/i18n/app/actions/public/cart-preview.tsx)     | Browser translator and cart component context                 |
| [app/actions/public/number-preview.tsx](https://github.com/remix-run/remix/blob/main/demos/i18n/app/actions/public/number-preview.tsx) | Serialized labels, client state, and browser formatting       |
| [app/assets.ts](https://github.com/remix-run/remix/blob/main/demos/i18n/app/assets.ts)                                                 | Browser compilation and source allowlist                      |

For a larger app, keep the request-scoped state, use the locale pattern as the base for localized routes, and replace inline resources with your translation backend.

## Tests

```sh
pnpm -C demos/i18n test
pnpm -C demos/i18n typecheck
```

The tests cover negotiation, concurrent translated HTML, locale-specific plural forms, response headers, redirects, and cookies. Chromium tests exercise browser-side pluralization, full-document language switches, LTR/RTL transitions, reset client state, and navigation without JavaScript. The E2E tests use the repository's Playwright setup.
