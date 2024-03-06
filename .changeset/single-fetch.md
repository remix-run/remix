---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
"@remix-run/testing": minor
---

New `future.unstable_singleFetch` flag

- Naked objects returned from loaders/actions are no longer automatically converted to JSON responses.  They'll be streamed as-is via `turbo-stream` so `Date`'s will become `Date` through `useLoaderData()`
- You can return naked objects with `Promise`'s without needing to use `defer()` - including nested `Promise`'s
- `<RemixServer abortDelay>` is no longer used.  Instead, you should `export const streamTimeout` from `entry.server.tsx` and the remix server runtime will use that as the delay to abort the streamed response.
- Actions no longer automatically revalidate on 4xx/5xx responses (via RR `future.unstable_skipActionErrorRevalidation` flag) - you can return a 2xx to opt-into revalidation or use `shouldRevalidate`
-