# Remix i18n Demo

A server-rendered i18next integration built from Remix routes, middleware, request context, and cookies. It uses i18next directly; no framework-specific i18n adapter is required.

## What it demonstrates

- **Localized routes:** `/:locale` produces stable, explicit URLs for every supported language: `/en`, `/es`, `/fr`, and `/ja`. The locale-less `/` entry uses request preferences.
- **Request isolation:** `app/middleware/i18n.ts` creates one i18next instance per request, so concurrent requests cannot change each other's language.
- **Typed request context:** route middleware stores the locale and fixed `t` function with `context.set(...)`; the page action receives them as `context.i18n` and passes them explicitly to the page component.
- **Language detection:** URL locale, saved preference cookie, browser language preference (`Accept-Language`), then the `en` fallback.
- **Progressive enhancement:** the language form works without browser JavaScript, saves or clears the preference, and redirects using POST-redirect-GET.
- **Client navigation:** `run()` enhances the same anchors and form through the browser Navigation API, updating the top frame without replacing the document. Unsupported browsers retain normal document navigation.
- **Localized responses:** `<html lang>` and `Content-Language` reflect the selected language. Locale-less responses vary by `Cookie` and `Accept-Language`; locale-prefixed responses have a stable representation.
- **Translation safety:** locale files must match the English resource shape, and i18next keys are checked by TypeScript.
- **Web-standard formatting:** `Intl` formats dates, numbers, a USD business value, and relative time. The language controls presentation; it does not choose the currency.

The URL locale takes priority over request preferences. Language links and preference submissions use explicit localized URLs, including `/en`. The header logo links to `/`, where the saved cookie, browser-provided `Accept-Language` header, or configured fallback selects the language. Clearing the saved preference returns to `/` so browser-language detection runs again.

## Server and browser translation boundaries

Keep language detection and i18next request-scoped on the server. Pass `{ locale, t, detectionSource }` through normal component props while the tree is shallow; use Remix component context when many server-rendered descendants need the same state.

A `clientEntry(...)` is a serialized browser boundary and cannot read component context from a server-only ancestor. Pass each client entry only the translated labels or messages it renders, plus `locale` when it uses `Intl`. Pass `detectionSource` only to client-side diagnostics that display it. The request-bound `t` function is not serializable and should not cross the boundary.

Only initialize i18next in the browser when an interaction must generate arbitrary translated copy without a server response. In that case, create one shared parent client entry from serializable locale and resource data, then provide its browser-side translator to descendants through component context.

## Key files

| File                          | Responsibility                                               |
| ----------------------------- | ------------------------------------------------------------ |
| `app/routes.ts`               | Typed routes with an optional locale path segment            |
| `app/assets.ts`               | Browser asset compilation and client entry URLs              |
| `app/actions/public/entry.ts` | Remix UI runtime and Navigation API enhancement              |
| `app/i18n/config.ts`          | Supported languages, typed resources, language cookie        |
| `app/middleware/i18n.ts`      | Detection, request-scoped setup, localized response headers  |
| `app/actions/controller.tsx`  | Localized page response and language preference action       |
| `app/actions/home-page.tsx`   | Route-generated locale links, translation, and `Intl`        |
| `app/router.test.ts`          | Full request, response header, redirect, and cookie behavior |

For a larger app, keep the request-scoped state, use the locale pattern as the base for all localized routes, and replace inline resources with your translation backend.

## Run

From the repository root:

```sh
pnpm install
pnpm -C demos/i18n dev
```

Open <http://localhost:44100>.

```sh
pnpm -C demos/i18n test
pnpm -C demos/i18n typecheck
```
