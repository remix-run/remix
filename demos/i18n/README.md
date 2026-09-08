# Remix i18n Demo

A server-rendered i18next integration built from Remix routes, middleware, request context, and cookies. It uses i18next directly; no framework-specific i18n adapter is required.

## Run

From the repository root:

```sh
pnpm install
pnpm -C demos/i18n dev
```

Open <http://localhost:44100>. Try Arabic to see right-to-left layout and its plural forms. Increase the browser widget's value, then follow a language link: the value stays, while its translated labels and number format change.

## Language URLs and preferences

Detection follows four steps: URL locale, saved preference cookie, browser language preference (`Accept-Language`), then English. Every language has an explicit URL: `/en`, `/es`, `/fr`, `/ja`, and `/ar`.

- **“View this page in” links** change the URL without saving a preference. `run()` enhances these anchors through the browser Navigation API, preserving the document and client widget state. Unsupported browsers retain document navigation.
- **“Save preference”** stores an HTTP-only locale cookie and redirects to that language's URL using POST-redirect-GET.
- **“Clear saved preference”** deletes the cookie and returns to `/`, where browser-language detection runs again. The header logo also links to `/`.

The preference form uses `data-rmx-document` deliberately: a document submission resets unsaved selector state even when the resulting language is unchanged. Both preference actions and all language links work without JavaScript. The browser-only increment button remains disabled until hydration.

`<html lang>` and `Content-Language` reflect the selected language. `<html dir>` comes from i18next's language direction; logical CSS properties support both LTR and RTL layouts. Arabic strings use Unicode isolates around LTR code examples so paths and header names stay readable. Locale-less HTML varies by `Cookie` and `Accept-Language`; explicit locale URLs do not depend on those headers.

## Request-scoped translation

The middleware creates an i18next instance per request, fixes its translator to the selected language, and exposes `{ locale, direction, t, detectionSource }` as `context.i18n`. There is no shared mutable active language.

The page action passes this state through normal server component props. For a deeper server-rendered tree, component context can avoid threading those props through every descendant.

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

A `clientEntry(...)` is a serialized boundary. It cannot receive the request-bound `t` function or read component context from a server-only ancestor. The number preview receives only its locale and translated strings:

```tsx
<NumberPreview
  locale={locale}
  buttonLabel={t('formatting.preview_button')}
  valueLabel={t('formatting.preview_value')}
/>
```

The client entry reads its current labels from `handle.props` and formats its local number with `Intl.NumberFormat(handle.props.locale)`. Language-link navigation supplies new props without resetting that number. Neither i18next nor the translation catalogs are imported by browser modules.

Only initialize i18next in the browser when an interaction must generate arbitrary translated copy without a server response. In that case, create a shared parent client entry from serializable locale and resource data, then provide its browser-side translator to descendants through component context.

## Key files

| File                                                                                                                                   | Responsibility                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [app/routes.ts](https://github.com/remix-run/remix/blob/main/demos/i18n/app/routes.ts)                                                 | Typed routes with an optional locale segment                  |
| [app/middleware/i18n.ts](https://github.com/remix-run/remix/blob/main/demos/i18n/app/middleware/i18n.ts)                               | Detection, request isolation, direction, and response headers |
| [app/i18n/config.ts](https://github.com/remix-run/remix/blob/main/demos/i18n/app/i18n/config.ts)                                       | Supported languages, typed resources, and preference cookie   |
| [app/actions/controller.tsx](https://github.com/remix-run/remix/blob/main/demos/i18n/app/actions/controller.tsx)                       | Localized page response and preference actions                |
| [app/actions/home-page.tsx](https://github.com/remix-run/remix/blob/main/demos/i18n/app/actions/home-page.tsx)                         | Language links, pluralization, and server formatting          |
| [app/actions/public/number-preview.tsx](https://github.com/remix-run/remix/blob/main/demos/i18n/app/actions/public/number-preview.tsx) | Serialized labels, client state, and browser formatting       |
| [app/assets.ts](https://github.com/remix-run/remix/blob/main/demos/i18n/app/assets.ts)                                                 | Browser compilation and source allowlist                      |

For a larger app, keep the request-scoped state, use the locale pattern as the base for localized routes, and replace inline resources with your translation backend.

## Tests

```sh
pnpm -C demos/i18n test
pnpm -C demos/i18n typecheck
```

The tests cover negotiation, concurrent translated HTML, locale-specific plural forms, response headers, redirects, and cookies. Chromium tests exercise client-state preservation, translated label updates, LTR/RTL transitions, the same-language preference reset, and navigation with JavaScript disabled. The E2E tests use the repository's Playwright setup.
