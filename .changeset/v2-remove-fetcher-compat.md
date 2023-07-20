---
"@remix-run/react": major
---

Remove back-compat layer for `useFetcher`/`useFetchers`. This includes a few small breaking changes:

- `fetcher.type` has been removed since it can be derived from other available information
- "Submission" fields have been flattened from `fetcher.submission` down onto the root `fetcher` object, and prefixed with `form` in some cases (`fetcher.submission.action` => `fetcher.formAction`)
- `<fetcher.Form method="get">` is now more accurately categorized as `state:"loading"` instead of `state:"submitting"` to better align with the underlying GET request
