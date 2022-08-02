---
"@remix-run/cloudflare": minor
"@remix-run/deferred": minor
"@remix-run/deno": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
---

Introduces the deferred API to give more control over TTFB/CLS tradeoffs.

New Packages:

- `@remix-run/deferred`: implementation of parser / serializer for the `text/remix-deferred` content type.

New APIs:

- `<Await>`: component for resolving deferred content and rendering error states. This can be thought of as a thin wrapper around React Error Boundaries with support for handling SSR that resolves the data of a deferred loader value.
- `useAsyncValue()`: hook for indirectly accessing the resolved value from the `<Await>` component.
- `defer()`: response helper function for creating a `text/remix-deferred` response. THis can be thought of as `json()` with support for promises as immediate values.
