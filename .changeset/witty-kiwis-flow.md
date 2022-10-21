---
"remix": patch
"@remix-run/react": patch
---

Infer the type of the `.data` property of `useFetcher` from `loader` and `action` functions.
Similarly to how you can write useLoaderData<typeof loader>. e.g. you can now write useFetcher<typeof action>, and fetcher.data will be inferred correctly.
Previously, you had to write useFetcher<SerializeFrom<typeof action>>.
