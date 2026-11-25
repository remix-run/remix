The router no longer races middleware and handlers against `request.signal`. It still stops running middleware and handlers once the request aborts, and `router.fetch()` still rejects with the abort reason, but it now waits for work already in progress to settle first. Previously `router.fetch()` and each middleware's `await next()` rejected the moment the request aborted, while the handler kept running in the background. Middleware cleanup that runs when `next()` rejects, such as rolling back a transaction, now runs after the handler finishes. Responses that arrive after the request aborted still have their bodies cancelled. Requests through async handlers and middleware are about a third faster because the router no longer adds an abort listener to every request.

Work that should stop when the client disconnects needs the signal passed to it:

```diff
  router.get(routes.search, async ({ request, url }) => {
-   let results = await fetch(searchApi(url))
+   let results = await fetch(searchApi(url), { signal: request.signal })
    return Response.json(await results.json())
  })
```

Middleware that needs a hard deadline regardless of whether downstream work observes the signal should race `next()` against its own timeout. See the [decision doc](https://github.com/remix-run/remix/blob/main/decisions/011-cooperative-request-aborts.md) for the reasoning.
