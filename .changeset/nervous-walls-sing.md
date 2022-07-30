---
"remix": patch
"@remix-run/react": patch
---

Fix inferred types for `useLoaderData` and `useActionData` to preserve `null`s. Previously, `null` types were being replaced by `never` due to usage of `NonNullable` in `UndefinedOptionals`. Properties that aren't unions with `undefined` are now kept as-is, while properties that _do_ include `undefined` are still made optional, but _only_ remove `undefined` from the property type whereas `NonNullable` also removed `null` types.
