---
"@remix-run/react": patch
---

Previously, if an `action` was omitted from `<Form>` or `useFormAction`, the action value would default to `"."`. This is incorrect, as `"."` should resolve based on the current _path_, but an empty action resolves relative to the current _URL_ (including the search and hash values). We've fixed this to differentiate between the two.
