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

- `<Deferred>`: component for resolving deferred content and rendering fallback / error states. This can be thought of as a thin wrapper around `<React.Suspense>`.
- `useDeferred()`: hook for indirectly accessing the resolved value from the `<Deferred>` component.
- `deferred()`: response helper function for creating a `text/remix-deferred` response. THis can be thought of as `json()` with support for promises as immediate values.

New Type Helpers:

- `Deferrable<T>`: type helper for defining deferrable values on your loader data. This is used to unwrap the resolved value from the `<Deferred>` component, as well as provide type safety so you don't accidentally access the value directly off of `useLoaderData()` before it has been resolved by a `<Deferred>` component.
- `ResolvedDeferrable<T>`: type helper for unwrapping the resolved type of a `Deferrable<T>`. This is used internally by the `<Deferred>` component to provide type safety for the resolved value but may also be useful for others.
