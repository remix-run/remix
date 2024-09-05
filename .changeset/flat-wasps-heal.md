---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Single Fetch - fix revalidation behavior bugs

  - With Single Fetch, existing routes revalidate by default
  - This means requests do not need special query params for granular route revalidations out of the box - i.e., `GET /a/b/c.data`
  - There are two conditions that will trigger granular revalidation:
    - If a route opts out of revalidation via `shouldRevalidate`, it will be excluded from the single fetch call
    - If a route defines a `clientLoader` then it will be excluded from the single fetch call and if you call `serverLoader()` from your `clientLoader`, that will make a separarte HTTP call for just that route loader - i.e., `GET /a/b/c.data?_routes=routes/a` for a `clientLoader` in `routes/a.tsx`
  - When one or more routes are excluded from the single fetch call, the remaining routes that have loaders are included as query params:
    - For example, if A was excluded, and the `root` route and `routes/b` had a `loader` but `routes/c` did not, the single fetch request would be `GET /a/b/c.data?_routes=root,routes/a`
